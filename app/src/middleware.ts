import { defineMiddleware } from "astro:middleware"

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next()
  const pathname = context.url.pathname

  if (
    pathname.startsWith("/api/") ||
    pathname === "/service-worker.js" ||
    pathname === "/manifest.webmanifest" ||
    !pathname.startsWith("/_astro/")
  ) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0")
  }

  if (pathname === "/service-worker.js") {
    response.headers.set("Service-Worker-Allowed", "/")
  }

  return response
})
