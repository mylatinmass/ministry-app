const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const { hashInvitationToken } = require("./helper/ministry-invitations")
const { queueKlaviyoProfileSync } = require("./helper/klaviyo-profile-sync")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
})

const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}")
  } catch (error) {
    return null
  }
}

const loadInvitation = async (client, token, forUpdate = false) => {
  const result = await client.query(
    `
      SELECT invitation.id, invitation.child_user_id,
        invitation.invited_by_guardian_user_id, invitation.invitee_email,
        invitation.status, invitation.expires_at,
        child.first_name AS child_first_name,
        child.last_name AS child_last_name,
        inviter.first_name AS inviter_first_name,
        inviter.last_name AS inviter_last_name,
        invitee.id AS invitee_user_id,
        invitee.first_name AS invitee_first_name
      FROM managed_profile_link_invitations invitation
      JOIN users child ON child.id = invitation.child_user_id
      JOIN users inviter ON inviter.id = invitation.invited_by_guardian_user_id
      LEFT JOIN users invitee
        ON lower(btrim(invitee.email)) = lower(btrim(invitation.invitee_email))
       AND invitee.status = 'active'
      WHERE invitation.token_hash = $1
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [hashInvitationToken(token)]
  )
  return result.rows[0] || null
}

const audit = (client, actorId, subjectId, action, entityId) =>
  client.query(
    `
      INSERT INTO managed_profile_audit (
        actor_user_id, subject_user_id, action, entity_type, entity_id
      ) VALUES ($1, $2, $3, 'managed_profile_link_invitation', $4)
    `,
    [actorId, subjectId, action, entityId]
  )

const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { message: "Method not allowed" })
  }
  const body = parseBody(event)
  if (!body?.token) return jsonResponse(400, { message: "Invitation token is required" })
  if (!["inspect", "accept", "decline"].includes(body.action)) {
    return jsonResponse(400, { message: "Unknown invitation action" })
  }

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  if (!connectionString) {
    return jsonResponse(500, { message: "Profile invitations are not configured" })
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const invitation = await loadInvitation(client, body.token)
    if (!invitation) return jsonResponse(404, { message: "Invitation not found" })
    const expired = new Date(invitation.expires_at).getTime() <= Date.now()

    if (body.action === "inspect") {
      return jsonResponse(200, {
        invitation: {
          childName: [invitation.child_first_name, invitation.child_last_name]
            .filter(Boolean)
            .join(" "),
          invitedByName: [invitation.inviter_first_name, invitation.inviter_last_name]
            .filter(Boolean)
            .join(" "),
          guardianFirstName: invitation.invitee_first_name || "Guardian",
          status: invitation.status,
          expired,
          expiresAt: invitation.expires_at,
          accountAvailable: Boolean(invitation.invitee_user_id),
        },
      })
    }

    if (invitation.status !== "pending") {
      return jsonResponse(409, { message: "This invitation was already answered" })
    }
    if (expired) return jsonResponse(410, { message: "This invitation has expired" })
    if (!invitation.invitee_user_id) {
      return jsonResponse(409, {
        message: "The invited Ministry account is no longer available",
      })
    }

    await client.query("BEGIN")
    try {
      const locked = await loadInvitation(client, body.token, true)
      if (
        !locked ||
        locked.status !== "pending" ||
        new Date(locked.expires_at).getTime() <= Date.now()
      ) {
        await client.query("ROLLBACK")
        return jsonResponse(409, { message: "This invitation is no longer available" })
      }
      if (!locked.invitee_user_id) {
        await client.query("ROLLBACK")
        return jsonResponse(409, { message: "The invited Ministry account is no longer available" })
      }

      if (body.action === "decline") {
        await client.query(
          `UPDATE managed_profile_link_invitations SET status = 'declined', responded_at = now(), updated_at = now() WHERE id = $1`,
          [locked.id]
        )
        await audit(
          client,
          locked.invitee_user_id,
          locked.child_user_id,
          "guardian_link.declined",
          locked.id
        )
        await client.query("COMMIT")
        return jsonResponse(200, { success: true, status: "declined", message: "Invitation declined" })
      }

      const existingResult = await client.query(
        `
          SELECT id
          FROM managed_profiles
          WHERE guardian_user_id = $1 AND child_user_id = $2
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [locked.invitee_user_id, locked.child_user_id]
      )
      let relationshipId
      if (existingResult.rowCount) {
        relationshipId = existingResult.rows[0].id
        await client.query(
          `UPDATE managed_profiles SET status = 'active', ended_at = NULL, updated_at = now() WHERE id = $1`,
          [relationshipId]
        )
      } else {
        const relationshipResult = await client.query(
          `INSERT INTO managed_profiles (guardian_user_id, child_user_id) VALUES ($1, $2) RETURNING id`,
          [locked.invitee_user_id, locked.child_user_id]
        )
        relationshipId = relationshipResult.rows[0].id
      }
      await client.query(
        `
          UPDATE managed_profile_link_invitations
          SET status = 'accepted', accepted_guardian_user_id = $1,
            responded_at = now(), updated_at = now()
          WHERE id = $2
        `,
        [locked.invitee_user_id, locked.id]
      )
      await audit(
        client,
        locked.invitee_user_id,
        locked.child_user_id,
        "guardian_link.accepted",
        locked.id
      )
      await queueKlaviyoProfileSync(client, locked.child_user_id)
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        status: "accepted",
        relationshipId,
        message: "Child profile linked to your account",
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  } catch (error) {
    console.error("Unable to answer guardian profile invitation:", error)
    if (error.code === "23505") {
      return jsonResponse(409, { message: "This child is already linked to that guardian" })
    }
    return jsonResponse(500, { message: "Unable to answer this profile invitation" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
