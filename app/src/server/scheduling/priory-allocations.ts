import crypto from "node:crypto"
import { GoogleAuth } from "google-auth-library"
import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import { sendReliableEmail } from "../notifications/delivery"
import {
  getIdentityContext,
  getMinistryAccess,
  writeSchedulingAudit,
} from "./authorization"

const cleanText = (value: unknown, maximum = 500) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const hash = (value: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/
const DAY_NAMES = new Map([
  ["sunday", 0], ["sun", 0], ["monday", 1], ["mon", 1],
  ["tuesday", 2], ["tue", 2], ["wednesday", 3], ["wed", 3],
  ["thursday", 4], ["thu", 4], ["friday", 5], ["fri", 5],
  ["saturday", 6], ["sat", 6],
])

type PriorySettings = {
  enabled: boolean
  spreadsheetId: string
  missionId: string
  missionName: string
  timeZone: string
  priestsTab: string
  allocationsTab: string
  exceptionsTab: string
  requestsTab: string
  lastSyncStartedAt: string | null
  lastSyncSucceededAt: string | null
  lastSyncError: string | null
}

const settingsFromRow = (row: any): PriorySettings => ({
  enabled: Boolean(row?.enabled),
  spreadsheetId: row?.spreadsheet_id || "",
  missionId: row?.mission_id || "",
  missionName: row?.mission_name || "",
  timeZone: row?.time_zone || "America/New_York",
  priestsTab: row?.priests_tab || "Priests",
  allocationsTab: row?.allocations_tab || "Allocations",
  exceptionsTab: row?.exceptions_tab || "Exceptions",
  requestsTab: row?.requests_tab || "Requests",
  lastSyncStartedAt: row?.last_sync_started_at || null,
  lastSyncSucceededAt: row?.last_sync_succeeded_at || null,
  lastSyncError: row?.last_sync_error || null,
})

export const loadPriorySettings = async (client: PoolClient) => {
  await client.query(
    `INSERT INTO priory_integration_settings (setting_key)
     VALUES ('primary') ON CONFLICT (setting_key) DO NOTHING`,
  )
  const result = await client.query(
    `SELECT * FROM priory_integration_settings WHERE setting_key = 'primary'`,
  )
  return settingsFromRow(result.rows[0])
}

const googleCredentials = () => {
  const raw = process.env.GOOGLE_PRIORY_SCHEDULE_CREDENTIALS_JSON
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      throw new Error("GOOGLE_PRIORY_SCHEDULE_CREDENTIALS_JSON is invalid")
    }
  }
  const clientEmail = process.env.GOOGLE_PRIORY_SCHEDULE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIORY_SCHEDULE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  )
  return clientEmail && privateKey
    ? { client_email: clientEmail, private_key: privateKey }
    : null
}

const sheetsToken = async () => {
  const credentials = googleCredentials()
  if (!credentials) {
    throw new Error("Priory Google Sheets credentials are not configured")
  }
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) throw new Error("Unable to authorize the Priory schedule")
  return token.token
}

const sendPrioryTelegramMessage = async (chatId: string, text: string) => {
  const token = cleanText(process.env.TELEGRAM_BOT_TOKEN, 500)
  if (!token) throw new Error("Telegram is not configured")
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  })
  const result: any = await response.json().catch(() => ({}))
  if (!response.ok || result.ok !== true) {
    throw new Error(result.description || "Unable to send the Priory Telegram notice")
  }
}

const sheetRange = (tab: string) => `'${tab.replace(/'/g, "''")}'!A:Z`

const fetchSheetValues = async (settings: PriorySettings) => {
  const token = await sheetsToken()
  const query = new URLSearchParams()
  for (const tab of [
    settings.priestsTab,
    settings.allocationsTab,
    settings.exceptionsTab,
    settings.requestsTab,
  ]) {
    query.append("ranges", sheetRange(tab))
  }
  query.set("majorDimension", "ROWS")
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(settings.spreadsheetId)}/values:batchGet?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const result: any = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result?.error?.message || "Unable to read the Priory schedule")
  }
  const ranges = result.valueRanges || []
  return {
    priests: ranges[0]?.values || [],
    allocations: ranges[1]?.values || [],
    exceptions: ranges[2]?.values || [],
    requests: ranges[3]?.values || [],
  }
}

const appendRequestRow = async (
  settings: PriorySettings,
  values: Array<string>,
) => {
  const token = await sheetsToken()
  const range = encodeURIComponent(sheetRange(settings.requestsTab))
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(settings.spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ majorDimension: "ROWS", values: [values] }),
    },
  )
  const result: any = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result?.error?.message || "Unable to append the Priory request")
  }
  return result?.updates?.updatedRange || ""
}

const updateRequestStatus = async (
  settings: PriorySettings,
  requestId: string,
  sheetRowReference: string,
  status: "cancelled",
) => {
  const token = await sheetsToken()
  const requestsRange = encodeURIComponent(sheetRange(settings.requestsTab))
  const readResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(settings.spreadsheetId)}/values/${requestsRange}?majorDimension=ROWS`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const readResult: any = await readResponse.json().catch(() => ({}))
  if (!readResponse.ok) {
    throw new Error(readResult?.error?.message || "Unable to locate the Priory request")
  }
  const currentRowIndex = (readResult.values || []).findIndex(
    (values: any[]) => cleanText(values?.[0], 100) === requestId,
  )
  const row = currentRowIndex >= 1
    ? String(currentRowIndex + 1)
    : sheetRowReference.match(/!A(\d+)/i)?.[1]
  if (!row) throw new Error("The Priory request row could not be identified")
  const range = encodeURIComponent(`'${settings.requestsTab.replace(/'/g, "''")}'!I${row}`)
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(settings.spreadsheetId)}/values/${range}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ majorDimension: "ROWS", values: [[status]] }),
    },
  )
  const result: any = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result?.error?.message || "Unable to cancel the Priory request in Google Sheets")
  }
}

const tableRows = (values: any[][]): any[] => {
  if (!values.length) return []
  const headers = values[0].map((header) =>
    String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
  )
  return values.slice(1).map((values, index) => ({
    sheetRow: index + 2,
    ...Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])),
  }))
}

