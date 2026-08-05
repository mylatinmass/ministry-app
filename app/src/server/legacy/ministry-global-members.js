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

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
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
    if (!["owner", "super_admin"].includes(context.user.global_role)) {
      return jsonResponse(403, {
        message: "Global member access is restricted",
      })
    }
    if (context.authMethod !== "password") {
      return jsonResponse(403, {
        message:
          "Sign in with your username and password to manage all members.",
      })
    }

    const [membershipsResult, ministriesResult, levelsResult] =
      await Promise.all([
        client.query(
          `
          SELECT
            user_account.id AS user_id,
            user_account.first_name,
            user_account.last_name,
            user_account.email,
            user_account.phone,
            user_account.username,
            user_account.global_role,
            user_account.status AS user_status,
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
          FROM users user_account
          LEFT JOIN ministry_members membership
            ON membership.user_id = user_account.id
           AND membership.status = 'active'
          LEFT JOIN ministries ministry
            ON ministry.id = membership.ministry_id
           AND ministry.status = 'active'
          LEFT JOIN ministry_levels ministry_level
            ON ministry_level.id = membership.highest_level_id
          WHERE user_account.status = 'active'
          ORDER BY
            lower(user_account.last_name),
            lower(user_account.first_name),
            lower(ministry.name)
        `
        ),
        client.query(
          `
          SELECT id, name, slug
          FROM ministries
          WHERE status = 'active'
          ORDER BY name
        `
        ),
        client.query(
          `
          SELECT id, ministry_id, name, description, rank_order
          FROM ministry_levels
          WHERE status = 'active'
          ORDER BY ministry_id, rank_order
        `
        ),
      ])

    const membersById = new Map()
    for (const row of membershipsResult.rows) {
      if (!membersById.has(row.user_id)) {
        membersById.set(row.user_id, {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone || "",
          username: row.username,
          globalRole: row.global_role,
          status: row.user_status,
          memberships: [],
        })
      }
      if (row.membership_id && row.ministry_id) {
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
