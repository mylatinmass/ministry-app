const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  getMinistryIdentityContext,
  getMinistryTokenPayload,
} = require("./helper/ministry-auth")
const {
  INVITATION_LIFETIME_DAYS,
  buildInvitationUrl,
  createInvitationToken,
  hashInvitationToken,
  isValidEmail,
  normalizeEmail,
} = require("./helper/ministry-invitations")
const {
  sendMinistryInvitationEmail,
} = require("./helper/ministry-invitation-email")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}")
  } catch (error) {
    return null
  }
}

const isGlobalManager = (user) =>
  ["owner", "super_admin"].includes(user.global_role)

const getManagedMinistries = async (client, user) => {
  const result = isGlobalManager(user)
    ? await client.query(
        `SELECT id, name, slug FROM ministries WHERE status = 'active' ORDER BY name`
      )
    : await client.query(
        `
          SELECT m.id, m.name, m.slug
          FROM ministry_members mm
          JOIN ministries m ON m.id = mm.ministry_id
          WHERE mm.user_id = $1
            AND mm.status = 'active'
            AND mm.level IN ('owner', 'admin')
            AND m.status = 'active'
          ORDER BY m.name
        `,
        [user.id]
      )

  return result.rows
}

const canManageMinistry = (managedMinistries, ministryId) =>
  managedMinistries.some((ministry) => ministry.id === ministryId)

const listMembers = async (client, user, ministryId) => {
  const managedMinistries = await getManagedMinistries(client, user)

  if (!canManageMinistry(managedMinistries, ministryId)) {
    const membershipResult = await client.query(
      `
        SELECT 1
        FROM ministry_members
        WHERE ministry_id = $1 AND user_id = $2 AND status = 'active'
        LIMIT 1
      `,
      [ministryId, user.id]
    )
    if (!membershipResult.rowCount) {
      return jsonResponse(403, { message: "You cannot access this ministry" })
    }
    return jsonResponse(200, {
      canManage: false,
      canManageAll: false,
      ministries: [],
      members: [],
      invitations: [],
    })
  }

  const [membersResult, invitationsResult, requestsResult] = await Promise.all([
    client.query(
      `
        SELECT
          mm.id,
          u.id AS user_id,
          u.first_name,
          u.last_name,
          u.email,
          u.username,
          mm.level,
          mm.status,
          mm.can_serve,
          mm.joined_at
        FROM ministry_members mm
        JOIN users u ON u.id = mm.user_id
        WHERE mm.ministry_id = $1
          AND mm.status = 'active'
        ORDER BY
          CASE mm.level WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
          lower(u.last_name),
          lower(u.first_name)
      `,
      [ministryId]
    ),
    client.query(
      `
        SELECT
          invitation.id,
          invitation.email,
          invitation.status,
          invitation.expires_at,
          invitation.created_at,
          array_agg(m.name ORDER BY m.name) AS ministry_names
        FROM ministry_invitations invitation
        JOIN ministry_invitation_items item
          ON item.invitation_id = invitation.id
        JOIN ministries m ON m.id = item.ministry_id
        WHERE EXISTS (
          SELECT 1
          FROM ministry_invitation_items selected_item
          WHERE selected_item.invitation_id = invitation.id
            AND selected_item.ministry_id = $1
        )
          AND invitation.status = 'pending'
          AND invitation.expires_at > now()
        GROUP BY invitation.id
        ORDER BY invitation.created_at DESC
      `,
      [ministryId]
    ),
    client.query(
      `
        SELECT request.id, request.child_user_id, request.guardian_user_id,
          child.first_name, child.last_name,
          guardian.first_name AS guardian_first_name,
          guardian.last_name AS guardian_last_name,
          request.requested_at
        FROM managed_profile_membership_requests request
        JOIN users child ON child.id = request.child_user_id
        JOIN users guardian ON guardian.id = request.guardian_user_id
        WHERE request.ministry_id = $1 AND request.status = 'pending'
        ORDER BY request.requested_at
      `,
      [ministryId]
    ),
  ])

  return jsonResponse(200, {
    canManage: true,
    canManageAll: isGlobalManager(user),
    ministries: managedMinistries,
    members: membersResult.rows.map((member) => ({
      id: member.id,
      userId: member.user_id,
      firstName: member.first_name,
      lastName: member.last_name,
      email: member.email,
      username: member.username,
      level: member.level,
      status: member.status,
      canServe: member.can_serve,
      joinedAt: member.joined_at,
    })),
    invitations: invitationsResult.rows.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
      ministryNames: invitation.ministry_names,
    })),
    membershipRequests: requestsResult.rows.map((request) => ({
      id: request.id,
      profileId: request.child_user_id,
      firstName: request.first_name,
      lastName: request.last_name,
      guardianName: [request.guardian_first_name, request.guardian_last_name]
        .filter(Boolean)
        .join(" "),
      requestedAt: request.requested_at,
    })),
  })
}