const parseDate = (value: unknown, field: string, required = true) => {
  const text = cleanText(value, 10)
  if (!text && !required) return null
  if (!ISO_DATE.test(text)) throw new Error(`${field} must use YYYY-MM-DD`)
  return text
}

const parseTime = (value: unknown, field: string) => {
  const text = cleanText(value, 5)
  if (!CLOCK_TIME.test(text)) throw new Error(`${field} must use HH:MM`)
  return text
}

const parseWeekday = (value: unknown) => {
  const text = cleanText(value, 20).toLowerCase()
  if (/^[0-6]$/.test(text)) return Number(text)
  const day = DAY_NAMES.get(text)
  if (day === undefined) throw new Error("Day of week must be Sunday-Saturday or 0-6")
  return day
}

const activeValue = (value: unknown) =>
  typeof value === "boolean"
    ? value
    : !["inactive", "false", "no", "0"].includes(
        cleanText(value, 20).toLowerCase(),
      )

const statusCell = (row: any) =>
  row.active !== "" && row.active !== undefined ? row.active : row.status

const privacySafeEventType = (value: unknown) => {
  const title = cleanText(value, 200).toLowerCase()
  if (/sick\s*call|anoint/.test(title)) return "Sick call"
  if (/confession|penance/.test(title)) return "Confession"
  if (/\bmass\b|requiem/.test(title)) return "Mass"
  if (/travel|transit/.test(title)) return "Travel"
  if (/meeting|appointment|counsel/.test(title)) return "Appointment"
  return "Priest duty"
}

const normalizePriests = (values: any[][]) =>
  tableRows(values).map((row: any) => {
    const externalPriestId = cleanText(row.priest_id, 120)
    const displayName = cleanText(row.display_name || row.priest_name, 200)
    if (!externalPriestId || !displayName) {
      throw new Error(`Priests row ${row.sheetRow} requires Priest ID and Display Name`)
    }
    const priest = {
      externalPriestId,
      displayName,
      status: activeValue(statusCell(row)) ? "active" : "inactive",
    }
    return { ...priest, sourceHash: hash(priest) }
  })

const normalizeAllocations = (values: any[][], priestIds: Set<string>) =>
  tableRows(values).map((row: any) => {
    const sourceAllocationId = cleanText(row.allocation_id, 120)
    const externalPriestId = cleanText(row.priest_id, 120)
    const missionId = cleanText(row.mission_id, 120)
    const ruleType = cleanText(row.rule_type, 30).toLowerCase() || "one_time"
    if (!sourceAllocationId || !externalPriestId || !missionId) {
      throw new Error(`Allocations row ${row.sheetRow} requires Allocation ID, Priest ID, and Mission ID`)
    }
    if (!priestIds.has(externalPriestId)) {
      throw new Error(`Allocations row ${row.sheetRow} references an unknown Priest ID`)
    }
    if (!["weekly", "one_time"].includes(ruleType)) {
      throw new Error(`Allocations row ${row.sheetRow} has an invalid Rule Type`)
    }
    const allocation = {
      sourceAllocationId,
      externalPriestId,
      missionId,
      missionName: cleanText(row.mission_name, 200) || null,
      ruleType,
      dayOfWeek: ruleType === "weekly" ? parseWeekday(row.day_of_week) : null,
      specificDate: ruleType === "one_time"
        ? parseDate(row.date || row.specific_date, "Allocation date")
        : null,
      startTime: parseTime(row.start_time, "Allocation start time"),
      endTime: parseTime(row.end_time, "Allocation end time"),
      effectiveFrom: ruleType === "weekly"
        ? parseDate(row.effective_from, "Effective From", false)
        : null,
      effectiveTo: ruleType === "weekly"
        ? parseDate(row.effective_to, "Effective To", false)
        : null,
      timeZone: cleanText(row.time_zone || row.timezone, 100) || "America/New_York",
      status: activeValue(statusCell(row)) ? "active" : "inactive",
      linkedRequestId: cleanText(row.request_id, 100) || null,
    }
    if (allocation.endTime <= allocation.startTime) {
      throw new Error(`Allocations row ${row.sheetRow} must end after it starts`)
    }
    return { ...allocation, sourceHash: hash(allocation) }
  })

const normalizeExceptions = (values: any[][], priestIds: Set<string>) =>
  tableRows(values).map((row: any) => {
    const sourceExceptionId = cleanText(row.exception_id, 120)
    const externalPriestId = cleanText(row.priest_id, 120)
    const action = cleanText(row.action, 20).toLowerCase()
    if (!sourceExceptionId || !externalPriestId || !["cancel", "replace"].includes(action)) {
      throw new Error(`Exceptions row ${row.sheetRow} is missing a valid ID, Priest ID, or Action`)
    }
    if (!priestIds.has(externalPriestId)) {
      throw new Error(`Exceptions row ${row.sheetRow} references an unknown Priest ID`)
    }
    const exception = {
      sourceExceptionId,
      sourceAllocationId: cleanText(row.allocation_id, 120) || null,
      externalPriestId,
      exceptionDate: parseDate(row.date || row.exception_date, "Exception date"),
      action,
      replacementMissionId: action === "replace"
        ? cleanText(row.replacement_mission_id || row.mission_id, 120)
        : null,
      replacementMissionName: action === "replace"
        ? cleanText(row.replacement_mission_name || row.mission_name, 200) || null
        : null,
      replacementStartTime: action === "replace"
        ? parseTime(row.replacement_start_time || row.start_time, "Replacement start time")
        : null,
      replacementEndTime: action === "replace"
        ? parseTime(row.replacement_end_time || row.end_time, "Replacement end time")
        : null,
      status: activeValue(statusCell(row)) ? "active" : "inactive",
    }
    if (action === "replace" && !exception.replacementMissionId) {
      throw new Error(`Exceptions row ${row.sheetRow} requires a replacement Mission ID`)
    }
    return { ...exception, sourceHash: hash(exception) }
  })

const timeOverlaps = (left: any, right: any) =>
  left.startTime < right.endTime && left.endTime > right.startTime

