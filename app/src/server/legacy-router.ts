type LegacyHandler = (event: any) => Promise<any>

type LegacyModule = {
  handler: LegacyHandler
}

let handlersPromise: Promise<Record<string, LegacyHandler>> | null = null

const unwrap = (module: any): LegacyModule =>
  (module.default || module) as LegacyModule

const loadLegacyHandlers = async () => {
  if (import.meta.env.DEV) {
    const { createRequire } = await import("node:module")
    const require = createRequire(import.meta.url)
    return {
      "ministry-detail": require("./legacy/ministry-detail.js").handler,
      "ministry-invitation-response":
        require("./legacy/ministry-invitation-response.js").handler,
      "ministry-list": require("./legacy/ministry-list.js").handler,
      "ministry-login": require("./legacy/ministry-login.js").handler,
      "ministry-login-link": require("./legacy/ministry-login-link.js").handler,
      "ministry-login-link-response":
        require("./legacy/ministry-login-link-response.js").handler,
      "ministry-members": require("./legacy/ministry-members.js").handler,
      "ministry-membership-request-response":
        require("./legacy/ministry-membership-request-response.js").handler,
      "ministry-profile-separation":
        require("./legacy/ministry-profile-separation.js").handler,
      "ministry-profile": require("./legacy/ministry-profile.js").handler,
      "ministry-profiles": require("./legacy/ministry-profiles.js").handler,
      "ministry-session": require("./legacy/ministry-session.js").handler,
    }
  }

  const [
    ministryDetail,
    ministryInvitationResponse,
    ministryList,
    ministryLogin,
    ministryLoginLink,
    ministryLoginLinkResponse,
    ministryMembers,
    ministryMembershipRequestResponse,
    ministryProfileSeparation,
    ministryProfile,
    ministryProfiles,
    ministrySession,
  ] = await Promise.all([
    import("./legacy/ministry-detail.js"),
    import("./legacy/ministry-invitation-response.js"),
    import("./legacy/ministry-list.js"),
    import("./legacy/ministry-login.js"),
    import("./legacy/ministry-login-link.js"),
    import("./legacy/ministry-login-link-response.js"),
    import("./legacy/ministry-members.js"),
    import("./legacy/ministry-membership-request-response.js"),
    import("./legacy/ministry-profile-separation.js"),
    import("./legacy/ministry-profile.js"),
    import("./legacy/ministry-profiles.js"),
    import("./legacy/ministry-session.js"),
  ])

  return {
    "ministry-detail": unwrap(ministryDetail).handler,
    "ministry-invitation-response":
      unwrap(ministryInvitationResponse).handler,
    "ministry-list": unwrap(ministryList).handler,
    "ministry-login": unwrap(ministryLogin).handler,
    "ministry-login-link": unwrap(ministryLoginLink).handler,
    "ministry-login-link-response": unwrap(ministryLoginLinkResponse).handler,
    "ministry-members": unwrap(ministryMembers).handler,
    "ministry-membership-request-response":
      unwrap(ministryMembershipRequestResponse).handler,
    "ministry-profile-separation":
      unwrap(ministryProfileSeparation).handler,
    "ministry-profile": unwrap(ministryProfile).handler,
    "ministry-profiles": unwrap(ministryProfiles).handler,
    "ministry-session": unwrap(ministrySession).handler,
  }
}

const getHandlers = () => {
  if (!handlersPromise) handlersPromise = loadLegacyHandlers()
  return handlersPromise
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
  const handler = (await getHandlers())[name]
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
