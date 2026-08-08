import pg from "pg"
import {
  DEFAULT_LOCATION,
  DEFAULT_TIME_ZONE,
  syncMassSchedule,
} from "./lib/mass-schedule-sync.mjs"

const { Client } = pg

const DEFAULT_SOURCE_URL =
  "https://script.google.com/macros/s/AKfycbzTgfDwfVyJNQBkCnE6gVSMwxjDybeoFZiMGSSH-MOmd62HAYgiZ-6emkzwiqUmr7Mkhg/exec"
const DEFAULT_LITURGICAL_DAYS_URL =
  "https://drive.google.com/uc?export=download&id=1YoY6iGwzwydIjPqIJmmsYNipHO4lOA0Z"

const buildMode = process.argv.includes("--build")
const required =
  process.argv.includes("--required") ||
  process.env.MASS_SCHEDULE_SYNC_REQUIRED === "true"
const connectionString = process.env.COCKROACHDB_CONNECTION_STRING

const retryableStatuses = new Set([404, 408, 425, 429, 500, 502, 503, 504])

const fetchSchedulePayload = async (sourceUrl) => {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const separator = sourceUrl.includes("?") ? "&" : "?"
      const requestUrl =
        attempt === 1
          ? sourceUrl
          : `${sourceUrl}${separator}ministrySyncAttempt=${Date.now()}-${attempt}`
      const response = await fetch(requestUrl, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(15_000),
      })
      if (response.ok) return response.json()
      lastError = new Error(`Mass Schedule returned HTTP ${response.status}`)
      if (!retryableStatuses.has(response.status)) throw lastError
    } catch (error) {
      lastError = error
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 750))
    }
  }
  throw lastError || new Error("Mass Schedule could not be retrieved")
}

const skipOrThrow = (message, error) => {
  const detail = error?.message ? `${message}: ${error.message}` : message
  if (required || !buildMode) throw new Error(detail, { cause: error })
  console.warn(`${detail}. The build will continue with the last imported schedule.`)
}

if (!connectionString) {
  skipOrThrow(
    "Mass Schedule sync skipped because COCKROACHDB_CONNECTION_STRING is not configured",
  )
} else {
  const sourceUrl = process.env.MASS_SCHEDULE_URL || DEFAULT_SOURCE_URL
  const liturgicalDaysUrl =
    process.env.MASS_SCHEDULE_LITURGICAL_DAYS_URL ||
    DEFAULT_LITURGICAL_DAYS_URL
  let client
  try {
    const [payload, liturgicalPayload] = await Promise.all([
      fetchSchedulePayload(sourceUrl),
      fetchSchedulePayload(liturgicalDaysUrl),
    ])
    const liturgicalNamesByDate = new Map(
      (liturgicalPayload.liturgicalDays || []).map((day) => [
        String(day.date || "").replaceAll("-", ""),
        day.name || "",
      ]),
    )
    payload.massDays = (payload.massDays || []).map((day) => ({
      ...day,
      eventName:
        liturgicalNamesByDate.get(String(day.dayYMD || "").replaceAll("-", "")) ||
        "",
    }))
    client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    const summary = await syncMassSchedule(client, payload, {
      location: process.env.MASS_SCHEDULE_LOCATION || DEFAULT_LOCATION,
      timeZone: process.env.MASS_SCHEDULE_TIME_ZONE || DEFAULT_TIME_ZONE,
      ministrySlugs: {
        sacristans:
          process.env.MASS_SCHEDULE_SACRISTANS_MINISTRY_SLUG || "sacristans",
        altarServers:
          process.env.MASS_SCHEDULE_ALTAR_SERVERS_MINISTRY_SLUG ||
          "altar-servers",
        ushers: process.env.MASS_SCHEDULE_USHERS_MINISTRY_SLUG || "ushers",
      },
    })
    console.log(`Mass Schedule sync complete: ${JSON.stringify(summary)}`)
  } catch (error) {
    skipOrThrow("Mass Schedule sync failed", error)
  } finally {
    if (client) await client.end()
  }
}