const dateRangesOverlap = (left: any, right: any) => {
  const leftStart = left.effectiveFrom || "0001-01-01"
  const leftEnd = left.effectiveTo || "9999-12-31"
  const rightStart = right.effectiveFrom || "0001-01-01"
  const rightEnd = right.effectiveTo || "9999-12-31"
  return leftStart <= rightEnd && leftEnd >= rightStart
}

const allocationRulesOverlap = (left: any, right: any) => {
  if (left.externalPriestId !== right.externalPriestId) return false
  if (!timeOverlaps(left, right)) return false
  if (left.ruleType === "one_time" && right.ruleType === "one_time") {
    return left.specificDate === right.specificDate
  }
  if (left.ruleType === "weekly" && right.ruleType === "weekly") {
    return left.dayOfWeek === right.dayOfWeek && dateRangesOverlap(left, right)
  }
  const oneTime = left.ruleType === "one_time" ? left : right
  const weekly = left.ruleType === "weekly" ? left : right
  const weekday = new Date(`${oneTime.specificDate}T12:00:00Z`).getUTCDay()
  return weekday === weekly.dayOfWeek &&
    (!weekly.effectiveFrom || oneTime.specificDate >= weekly.effectiveFrom) &&
    (!weekly.effectiveTo || oneTime.specificDate <= weekly.effectiveTo)
}

const validateSourceOverlaps = (allocations: any[]) => {
  const active = allocations.filter((allocation) => allocation.status === "active")
  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const left = active[leftIndex]
      const right = active[rightIndex]
      if (allocationRulesOverlap(left, right)) {
        throw new Error(
          `Priest ${left.externalPriestId} has overlapping allocations ${left.sourceAllocationId} and ${right.sourceAllocationId}`,
        )
      }
    }
  }
}

const zonedParts = (date: Date, timeZone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>

const dateKeyInZone = (date: Date, timeZone: string) => {
  const parts = zonedParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

const wallClockToInstant = (dateKey: string, clock: string, timeZone: string) => {
  const [year, month, day] = dateKey.split("-").map(Number)
  const [hour, minute] = clock.split(":").map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let candidate = new Date(target)
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = zonedParts(candidate, timeZone)
    const observed = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute),
    )
    candidate = new Date(candidate.getTime() + target - observed)
  }
  return candidate
}

const allocationWindows = async (
  client: PoolClient,
  externalPriestId: string,
  dutyStart: Date,
  dutyEnd: Date,
) => {
  const [allocations, exceptions] = await Promise.all([
    client.query(
      `SELECT * FROM priory_allocation_cache WHERE external_priest_id = $1 AND status = 'active'`,
      [externalPriestId],
    ),
    client.query(
      `SELECT * FROM priory_allocation_exceptions WHERE external_priest_id = $1 AND status = 'active'`,
      [externalPriestId],
    ),
  ])
  const windows: any[] = []
  for (const allocation of allocations.rows) {
    const timeZone = allocation.time_zone
    const dateKeys = new Set<string>()
    let samples = 0
    for (
      let cursor = dutyStart.getTime();
      cursor < dutyEnd.getTime() && samples < 744;
      cursor += 12 * 60 * 60_000, samples += 1
    ) {
      dateKeys.add(dateKeyInZone(new Date(cursor), timeZone))
    }
    dateKeys.add(dateKeyInZone(new Date(dutyEnd.getTime() - 1), timeZone))
    for (const dateKey of dateKeys) {
      const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay()
      const applies = allocation.rule_type === "one_time"
        ? String(allocation.specific_date).slice(0, 10) === dateKey
        : Number(allocation.day_of_week) === weekday &&
          (!allocation.effective_from || dateKey >= String(allocation.effective_from).slice(0, 10)) &&
          (!allocation.effective_to || dateKey <= String(allocation.effective_to).slice(0, 10))
      if (!applies) continue
      const relevantExceptions = exceptions.rows.filter((exception) =>
        String(exception.exception_date).slice(0, 10) === dateKey &&
        (!exception.source_allocation_id || exception.source_allocation_id === allocation.source_allocation_id),
      )
      if (relevantExceptions.some((exception) => exception.action === "cancel")) continue
      const replacement = relevantExceptions.find((exception) => exception.action === "replace")
      windows.push({
        allocationId: allocation.source_allocation_id,
        missionId: replacement?.replacement_mission_id || allocation.mission_id,
        missionName: replacement?.replacement_mission_name || allocation.mission_name || "",
        start: wallClockToInstant(
          dateKey,
          String(replacement?.replacement_start_time || allocation.start_time).slice(0, 5),
          timeZone,
        ),
        end: wallClockToInstant(
          dateKey,
          String(replacement?.replacement_end_time || allocation.end_time).slice(0, 5),
          timeZone,
        ),
      })
    }
  }
  const merged: any[] = []
  for (const window of windows.sort((left, right) => left.start.getTime() - right.start.getTime())) {
    const previous = merged.at(-1)
    if (
      previous && previous.missionId === window.missionId &&
      previous.end.getTime() >= window.start.getTime()
    ) {
      if (window.end > previous.end) previous.end = window.end
      continue
    }
    merged.push({ ...window })
  }
  return merged
}

