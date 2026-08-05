const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const { isValidEmail, normalizeEmail } = require("./helper/ministry-invitations")

const genericMessage =
  "Your request has been received. If you are eligible, an administrator will email you an invitation."

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
})

const cleanText = (value, maximum) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  let body
  try {
    body = JSON.parse(event.body || "{}")
  } catch {
    return jsonResponse(400, { message: "Invalid request" })
  }

  // Quietly accept bot-filled submissions without saving them.
  if (cleanText(body.website, 200)) {
    return jsonResponse(200, { success: true, message: genericMessage })
  }

  const firstName = cleanText(body.firstName, 100)
  const lastName = cleanText(body.lastName, 100)
  const email = normalizeEmail(body.email)
  const phone = cleanText(body.phone, 50) || null
  const message = cleanText(body.message, 2000) || null

  if (!firstName || !lastName || !isValidEmail(email)) {
    return jsonResponse(400, {
      message: "Enter your first name, last name, and a valid email address.",
    })
  }

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  if (!connectionString) {
    return jsonResponse(500, { message: "Access requests are not configured" })
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()

    const eligibleAccount = await client.query(
      `
        SELECT 1
        FROM users user_account
        WHERE lower(btrim(user_account.email)) = $1
          AND user_account.status = 'active'
          AND (
            user_account.global_role IN ('owner', 'super_admin')
            OR EXISTS (
              SELECT 1
              FROM ministry_members membership
              JOIN ministries ministry ON ministry.id = membership.ministry_id
              WHERE membership.user_id = user_account.id
                AND membership.status = 'active'
                AND ministry.status = 'active'
            )
          )
        LIMIT 1
      `,
      [email]
    )

    if (eligibleAccount.rowCount) {
      return jsonResponse(200, { success: true, message: genericMessage })
    }

    const recent = await client.query(
      `
        SELECT 1
        FROM ministry_access_requests
        WHERE lower(email) = $1
          AND (status = 'pending' OR created_at > now() - INTERVAL '24 hours')
        LIMIT 1
      `,
      [email]
    )
    if (recent.rowCount) {
      return jsonResponse(200, { success: true, message: genericMessage })
    }

    await client.query(
      `
        INSERT INTO ministry_access_requests (
          first_name, last_name, email, phone, message
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [firstName, lastName, email, phone, message]
    )

    return jsonResponse(201, { success: true, message: genericMessage })
  } catch (error) {
    if (error.code === "23505") {
      return jsonResponse(200, { success: true, message: genericMessage })
    }
    console.error("Unable to create ministry access request:", error)
    return jsonResponse(500, { message: "Unable to submit your request" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
