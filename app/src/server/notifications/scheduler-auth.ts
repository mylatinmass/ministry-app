import { OAuth2Client } from "google-auth-library"

const client = new OAuth2Client()

export const verifySchedulerRequest = async (request: Request) => {
  const authorization = request.headers.get("authorization") || ""
  const [scheme, token] = authorization.split(" ")
  const audience = process.env.GOOGLE_SCHEDULER_AUDIENCE
  const expectedEmail = process.env.GOOGLE_SCHEDULER_SERVICE_ACCOUNT

  if (
    scheme !== "Bearer" ||
    !token ||
    !audience ||
    !expectedEmail
  ) {
    return false
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience,
    })
    const payload = ticket.getPayload()
    return Boolean(
      payload?.email_verified &&
        payload.email === expectedEmail &&
        ["accounts.google.com", "https://accounts.google.com"].includes(
          payload.iss || "",
        ),
    )
  } catch {
    return false
  }
}