export const checkPrioryAllocation = async (
  client: PoolClient,
  userId: string,
  dutyStart: Date,
  dutyEnd: Date,
) => {
  const settings = await loadPriorySettings(client)
  if (!settings.enabled) return { enabled: false, allowed: true, allocationId: null }
  if (dutyEnd <= dutyStart || dutyEnd.getTime() - dutyStart.getTime() > 31 * 24 * 60 * 60_000) {
    return { enabled: true, allowed: false, reason: "Choose a valid priest duty window of 31 days or less", allocationId: null }
  }
  const mapping = await client.query(
    `SELECT mapping.external_priest_id
     FROM priory_priest_mappings mapping
     JOIN priory_priest_catalog priest
       ON priest.external_priest_id=mapping.external_priest_id
      AND priest.status='active'
     WHERE mapping.user_id = $1 AND mapping.status = 'active'`,
    [userId],
  )
  const externalPriestId = mapping.rows[0]?.external_priest_id
  if (!externalPriestId) {
    return { enabled: true, allowed: false, reason: "This priest is not mapped to the Priory schedule", allocationId: null }
  }
  const windows = await allocationWindows(client, externalPriestId, dutyStart, dutyEnd)
  const covering = windows.filter((window) =>
    window.missionId === settings.missionId &&
    window.start <= dutyStart && window.end >= dutyEnd,
  )
  const overlapping = windows.filter((window) =>
    window.start < dutyEnd && window.end > dutyStart,
  )
  if (overlapping.length > 1) {
    return { enabled: true, allowed: false, reason: "The Priory schedule contains overlapping allocations for this priest", allocationId: null }
  }
  return covering.length === 1
    ? { enabled: true, allowed: true, allocationId: covering[0].allocationId, externalPriestId }
    : { enabled: true, allowed: false, reason: "This priest is not allocated to this mission for the complete duty time", allocationId: null, externalPriestId }
}

export const assertPriestAllocation = async (
  client: PoolClient,
  ministryId: string,
  userId: string,
  dutyStart: Date,
  dutyEnd: Date,
) => {
  const ministry = await client.query(`SELECT slug FROM ministries WHERE id = $1`, [ministryId])
  if (ministry.rows[0]?.slug !== "priests") return null
  const result = await checkPrioryAllocation(client, userId, dutyStart, dutyEnd)
  if (!result.allowed) {
    throw Object.assign(new Error(result.reason || "Priory allocation is required"), {
      status: 409,
      prioryAllocationRequired: true,
      requestedPriestId: result.externalPriestId || null,
    })
  }
  return result.allocationId || null
}

const getPriestAccess = async (client: PoolClient, user: any) => {
  const ministry = await client.query(`SELECT id FROM ministries WHERE slug = 'priests' LIMIT 1`)
  const ministryId = ministry.rows[0]?.id
  if (!ministryId) return { ministryId: null, canView: false, canManage: false }
  const access = await getMinistryAccess(client, user, ministryId)
  return { ministryId, ...access }
}

