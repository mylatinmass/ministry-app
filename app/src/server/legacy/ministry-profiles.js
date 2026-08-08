const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  createMinistryToken,
  getMinistryIdentityContext,
  getMinistryTokenPayload,
  toPublicMinistryUser,
} = require("./helper/ministry-auth")
const {
  createInvitationToken,
  hashInvitationToken,
  isValidEmail,
  normalizeEmail,
} = require("./helper/ministry-invitations")
const {
  buildSeparationUrl,
  sendProfileSeparationEmail,
} = require("./helper/managed-profile-email")
const {
  buildMembershipRequestUrl,
  sendMembershipRequestEmail,
} = require("./helper/managed-profile-membership-email")

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

const cleanName = (value) => value?.toString().trim().replace(/\s+/g, " ") || ""

const audit = (client, actorId, subjectId, action, entityType, entityId, metadata = {}) =>
  client.query(
    `
      INSERT INTO managed_profile_audit (
        actor_user_id, subject_user_id, action, entity_type, entity_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::JSONB)
    `,
    [actorId, subjectId, action, entityType || null, entityId || null, JSON.stringify(metadata)]
  )

const listProfiles = async (client, context) => {
  const [childrenResult, ministriesResult, requestsResult, alertsResult] = await Promise.all([
    client.query(
      `
        SELECT
          mp.id AS relationship_id,
          mp.status AS relationship_status,
          child.id,
          child.first_name,
          child.last_name,
          child.username,
          child.global_role,
          child.status,
          (
            SELECT separation.new_email
            FROM managed_profile_separations separation
            WHERE separation.child_user_id = child.id
              AND separation.status = 'pending'
            ORDER BY separation.created_at DESC
            LIMIT 1
          ) AS separation_email
        FROM managed_profiles mp
        JOIN users child ON child.id = mp.child_user_id
        WHERE mp.guardian_user_id = $1
          AND mp.status IN ('active', 'separation_pending')
        ORDER BY lower(child.first_name), lower(child.last_name)
      `,
      [context.actor.id]
    ),
    ["owner", "super_admin"].includes(context.actor.global_role)
      ? client.query(`SELECT id, name, slug FROM ministries WHERE status = 'active' ORDER BY name`)
      : client.query(
          `
            SELECT m.id, m.name, m.slug
            FROM ministry_members mm
            JOIN ministries m ON m.id = mm.ministry_id
            WHERE mm.user_id = $1 AND mm.status = 'active' AND m.status = 'active'
            ORDER BY m.name
          `,
          [context.actor.id]
        ),
    client.query(
      `
        SELECT request.id, request.child_user_id, request.ministry_id,
          request.status, m.name AS ministry_name
        FROM managed_profile_membership_requests request
        JOIN ministries m ON m.id = request.ministry_id
        WHERE request.guardian_user_id = $1
          AND request.status = 'pending'
        ORDER BY request.requested_at DESC
      `,
      [context.actor.id]
    ),
    client.query(
      `
        SELECT alert.subject_user_id, count(*)::INT AS unread_count
        FROM ministry_alerts alert
        WHERE alert.read_at IS NULL
          AND (
            alert.subject_user_id = $1
            OR EXISTS (
              SELECT 1 FROM managed_profiles profile
              WHERE profile.guardian_user_id = $1
                AND profile.child_user_id = alert.subject_user_id
                AND profile.status IN ('active', 'separation_pending')
            )
          )
        GROUP BY alert.subject_user_id
      `,
      [context.actor.id]
    ),
  ])

  const unreadCounts = new Map(
    alertsResult.rows.map((row) => [row.subject_user_id, Number(row.unread_count || 0)])
  )

  return {
    actor: toPublicMinistryUser(context.actor),
    activeProfile: toPublicMinistryUser(context.user),
    profiles: [
      {
        ...toPublicMinistryUser(context.actor),
        isGuardian: true,
        relationshipStatus: "self",
        alertCount: unreadCounts.get(context.actor.id) || 0,
      },
      ...childrenResult.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        username: row.username,
        globalRole: row.global_role,
        status: row.status,
        isGuardian: false,
        relationshipId: row.relationship_id,
        relationshipStatus: row.relationship_status,
        separationEmail: row.separation_email || "",
        alertCount: unreadCounts.get(row.id) || 0,
      })),
    ],
    ministries: ministriesResult.rows,
    membershipRequests: requestsResult.rows.map((row) => ({
      id: row.id,
      profileId: row.child_user_id,
      ministryId: row.ministry_id,
      ministryName: row.ministry_name,
      status: row.status,
    })),
  }
}

