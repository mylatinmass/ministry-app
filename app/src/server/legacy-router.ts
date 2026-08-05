type LegacyHandler = (event: any) => Promise<any>

type LegacyModule = {
  handler: LegacyHandler
}

let handlersPromise: Promise<Record<string, LegacyHandler>> | null = null

const unwrap = (module: any): LegacyModule =>
  (module.default || module) as LegacyModule

const loadLegacyHandlers = async (): Promise<Record<string, LegacyHandler>> => {
  if (import.meta.env.DEV) {
    const { createRequire } = await import("node:module")
    const require = createRequire(import.meta.url)
    const freshHandler = (relativePath: string) => {
      const resolvedPath = require.resolve(relativePath)
      delete require.cache[resolvedPath]
      return require(resolvedPath).handler as LegacyHandler
    }
    return {
      "ministry-access-request": freshHandler("./legacy/ministry-access-request.js"),
      "ministry-global-members": freshHandler("./legacy/ministry-global-members.js"),
      "ministry-detail": freshHandler("./legacy/ministry-detail.js"),
      "ministry-invitation-response": freshHandler("./legacy/ministry-invitation-response.js"),
      "ministry-list": freshHandler("./legacy/ministry-list.js"),
      "ministry-login": freshHandler("./legacy/ministry-login.js"),
      "ministry-login-link": freshHandler("./legacy/ministry-login-link.js"),
      "ministry-login-link-response": freshHandler("./legacy/ministry-login-link-response.js"),
      "ministry-members": freshHandler("./legacy/ministry-members.js"),
      "ministry-membership-request-response": freshHandler("./legacy/ministry-membership-request-response.js"),
      "ministry-profile-separation": freshHandler("./legacy/ministry-profile-separation.js"),
      "ministry-profile": freshHandler("./legacy/ministry-profile.js"),
      "ministry-profiles": freshHandler("./legacy/ministry-profiles.js"),
      "ministry-session": freshHandler("./legacy/ministry-session.js"),
    }
  }

  const [
    ministryAccessRequest,
    ministryGlobalMembers,
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
    import("./legacy/ministry-access-request.js"),
    import("./legacy/ministry-global-members.js"),
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
    "ministry-access-request": unwrap(ministryAccessRequest).handler,
    "ministry-global-members": unwrap(ministryGlobalMembers).handler,
    "ministry-detail": unwrap(ministryDetail).handler,
    "ministry-invitation-response": unwrap(ministryInvitationResponse).handler,
    "ministry-list": unwrap(ministryList).handler,
    "ministry-login": unwrap(ministryLogin).handler,
    "ministry-login-link": unwrap(ministryLoginLink).handler,
    "ministry-login-link-response": unwrap(ministryLoginLinkResponse).handler,
    "ministry-members": unwrap(ministryMembers).handler,
    "ministry-membership-request-response": unwrap(
      ministryMembershipRequestResponse
    ).handler,
    "ministry-profile-separation": unwrap(ministryProfileSeparation).handler,
    "ministry-profile": unwrap(ministryProfile).handler,
    "ministry-profiles": unwrap(ministryProfiles).handler,
    "ministry-session": unwrap(ministrySession).handler,
  }
}

const getHandlers = () => {
  if (import.meta.env.DEV) return loadLegacyHandlers()
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