const syncRows = async (client: PoolClient, sheet: any) => {
  const priests = normalizePriests(sheet.priests)
  const priestIds = new Set(priests.map((priest) => priest.externalPriestId))
  const allocations = normalizeAllocations(sheet.allocations, priestIds)
  const exceptions = normalizeExceptions(sheet.exceptions, priestIds)
  validateSourceOverlaps(allocations)
  const previousCounts = await client.query(
    `SELECT
       (SELECT count(*)::INT FROM priory_priest_catalog WHERE status='active') AS priests,
       (SELECT count(*)::INT FROM priory_allocation_cache WHERE status='active') AS allocations`,
  )
  if (!priests.length && Number(previousCounts.rows[0]?.priests || 0) > 0) {
    throw new Error("The Priory Sheet returned no priests; the last verified cache was preserved")
  }
  if (!allocations.length && Number(previousCounts.rows[0]?.allocations || 0) > 0) {
    throw new Error("The Priory Sheet returned no allocations; the last verified cache was preserved")
  }
  const seenAt = new Date()

  for (const priest of priests) {
    await client.query(
      `INSERT INTO priory_priest_catalog (external_priest_id, display_name, status, source_hash, last_seen_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (external_priest_id) DO UPDATE SET display_name = excluded.display_name,
         status = excluded.status, source_hash = excluded.source_hash,
         last_seen_at = excluded.last_seen_at, updated_at = now()`,
      [priest.externalPriestId, priest.displayName, priest.status, priest.sourceHash, seenAt],
    )
  }
  for (const allocation of allocations) {
    await client.query(
      `INSERT INTO priory_allocation_cache (
         source_allocation_id, external_priest_id, mission_id, mission_name,
         rule_type, day_of_week, specific_date, start_time, end_time,
         effective_from, effective_to, time_zone, status, linked_request_id,
         source_hash, last_seen_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (source_allocation_id) DO UPDATE SET
         external_priest_id=excluded.external_priest_id, mission_id=excluded.mission_id,
         mission_name=excluded.mission_name, rule_type=excluded.rule_type,
         day_of_week=excluded.day_of_week, specific_date=excluded.specific_date,
         start_time=excluded.start_time, end_time=excluded.end_time,
         effective_from=excluded.effective_from, effective_to=excluded.effective_to,
         time_zone=excluded.time_zone, status=excluded.status,
         linked_request_id=excluded.linked_request_id, source_hash=excluded.source_hash,
         last_seen_at=excluded.last_seen_at, updated_at=now()`,
      [
        allocation.sourceAllocationId, allocation.externalPriestId,
        allocation.missionId, allocation.missionName, allocation.ruleType,
        allocation.dayOfWeek, allocation.specificDate, allocation.startTime,
        allocation.endTime, allocation.effectiveFrom, allocation.effectiveTo,
        allocation.timeZone, allocation.status, allocation.linkedRequestId,
        allocation.sourceHash, seenAt,
      ],
    )
  }
  for (const exception of exceptions) {
    await client.query(
      `INSERT INTO priory_allocation_exceptions (
         source_exception_id, source_allocation_id, external_priest_id,
         exception_date, action, replacement_mission_id, replacement_mission_name,
         replacement_start_time, replacement_end_time, status, source_hash, last_seen_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (source_exception_id) DO UPDATE SET
         source_allocation_id=excluded.source_allocation_id,
         external_priest_id=excluded.external_priest_id,
         exception_date=excluded.exception_date, action=excluded.action,
         replacement_mission_id=excluded.replacement_mission_id,
         replacement_mission_name=excluded.replacement_mission_name,
         replacement_start_time=excluded.replacement_start_time,
         replacement_end_time=excluded.replacement_end_time,
         status=excluded.status, source_hash=excluded.source_hash,
         last_seen_at=excluded.last_seen_at, updated_at=now()`,
      [
        exception.sourceExceptionId, exception.sourceAllocationId,
        exception.externalPriestId, exception.exceptionDate, exception.action,
        exception.replacementMissionId, exception.replacementMissionName,
        exception.replacementStartTime, exception.replacementEndTime,
        exception.status, exception.sourceHash, seenAt,
      ],
    )
  }
  await client.query(`UPDATE priory_priest_catalog SET status='inactive', updated_at=now() WHERE last_seen_at < $1`, [seenAt])
  await client.query(`UPDATE priory_allocation_cache SET status='inactive', updated_at=now() WHERE last_seen_at < $1`, [seenAt])
  await client.query(`UPDATE priory_allocation_exceptions SET status='inactive', updated_at=now() WHERE last_seen_at < $1`, [seenAt])

  let reconciled = 0
  const sheetRequests = tableRows(sheet.requests)
  const sheetRequestById = new Map<string, any>()
  for (const row of sheetRequests) {
    const requestId = cleanText(row.request_id, 100)
    if (requestId) sheetRequestById.set(requestId, row)
  }
  const requestIds = new Set<string>(sheetRequestById.keys())
  for (const allocation of allocations) {
    if (allocation.linkedRequestId) requestIds.add(allocation.linkedRequestId)
  }
  for (const requestId of requestIds) {
    const allocation = allocations.find((item) => item.linkedRequestId === requestId)
    const row = sheetRequestById.get(requestId) || {}
    const sheetStatus = cleanText(row.status, 30).toLowerCase()
    const status = allocation ? "approved" : sheetStatus
    if (!["approved", "declined"].includes(status)) continue
    const result = await client.query(
      `UPDATE priory_allocation_requests SET status=$2,
         source_allocation_id=$3, resolved_at=now(), updated_at=now()
       WHERE id=$1 AND status IN ('pending','failed')
       RETURNING id, requested_by, event_id`,
      [requestId, status, allocation?.sourceAllocationId || null],
    )
    reconciled += result.rowCount || 0
    const resolved = result.rows[0]
    if (resolved) {
      await client.query(
        `INSERT INTO ministry_alerts (
           subject_user_id, recipient_user_id, kind, title, message,
           event_id, dedupe_key, metadata, digest_after
         ) VALUES ($1,$1,$2,$3,$4,$5,$6,$7::JSONB,now())
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          resolved.requested_by,
          `priory_allocation_request_${status}`,
          status === "approved"
            ? "Priest availability approved"
            : "Priest availability declined",
          status === "approved"
            ? "The Priory allocation now covers the requested time. Review the draft event and assign the priest."
            : "The Priory declined the requested availability window.",
          resolved.event_id,
          `priory-request:${requestId}:${status}`,
          JSON.stringify({
            notificationCategory: "schedule_changes",
            notificationUrl: resolved.event_id
              ? `/priests?event=${resolved.event_id}`
              : "/priests",
            privacySafeMessage: `A Priest availability request was ${status}.`,
          }),
        ],
      )
    }
  }
  return { priests: priests.length, allocations: allocations.length, exceptions: exceptions.length, reconciled }
}

const reconcileAssignmentConflicts = async (client: PoolClient) => {
  const assignments = await client.query(
    `SELECT assignment.id, assignment.user_id, assignment.priory_allocation_conflict,
       event.id AS event_id, event.title AS event_title,
       event.start_time, event.end_time,
       responsibility.relative_start_minutes,
       COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id
     FROM responsibility_assignments assignment
     JOIN events event ON event.id=assignment.event_id
     JOIN event_responsibilities responsibility ON responsibility.id=assignment.responsibility_id
     JOIN ministries ministry ON ministry.id=COALESCE(responsibility.ministry_id, event.ministry_id)
     WHERE ministry.slug='priests' AND assignment.user_id IS NOT NULL
       AND assignment.status NOT IN ('declined','cancelled','completed')
       AND event.status NOT IN ('cancelled','archived','completed')
       AND event.end_time > now() - INTERVAL '1 day'`,
  )
  for (const assignment of assignments.rows) {
    const dutyStart = new Date(
      new Date(assignment.start_time).getTime() +
      Number(assignment.relative_start_minutes || 0) * 60_000,
    )
    const result = await checkPrioryAllocation(
      client,
      assignment.user_id,
      dutyStart,
      new Date(assignment.end_time),
    )
    await client.query(
      `UPDATE responsibility_assignments SET priory_allocation_id=$2,
         priory_allocation_conflict=$3, priory_allocation_checked_at=now(), updated_at=now()
       WHERE id=$1`,
      [assignment.id, result.allocationId || null, result.enabled && !result.allowed],
    )
    if (
      result.enabled &&
      !result.allowed &&
      !assignment.priory_allocation_conflict
    ) {
      const leaders = await client.query(
        `SELECT DISTINCT leader.id
         FROM ministry_accounts leader
         WHERE leader.status='active' AND (
           leader.global_role IN ('owner','super_admin')
           OR EXISTS (
             SELECT 1 FROM ministry_members membership
             JOIN ministries ministry ON ministry.id=membership.ministry_id
             WHERE membership.user_id=leader.id AND membership.status='active'
               AND membership.level IN ('owner','admin') AND ministry.slug='priests'
           )
         )`,
      )
      for (const leader of leaders.rows) {
        await client.query(
          `INSERT INTO ministry_alerts (
             subject_user_id, recipient_user_id, kind, title, message,
             assignment_id, event_id, ministry_id, dedupe_key, metadata,
             digest_after
           ) VALUES ($1,$1,'priory_allocation_conflict',$2,$3,$4,$5,$6,$7,$8::JSONB,now())
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [
            leader.id,
            `Priory allocation conflict: ${assignment.event_title}`,
            "A priest assignment is outside this mission's current Priory allocation.",
            assignment.id,
            assignment.event_id,
            assignment.ministry_id,
            `priory-conflict:${assignment.id}:${new Date().toISOString().slice(0, 10)}`,
            JSON.stringify({
              notificationCategory: "schedule_changes",
              notificationUrl: `/priests?event=${assignment.event_id}`,
              privacySafeMessage: "A priest assignment needs schedule review.",
            }),
          ],
        )
      }
    }
  }
}

