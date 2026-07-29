import ministryDetail from "./legacy/ministry-detail.js"
import ministryInvitationResponse from "./legacy/ministry-invitation-response.js"
import ministryList from "./legacy/ministry-list.js"
import ministryLogin from "./legacy/ministry-login.js"
import ministryMembers from "./legacy/ministry-members.js"
import ministryMembershipRequestResponse from "./legacy/ministry-membership-request-response.js"
import ministryProfileSeparation from "./legacy/ministry-profile-separation.js"
import ministryProfile from "./legacy/ministry-profile.js"
import ministryProfiles from "./legacy/ministry-profiles.js"
import ministrySession from "./legacy/ministry-session.js"

const handlers: Record<string, (event: any) => Promise<any>> = {
  "ministry-detail": ministryDetail.handler,
  "ministry-invitation-response": ministryInvitationResponse.handler,
  "ministry-list": ministryList.handler,
  "ministry-login": ministryLogin.handler,
  "ministry-members": ministryMembers.handler,
  "ministry-membership-request-response":
    ministryMembershipRequestResponse.handler,
  "ministry-profile-separation": ministryProfileSeparation.handler,
  "ministry-profile": ministryProfile.handler,
  "ministry-profiles": ministryProfiles.handler,
  "ministry-session": ministrySession.handler,
}

const toEvent = async (request: Request) => {
  const url = new URL(request.url)
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : await request.text()

  return {
    httpMethod: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
    rawUrl: request.url,
    path: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
  }
}

export const runLegacyHandler = async (name: string, request: Request) => {
  const handler = handlers[name]
  if (!handler) return null

  const result = await handler(await toEvent(request))
  const headers = new Headers(result.headers || {})
  headers.set("Cache-Control", "private, no-store, max-age=0")

  const body = result.isBase64Encoded
    ? Uint8Array.from(Buffer.from(result.body || "", "base64"))
    : result.body || ""

  return new Response(body, {
    status: result.statusCode || 200,
    headers,
  })
}
