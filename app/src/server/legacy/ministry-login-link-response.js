const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const { createMinistryToken, hasMinistryAccess, toPublicMinistryUser } = require("./helper/ministry-auth")
const { hashLoginLinkToken } = require("./helper/ministry-login-links")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
})

const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { message: "Method not allowed" })
  let body
  try { body = JSON.parse(event.body || "{}") } catch { return jsonResponse(400, { message: "Invalid request" }) }
  if (!body.token || body.token.toString().length < 32) return jsonResponse(400, { message: "Sign-in link is incomplete" })
  const connectionString = process.env.MINISTRY_DATABASE_URL
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!connectionString || !jwtSecret) return jsonResponse(500, { message: "Ministries login is not configured" })
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query("BEGIN")
    const result = await client.query(
      `SELECT link.id, link.expires_at, link.consumed_at, link.revoked_at,
              u.id AS user_id, u.first_name, u.last_name, u.username, u.global_role, u.status,
              u.is_volunteer_profile,
              EXISTS (
                SELECT 1 FROM ministry_members mm JOIN ministries m ON m.id = mm.ministry_id
                WHERE mm.user_id = u.id AND mm.status = 'active' AND m.status = 'active'
              ) AS has_active_membership
       FROM ministry_login_links link JOIN ministry_accounts u ON u.id = link.user_id
       WHERE link.token_hash = $1 LIMIT 1 FOR UPDATE`,
      [hashLoginLinkToken(body.token)]
    )
    const row = result.rows[0]
    if (!row || row.consumed_at || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK")
      return jsonResponse(410, { message: "This sign-in link is invalid, expired, or already used" })
    }
    const user = { id: row.user_id, first_name: row.first_name, last_name: row.last_name, username: row.username, global_role: row.global_role, status: row.status, has_active_membership: row.has_active_membership, is_volunteer_profile: row.is_volunteer_profile }
    if (user.status !== "active" || !hasMinistryAccess(user) || ["owner", "super_admin"].includes(user.global_role)) {
      await client.query("ROLLBACK")
      return jsonResponse(403, { message: "This account must sign in with a username and password" })
    }
    await client.query(`UPDATE ministry_login_links SET consumed_at = now() WHERE id = $1`, [row.id])
    await client.query(
      `INSERT INTO ministry_audit_log (actor_user_id, active_profile_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $1, 'session.email_link_redeemed', 'user', $1, $2::JSONB)`,
      [user.id, JSON.stringify({ authMethod: "email_link" })]
    )
    await client.query("COMMIT")
    return jsonResponse(200, {
      success: true,
      token: createMinistryToken(user, jwtSecret, { authMethod: "email_link", expiresIn: "4h" }),
      user: toPublicMinistryUser(user),
    })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("Unable to redeem ministry login link:", error)
    return jsonResponse(500, { message: "Unable to use this sign-in link" })
  } finally { await client.end().catch(() => {}) }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
