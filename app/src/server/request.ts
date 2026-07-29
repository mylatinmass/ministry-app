export const json = (
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store, max-age=0",
      ...headers,
    },
  })

export const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") || ""
  const [scheme, token] = authorization.split(" ")
  return scheme === "Bearer" && token ? token : ""
}
