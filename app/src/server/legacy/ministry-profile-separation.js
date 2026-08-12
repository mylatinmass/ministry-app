const { Client } = require("pg")
const { hashPassword } = require("./passwords")
const {
  queueKlaviyoProfileSync,
} = require("./helper/klaviyo-profile-sync")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  createMinistryToken,
  normalizeUsername,
} = require("./helper/ministry-auth")
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

const usernameError = (username) => {
  if (username.length < 4) return "Username must be at least 4 characters"
  if (username.length > 40) return "Username must be 40 characters or fewer"
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return "Use only letters, numbers, periods, underscores, or hyphens"
  }
  return ""
}

const loadSeparation = async (client, token, forUpdate = false) => {
  const result = await client.query(
    `
      SELECT
        separation.id,
        separation.managed_profile_id,
        separation.child_user_id,
        separation.new_email,
        separation.status,
        separation.expires_at,
        child.first_name,
        child.last_name,
        guardian.id AS guardian_user_id
      FROM managed_profile_separations separation
      JOIN managed_profiles profile ON profile.id = separation.managed_profile_id
      JOIN users child ON child.id = separation.child_user_id
      JOIN users guardian ON guardian.id = profile.guardian_user_id
      WHERE separation.token_hash = $1
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [hashInvitationToken(token)]
  )
  return result.rows[0] || null
}

const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { message: "Method not allowed" })
  const body = parseBody(event)
  if (!body?.token) return jsonResponse(400, { message: "Activation token is required" })

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!connectionString || !jwtSecret) return jsonResponse(500, { message: "Activation is not configured" })

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const separation = await loadSeparation(client, body.token)
    if (!separation) return jsonResponse(404, { message: "Activation link not found" })
    const expired = new Date(separation.expires_at).getTime() <= Date.now()
    if (body.action === "inspect") {
      return jsonResponse(200, {
        separation: {
          firstName: separation.first_name,
          lastName: separation.last_name,
          status: separation.status,
          expired,
          expiresAt: separation.expires_at,
        },
      })
    }

    const username = normalizeUsername(body.username)
    if (body.action === "check_username") {
      const validationMessage = usernameError(username)
      if (validationMessage) return jsonResponse(200, { available: false, message: validationMessage })
      const duplicate = await client.query(
        `SELECT 1 FROM users WHERE lower(username) = $1 AND id <> $2 LIMIT 1`,
        [username, separation.child_user_id]
      )
      return jsonResponse(200, {
        available: !duplicate.rowCount,
        message: duplicate.rowCount ? "Username is already in use" : "Username is available",
      })
    }

    if (body.action !== "accept") return jsonResponse(400, { message: "Unknown activation action" })
    const validationMessage = usernameError(username)
    const password = body.password?.toString() || ""
    const phone = body.phone?.toString().trim() || ""
    if (validationMessage) return jsonResponse(400, { message: validationMessage })
    if (password.length < 8) return jsonResponse(400, { message: "Password must be at least 8 characters" })
    if (separation.status !== "pending") return jsonResponse(409, { message: "This activation was already completed" })
    if (expired) return jsonResponse(410, { message: "This activation link has expired" })

    const duplicate = await client.query(
      `SELECT 1 FROM users WHERE lower(username) = $1 AND id <> $2 LIMIT 1`,
      [username, separation.child_user_id]
    )
    if (duplicate.rowCount) return jsonResponse(409, { message: "Username is already in use" })
    const passwordHash = await hashPassword(password)

    await client.query("BEGIN")
    try {
      const locked = await loadSeparation(client, body.token, true)
      if (!locked || locked.status !== "pending" || new Date(locked.expires_at).getTime() <= Date.now()) {
        await client.query("ROLLBACK")
        return jsonResponse(409, { message: "This activation is no longer available" })
      }
      const emailOwner = await client.query(
        `
          SELECT 1
          FROM users
          WHERE lower(btrim(email)) = $1
            AND id <> $2
          LIMIT 1
        `,
        [locked.new_email, locked.child_user_id]
      )
      if (emailOwner.rowCount) {
        await client.query("ROLLBACK")
        return jsonResponse(409, {
          message:
            "That email is now connected to another account. Ask your guardian to send a new activation invitation.",
        })
      }
      const userResult = await client.query(
        `
          UPDATE users
          SET email = $1, phone = NULLIF($2, ''), telephone = NULLIF($2, ''),
            username = $3, password_hash = $4, updated_at = now()
          WHERE id = $5
          RETURNING id, first_name, last_name, username, global_role, status
        `,
        [locked.new_email, phone, username, passwordHash, locked.child_user_id]
      )
      await client.query(
        `UPDATE managed_profile_separations SET status = 'accepted', accepted_at = now(), updated_at = now() WHERE id = $1`,
        [locked.id]
      )
      await client.query(
        `UPDATE managed_profiles SET status = 'separated', ended_at = now(), updated_at = now() WHERE id = $1`,
        [locked.managed_profile_id]
      )
      await client.query(
        `
          INSERT INTO managed_profile_audit (
            actor_user_id, subject_user_id, action, entity_type, entity_id
          ) VALUES ($1, $1, 'separation.completed', 'managed_profile_separation', $2)
        `,
        [locked.child_user_id, locked.id]
      )
      await queueKlaviyoProfileSync(client, locked.child_user_id)
      await client.query("COMMIT")
      return jsonResponse(200, {
        success: true,
        status: "accepted",
        message: "Your independent account is ready. Your full ministry history was preserved.",
        token: createMinistryToken(userResult.rows[0], jwtSecret),
      })
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  } catch (error) {
    console.error("Unable to activate independent profile:", error)
    if (error.code === "23505") return jsonResponse(409, { message: "Username is already in use" })
    return jsonResponse(500, { message: "Unable to activate this profile" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
