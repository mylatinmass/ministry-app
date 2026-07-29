import { getPool } from "./database"
import ministryAuth from "./legacy/helper/ministry-auth.js"

const {
  getMinistryIdentityContext,
  getMinistryTokenPayload,
} = ministryAuth

export const getAuthenticatedIdentity = async (request: Request) => {
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!jwtSecret) throw new Error("JWT_SECRET_KEY is not configured")

  const event = {
    headers: Object.fromEntries(request.headers.entries()),
  }
  const payload = getMinistryTokenPayload(event, jwtSecret)
  const client = await getPool().connect()

  try {
    const context = await getMinistryIdentityContext(client, payload)
    if (!context) throw new Error("Ministry access is inactive")
    return context
  } finally {
    client.release()
  }
}
