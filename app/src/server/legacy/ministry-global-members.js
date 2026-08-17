const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  getMinistryIdentityContext,
  getMinistryTokenPayload,
} = require("./helper/ministry-auth")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
})

const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.MINISTRY_DATABASE_URL
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, {
      message: "Global member management is not configured",
    })
  }

  let payload
  try {
    payload = getMinistryTokenPayload(event, jwtSecret)
  } catch {
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
    if (context.authMethod !== "password") {
      return jsonResponse(403, {
        message:
          "Sign in with your username and password to manage members.",
      })
    }

    const canManageAll = ["owner", "super_admin"].includes(
      context.user.global_role
    )
    const ministriesResult = canManageAll
      ? await client.query(
          `
            SELECT id, name, slug
            FROM ministries
            WHERE status = 'active'
            ORDER BY name
          `
        )
      : await client.query(
          `
            SELECT ministry.id, ministry.name, ministry.slug
            FROM ministry_members membership
            JOIN ministries ministry ON ministry.id = membership.ministry_id
            WHERE membership.user_id = $1
              AND membership.status = 'active'
              AND membership.level IN ('owner', 'admin')
              AND ministry.status = 'active'
            ORDER BY ministry.name
          `,
          [context.user.id]
        )

    if (!ministriesResult.rowCount) {
      return jsonResponse(403, {
        message: "Member management is restricted to Ministry Admins",
      })
    }
    const managedMinistryIds = ministriesResult.rows.map(
      (ministry) => ministry.id
    )
    const canManageBackgroundChecks =
      canManageAll ||
      ministriesResult.rows.some((ministry) => ministry.slug === "security")

    const [membershipsResult, levelsResult, invitationsResult] =
      await Promise.all([
        client.query(
          `
          WITH eligible_users AS (
            SELECT DISTINCT
              user_account.id,
              user_account.first_name,
              user_account.last_name,
              user_account.global_role,
              user_account.status,
              user_account.background_check_verified,
              user_account.background_check_verified_at
            FROM ministry_accounts user_account
            JOIN ministry_members existing_membership
              ON existing_membership.user_id = user_account.id
             AND existing_membership.status = 'active'
            WHERE user_account.status = 'active'
              AND (
                $2::BOOL
                OR NOT EXISTS (
                  SELECT 1
                  FROM managed_profiles managed_profile
                  WHERE managed_profile.child_user_id = user_account.id
                    AND managed_profile.status IN ('active', 'separation_pending')
                )
              )
          )
          SELECT
            user_account.id AS user_id,
            user_account.first_name,
            user_account.last_name,
            user_account.global_role,
            user_account.status AS user_status,
            user_account.background_check_verified,
            user_account.background_check_verified_at,
            membership.id AS membership_id,
            membership.level AS membership_role,
            membership.can_serve,
            membership.highest_level_id,
            ministry_level.name AS highest_level_name,
            ministry_level.rank_order AS highest_level_rank,
            ministry.id AS ministry_id,
            ministry.name AS ministry_name,
            ministry.slug AS ministry_slug,
            membership.joined_at
          FROM eligible_users user_account
          LEFT JOIN ministry_members membership
            ON membership.user_id = user_account.id
           AND membership.status = 'active'
           AND membership.ministry_id = ANY($1::UUID[])
          LEFT JOIN ministries ministry
            ON ministry.id = membership.ministry_id
           AND ministry.status = 'active'
          LEFT JOIN ministry_levels ministry_level
            ON ministry_level.id = membership.highest_level_id
          ORDER BY
            lower(user_account.last_name),
            lower(user_account.first_name),
            lower(COALESCE(ministry.name, ''))
        `,
          [managedMinistryIds, canManageAll]
        ),
        client.query(
          `
          SELECT id, ministry_id, name, description, rank_order
          FROM ministry_levels
          WHERE status = 'active'
            AND ministry_id = ANY($1::UUID[])
          ORDER BY ministry_id, rank_order
        `,
          [managedMinistryIds]
        ),
        client.query(
          `
            SELECT
              invitation.id,
              invitation.status,
              invitation.expires_at,
              invitation.created_at,
              array_agg(ministry.name ORDER BY ministry.name) AS ministry_names,
              concat_ws(' ', requester.first_name, requester.last_name) AS requested_by_name
            FROM ministry_invitations invitation
            JOIN ministry_invitation_items item
              ON item.invitation_id = invitation.id
            JOIN ministries ministry
              ON ministry.id = item.ministry_id
            JOIN ministry_accounts requester
              ON requester.id = invitation.requested_by
            WHERE invitation.status = 'pending'
              AND item.ministry_id = ANY($1::UUID[])
              AND NOT EXISTS (
                SELECT 1
                FROM ministry_invitation_items outside_item
                WHERE outside_item.invitation_id = invitation.id
                  AND NOT (outside_item.ministry_id = ANY($1::UUID[]))
              )
            GROUP BY
              invitation.id,
              requester.id,
              requester.first_name,
              requester.last_name
            ORDER BY invitation.created_at DESC
          `,
          [managedMinistryIds]
        ),
      ])

    const membersById = new Map()
    for (const row of membershipsResult.rows) {
      if (!membersById.has(row.user_id)) {
        membersById.set(row.user_id, {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          globalRole: row.global_role,
          status: row.user_status,
          backgroundCheckVerified: Boolean(row.background_check_verified),
          backgroundCheckVerifiedAt: row.background_check_verified_at || null,
          memberships: [],
        })
      }
      if (row.membership_id) {
        membersById.get(row.user_id).memberships.push({
          id: row.membership_id,
          ministryId: row.ministry_id,
          ministryName: row.ministry_name,
          ministrySlug: row.ministry_slug,
          role: row.membership_role,
          canServe: Boolean(row.can_serve),
          highestLevelId: row.highest_level_id,
          highestLevelName: row.highest_level_name,
          highestLevelRank: Number(row.highest_level_rank) || null,
          joinedAt: row.joined_at,
        })
      }
    }

    return jsonResponse(200, {
      currentUserId: context.user.id,
      canManageAll,
      canManageBackgroundChecks,
      members: Array.from(membersById.values()),
      ministries: ministriesResult.rows.map((ministry) => ({
        id: ministry.id,
        name: ministry.name,
        slug: ministry.slug,
      })),
      levels: levelsResult.rows.map((level) => ({
        id: level.id,
        ministryId: level.ministry_id,
        name: level.name,
        description: level.description || "",
        rankOrder: Number(level.rank_order),
      })),
      invitations: invitationsResult.rows.map((invitation) => ({
        id: invitation.id,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
        ministryNames: invitation.ministry_names,
        requestedByName: invitation.requested_by_name,
        expired: new Date(invitation.expires_at).getTime() <= Date.now(),
      })),
    })
  } catch (error) {
    console.error("Unable to list all ministry members:", error)
    return jsonResponse(500, { message: "Unable to load all members" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