const createChild = async (client, actor, body) => {
  const firstName = cleanName(body.firstName)
  const lastName = cleanName(body.lastName)
  if (!firstName || !lastName) {
    return jsonResponse(400, { message: "First and last name are required" })
  }
  if (firstName.length > 100 || lastName.length > 100) {
    return jsonResponse(400, { message: "Names must be 100 characters or fewer" })
  }

  await client.query("BEGIN")
  try {
    const userResult = await client.query(
      `
        INSERT INTO users (first_name, last_name, global_role, status)
        VALUES ($1, $2, 'regular', 'active')
        RETURNING id
      `,
      [firstName, lastName]
    )
    const childId = userResult.rows[0].id
    const relationshipResult = await client.query(
      `
        INSERT INTO managed_profiles (guardian_user_id, child_user_id)
        VALUES ($1, $2)
        RETURNING id
      `,
      [actor.id, childId]
    )
    await audit(
      client,
      actor.id,
      childId,
      "managed_profile.created",
      "managed_profile",
      relationshipResult.rows[0].id
    )
    await client.query("COMMIT")
    return jsonResponse(201, { success: true, profileId: childId, message: "Child profile added" })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }
}

const createReviewerNotifications = async (
  client,
  event,
  requestId,
  ministryId,
  childId,
  actor
) => {
  const [detailsResult, reviewersResult] = await Promise.all([
    client.query(
      `
        SELECT m.name AS ministry_name,
          child.first_name AS child_first_name,
          child.last_name AS child_last_name
        FROM ministries m
        JOIN users child ON child.id = $2
        WHERE m.id = $1
      `,
      [ministryId, childId]
    ),
    client.query(
      `
        SELECT DISTINCT u.id, u.first_name, lower(btrim(u.email)) AS email
        FROM users u
        WHERE u.status = 'active'
          AND NULLIF(btrim(u.email), '') IS NOT NULL
          AND (
            u.global_role IN ('owner', 'super_admin')
            OR EXISTS (
              SELECT 1 FROM ministry_members mm
              WHERE mm.user_id = u.id
                AND mm.ministry_id = $1
                AND mm.status = 'active'
                AND mm.level IN ('owner', 'admin')
            )
          )
        ORDER BY u.id
      `,
      [ministryId]
    ),
  ])
  const details = detailsResult.rows[0]
  if (!details || !reviewersResult.rowCount) {
    throw new Error("No ministry leaders with email addresses are available")
  }
  const reviewers = reviewersResult.rows.filter(
    (reviewer, index, all) =>
      all.findIndex((candidate) => candidate.email === reviewer.email) === index
  )
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const guardianName = [actor.first_name, actor.last_name].filter(Boolean).join(" ")
  const childName = [details.child_first_name, details.child_last_name]
    .filter(Boolean)
    .join(" ")
  const notifications = []
  for (const reviewer of reviewers) {
    const token = createInvitationToken()
    const recipientResult = await client.query(
      `
        INSERT INTO managed_profile_membership_request_recipients (
          request_id, reviewer_user_id, token_hash, expires_at
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (request_id, reviewer_user_id) DO NOTHING
        RETURNING id
      `,
      [requestId, reviewer.id, hashInvitationToken(token), expiresAt]
    )
    if (recipientResult.rowCount) {
      notifications.push({
        recipientId: recipientResult.rows[0].id,
        reviewer,
        token,
        expiresAt,
        guardianName,
        childName,
        ministryName: details.ministry_name,
      })
    }
  }
  return notifications
}

const deliverReviewerNotifications = async (client, event, notifications) => {
  let delivered = 0
  for (const notification of notifications) {
    try {
      await sendMembershipRequestEmail({
        email: notification.reviewer.email,
        reviewerFirstName: notification.reviewer.first_name,
        childName: notification.childName,
        guardianName: notification.guardianName,
        ministryName: notification.ministryName,
        acceptUrl: buildMembershipRequestUrl(event, notification.token, "accept"),
        declineUrl: buildMembershipRequestUrl(event, notification.token, "decline"),
        expiresAt: notification.expiresAt,
      })
      await client.query(
        `UPDATE managed_profile_membership_request_recipients SET emailed_at = now() WHERE id = $1`,
        [notification.recipientId]
      )
      delivered += 1
    } catch (error) {
      console.error("Unable to email membership request reviewer:", error)
    }
  }
  return delivered
}

