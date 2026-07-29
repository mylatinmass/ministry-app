import { getPool } from "./database"
import { getLegacyAuth } from "./legacy-auth"

export const getAuthenticatedIdentity = async (request: Request) => {
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!jwtSecret) throw new Error("JWT_SECRET_KEY is not configured")
  const {
    getMinistryIdentityContext,
    getMinistryTokenPayload,
  } = await getLegacyAuth()

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