export const syncPrioryAllocations = async (
  triggerType: "scheduled" | "manual" | "initial" = "scheduled",
) => {
  const pool = getPool()
  await pool.query(
    `INSERT INTO priory_integration_settings (setting_key)
     VALUES ('primary') ON CONFLICT (setting_key) DO NOTHING`,
  )
  const settingsResult = await pool.query(
    `SELECT * FROM priory_integration_settings WHERE setting_key='primary'`,
  )
  const settings = settingsFromRow(settingsResult.rows[0])
  if (!settings.enabled) return { skipped: true, reason: "disabled" }
  if (!settings.spreadsheetId || !settings.missionId) {
    return { skipped: true, reason: "incomplete_configuration" }
  }
  const run = await pool.query(
    `INSERT INTO priory_sync_runs (trigger_type) VALUES ($1) RETURNING id`,
    [triggerType],
  )
  const runId = run.rows[0].id
  await pool.query(
    `UPDATE priory_integration_settings SET last_sync_started_at=now(), updated_at=now() WHERE setting_key='primary'`,
  )
  try {
    const sheet = await fetchSheetValues(settings)
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const counts = await syncRows(client, sheet)
      await reconcileAssignmentConflicts(client)
      await client.query(
        `UPDATE priory_integration_settings SET last_sync_succeeded_at=now(), last_sync_error=NULL, updated_at=now() WHERE setting_key='primary'`,
      )
      await client.query(
        `UPDATE priory_sync_runs SET status='succeeded', priests_seen=$2,
           allocations_seen=$3, exceptions_seen=$4, requests_reconciled=$5,
           completed_at=now() WHERE id=$1`,
        [runId, counts.priests, counts.allocations, counts.exceptions, counts.reconciled],
      )
      await client.query("COMMIT")
      return counts
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    const message = cleanText(error?.message || "Priory schedule sync failed", 2000)
    await pool.query(
      `UPDATE priory_integration_settings SET last_sync_error=$1, updated_at=now() WHERE setting_key='primary'`,
      [message],
    )
    await pool.query(
      `UPDATE priory_sync_runs SET status='failed', error_message=$2, completed_at=now() WHERE id=$1`,
      [runId, message],
    )
    throw error
  }
}

export const syncPrioryAllocationsIfDue = async () => {
  const pool = getPool()
  await pool.query(
    `INSERT INTO priory_integration_settings (setting_key)
     VALUES ('primary') ON CONFLICT (setting_key) DO NOTHING`,
  )
  const claim = await pool.query(
    `UPDATE priory_integration_settings
     SET last_sync_started_at=now(), updated_at=now()
     WHERE setting_key='primary' AND enabled=true
       AND (last_sync_started_at IS NULL OR last_sync_started_at < now() - INTERVAL '5 minutes')
     RETURNING setting_key`,
  )
  if (!claim.rowCount) return { skipped: true, reason: "not_due" }
  return syncPrioryAllocations("scheduled")
}

const loadPrioryOverview = async (
  client: PoolClient,
  context: any,
  start: Date,
  end: Date,
  selectedExternalPriestId = "",
) => {
  const settings = await loadPriorySettings(client)
  const access = await getPriestAccess(client, context.user)
  if (!access.canView && !["owner", "super_admin"].includes(context.user.global_role)) {
    throw Object.assign(new Error("Priest ministry access is required"), { status: 403 })
  }
  const [catalog, mappings, localPriests, requests, conflictCount] = await Promise.all([
    client.query(`SELECT * FROM priory_priest_catalog ORDER BY lower(display_name)`),
    client.query(`SELECT mapping.*, catalog.display_name FROM priory_priest_mappings mapping JOIN priory_priest_catalog catalog ON catalog.external_priest_id=mapping.external_priest_id WHERE mapping.status='active'`),
    access.ministryId
      ? client.query(
          `SELECT user_account.id, user_account.first_name, user_account.last_name
           FROM ministry_members membership JOIN ministry_accounts user_account ON user_account.id=membership.user_id
           WHERE membership.ministry_id=$1 AND membership.status='active'
           ORDER BY lower(user_account.last_name), lower(user_account.first_name)`,
          [access.ministryId],
        )
      : Promise.resolve({ rows: [] }),
    client.query(`SELECT * FROM priory_allocation_requests ORDER BY created_at DESC LIMIT 100`),
    client.query(`SELECT count(*)::INT AS count FROM responsibility_assignments WHERE priory_allocation_conflict=true`),
  ])
  const mappingByExternal = new Map(mappings.rows.map((mapping) => [mapping.external_priest_id, mapping]))
  const priests = []
  for (const priest of catalog.rows) {
    if (priest.status !== "active") continue
    if (selectedExternalPriestId && selectedExternalPriestId !== priest.external_priest_id) continue
    const mapping = mappingByExternal.get(priest.external_priest_id)
    let allocation = { enabled: settings.enabled, allowed: false, allocationId: null } as any
    if (mapping) allocation = await checkPrioryAllocation(client, mapping.user_id, start, end)
    priests.push({
      externalPriestId: priest.external_priest_id,
      displayName: priest.display_name,
      status: priest.status,
      localUserId: mapping?.user_id || "",
      availableToMission: Boolean(allocation.allowed),
      allocationId: allocation.allocationId || null,
    })
  }
  const lastSuccess = settings.lastSyncSucceededAt
    ? new Date(settings.lastSyncSucceededAt).getTime()
    : 0
  const canManage = access.canManage || ["owner", "super_admin"].includes(context.user.global_role)
  return {
    settings,
    configured: Boolean(settings.spreadsheetId && settings.missionId),
    stale: settings.enabled && (!lastSuccess || Date.now() - lastSuccess > 15 * 60_000),
    canManage,
    canConfigure: ["owner", "super_admin"].includes(context.user.global_role),
    priests,
    localPriests: canManage ? localPriests.rows.map((priest) => ({
      id: priest.id,
      name: `${priest.first_name} ${priest.last_name || ""}`.trim(),
    })) : [],
    mappings: canManage ? mappings.rows.map((mapping) => ({
      id: mapping.id,
      localUserId: mapping.user_id,
      externalPriestId: mapping.external_priest_id,
      displayName: mapping.display_name,
    })) : [],
    requests: canManage ? requests.rows.map((request) => ({
      id: request.id,
      eventId: request.event_id,
      requestedPriestId: request.requested_priest_id || "",
      requestedStart: request.requested_start,
      requestedEnd: request.requested_end,
      eventType: request.event_type,
      urgency: request.urgency,
      status: request.status,
      createdAt: request.created_at,
    })) : [],
    conflictCount: canManage ? Number(conflictCount.rows[0]?.count || 0) : 0,
  }
}

