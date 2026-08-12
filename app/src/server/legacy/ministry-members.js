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
const {
  queueKlaviyoProfileSync,
} = require("./helper/klaviyo-profile-sync")

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

const cleanText = (value, maximum = 1000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const cleanIconKey = (value) => {
  const iconKey = cleanText(value, 64)
  return /^[a-z0-9-]+$/.test(iconKey) ? iconKey : null
}

const writeLevelAudit = async (
  client,
  {
    actor,
    user,
    action,
    entityType,
    entityId,
    ministryId,
    beforeData,
    afterData,
  }
) =>
  client.query(
    `
      INSERT INTO ministry_audit_log (
        actor_user_id,
        active_profile_user_id,
        action,
        entity_type,
        entity_id,
        ministry_id,
        before_data,
        after_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB, $8::JSONB)
    `,
    [
      actor.id,
      user.id,
      action,
      entityType,
      entityId || null,
      ministryId,
      beforeData == null ? null : JSON.stringify(beforeData),
      afterData == null ? null : JSON.stringify(afterData),
    ]
  )

const listMembers = async (client, user, ministryId) => {
  const managedMinistries = await getManagedMinistries(client, user)

  if (!canManageMinistry(managedMinistries, ministryId)) {
    const membershipResult = await client.query(
      `
        SELECT
          membership.level,
          membership.can_serve,
          membership.highest_level_id,
          ministry_level.name AS highest_level_name,
          ministry_level.icon_key AS highest_level_icon_key,
          ministry_level.rank_order AS highest_level_rank
        FROM ministry_members membership
        LEFT JOIN ministry_levels ministry_level
          ON ministry_level.id = membership.highest_level_id
        WHERE membership.ministry_id = $1
          AND membership.user_id = $2
          AND membership.status = 'active'
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
      levels: [],
      currentMembership: {
        level: membershipResult.rows[0].level,
        canServe: Boolean(membershipResult.rows[0].can_serve),
        highestLevelId: membershipResult.rows[0].highest_level_id,
        highestLevelName: membershipResult.rows[0].highest_level_name,
        highestLevelIconKey: membershipResult.rows[0].highest_level_icon_key,
        highestLevelRank:
          Number(membershipResult.rows[0].highest_level_rank) || null,
      },
    })
  }

  const [
    membersResult,
    invitationsResult,
    requestsResult,
    levelsResult,
    accessRequestsResult,
  ] = await Promise.all([
    client.query(
      `
        SELECT
          mm.id,
          u.id AS user_id,
          u.first_name,
          u.last_name,
          mm.level,
          mm.status,
          mm.can_serve,
          mm.highest_level_id,
          ministry_level.name AS highest_level_name,
          ministry_level.icon_key AS highest_level_icon_key,
          ministry_level.rank_order AS highest_level_rank,
          mm.joined_at
        FROM ministry_members mm
        JOIN users u ON u.id = mm.user_id
        LEFT JOIN ministry_levels ministry_level
          ON ministry_level.id = mm.highest_level_id
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
    client.query(
      `
        SELECT id, name, description, icon_key, rank_order, status
        FROM ministry_levels
        WHERE ministry_id = $1
          AND status = 'active'
        ORDER BY rank_order
      `,
      [ministryId]
    ),
    isGlobalManager(user)
      ? client.query(
          `
            SELECT id, first_name, last_name, created_at
            FROM ministry_access_requests
            WHERE status = 'pending'
            ORDER BY created_at
          `
        )
      : Promise.resolve({ rows: [] }),
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
      level: member.level,
      status: member.status,
      canServe: member.can_serve,
      highestLevelId: member.highest_level_id,
      highestLevelName: member.highest_level_name,
      highestLevelIconKey: member.highest_level_icon_key,
      highestLevelRank: Number(member.highest_level_rank) || null,
      joinedAt: member.joined_at,
    })),
    levels: levelsResult.rows.map((level) => ({
      id: level.id,
      name: level.name,
      description: level.description || "",
      iconKey: level.icon_key || "",
      rankOrder: Number(level.rank_order),
      status: level.status,
    })),
    invitations: invitationsResult.rows.map((invitation) => ({
      id: invitation.id,
      status: invitation.status,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
      ministryNames: invitation.ministry_names,
      expired: new Date(invitation.expires_at).getTime() <= Date.now(),
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
    accessRequests: accessRequestsResult.rows.map((request) => ({
      id: request.id,
      firstName: request.first_name,
      lastName: request.last_name,
      requestedAt: request.created_at,
    })),
  })
}

const createInvitation = async (
  client,
  event,
  user,
  actor,
  managedMinistries,
  body
) => {
  const requestedUserId = body.userId?.toString().trim() || ""
  let email = normalizeEmail(body.email)
  const requestedIds = Array.from(
    new Set(
      (Array.isArray(body.ministryIds) ? body.ministryIds : [])
        .map((id) => id?.toString())
        .filter(Boolean)
    )
  )

  if (!requestedUserId && !isValidEmail(email)) {
    return jsonResponse(400, { message: "Enter a valid email address" })
  }
  if (!requestedIds.length) {
    return jsonResponse(400, { message: "Select at least one ministry" })
  }
  if (requestedIds.some((id) => !canManageMinistry(managedMinistries, id))) {
    return jsonResponse(403, {
      message: "You cannot invite to one or more selected ministries",
    })
  }

  const selectedMinistries = managedMinistries.filter((ministry) =>
    requestedIds.includes(ministry.id)
  )
  const userResult = requestedUserId
    ? await client.query(
        `
          SELECT target.id, target.email, target.username, target.password_hash, target.status
          FROM users target
          WHERE target.id = $1
            AND target.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM ministry_members membership
              WHERE membership.user_id = target.id
                AND membership.status = 'active'
            )
            AND (
              $2::BOOL
              OR NOT EXISTS (
                SELECT 1
                FROM managed_profiles managed_profile
                WHERE managed_profile.child_user_id = target.id
                  AND managed_profile.status IN ('active', 'separation_pending')
              )
            )
          LIMIT 1
        `,
        [requestedUserId, isGlobalManager(user)]
      )
    : await client.query(
        `
          SELECT id, email, username, password_hash, status
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
  if (requestedUserId && !existingUser) {
    return jsonResponse(404, { message: "Active Ministry member not found" })
  }
  if (requestedUserId) email = normalizeEmail(existingUser.email)
  if (!isValidEmail(email)) {
    return jsonResponse(409, {
      message: "This managed profile must use its guardian's ministry-request process",
    })
  }
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
      message:
        "This person is already an active member of every selected ministry",
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
      await writeLevelAudit(client, {
        actor,
        user,
        action: "ministry_invitation.created",
        entityType: "ministry_invitation",
        entityId: invitationId,
        ministryId: ministry.id,
        beforeData: null,
        afterData: {
          invitedUserId: existingUser?.id || null,
          status: "pending",
          expiresAt,
        },
      })
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

const manageInvitation = async (
  client,
  event,
  user,
  actor,
  managedMinistries,
  body
) => {
  const invitationId = body.invitationId?.toString()
  const action = body.action?.toString()
  if (!invitationId) {
    return jsonResponse(400, { message: "Invitation is required" })
  }

  await client.query("BEGIN")
  try {
    const invitationResult = await client.query(
      `
        SELECT id, email, status, expires_at, created_at
        FROM ministry_invitations
        WHERE id = $1
        FOR UPDATE
      `,
      [invitationId]
    )
    const invitation = invitationResult.rows[0]
    if (!invitation) {
      await client.query("ROLLBACK")
      return jsonResponse(404, { message: "Invitation not found" })
    }
    if (invitation.status !== "pending") {
      await client.query("ROLLBACK")
      return jsonResponse(409, {
        message: "This invitation is no longer pending",
      })
    }

    const ministriesResult = await client.query(
      `
        SELECT ministry.id, ministry.name, ministry.slug
        FROM ministry_invitation_items item
        JOIN ministries ministry ON ministry.id = item.ministry_id
        WHERE item.invitation_id = $1
        ORDER BY ministry.name
      `,
      [invitationId]
    )
    const ministries = ministriesResult.rows
    if (
      !ministries.length ||
      ministries.some(
        (ministry) => !canManageMinistry(managedMinistries, ministry.id)
      )
    ) {
      await client.query("ROLLBACK")
      return jsonResponse(403, {
        message: "You cannot manage this invitation",
      })
    }

    if (action === "cancel_invitation") {
      await client.query(
        `
          UPDATE ministry_invitations
          SET status = 'revoked',
              token_hash = $2,
              responded_at = now(),
              updated_at = now()
          WHERE id = $1 AND status = 'pending'
        `,
        [invitationId, hashInvitationToken(createInvitationToken())]
      )
      await writeLevelAudit(client, {
        actor,
        user,
        action: "ministry_invitation.cancelled",
        entityType: "ministry_invitation",
        entityId: invitationId,
        ministryId: ministries[0].id,
        beforeData: {
          status: invitation.status,
          expiresAt: invitation.expires_at,
        },
        afterData: { status: "revoked" },
      })
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        message: "Invitation cancelled. The previous link can no longer be used",
      })
    }

    const token = createInvitationToken()
    const expiresAt = new Date(
      Date.now() + INVITATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000
    )
    await client.query(
      `
        UPDATE ministry_invitations
        SET token_hash = $2,
            expires_at = $3,
            updated_at = now()
        WHERE id = $1 AND status = 'pending'
      `,
      [invitationId, hashInvitationToken(token), expiresAt]
    )
    await sendMinistryInvitationEmail({
      email: invitation.email,
      ministries,
      acceptUrl: buildInvitationUrl(event, token, "accept"),
      declineUrl: buildInvitationUrl(event, token, "decline"),
      expiresAt,
    })
    await writeLevelAudit(client, {
      actor,
      user,
      action: "ministry_invitation.resent",
      entityType: "ministry_invitation",
      entityId: invitationId,
      ministryId: ministries[0].id,
      beforeData: {
        status: invitation.status,
        expiresAt: invitation.expires_at,
      },
      afterData: { status: "pending", expiresAt },
    })
    await client.query("COMMIT")
    return jsonResponse(200, {
      success: true,
      message: "Invitation resent",
    })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }
}

const updateMembership = async (
  client,
  event,
  user,
  actor,
  managedMinistries,
  body
) => {
  const ministryId = body.ministryId?.toString()
  const targetUserId = body.userId?.toString()
  const action = body.action?.toString()

  if (!action) {
    return jsonResponse(400, { message: "Membership action is incomplete" })
  }

  if (["resend_invitation", "cancel_invitation"].includes(action)) {
    return manageInvitation(
      client,
      event,
      user,
      actor,
      managedMinistries,
      body
    )
  }

  if (action === "set_global_role") {
    if (!isGlobalManager(user)) {
      return jsonResponse(403, {
        message: "Only a global administrator can change global access",
      })
    }
    if (!targetUserId) {
      return jsonResponse(400, { message: "Member is required" })
    }
    if (targetUserId === user.id) {
      return jsonResponse(409, {
        message: "You cannot change your own global access",
      })
    }
    const globalRole =
      body.globalRole === "super_admin" ? "super_admin" : "regular"

    await client.query("BEGIN")
    try {
      const existingResult = await client.query(
        `
          SELECT target.id, target.global_role, target.status
          FROM users target
          WHERE target.id = $1
            AND target.status = 'active'
            AND target.global_role <> 'owner'
            AND EXISTS (
              SELECT 1
              FROM ministry_members membership
              WHERE membership.user_id = target.id
                AND membership.status = 'active'
            )
          FOR UPDATE
        `,
        [targetUserId]
      )
      const existing = existingResult.rows[0]
      if (!existing) {
        await client.query("ROLLBACK")
        return jsonResponse(404, { message: "Ministry member not found" })
      }
      const result = await client.query(
        `
          UPDATE users
          SET global_role = $1, updated_at = now()
          WHERE id = $2
          RETURNING id, global_role, status
        `,
        [globalRole, targetUserId]
      )
      await writeLevelAudit(client, {
        actor,
        user,
        action: "ministry_user.global_role_changed",
        entityType: "user",
        entityId: targetUserId,
        ministryId: null,
        beforeData: existing,
        afterData: result.rows[0],
      })
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        message:
          globalRole === "super_admin"
            ? "Super Admin access granted"
            : "Super Admin access removed",
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  }

  if (action === "suppress_profile") {
    if (!isGlobalManager(user)) {
      return jsonResponse(403, {
        message: "Only a global administrator can suppress a member profile",
      })
    }
    if (!targetUserId) {
      return jsonResponse(400, { message: "Member is required" })
    }
    if (targetUserId === user.id) {
      return jsonResponse(409, {
        message: "You cannot suppress your own profile",
      })
    }

    await client.query("BEGIN")
    try {
      const targetResult = await client.query(
        `
          SELECT id, first_name, last_name, email, global_role, status
          FROM users
          WHERE id = $1
            AND status = 'active'
            AND global_role <> 'owner'
          FOR UPDATE
        `,
        [targetUserId]
      )
      const target = targetResult.rows[0]
      if (!target) {
        await client.query("ROLLBACK")
        return jsonResponse(404, { message: "Active Ministry member not found" })
      }

      const activeSuppression = await client.query(
        `
          SELECT id
          FROM ministry_profile_suppressions
          WHERE user_id = $1
            AND reactivated_at IS NULL
          FOR UPDATE
        `,
        [targetUserId]
      )
      if (activeSuppression.rowCount) {
        await client.query("ROLLBACK")
        return jsonResponse(409, { message: "This profile is already suppressed" })
      }

      const membershipsResult = await client.query(
        `
          SELECT id, ministry_id, level, status, can_serve, highest_level_id
          FROM ministry_members
          WHERE user_id = $1
            AND status = 'active'
          FOR UPDATE
        `,
        [targetUserId]
      )
      if (!membershipsResult.rowCount) {
        await client.query("ROLLBACK")
        return jsonResponse(404, { message: "Active Ministry member not found" })
      }

      const suppressionResult = await client.query(
        `
          INSERT INTO ministry_profile_suppressions (
            user_id, suppressed_by, reason
          )
          VALUES ($1, $2, $3)
          RETURNING id, user_id, suppressed_by, suppressed_at
        `,
        [targetUserId, actor.id, cleanText(body.reason, 500) || null]
      )

      await client.query(
        `
          UPDATE ministry_members
          SET status = 'inactive', updated_at = now()
          WHERE user_id = $1
            AND status = 'active'
        `,
        [targetUserId]
      )
      await client.query(
        `
          UPDATE users
          SET global_role = 'regular', updated_at = now()
          WHERE id = $1
            AND global_role <> 'owner'
        `,
        [targetUserId]
      )
      await client.query(
        `
          UPDATE ministry_login_links
          SET revoked_at = now()
          WHERE user_id = $1
            AND consumed_at IS NULL
            AND revoked_at IS NULL
        `,
        [targetUserId]
      )

      await writeLevelAudit(client, {
        actor,
        user,
        action: "ministry_profile.suppressed",
        entityType: "user",
        entityId: targetUserId,
        ministryId: null,
        beforeData: {
          ...target,
          memberships: membershipsResult.rows,
        },
        afterData: {
          status: "suppressed",
          suppressionId: suppressionResult.rows[0].id,
          activeMemberships: 0,
          globalRole: "regular",
        },
      })
      await client.query("COMMIT")

      const name = [target.first_name, target.last_name]
        .filter(Boolean)
        .join(" ")
      return jsonResponse(200, {
        success: true,
        message: `${name || target.email || "Member"} was suppressed and removed from active member lists`,
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  }

  if (!ministryId) {
    return jsonResponse(400, { message: "Ministry is required" })
  }

  if (
    [
      "create_ministry_level",
      "update_ministry_level",
      "move_ministry_level",
      "reorder_ministry_levels",
      "archive_ministry_level",
    ].includes(action)
  ) {
    if (!canManageMinistry(managedMinistries, ministryId)) {
      return jsonResponse(403, { message: "You cannot manage this ministry" })
    }

    await client.query("BEGIN")
    try {
      if (action === "create_ministry_level") {
        const name = cleanText(body.name, 100)
        const description = cleanText(body.description, 1000) || null
        const iconKey = cleanIconKey(body.iconKey)
        if (!name) {
          await client.query("ROLLBACK")
          return jsonResponse(400, { message: "Level name is required" })
        }
        const result = await client.query(
          `
            INSERT INTO ministry_levels (
              ministry_id,
              name,
              description,
              icon_key,
              rank_order,
              created_by,
              updated_by
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              (
                SELECT COALESCE(max(rank_order), 0) + 1
                FROM ministry_levels
                WHERE ministry_id = $1
                  AND status = 'active'
              ),
              $5,
              $5
            )
            RETURNING id, name, description, icon_key, rank_order, status
          `,
          [ministryId, name, description, iconKey, actor.id]
        )
        const created = result.rows[0]
        await writeLevelAudit(client, {
          actor,
          user,
          action: "ministry_level.created",
          entityType: "ministry_level",
          entityId: created.id,
          ministryId,
          afterData: created,
        })
        await client.query("COMMIT")
        return jsonResponse(201, {
          success: true,
          message: `${created.name} added as the highest ministry level`,
        })
      }

      if (action === "reorder_ministry_levels") {
        const orderedLevelIds = Array.isArray(body.orderedLevelIds)
          ? body.orderedLevelIds.map((id) => cleanText(id, 100)).filter(Boolean)
          : []
        const levelsResult = await client.query(
          `
            SELECT id, name, description, icon_key, rank_order, status
            FROM ministry_levels
            WHERE ministry_id = $1
              AND status = 'active'
            ORDER BY rank_order
            FOR UPDATE
          `,
          [ministryId]
        )
        const currentIds = levelsResult.rows.map((level) => level.id)
        const requestedIds = new Set(orderedLevelIds)
        if (
          orderedLevelIds.length !== currentIds.length ||
          requestedIds.size !== currentIds.length ||
          currentIds.some((id) => !requestedIds.has(id))
        ) {
          await client.query("ROLLBACK")
          return jsonResponse(409, {
            message: "The ministry levels changed. Please reload and try again.",
          })
        }
        const byId = new Map(
          levelsResult.rows.map((level) => [level.id, level])
        )
        const levels = orderedLevelIds.map((id) => byId.get(id))
        const offset =
          Math.max(...levels.map((level) => Number(level.rank_order)), 0) +
          levels.length +
          100
        await client.query(
          `
            UPDATE ministry_levels
            SET rank_order = rank_order + $2,
                updated_by = $3,
                updated_at = now()
            WHERE ministry_id = $1
              AND status = 'active'
          `,
          [ministryId, offset, actor.id]
        )
        for (const [index, level] of levels.entries()) {
          await client.query(
            `
              UPDATE ministry_levels
              SET rank_order = $2,
                  updated_by = $3,
                  updated_at = now()
              WHERE id = $1
            `,
            [level.id, index + 1, actor.id]
          )
        }
        await writeLevelAudit(client, {
          actor,
          user,
          action: "ministry_level.reordered",
          entityType: "ministry_level",
          entityId: ministryId,
          ministryId,
          beforeData: levelsResult.rows,
          afterData: levels.map((level, index) => ({
            id: level.id,
            rank_order: index + 1,
          })),
        })
        await client.query("COMMIT")
        return jsonResponse(200, {
          success: true,
          message: "Ministry level order updated",
        })
      }

      const levelId = cleanText(body.levelId, 100)
      if (!levelId) {
        await client.query("ROLLBACK")
        return jsonResponse(400, { message: "Ministry level is required" })
      }
      const levelResult = await client.query(
        `
          SELECT id, name, description, icon_key, rank_order, status
          FROM ministry_levels
          WHERE id = $1
            AND ministry_id = $2
            AND status = 'active'
          FOR UPDATE
        `,
        [levelId, ministryId]
      )
      const existingLevel = levelResult.rows[0]
      if (!existingLevel) {
        await client.query("ROLLBACK")
        return jsonResponse(404, { message: "Ministry level not found" })
      }

      if (action === "update_ministry_level") {
        const name = cleanText(body.name, 100)
        const description = cleanText(body.description, 1000) || null
        const iconKey = cleanIconKey(body.iconKey)
        if (!name) {
          await client.query("ROLLBACK")
          return jsonResponse(400, { message: "Level name is required" })
        }
        const result = await client.query(
          `
            UPDATE ministry_levels
            SET name = $2,
                description = $3,
                icon_key = $4,
                updated_by = $5,
                updated_at = now()
            WHERE id = $1
            RETURNING id, name, description, icon_key, rank_order, status
          `,
          [levelId, name, description, iconKey, actor.id]
        )
        const updated = result.rows[0]
        await writeLevelAudit(client, {
          actor,
          user,
          action: "ministry_level.updated",
          entityType: "ministry_level",
          entityId: levelId,
          ministryId,
          beforeData: existingLevel,
          afterData: updated,
        })
        await client.query("COMMIT")
        return jsonResponse(200, {
          success: true,
          message: "Ministry level updated",
        })
      }

      if (action === "move_ministry_level") {
        const direction = body.direction === "up" ? "up" : "down"
        const levelsResult = await client.query(
          `
            SELECT id, name, description, icon_key, rank_order, status
            FROM ministry_levels
            WHERE ministry_id = $1
              AND status = 'active'
            ORDER BY rank_order
            FOR UPDATE
          `,
          [ministryId]
        )
        const levels = levelsResult.rows.map((level) => ({ ...level }))
        const currentIndex = levels.findIndex((level) => level.id === levelId)
        const nextIndex =
          direction === "up" ? currentIndex + 1 : currentIndex - 1
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= levels.length) {
          await client.query("ROLLBACK")
          return jsonResponse(409, {
            message:
              direction === "up"
                ? "This is already the highest level"
                : "This is already the lowest level",
          })
        }
        ;[levels[currentIndex], levels[nextIndex]] = [
          levels[nextIndex],
          levels[currentIndex],
        ]
        const offset =
          Math.max(...levels.map((level) => Number(level.rank_order)), 0) +
          levels.length +
          100
        await client.query(
          `
            UPDATE ministry_levels
            SET rank_order = rank_order + $2,
                updated_by = $3,
                updated_at = now()
            WHERE ministry_id = $1
              AND status = 'active'
          `,
          [ministryId, offset, actor.id]
        )
        for (const [index, level] of levels.entries()) {
          await client.query(
            `
              UPDATE ministry_levels
              SET rank_order = $2,
                  updated_by = $3,
                  updated_at = now()
              WHERE id = $1
            `,
            [level.id, index + 1, actor.id]
          )
        }
        await writeLevelAudit(client, {
          actor,
          user,
          action: "ministry_level.reordered",
          entityType: "ministry_level",
          entityId: levelId,
          ministryId,
          beforeData: levelsResult.rows,
          afterData: levels.map((level, index) => ({
            id: level.id,
            rank_order: index + 1,
          })),
        })
        await client.query("COMMIT")
        return jsonResponse(200, {
          success: true,
          message: "Ministry level order updated",
        })
      }

      const usageResult = await client.query(
        `
          SELECT
            EXISTS (
              SELECT 1
              FROM ministry_members
              WHERE highest_level_id = $1
            ) AS has_members,
            EXISTS (
              SELECT 1
              FROM template_responsibilities
              WHERE required_ministry_level_id = $1
                AND status = 'active'
            ) AS has_templates,
            EXISTS (
              SELECT 1
              FROM event_responsibilities
              WHERE required_ministry_level_id = $1
                AND status <> 'cancelled'
            ) AS has_events
        `,
        [levelId]
      )
      const usage = usageResult.rows[0]
      if (usage.has_members || usage.has_templates || usage.has_events) {
        await client.query("ROLLBACK")
        return jsonResponse(409, {
          message:
            "This level is in use by members or responsibilities and cannot be archived",
        })
      }
      await client.query(
        `
          UPDATE ministry_levels
          SET status = 'archived',
              updated_by = $2,
              updated_at = now()
          WHERE id = $1
        `,
        [levelId, actor.id]
      )
      await writeLevelAudit(client, {
        actor,
        user,
        action: "ministry_level.archived",
        entityType: "ministry_level",
        entityId: levelId,
        ministryId,
        beforeData: existingLevel,
        afterData: { ...existingLevel, status: "archived" },
      })
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        message: "Ministry level archived",
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  }

  if (["approve_access_request", "decline_access_request"].includes(action)) {
    if (!isGlobalManager(user)) {
      return jsonResponse(403, {
        message:
          "Only a global administrator can review unassigned access requests",
      })
    }
    if (!canManageMinistry(managedMinistries, ministryId)) {
      return jsonResponse(403, { message: "You cannot manage this ministry" })
    }
    const requestId = body.requestId?.toString()
    if (!requestId) {
      return jsonResponse(400, { message: "Access request is required" })
    }
    const requestResult = await client.query(
      `
        SELECT id, first_name, last_name, email, phone, message, status, created_at
        FROM ministry_access_requests
        WHERE id = $1 AND status = 'pending'
        LIMIT 1
      `,
      [requestId]
    )
    const accessRequest = requestResult.rows[0]
    if (!accessRequest) {
      return jsonResponse(404, { message: "Access request not found" })
    }

    if (action === "approve_access_request") {
      const invitationResponse = await createInvitation(
        client,
        event,
        user,
        actor,
        managedMinistries,
        {
          email: accessRequest.email,
          ministryIds: [ministryId],
        }
      )
      if (
        invitationResponse.statusCode < 200 ||
        invitationResponse.statusCode >= 300
      ) {
        return invitationResponse
      }
    }

    const nextStatus =
      action === "approve_access_request" ? "approved" : "declined"
    const updateResult = await client.query(
      `
        UPDATE ministry_access_requests
        SET status = $2,
            reviewed_by = $3,
            assigned_ministry_id = CASE WHEN $2 = 'approved' THEN $4 ELSE NULL END,
            reviewed_at = now(),
            updated_at = now()
        WHERE id = $1 AND status = 'pending'
        RETURNING id
      `,
      [requestId, nextStatus, actor.id, ministryId]
    )
    if (!updateResult.rowCount) {
      return jsonResponse(409, {
        message: "This access request was already reviewed",
      })
    }
    await writeLevelAudit(client, {
      actor,
      user,
      action: `ministry_access_request.${nextStatus}`,
      entityType: "ministry_access_request",
      entityId: requestId,
      ministryId,
      beforeData: {
        status: accessRequest.status,
        createdAt: accessRequest.created_at,
      },
      afterData: {
        status: nextStatus,
        assignedMinistryId: nextStatus === "approved" ? ministryId : null,
      },
    })
    return jsonResponse(200, {
      success: true,
      message:
        nextStatus === "approved"
          ? "Access request approved and invitation emailed"
          : "Access request declined",
    })
  }

  if (["approve_request", "decline_request"].includes(action)) {
    if (!canManageMinistry(managedMinistries, ministryId)) {
      return jsonResponse(403, { message: "You cannot manage this ministry" })
    }
    const requestId = body.requestId?.toString()
    if (!requestId)
      return jsonResponse(400, { message: "Membership request is required" })
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
        [
          action === "approve_request" ? "approved" : "declined",
          actor.id,
          requestId,
        ]
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
          action === "approve_request"
            ? "membership.approved"
            : "membership.declined",
          ministryId,
        ]
      )
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        message:
          action === "approve_request"
            ? "Child membership approved"
            : "Membership request declined",
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  }

  if (!targetUserId) {
    return jsonResponse(400, { message: "Member is required" })
  }

  if (action === "add_existing_member") {
    return jsonResponse(409, {
      message:
        "Membership requires an invitation that the person can accept or decline",
    })
  }

  const isLeaving = action === "leave" && targetUserId === user.id
  if (!isLeaving && !canManageMinistry(managedMinistries, ministryId)) {
    return jsonResponse(403, { message: "You cannot manage this ministry" })
  }

  if (action === "set_role") {
    const level = body.level === "admin" ? "admin" : "member"
    await client.query("BEGIN")
    try {
      const existingResult = await client.query(
        `
          SELECT id, level, status
          FROM ministry_members
          WHERE ministry_id = $1
            AND user_id = $2
            AND status = 'active'
            AND level <> 'owner'
          FOR UPDATE
        `,
        [ministryId, targetUserId]
      )
      const existing = existingResult.rows[0]
      if (!existing) {
        await client.query("ROLLBACK")
        return jsonResponse(404, { message: "Member not found" })
      }
      const result = await client.query(
        `
          UPDATE ministry_members
          SET level = $1, updated_at = now()
          WHERE id = $2
          RETURNING id, level, status
        `,
        [level, existing.id]
      )
      await writeLevelAudit(client, {
        actor,
        user,
        action: "ministry_member.role_changed",
        entityType: "ministry_member",
        entityId: existing.id,
        ministryId,
        beforeData: { ...existing, targetUserId },
        afterData: { ...result.rows[0], targetUserId },
      })
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        message:
          level === "admin"
            ? "Member assigned as Ministry Admin"
            : "Member role updated",
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  }

  if (action === "set_ministry_level") {
    const highestLevelId = cleanText(body.highestLevelId, 100) || null
    if (highestLevelId) {
      const levelResult = await client.query(
        `
          SELECT id, name, rank_order
          FROM ministry_levels
          WHERE id = $1
            AND ministry_id = $2
            AND status = 'active'
          LIMIT 1
        `,
        [highestLevelId, ministryId]
      )
      if (!levelResult.rowCount) {
        return jsonResponse(400, {
          message: "Select an active level from this ministry",
        })
      }
    }
    await client.query("BEGIN")
    try {
      const existingResult = await client.query(
        `
          SELECT
            membership.id,
            membership.highest_level_id,
            (
              SELECT name
              FROM ministry_levels
              WHERE id = membership.highest_level_id
            ) AS highest_level_name,
            (
              SELECT rank_order
              FROM ministry_levels
              WHERE id = membership.highest_level_id
            ) AS highest_level_rank
          FROM ministry_members membership
          WHERE membership.ministry_id = $1
            AND membership.user_id = $2
            AND membership.status = 'active'
          LIMIT 1
          FOR UPDATE
        `,
        [ministryId, targetUserId]
      )
      const existing = existingResult.rows[0]
      if (!existing) {
        await client.query("ROLLBACK")
        return jsonResponse(404, { message: "Member not found" })
      }

      const result = await client.query(
        `
          UPDATE ministry_members
          SET highest_level_id = $1,
              updated_at = now()
          WHERE id = $2
          RETURNING id, highest_level_id
        `,
        [highestLevelId, existing.id]
      )
      await writeLevelAudit(client, {
        actor,
        user,
        action: "ministry_member.level_granted",
        entityType: "ministry_member",
        entityId: existing.id,
        ministryId,
        beforeData: {
          highestLevelId: existing.highest_level_id,
          highestLevelName: existing.highest_level_name,
          highestLevelRank: Number(existing.highest_level_rank) || null,
        },
        afterData: {
          highestLevelId: result.rows[0].highest_level_id,
        },
      })
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        message: highestLevelId
          ? "Member ministry level updated"
          : "Member ministry level cleared",
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  }

  if (action === "remove" || isLeaving) {
    await client.query("BEGIN")
    try {
      const existingResult = await client.query(
        `
          SELECT id, level, status, can_serve, highest_level_id
          FROM ministry_members
          WHERE ministry_id = $1
            AND user_id = $2
            AND status = 'active'
            AND (level <> 'owner' OR $3 = true)
          FOR UPDATE
        `,
        [ministryId, targetUserId, isLeaving]
      )
      const existing = existingResult.rows[0]
      if (!existing) {
        await client.query("ROLLBACK")
        return jsonResponse(404, { message: "Member not found" })
      }
      const result = await client.query(
        `
          UPDATE ministry_members
          SET status = 'inactive', updated_at = now()
          WHERE id = $1
          RETURNING id, level, status, can_serve, highest_level_id
        `,
        [existing.id]
      )
      await writeLevelAudit(client, {
        actor,
        user,
        action: isLeaving ? "ministry_member.left" : "ministry_member.removed",
        entityType: "ministry_member",
        entityId: existing.id,
        ministryId,
        beforeData: { ...existing, targetUserId },
        afterData: { ...result.rows[0], targetUserId },
      })
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
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        message: isLeaving
          ? "You left the ministry"
          : "Member removed from this ministry",
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
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
    return jsonResponse(500, {
      message: "Ministry membership is not configured",
    })
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
    if (!context)
      return jsonResponse(401, { message: "Ministry access is inactive" })
    const user = context.user

    if (event.httpMethod === "GET") {
      const ministryId = event.queryStringParameters?.ministryId?.toString()
      if (!ministryId)
        return jsonResponse(400, { message: "Ministry is required" })
      return await listMembers(client, user, ministryId)
    }

    if (context.isEmailLinkSession) {
      return jsonResponse(403, {
        message:
          "Sign in with your username and password to approve members or change member access.",
      })
    }

    const body = parseBody(event)
    if (!body) return jsonResponse(400, { message: "Invalid request" })
    const managedMinistries = await getManagedMinistries(client, user)

    if (event.httpMethod === "POST") {
      return await createInvitation(
        client,
        event,
        user,
        context.actor,
        managedMinistries,
        body
      )
    }
    return await updateMembership(
      client,
      event,
      user,
      context.actor,
      managedMinistries,
      body
    )
  } catch (error) {
    console.error("Unable to manage ministry members:", error)
    if (error.code === "23505") {
      return jsonResponse(409, {
        message: "A ministry level with this name already exists",
      })
    }
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
