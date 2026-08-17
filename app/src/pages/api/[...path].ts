import type { APIRoute } from "astro"
import { assertMinistryDatabaseIsolation } from "../../server/database"
import { runLegacyHandler } from "../../server/legacy-router"
import {
  handleSubscriptions,
  handleTestPush,
  handleVapidPublicKey,
} from "../../server/notifications/subscriptions"
import { handleReminderProcessing } from "../../server/notifications/reminders"
import { handleAlerts } from "../../server/notifications/alerts"
import { handleMessages } from "../../server/notifications/messages"
import {
  handleTelegramConnection,
  handleTelegramSetup,
  handleTelegramWebhook,
} from "../../server/notifications/telegram"
import { json } from "../../server/request"
import { handleEvents } from "../../server/scheduling/events"
import { handleTemplates } from "../../server/scheduling/templates"
import { handleAvailability } from "../../server/scheduling/availability"
import { handleOrdo } from "../../server/scheduling/ordo"
import { handleReports } from "../../server/scheduling/reports"
import { handleVolunteerSignup } from "../../server/scheduling/volunteers"
import { handleVolunteerEvents } from "../../server/scheduling/volunteer-events"
import { handleSupport } from "../../server/support"
import { handleChapelSettings } from "../../server/chapel-settings"
import { handlePriestAppointmentDetails } from "../../server/scheduling/priest-appointments"
import { handlePrioryAllocations } from "../../server/scheduling/priory-allocations"

export const prerender = false

const route: APIRoute = async ({ params, request }) => {
  await assertMinistryDatabaseIsolation()
  const path = (params.path || "").replace(/^\/+|\/+$/g, "")

  if (path === "push/vapid-public-key" && request.method === "GET") {
    return handleVapidPublicKey()
  }
  if (path === "push/subscriptions") {
    return handleSubscriptions(request)
  }
  if (path === "push/test") {
    return handleTestPush(request)
  }
  if (path === "telegram/connection") {
    return handleTelegramConnection(request)
  }
  if (path === "telegram/setup") {
    return handleTelegramSetup(request)
  }
  if (path === "telegram/webhook") {
    return handleTelegramWebhook(request)
  }
  if (path === "reminders/process") {
    return handleReminderProcessing(request)
  }
  if (path === "notifications") {
    return handleAlerts(request)
  }
  if (path === "messages") {
    return handleMessages(request)
  }
  if (path === "scheduling/templates") {
    return handleTemplates(request)
  }
  if (path === "scheduling/events") {
    return handleEvents(request)
  }
  if (path === "scheduling/priest-appointment-details") {
    return handlePriestAppointmentDetails(request)
  }
  if (path === "scheduling/priory-allocations") {
    return handlePrioryAllocations(request)
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
  if (path === "chapel-settings") {
    return handleChapelSettings(request)
  }

  const legacyResponse = await runLegacyHandler(path, request)
  if (legacyResponse) return legacyResponse

  return json({ message: "API route not found" }, 404)
}

export const ALL = route