const requestMembership = async (client, event, actor, body) => {
  const childId = body.profileId?.toString()
  const ministryId = body.ministryId?.toString()
  if (!childId || !ministryId) {
    return jsonResponse(400, { message: "Profile and ministry are required" })
  }
  const relationship = await client.query(
    `SELECT 1 FROM managed_profiles WHERE guardian_user_id = $1 AND child_user_id = $2 AND status = 'active'`,
    [actor.id, childId]
  )
  if (!relationship.rowCount) return jsonResponse(403, { message: "Profile access denied" })

  const eligible = ["owner", "super_admin"].includes(actor.global_role)
    ? await client.query(`SELECT 1 FROM ministries WHERE id = $1 AND status = 'active'`, [ministryId])
    : await client.query(
        `SELECT 1 FROM ministry_members WHERE user_id = $1 AND ministry_id = $2 AND status = 'active'`,
        [actor.id, ministryId]
      )
  if (!eligible.rowCount) return jsonResponse(403, { message: "You cannot request this ministry" })

  const existing = await client.query(
    `SELECT 1 FROM ministry_members WHERE user_id = $1 AND ministry_id = $2 AND status = 'active'`,
    [childId, ministryId]
  )
  if (existing.rowCount) return jsonResponse(409, { message: "This profile is already a member" })

  const pendingResult = await client.query(
    `
      SELECT request.id,
        (SELECT count(*) FROM managed_profile_membership_request_recipients recipient
         WHERE recipient.request_id = request.id) AS recipient_count
      FROM managed_profile_membership_requests request
      WHERE request.child_user_id = $1 AND request.ministry_id = $2
        AND request.status = 'pending'
      LIMIT 1
    `,
    [childId, ministryId]
  )
  if (pendingResult.rowCount && Number(pendingResult.rows[0].recipient_count) > 0) {
    return jsonResponse(409, { message: "This membership request is already awaiting a leader response" })
  }

  let requestId = pendingResult.rows[0]?.id
  let notifications
  await client.query("BEGIN")
  try {
    if (!requestId) {
      const requestResult = await client.query(
        `
          INSERT INTO managed_profile_membership_requests (
            guardian_user_id, child_user_id, ministry_id
          ) VALUES ($1, $2, $3)
          RETURNING id
        `,
        [actor.id, childId, ministryId]
      )
      requestId = requestResult.rows[0].id
      await audit(client, actor.id, childId, "membership.requested", "ministry", ministryId, {
        requestId,
      })
    }
    notifications = await createReviewerNotifications(
      client,
      event,
      requestId,
      ministryId,
      childId,
      actor
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }
  const delivered = await deliverReviewerNotifications(client, event, notifications)
  if (!delivered) {
    return jsonResponse(502, { message: "The request was saved, but leader emails could not be delivered" })
  }
  return jsonResponse(201, {
    success: true,
    message: `Membership request emailed to ${delivered} ${delivered === 1 ? "leader" : "leaders"}`,
  })
}

const startSeparation = async (client, event, actor, body) => {
  const childId = body.profileId?.toString()
  const email = normalizeEmail(body.email)
  if (!childId || !isValidEmail(email)) {
    return jsonResponse(400, { message: "Profile and a valid new email are required" })
  }
  const relationshipResult = await client.query(
    `
      SELECT mp.id, child.first_name
      FROM managed_profiles mp
      JOIN users child ON child.id = mp.child_user_id
      WHERE mp.guardian_user_id = $1
        AND mp.child_user_id = $2
        AND mp.status IN ('active', 'separation_pending')
      LIMIT 1
    `,
    [actor.id, childId]
  )
  if (!relationshipResult.rowCount) return jsonResponse(403, { message: "Profile access denied" })

  const emailOwner = await client.query(
    `SELECT 1 FROM users WHERE lower(btrim(email)) = $1 AND id <> $2 LIMIT 1`,
    [email, childId]
  )
  if (emailOwner.rowCount) return jsonResponse(409, { message: "That email is already in use" })

  const token = createInvitationToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const relationship = relationshipResult.rows[0]
  let separationId
  await client.query("BEGIN")
  try {
    await client.query(
      `UPDATE managed_profile_separations SET status = 'revoked', updated_at = now() WHERE child_user_id = $1 AND status = 'pending'`,
      [childId]
    )
    const result = await client.query(
      `
        INSERT INTO managed_profile_separations (
          managed_profile_id, child_user_id, new_email, token_hash, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [relationship.id, childId, email, hashInvitationToken(token), expiresAt]
    )
    separationId = result.rows[0].id
    await client.query(
      `UPDATE managed_profiles SET status = 'separation_pending', updated_at = now() WHERE id = $1`,
      [relationship.id]
    )
    await audit(client, actor.id, childId, "separation.started", "managed_profile_separation", separationId)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }

  try {
    await sendProfileSeparationEmail({
      email,
      firstName: relationship.first_name,
      activationUrl: buildSeparationUrl(event, token),
    })
  } catch (error) {
    await client.query(
      `UPDATE managed_profile_separations SET status = 'revoked', updated_at = now() WHERE id = $1`,
      [separationId]
    )
    await client.query(
      `UPDATE managed_profiles SET status = 'active', updated_at = now() WHERE id = $1`,
      [relationship.id]
    )
    throw error
  }

  return jsonResponse(201, { success: true, message: "Activation email sent" })
}

const cancelSeparation = async (client, actor, body) => {
  const childId = body.profileId?.toString()
  if (!childId) {
    return jsonResponse(400, { message: "Profile is required" })
  }

  await client.query("BEGIN")
  try {
    const relationshipResult = await client.query(
      `
        SELECT id
        FROM managed_profiles
        WHERE guardian_user_id = $1
          AND child_user_id = $2
          AND status = 'separation_pending'
        LIMIT 1
        FOR UPDATE
      `,
      [actor.id, childId]
    )
    if (!relationshipResult.rowCount) {
      await client.query("ROLLBACK")
      return jsonResponse(409, {
        message: "There is no pending activation to cancel",
      })
    }

    const relationshipId = relationshipResult.rows[0].id
    await client.query(
      `
        UPDATE managed_profile_separations
        SET status = 'revoked', updated_at = now()
        WHERE managed_profile_id = $1
          AND child_user_id = $2
          AND status = 'pending'
      `,
      [relationshipId, childId]
    )
    await client.query(
      `
        UPDATE managed_profiles
        SET status = 'active', updated_at = now()
        WHERE id = $1
      `,
      [relationshipId]
    )
    await audit(
      client,
      actor.id,
      childId,
      "separation.cancelled",
      "managed_profile",
      relationshipId
    )
    await client.query("COMMIT")
    return jsonResponse(200, {
      success: true,
      message: "Independent account activation cancelled",
    })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }
}

const handler = async (event) => {
  if (!["GET", "POST", "PATCH"].includes(event.httpMethod)) {
    return jsonResponse(405, { message: "Method not allowed" })
  }
  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!connectionString || !jwtSecret) return jsonResponse(500, { message: "Profiles are not configured" })

  let payload
  try {
    payload = getMinistryTokenPayload(event, jwtSecret)
  } catch (error) {
    return jsonResponse(401, { message: "Session expired" })
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const context = await getMinistryIdentityContext(client, payload)
    if (!context) return jsonResponse(401, { message: "Profile access expired" })
    if (event.httpMethod === "GET") return jsonResponse(200, await listProfiles(client, context))

    if (context.isEmailLinkSession) {
      return jsonResponse(403, {
        message: "Sign in with your username and password to manage family profiles or membership requests.",
      })
    }

    const body = parseBody(event)
    if (!body) return jsonResponse(400, { message: "Invalid request" })
    if (event.httpMethod === "PATCH" && body.action === "switch_profile") {
      const profileId = body.profileId?.toString() || context.actor.id
      const allowed = profileId === context.actor.id || (await client.query(
        `SELECT 1 FROM managed_profiles WHERE guardian_user_id = $1 AND child_user_id = $2 AND status IN ('active', 'separation_pending')`,
        [context.actor.id, profileId]
      )).rowCount
      if (!allowed) return jsonResponse(403, { message: "Profile access denied" })
      const targetResult = await client.query(
        `SELECT id, first_name, last_name, username, global_role, status FROM users WHERE id = $1 AND status = 'active'`,
        [profileId]
      )
      if (!targetResult.rowCount) return jsonResponse(404, { message: "Profile not found" })
      await audit(client, context.actor.id, profileId, "profile.switched", "user", profileId)
      return jsonResponse(200, {
        success: true,
        token: createMinistryToken(context.actor, jwtSecret, {
          activeProfileUserId: profileId,
          authMethod: context.authMethod,
        }),
        activeProfile: toPublicMinistryUser(targetResult.rows[0]),
      })
    }
    if (event.httpMethod === "POST" && body.action === "create_child") {
      return await createChild(client, context.actor, body)
    }
    if (event.httpMethod === "POST" && body.action === "request_membership") {
      return await requestMembership(client, event, context.actor, body)
    }
    if (event.httpMethod === "POST" && body.action === "start_separation") {
      return await startSeparation(client, event, context.actor, body)
    }
    if (event.httpMethod === "POST" && body.action === "cancel_separation") {
      return await cancelSeparation(client, context.actor, body)
    }
    return jsonResponse(400, { message: "Unknown profile action" })
  } catch (error) {
    console.error("Unable to manage family profiles:", error)
    if (error.code === "23505") return jsonResponse(409, { message: "This request already exists" })
    const publicMessages = new Set([
      "No ministry leaders with email addresses are available",
      "Profile activation email is not configured",
    ])
    return jsonResponse(500, {
      message: publicMessages.has(error.message)
        ? error.message
        : "Unable to update family profiles",
    })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
