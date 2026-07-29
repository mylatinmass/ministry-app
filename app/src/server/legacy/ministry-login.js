const { Client } = require("pg")
const { verifyPassword } = require("./passwords")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  createMinistryToken,
  getMinistryUserByUsername,
  hasMinistryAccess,
  toPublicMinistryUser,
} = require("./helper/ministry-auth")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  const jwtSecret = process.env.JWT_SECRET_KEY

  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, { message: "Ministries login is not configured" })
  }

  let body
  try {
    body = JSON.parse(event.body || "{}")
  } catch (error) {
    return jsonResponse(400, { message: "Invalid request" })
  }

  const username = body.username?.toString().trim()
  const password = body.password?.toString()

  if (!username || !password) {
    return jsonResponse(400, {
      success: false,
      message: "Username and password are required.",
    })
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    const user = await getMinistryUserByUsername(client, username)
    const passwordMatches =
      user?.password_hash &&
      (await verifyPassword(password, user.password_hash).catch(() => false))

    if (
      !user ||
      user.status !== "active" ||
      !hasMinistryAccess(user) ||
      !passwordMatches
    ) {
      return jsonResponse(401, {
        success: false,
        message: "Invalid credentials or inactive ministry access.",
      })
    }

    return jsonResponse(200, {
      success: true,
      token: createMinistryToken(user, jwtSecret),
      user: toPublicMinistryUser(user),
    })
  } catch (error) {
    console.error("Ministries login failed:", error)
    return jsonResponse(500, { message: "Unable to complete login" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