const notifyPrioryRequest = async (request: any, settings: PriorySettings) => {
  if (
    process.env.MINISTRY_OUTBOUND_DELIVERY_ENABLED !== "true" ||
    (process.env.VERCEL_ENV !== "production" && process.env.ALLOW_PREVIEW_DELIVERY !== "true")
  ) return
  const summary = [
    "Priest availability requested",
    `Mission: ${settings.missionName || settings.missionId}`,
    `Time: ${new Date(request.requestedStart).toLocaleString("en-US", { timeZone: settings.timeZone })} - ${new Date(request.requestedEnd).toLocaleTimeString("en-US", { timeZone: settings.timeZone })}`,
    `Type: ${request.eventType}`,
    `Priest: ${request.requestedPriestId || "ANY"}`,
    `Urgency: ${request.urgency}`,
    `Request ID: ${request.id}`,
  ].join("\n")
  const notifications = [
    ...(process.env.PRIORY_SCHEDULE_NOTIFICATION_EMAILS || "")
      .split(",").map((item) => item.trim()).filter(Boolean)
      .map((email) => sendReliableEmail({
        to: email,
        subject: "Priest availability requested",
        text: summary,
      })),
    ...(process.env.PRIORY_SCHEDULE_TELEGRAM_CHAT_IDS || "")
      .split(",").map((item) => item.trim()).filter(Boolean)
      .map((chatId) => sendPrioryTelegramMessage(chatId, summary)),
  ]
  const results = await Promise.allSettled(notifications)
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Unable to notify a Priory schedule recipient:", result.reason?.message || result.reason)
    }
  }
}

