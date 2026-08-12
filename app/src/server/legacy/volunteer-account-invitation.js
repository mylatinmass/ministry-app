const { Client } = require("pg")
const { hashPassword } = require("./passwords")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const { createMinistryToken, toPublicMinistryUser } = require("./helper/ministry-auth")
const { hashVolunteerInvitationToken } = require("./helper/volunteer-account-invitations")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
})

const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { message: "Method not allowed" })
  let body
  try { body = JSON.parse(event.body || "{}") } catch { return jsonResponse(400, { message: "Invalid request" }) }
  const token = body.token?.toString() || ""
  if (token.length < 32) return jsonResponse(400, { message: "Account invitation is incomplete" })
  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!connectionString || !jwtSecret) return jsonResponse(500, { message: "Volunteer accounts are not configured" })
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const load = (forUpdate = false) => client.query(
      `SELECT invitation.id, invitation.user_id, invitation.status,
              invitation.expires_at, invitation.consumed_at, invitation.revoked_at,
              users.first_name, users.last_name, users.username,
              users.password_hash, users.global_role, users.status AS user_status,
              event.title AS event_title, responsibility.name AS responsibility_name
       FROM volunteer_account_invitations invitation
       JOIN users ON users.id = invitation.user_id
       JOIN responsibility_assignments assignment ON assignment.id = invitation.assignment_id
       JOIN events event ON event.id = assignment.event_id
       JOIN event_responsibilities responsibility ON responsibility.id = assignment.responsibility_id
       WHERE invitation.token_hash = $1 LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
      [hashVolunteerInvitationToken(token)]
    )
    if (body.action === "inspect") {
      const row = (await load()).rows[0]
      if (!row) return jsonResponse(404, { message: "Account invitation not found" })
      return jsonResponse(200, {
        invitation: {
          firstName: row.first_name || "",
          lastName: row.last_name || "",
          eventTitle: row.event_title,
          responsibilityName: row.responsibility_name,
          status: row.status,
          expired: new Date(row.expires_at).getTime() <= Date.now(),
          expiresAt: row.expires_at,
        },
      })
    }
    if (body.action !== "activate") return jsonResponse(400, { message: "Unknown action" })
    const password = body.password?.toString() || ""
    if (password.length < 8) return jsonResponse(400, { message: "Password must be at least 8 characters" })
    const passwordHash = await hashPassword(password)
    await client.query("BEGIN")
    const row = (await load(true)).rows[0]
    if (!row || row.status !== "pending" || row.consumed_at || row.revoked_at) {
      await client.query("ROLLBACK")
      return jsonResponse(410, { message: "This account invitation is invalid or already used" })
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query(`UPDATE volunteer_account_invitations SET status = 'expired', updated_at = now() WHERE id = $1`, [row.id])
      await client.query("COMMIT")
      return jsonResponse(410, { message: "This account invitation has expired" })
    }
    if (row.user_status !== "active") {
      await client.query("ROLLBACK")
      return jsonResponse(403, { message: "This profile is inactive" })
    }
    await client.query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [row.user_id, passwordHash])
    await client.query(`UPDATE volunteer_account_invitations SET status = 'accepted', consumed_at = now(), updated_at = now() WHERE id = $1`, [row.id])
    await client.query(`UPDATE volunteer_account_invitations SET status = 'revoked', revoked_at = now(), updated_at = now() WHERE user_id = $1 AND id <> $2 AND status = 'pending'`, [row.user_id, row.id])
    await client.query("COMMIT")
    const user = {
      id: row.user_id, first_name: row.first_name, last_name: row.last_name,
      username: row.username, global_role: row.global_role,
    }
    return jsonResponse(200, {
      success: true,
      status: "accepted",
      message: "Your volunteer account is ready",
      token: createMinistryToken(user, jwtSecret, { authMethod: "password" }),
      user: toPublicMinistryUser(user),
    })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("Unable to activate volunteer account:", error)
    return jsonResponse(500, { message: "Unable to activate volunteer account" })
  } finally { await client.end().catch(() => {}) }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