const createInvitation = async (client, event, user, managedMinistries, body) => {
  const email = normalizeEmail(body.email)
  const requestedIds = Array.from(
    new Set(
      (Array.isArray(body.ministryIds) ? body.ministryIds : [])
        .map((id) => id?.toString())
        .filter(Boolean)
    )
  )

  if (!isValidEmail(email)) {
    return jsonResponse(400, { message: "Enter a valid email address" })
  }
  if (!requestedIds.length) {
    return jsonResponse(400, { message: "Select at least one ministry" })
  }
  if (requestedIds.some((id) => !canManageMinistry(managedMinistries, id))) {
    return jsonResponse(403, { message: "You cannot invite to one or more selected ministries" })
  }

  const selectedMinistries = managedMinistries.filter((ministry) =>
    requestedIds.includes(ministry.id)
  )
  const userResult = await client.query(
    `
      SELECT id, username, password_hash, status
      FROM users
      WHERE lower(btrim(email)) = $1
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        CASE WHEN username IS NOT NULL AND password_hash IS NOT NULL THEN 0 ELSE 1 END,
        created_at
      LIMIT 1
    `,
    [email]
  )
  const existingUser = userResult.rows[0] || null
  if (existingUser?.status === "inactive") {
    return jsonResponse(409, {
      message: "This account is inactive and cannot be invited",
    })
  }
  const activeResult = existingUser
    ? await client.query(
        `
          SELECT ministry_id
          FROM ministry_members
          WHERE user_id = $1
            AND ministry_id = ANY($2::UUID[])
            AND status = 'active'
        `,
        [existingUser.id, requestedIds]
      )
    : { rows: [] }
  const activeIds = new Set(activeResult.rows.map((row) => row.ministry_id))
  const invitationMinistries = selectedMinistries.filter(
    (ministry) => !activeIds.has(ministry.id)
  )

  if (!invitationMinistries.length) {
    return jsonResponse(409, {
      message: "This person is already an active member of every selected ministry",
    })
  }

  const invitationIds = invitationMinistries.map((ministry) => ministry.id)
  const pendingResult = await client.query(
    `
      SELECT DISTINCT m.name
      FROM ministry_invitations invitation
      JOIN ministry_invitation_items item
        ON item.invitation_id = invitation.id
      JOIN ministries m ON m.id = item.ministry_id
      WHERE lower(invitation.email) = $1
        AND invitation.status = 'pending'
        AND invitation.expires_at > now()
        AND item.ministry_id = ANY($2::UUID[])
      ORDER BY m.name
    `,
    [email, invitationIds]
  )

  if (pendingResult.rowCount) {
    return jsonResponse(409, {
      message: `An active invitation already exists for ${pendingResult.rows
        .map((row) => row.name)
        .join(", ")}`,
    })
  }

  const token = createInvitationToken()
  const expiresAt = new Date(
    Date.now() + INVITATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000
  )
  let invitationId

  await client.query("BEGIN")
  try {
    const invitationResult = await client.query(
      `
        INSERT INTO ministry_invitations (
          email, invited_user_id, token_hash, requested_by, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        email,
        existingUser?.id || null,
        hashInvitationToken(token),
        user.id,
        expiresAt,
      ]
    )
    invitationId = invitationResult.rows[0].id

    for (const ministry of invitationMinistries) {
      await client.query(
        `
          INSERT INTO ministry_invitation_items (invitation_id, ministry_id)
          VALUES ($1, $2)
        `,
        [invitationId, ministry.id]
      )
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }

  try {
    await sendMinistryInvitationEmail({
      email,
      ministries: invitationMinistries,
      acceptUrl: buildInvitationUrl(event, token, "accept"),
      declineUrl: buildInvitationUrl(event, token, "decline"),
      expiresAt,
    })
  } catch (error) {
    await client.query(
      `
        UPDATE ministry_invitations
        SET status = 'revoked', responded_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'pending'
      `,
      [invitationId]
    )
    throw error
  }

  return jsonResponse(201, {
    success: true,
    message: `Invitation emailed for ${invitationMinistries.length} ${
      invitationMinistries.length === 1 ? "ministry" : "ministries"
    }`,
    skippedMinistries: selectedMinistries
      .filter((ministry) => activeIds.has(ministry.id))
      .map((ministry) => ministry.name),
  })
}

const updateMembership = async (
  client,
  user,
  actor,
  managedMinistries,
  body
) => {
  const ministryId = body.ministryId?.toString()
  const targetUserId = body.userId?.toString()
  const action = body.action?.toString()

  if (!ministryId || !action) {
    return jsonResponse(400, { message: "Membership action is incomplete" })
  }

  if (["approve_request", "decline_request"].includes(action)) {
    if (!canManageMinistry(managedMinistries, ministryId)) {
      return jsonResponse(403, { message: "You cannot manage this ministry" })
    }
    const requestId = body.requestId?.toString()
    if (!requestId) return jsonResponse(400, { message: "Membership request is required" })
    await client.query("BEGIN")
    try {
      const requestResult = await client.query(
        `
          SELECT id, child_user_id
          FROM managed_profile_membership_requests
          WHERE id = $1 AND ministry_id = $2 AND status = 'pending'
          FOR UPDATE
        `,
        [requestId, ministryId]
      )
      if (!requestResult.rowCount) {
        await client.query("ROLLBACK")
        return jsonResponse(404, { message: "Membership request not found" })
      }
      const request = requestResult.rows[0]
      if (action === "approve_request") {
        await client.query(
          `
            INSERT INTO ministry_members (
              ministry_id, user_id, level, status, can_serve, joined_at, updated_at
            ) VALUES ($1, $2, 'member', 'active', true, now(), now())
            ON CONFLICT (ministry_id, user_id)
            DO UPDATE SET level = 'member', status = 'active', can_serve = true, updated_at = now()
          `,
          [ministryId, request.child_user_id]
        )
      }
      await client.query(
        `
          UPDATE managed_profile_membership_requests
          SET status = $1, reviewed_by = $2, reviewed_at = now(), updated_at = now()
          WHERE id = $3
        `,
        [action === "approve_request" ? "approved" : "declined", actor.id, requestId]
      )
      await client.query(
        `
          INSERT INTO managed_profile_audit (
            actor_user_id, subject_user_id, action, entity_type, entity_id
          ) VALUES ($1, $2, $3, 'ministry', $4)
        `,
        [
          actor.id,
          request.child_user_id,
          action === "approve_request" ? "membership.approved" : "membership.declined",
          ministryId,
        ]
      )
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        message: action === "approve_request" ? "Child membership approved" : "Membership request declined",
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  }

  if (!targetUserId) {
    return jsonResponse(400, { message: "Member is required" })
  }

  const isLeaving = action === "leave" && targetUserId === user.id
  if (!isLeaving && !canManageMinistry(managedMinistries, ministryId)) {
    return jsonResponse(403, { message: "You cannot manage this ministry" })
  }

  if (action === "set_role") {
    const level = body.level === "admin" ? "admin" : "member"
    const result = await client.query(
      `
        UPDATE ministry_members
        SET level = $1, updated_at = now()
        WHERE ministry_id = $2
          AND user_id = $3
          AND status = 'active'
          AND level <> 'owner'
        RETURNING id
      `,
      [level, ministryId, targetUserId]
    )
    if (!result.rowCount) return jsonResponse(404, { message: "Member not found" })
    return jsonResponse(200, {
      success: true,
      message: level === "admin" ? "Member assigned as Leader" : "Member role updated",
    })
  }

  if (action === "remove" || isLeaving) {
    const result = await client.query(
      `
        UPDATE ministry_members
        SET status = 'inactive', updated_at = now()
        WHERE ministry_id = $1
          AND user_id = $2
          AND status = 'active'
          AND (level <> 'owner' OR $3 = true)
        RETURNING id
      `,
      [ministryId, targetUserId, isLeaving]
    )
    if (!result.rowCount) return jsonResponse(404, { message: "Member not found" })
    if (actor.id !== user.id && isLeaving) {
      await client.query(
        `
          INSERT INTO managed_profile_audit (
            actor_user_id, subject_user_id, action, entity_type, entity_id
          ) VALUES ($1, $2, 'membership.left', 'ministry', $3)
        `,
        [actor.id, user.id, ministryId]
      )
    }
    return jsonResponse(200, {
      success: true,
      message: isLeaving ? "You left the ministry" : "Member removed from ministry",
    })
  }

  return jsonResponse(400, { message: "Unknown membership action" })
}

const handler = async (event) => {
  if (!["GET", "POST", "PATCH"].includes(event.httpMethod)) {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, { message: "Ministry membership is not configured" })
  }

  let payload
  try {
    payload = getMinistryTokenPayload(event, jwtSecret)
  } catch (error) {
    return jsonResponse(401, { message: "Session expired" })
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    const context = await getMinistryIdentityContext(client, payload)
    if (!context) return jsonResponse(401, { message: "Ministry access is inactive" })
    const user = context.user

    if (event.httpMethod === "GET") {
      const ministryId = event.queryStringParameters?.ministryId?.toString()
      if (!ministryId) return jsonResponse(400, { message: "Ministry is required" })
      return await listMembers(client, user, ministryId)
    }

    const body = parseBody(event)
    if (!body) return jsonResponse(400, { message: "Invalid request" })
    const managedMinistries = await getManagedMinistries(client, user)

    if (event.httpMethod === "POST") {
      return await createInvitation(client, event, user, managedMinistries, body)
    }
    return await updateMembership(
      client,
      user,
      context.actor,
      managedMinistries,
      body
    )
  } catch (error) {
    console.error("Unable to manage ministry members:", error)
    return jsonResponse(500, {
      message:
        error.message === "Invitation email is not configured"
          ? error.message
          : "Unable to update ministry membership",
    })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
