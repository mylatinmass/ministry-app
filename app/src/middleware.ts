import { defineMiddleware } from "astro:middleware"

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next()
  const pathname = context.url.pathname

  if (
    pathname.startsWith("/ministry/api/") ||
    pathname === "/ministry/service-worker.js" ||
    pathname === "/ministry/manifest.webmanifest" ||
    !pathname.startsWith("/ministry/_astro/")
  ) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0")
  }

  if (pathname === "/ministry/service-worker.js") {
    response.headers.set("Service-Worker-Allowed", "/ministry/")
  }

  return response
})
