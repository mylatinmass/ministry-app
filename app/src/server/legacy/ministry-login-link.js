const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const { normalizeEmail, isValidEmail } = require("./helper/ministry-invitations")
const { assertLiveDeliveryAllowed } = require("./helper/delivery-safety")
const {
  LOGIN_LINK_LIFETIME_MINUTES,
  buildLoginLinkUrl,
  createLoginLinkToken,
  hashLoginLinkToken,
  sendMinistryLoginLinkEmail,
} = require("./helper/ministry-login-links")

const genericMessage = "If that email belongs to an eligible active member, a sign-in link has been sent."
const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
})

const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { message: "Method not allowed" })
  let body
  try { body = JSON.parse(event.body || "{}") } catch { return jsonResponse(400, { message: "Invalid request" }) }
  const email = normalizeEmail(body.email)
  if (!isValidEmail(email)) return jsonResponse(400, { message: "Enter a valid email address." })
  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  if (!connectionString) return jsonResponse(500, { message: "Ministries login is not configured" })
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return jsonResponse(500, { message: "Login email is not configured" })
  }
  try {
    assertLiveDeliveryAllowed()
  } catch (error) {
    return jsonResponse(503, { message: "Sign-in email delivery is unavailable in this environment" })
  }
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const result = await client.query(
      `SELECT u.id, u.email
       FROM users u
       WHERE lower(u.email) = $1
         AND u.status = 'active'
         AND u.global_role NOT IN ('owner', 'super_admin')
         AND EXISTS (
           SELECT 1 FROM ministry_members mm
           JOIN ministries m ON m.id = mm.ministry_id
           WHERE mm.user_id = u.id AND mm.status = 'active' AND m.status = 'active'
         )
       LIMIT 2`,
      [email]
    )
    if (result.rowCount !== 1) return jsonResponse(200, { success: true, message: genericMessage })
    const user = result.rows[0]
    const recent = await client.query(
      `SELECT 1 FROM ministry_login_links WHERE user_id = $1 AND created_at > now() - INTERVAL '60 seconds' LIMIT 1`,
      [user.id]
    )
    if (recent.rowCount) return jsonResponse(200, { success: true, message: genericMessage })
    const token = createLoginLinkToken()
    const configuredMinutes = Number.parseInt(process.env.MINISTRY_LOGIN_LINK_TTL_MINUTES || "", 10)
    const lifetimeMinutes = Number.isFinite(configuredMinutes) && configuredMinutes >= 5 && configuredMinutes <= 60
      ? configuredMinutes
      : LOGIN_LINK_LIFETIME_MINUTES
    const expiresAt = new Date(Date.now() + lifetimeMinutes * 60 * 1000)
    await client.query("BEGIN")
    try {
      await client.query(
        `UPDATE ministry_login_links SET revoked_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [user.id]
      )
      await client.query(
        `INSERT INTO ministry_login_links (user_id, token_hash, requested_email, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, hashLoginLinkToken(token), email, expiresAt]
      )
      await sendMinistryLoginLinkEmail({
        email: user.email,
        loginUrl: buildLoginLinkUrl(event, token),
        expiresAt,
      })
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      console.error("Unable to deliver ministry login link:", error)
      return jsonResponse(200, { success: true, message: genericMessage })
    }
    return jsonResponse(200, { success: true, message: genericMessage })
  } catch (error) {
    console.error("Unable to send ministry login link:", error)
    return jsonResponse(500, { message: error.message === "Login email is not configured" ? error.message : "Unable to send sign-in link" })
  } finally { await client.end().catch(() => {}) }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
