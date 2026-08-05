import type { APIRoute } from "astro"
import { runLegacyHandler } from "../../server/legacy-router"
import {
  handleSubscriptions,
  handleVapidPublicKey,
} from "../../server/notifications/subscriptions"
import { handleReminderProcessing } from "../../server/notifications/reminders"
import { json } from "../../server/request"
import { handleEvents } from "../../server/scheduling/events"
import { handleTemplates } from "../../server/scheduling/templates"
import { handleAvailability } from "../../server/scheduling/availability"
import { handleOrdo } from "../../server/scheduling/ordo"
import { handleReports } from "../../server/scheduling/reports"
import { handleVolunteerSignup } from "../../server/scheduling/volunteers"
import { handleVolunteerEvents } from "../../server/scheduling/volunteer-events"
import { handleSupport } from "../../server/support"

export const prerender = false

const route: APIRoute = async ({ params, request }) => {
  const path = (params.path || "").replace(/^\/+|\/+$/g, "")

  if (path === "push/vapid-public-key" && request.method === "GET") {
    return handleVapidPublicKey()
  }
  if (path === "push/subscriptions") {
    return handleSubscriptions(request)
  }
  if (path === "reminders/process") {
    return handleReminderProcessing(request)
  }
  if (path === "scheduling/templates") {
    return handleTemplates(request)
  }
  if (path === "scheduling/events") {
    return handleEvents(request)
  }
  if (path === "scheduling/availability") {
    return handleAvailability(request)
  }
  if (path === "scheduling/ordo") {
    return handleOrdo(request)
  }
  if (path === "scheduling/reports") {
    return handleReports(request)
  }
  if (path === "volunteer-signup") {
    return handleVolunteerSignup(request)
  }
  if (path === "scheduling/volunteer-events") {
    return handleVolunteerEvents(request)
  }
  if (path === "support") {
    return handleSupport(request)
  }

  const legacyResponse = await runLegacyHandler(path, request)
  if (legacyResponse) return legacyResponse

  return json({ message: "API route not found" }, 404)
}

export const ALL = route
