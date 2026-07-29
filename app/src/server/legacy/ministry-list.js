const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  getMinistryIdentityContext,
  getMinistryTokenPayload,
  toPublicMinistryUser,
} = require("./helper/ministry-auth")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const toMinistry = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  status: row.status,
  accessLevel: row.access_level,
  globalAccess: row.global_access,
  canServe: row.can_serve,
  memberCount: Number(row.member_count),
  templateCount: Number(row.template_count),
})

const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  const jwtSecret = process.env.JWT_SECRET_KEY

  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, { message: "Ministries access is not configured" })
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

    if (!context) {
      return jsonResponse(401, { message: "Ministry access is inactive" })
    }
    const user = context.user

    const hasGlobalAccess = ["owner", "super_admin"].includes(user.global_role)
    const result = hasGlobalAccess
      ? await client.query(
          `
            SELECT
              m.id,
              m.slug,
              m.name,
              m.description,
              m.status,
              $1::STRING AS access_level,
              true AS global_access,
              coalesce(access.can_serve, false) AS can_serve,
              (
                SELECT count(*)
                FROM ministry_members members
                WHERE members.ministry_id = m.id
                  AND members.status = 'active'
                  AND members.can_serve = true
              ) AS member_count,
              (
                SELECT count(*)
                FROM templates t
                WHERE t.ministry_id = m.id
                  AND t.status = 'active'
              ) AS template_count
            FROM ministries m
            LEFT JOIN ministry_members access
              ON access.ministry_id = m.id
              AND access.user_id = $2
              AND access.status = 'active'
            ORDER BY
              CASE m.status
                WHEN 'active' THEN 0
                WHEN 'inactive' THEN 1
                ELSE 2
              END,
              m.name
          `,
          [user.global_role, user.id]
        )
      : await client.query(
          `
            SELECT
              m.id,
              m.slug,
              m.name,
              m.description,
              m.status,
              access.level AS access_level,
              false AS global_access,
              access.can_serve,
              (
                SELECT count(*)
                FROM ministry_members members
                WHERE members.ministry_id = m.id
                  AND members.status = 'active'
                  AND members.can_serve = true
              ) AS member_count,
              (
                SELECT count(*)
                FROM templates t
                WHERE t.ministry_id = m.id
                  AND t.status = 'active'
              ) AS template_count
            FROM ministry_members access
            JOIN ministries m ON m.id = access.ministry_id
            WHERE access.user_id = $1
              AND access.status = 'active'
              AND m.status = 'active'
            ORDER BY m.name
          `,
          [user.id]
        )

    return jsonResponse(200, {
      actor: toPublicMinistryUser(context.actor),
      user: toPublicMinistryUser(user),
      isManagedProfile: context.isManagedProfile,
      ministries: result.rows.map(toMinistry),
    })
  } catch (error) {
    console.error("Unable to list ministries:", error)
    return jsonResponse(500, { message: "Unable to load ministries" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