export const handlePrioryAllocations = async (request: Request) => {
  const client = await getPool().connect()
  let notification: any = null
  let postCommitError = ""
  try {
    const context = await getIdentityContext(client, request)
    const url = new URL(request.url)
    if (request.method === "GET") {
      const start = new Date(url.searchParams.get("start") || Date.now())
      const end = new Date(url.searchParams.get("end") || start.getTime() + 60 * 60_000)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return json({ message: "Choose a valid availability window" }, 400)
      }
      return json(await loadPrioryOverview(client, context, start, end, cleanText(url.searchParams.get("priestId"), 120)))
    }
    const body = await request.json().catch(() => ({}))
    const access = await getPriestAccess(client, context.user)
    const global = ["owner", "super_admin"].includes(context.user.global_role)
    if (body.action === "refresh") {
      if (!access.canManage && !global) return json({ message: "Priest ministry administration is required" }, 403)
      const result = await syncPrioryAllocations("manual")
      return json({ message: "Priory schedule refreshed", result })
    }
    await client.query("BEGIN")
    if (body.action === "save_settings") {
      if (!global) throw Object.assign(new Error("Only a Super Admin can configure the Priory connection"), { status: 403 })
      const enabled = body.enabled === true
      const spreadsheetId = cleanText(body.spreadsheetId, 250)
      const missionId = cleanText(body.missionId, 120)
      if (enabled && (!spreadsheetId || !missionId)) {
        throw Object.assign(new Error("Spreadsheet ID and Mission ID are required"), { status: 400 })
      }
      const before = await loadPriorySettings(client)
      await client.query(
        `UPDATE priory_integration_settings SET enabled=$1, spreadsheet_id=$2,
           mission_id=$3, mission_name=$4, time_zone=$5, updated_by=$6, updated_at=now()
         WHERE setting_key='primary'`,
        [enabled, spreadsheetId || null, missionId || null, cleanText(body.missionName, 200) || null, cleanText(body.timeZone, 100) || "America/New_York", context.actor.id],
      )
      await writeSchedulingAudit(client, context, {
        action: "priory.integration_updated", entityType: "priory_integration",
        beforeData: before,
        afterData: { enabled, spreadsheetId: spreadsheetId ? "configured" : "", missionId, missionName: cleanText(body.missionName, 200) },
      })
    } else if (body.action === "save_mapping") {
      if (!access.canManage && !global) throw Object.assign(new Error("Priest ministry administration is required"), { status: 403 })
      const userId = cleanText(body.userId, 100)
      const externalPriestId = cleanText(body.externalPriestId, 120)
      if (!userId || !externalPriestId) throw Object.assign(new Error("Choose a local priest and Priory priest"), { status: 400 })
      const eligible = await client.query(
        `SELECT 1 FROM ministry_members membership JOIN ministries ministry ON ministry.id=membership.ministry_id
         WHERE membership.user_id=$1 AND membership.status='active' AND ministry.slug='priests'`,
        [userId],
      )
      if (!eligible.rowCount) throw Object.assign(new Error("Choose an active Priest ministry member"), { status: 400 })
      await client.query(
        `INSERT INTO priory_priest_mappings (user_id, external_priest_id, created_by, updated_by)
         VALUES ($1,$2,$3,$3)
         ON CONFLICT (user_id) DO UPDATE SET external_priest_id=excluded.external_priest_id,
           status='active', updated_by=excluded.updated_by, updated_at=now()`,
        [userId, externalPriestId, context.actor.id],
      )
      await writeSchedulingAudit(client, context, {
        action: "priory.priest_mapped", entityType: "priory_priest_mapping",
        entityId: userId, ministryId: access.ministryId,
        afterData: { userId, externalPriestId },
      })
    } else if (body.action === "remove_mapping") {
      if (!access.canManage && !global) throw Object.assign(new Error("Priest ministry administration is required"), { status: 403 })
      const userId = cleanText(body.userId, 100)
      await client.query(`UPDATE priory_priest_mappings SET status='inactive', updated_by=$2, updated_at=now() WHERE user_id=$1`, [userId, context.actor.id])
      await writeSchedulingAudit(client, context, {
        action: "priory.priest_unmapped", entityType: "priory_priest_mapping",
        entityId: userId, ministryId: access.ministryId,
      })
    } else if (body.action === "request_allocation") {
      if (!access.canManage && !global) throw Object.assign(new Error("Priest ministry administration is required"), { status: 403 })
      const settings = await loadPriorySettings(client)
      if (!settings.enabled) throw Object.assign(new Error("The Priory schedule is not enabled"), { status: 409 })
      const eventId = cleanText(body.eventId, 100)
      const eventResult = await client.query(
        `SELECT event.id, event.title, event.start_time, event.end_time
         FROM events event
         JOIN ministries ministry ON ministry.id=event.ministry_id
         WHERE event.id=$1 AND ministry.slug='priests' AND event.status <> 'archived'`,
        [eventId],
      )
      if (!eventResult.rowCount) throw Object.assign(new Error("Save a Priest-ministry event draft before requesting availability"), { status: 400 })
      const localEvent = eventResult.rows[0]
      const requestedStart = new Date(localEvent.start_time)
      const requestedEnd = new Date(localEvent.end_time)
      const eventType = privacySafeEventType(localEvent.title)
      const existingRequest = await client.query(
        `SELECT id FROM priory_allocation_requests
         WHERE event_id=$1 AND status='pending' LIMIT 1`,
        [eventId],
      )
      if (existingRequest.rowCount) {
        throw Object.assign(new Error("A Priory availability request is already pending for this event"), { status: 409 })
      }
      const requestedPriestId = cleanText(body.requestedPriestId, 120) || null
      if (requestedPriestId) {
        const knownPriest = await client.query(
          `SELECT 1 FROM priory_priest_catalog WHERE external_priest_id=$1 AND status='active'`,
          [requestedPriestId],
        )
        if (!knownPriest.rowCount) throw Object.assign(new Error("Choose an active Priory priest or ANY"), { status: 400 })
      }
      const result = await client.query(
        `INSERT INTO priory_allocation_requests (
           event_id, requested_priest_id, requested_start, requested_end,
           event_type, urgency, requested_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [eventId, requestedPriestId, requestedStart, requestedEnd, eventType, body.urgency === "urgent" ? "urgent" : "normal", context.actor.id],
      )
      const created = result.rows[0]
      let sheetRowReference = ""
      try {
        sheetRowReference = await appendRequestRow(settings, [
          created.id, settings.missionId, settings.missionName,
          new Date(created.requested_start).toISOString(),
          new Date(created.requested_end).toISOString(),
          created.event_type, created.urgency,
          created.requested_priest_id || "ANY", "pending",
          new Date(created.created_at).toISOString(), "",
        ])
        await client.query(`UPDATE priory_allocation_requests SET sheet_row_reference=$2 WHERE id=$1`, [created.id, sheetRowReference])
      } catch (error: any) {
        await client.query(`UPDATE priory_allocation_requests SET status='failed', updated_at=now() WHERE id=$1`, [created.id])
        postCommitError = `Request saved locally, but the Priory Sheet could not be updated: ${error.message}`
      }
      await writeSchedulingAudit(client, context, {
        action: "priory.allocation_requested", entityType: "priory_allocation_request",
        entityId: created.id, ministryId: access.ministryId,
        afterData: { missionId: settings.missionId, requestedStart, requestedEnd, eventType: created.event_type, urgency: created.urgency, requestedPriestId: created.requested_priest_id || "ANY" },
      })
      notification = { ...created, requestedStart, requestedEnd, eventType: created.event_type, urgency: created.urgency, requestedPriestId: created.requested_priest_id, settings }
    } else if (body.action === "cancel_request") {
      if (!access.canManage && !global) throw Object.assign(new Error("Priest ministry administration is required"), { status: 403 })
      const requestId = cleanText(body.requestId, 100)
      const requestResult = await client.query(
        `SELECT request.sheet_row_reference, settings.*
         FROM priory_allocation_requests request
         CROSS JOIN priory_integration_settings settings
         WHERE request.id=$1 AND request.status IN ('pending','failed')`,
        [requestId],
      )
      if (!requestResult.rowCount) throw Object.assign(new Error("The request is no longer pending"), { status: 409 })
      const requestRow = requestResult.rows[0]
      if (requestRow.sheet_row_reference) {
        await updateRequestStatus(
          {
            enabled: Boolean(requestRow.enabled),
            spreadsheetId: requestRow.spreadsheet_id || "",
            missionId: requestRow.mission_id || "",
            missionName: requestRow.mission_name || "",
            timeZone: requestRow.time_zone || "America/New_York",
            priestsTab: requestRow.priests_tab || "Priests",
            allocationsTab: requestRow.allocations_tab || "Allocations",
            exceptionsTab: requestRow.exceptions_tab || "Exceptions",
            requestsTab: requestRow.requests_tab || "Requests",
            lastSyncStartedAt: requestRow.last_sync_started_at,
            lastSyncSucceededAt: requestRow.last_sync_succeeded_at,
            lastSyncError: requestRow.last_sync_error,
          },
          requestId,
          requestRow.sheet_row_reference,
          "cancelled",
        )
      }
      await client.query(`UPDATE priory_allocation_requests SET status='cancelled', cancelled_at=now(), updated_at=now() WHERE id=$1`, [requestId])
      await writeSchedulingAudit(client, context, { action: "priory.allocation_request_cancelled", entityType: "priory_allocation_request", entityId: requestId, ministryId: access.ministryId })
    } else {
      throw Object.assign(new Error("Unknown Priory schedule action"), { status: 400 })
    }
    await client.query("COMMIT")
    if (notification) await notifyPrioryRequest(notification, notification.settings).catch((error) => console.error("Priory request notification failed:", error))
    if (postCommitError) return json({ message: postCommitError }, 502)
    return json({ message: notification ? "Priest availability requested" : "Priory schedule updated" })
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {})
    const status = error?.status || (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    if (status === 500) console.error("Unable to manage Priory allocations:", error)
    return json({ message: error?.message || "Unable to manage the Priory schedule" }, status)
  } finally {
    client.release()
  }
}
