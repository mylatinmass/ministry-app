const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const { hashInvitationToken } = require("./helper/ministry-invitations")

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

const loadResponseContext = async (client, token) => {
  if (!token || token.length < 32) return null
  const result = await client.query(
    `
      SELECT
        recipient.request_id,
        recipient.reviewer_user_id,
        recipient.expires_at,
        request.child_user_id,
        request.ministry_id,
        request.status,
        request.reviewed_at,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name,
        child.first_name AS child_first_name,
        child.last_name AS child_last_name,
        guardian.first_name AS guardian_first_name,
        guardian.last_name AS guardian_last_name,
        ministry.name AS ministry_name,
        decided_by.first_name AS decided_first_name,
        decided_by.last_name AS decided_last_name
      FROM managed_profile_membership_request_recipients recipient
      JOIN managed_profile_membership_requests request ON request.id = recipient.request_id
      JOIN users reviewer ON reviewer.id = recipient.reviewer_user_id
      JOIN users child ON child.id = request.child_user_id
      JOIN users guardian ON guardian.id = request.guardian_user_id
      JOIN ministries ministry ON ministry.id = request.ministry_id
      LEFT JOIN users decided_by ON decided_by.id = request.reviewed_by
      WHERE recipient.token_hash = $1
      LIMIT 1
    `,
    [hashInvitationToken(token)]
  )
  return result.rows[0] || null
}

const toPublicRequest = (row) => ({
  reviewerName: [row.reviewer_first_name, row.reviewer_last_name].filter(Boolean).join(" "),
  childName: [row.child_first_name, row.child_last_name].filter(Boolean).join(" "),
  guardianName: [row.guardian_first_name, row.guardian_last_name].filter(Boolean).join(" "),
  ministryName: row.ministry_name,
  status: row.status,
  expired: new Date(row.expires_at).getTime() <= Date.now(),
  expiresAt: row.expires_at,
  reviewedAt: row.reviewed_at,
  reviewedBy: [row.decided_first_name, row.decided_last_name].filter(Boolean).join(" ") || null,
})

const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { message: "Method not allowed" })
  const body = parseBody(event)
  if (!body?.token) return jsonResponse(400, { message: "Request token is required" })
  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  if (!connectionString) return jsonResponse(500, { message: "Membership requests are not configured" })

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const context = await loadResponseContext(client, body.token)
    if (!context) return jsonResponse(404, { message: "Membership request not found" })
    if (body.action === "inspect") {
      return jsonResponse(200, { request: toPublicRequest(context) })
    }
    if (!["accept", "decline"].includes(body.action)) {
      return jsonResponse(400, { message: "Choose accept or decline" })
    }
    if (new Date(context.expires_at).getTime() <= Date.now()) {
      return jsonResponse(410, { message: "This review link has expired" })
    }

    await client.query("BEGIN")
    try {
      const lockedResult = await client.query(
        `
          SELECT id, child_user_id, ministry_id, status, reviewed_by
          FROM managed_profile_membership_requests
          WHERE id = $1
          FOR UPDATE
        `,
        [context.request_id]
      )
      const request = lockedResult.rows[0]
      if (!request || request.status !== "pending") {
        await client.query("ROLLBACK")
        const latest = await loadResponseContext(client, body.token)
        return jsonResponse(409, {
          message: `This request was already ${latest?.status || "answered"}`,
          request: latest ? toPublicRequest(latest) : null,
        })
      }
      if (body.action === "accept") {
        await client.query(
          `
            INSERT INTO ministry_members (
              ministry_id, user_id, level, status, can_serve, joined_at, updated_at
            ) VALUES ($1, $2, 'member', 'active', true, now(), now())
            ON CONFLICT (ministry_id, user_id)
            DO UPDATE SET level = 'member', status = 'active', can_serve = true, updated_at = now()
          `,
          [request.ministry_id, request.child_user_id]
        )
      }
      const status = body.action === "accept" ? "approved" : "declined"
      await client.query(
        `
          UPDATE managed_profile_membership_requests
          SET status = $1, reviewed_by = $2, reviewed_at = now(), updated_at = now()
          WHERE id = $3
        `,
        [status, context.reviewer_user_id, request.id]
      )
      await client.query(
        `
          INSERT INTO managed_profile_audit (
            actor_user_id, subject_user_id, action, entity_type, entity_id
          ) VALUES ($1, $2, $3, 'ministry', $4)
        `,
        [
          context.reviewer_user_id,
          request.child_user_id,
          status === "approved" ? "membership.approved" : "membership.declined",
          request.ministry_id,
        ]
      )
      await client.query("COMMIT")
      const updated = await loadResponseContext(client, body.token)
      return jsonResponse(200, {
        success: true,
        status,
        message: status === "approved" ? "Membership approved" : "Membership request declined",
        request: toPublicRequest(updated),
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  } catch (error) {
    console.error("Unable to answer child membership request:", error)
    return jsonResponse(500, { message: "Unable to answer this membership request" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
