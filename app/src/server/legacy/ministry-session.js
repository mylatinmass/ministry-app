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

const handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  const jwtSecret = process.env.JWT_SECRET_KEY

  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, { message: "Ministries login is not configured" })
  }

  let payload
  try {
    payload = getMinistryTokenPayload(event, jwtSecret)
  } catch (error) {
    return jsonResponse(401, { valid: false, message: "Session expired" })
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    const context = await getMinistryIdentityContext(client, payload)

    if (!context) {
      return jsonResponse(401, {
        valid: false,
        message: "Ministry access is inactive",
      })
    }

    return jsonResponse(200, {
      valid: true,
      actor: toPublicMinistryUser(context.actor),
      user: toPublicMinistryUser(context.user),
      isManagedProfile: context.isManagedProfile,
      authMethod: context.authMethod,
      restrictedSession: context.isEmailLinkSession,
    })
  } catch (error) {
    console.error("Ministries session validation failed:", error)
    return jsonResponse(500, { valid: false, message: "Unable to validate session" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
