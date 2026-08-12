import { createHash } from "node:crypto"
import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  getMinistryAccess,
  writeSchedulingAudit,
} from "./authorization"

const ORDO_INDEX_URL = "https://1962ordo.today/get-liturgical-days/"
const ORDO_HOSTNAME = "1962ordo.today"
const DIVINUM_FALLBACK_API = "https://www.missalemeum.com/en/api/v5/proper"
const DIVINUM_FALLBACK_PAGE = "https://www.missalemeum.com/en"
const DEFAULT_REFRESH_HOURS = 24
const CHAPEL_TIME_ZONE = "America/New_York"
const VESTMENT_COLORS = ["White", "Red", "Green", "Violet", "Rose", "Black"]
const DIVINUM_COLORS: Record<string, string> = {
  b: "Black",
  g: "Green",
  p: "Rose",
  r: "Red",
  v: "Violet",
  w: "White",
}
const CLASS_LABELS = ["", "I Class", "II Class", "III Class", "IV Class"]

type MassOption = {
  id: string
  label: string
  instructions: string
  vestmentColor: string | null
  gloria: boolean | null
  credo: boolean | null
  preface: string | null
  commemoration: string | null
}

type ParsedOrdoDay = {
  liturgicalDate: string
  celebration: string
  classLabel: string | null
  vestmentColor: string | null
  commemorations: string[]
  generalInformation: string[]
  massOptions: MassOption[]
  breviary: Record<string, string>
  reminders: string[]
  sourceUrl: string
  sourcePublishedAt: string | null
  sourceModifiedAt: string | null
  sourceHash: string
}

const cleanText = (value: unknown, maximum = 5000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")

const htmlToText = (value: string) =>
  decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")

const extractTagText = (html: string, tag: string) => {
  const match = html.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  )
  return match ? htmlToText(match[1]) : ""
}

const extractParagraphs = (html: string) => {
  const paragraphs = [
    ...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
  ].map((match) => htmlToText(match[1]))
  return paragraphs.length
    ? paragraphs.filter(Boolean)
    : htmlToText(html)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
}

const normalizeClass = (value: string) => {
  const match = value.match(/\b(IV|III|II|I)\s+class\b/i)
  return match ? `${match[1].toUpperCase()} Class` : null
}

const findVestmentColor = (value: string) => {
  const match = value.match(
    new RegExp(`\\b(${VESTMENT_COLORS.join("|")})\\b`, "i"),
  )
  if (!match) return null
  return `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}`
}

const extractInstructionPart = (value: string, pattern: RegExp) =>
  value
    .split(/[;,]\s*/)
    .map((part) => part.trim())
    .find((part) => pattern.test(part)) || null

const parseMassOptions = (
  paragraphs: string[],
  primaryColor: string | null,
) => {
  const optionTexts: string[] = []
  let current: string[] = []

  for (const paragraph of paragraphs) {
    const pieces = paragraph.split(/\n\s*OR\s*\n/i)
    pieces.forEach((piece, index) => {
      if ((index > 0 || /^OR$/i.test(piece.trim())) && current.length) {
        optionTexts.push(current.join(" ").trim())
        current = []
      }
      if (!/^OR$/i.test(piece.trim()) && piece.trim()) current.push(piece.trim())
    })
    if (/^OR$/i.test(paragraph.trim()) && current.length) {
      optionTexts.push(current.join(" ").trim())
      current = []
    }
  }
  if (current.length) optionTexts.push(current.join(" ").trim())

  const validOptions = optionTexts.filter(Boolean)
  return validOptions.map((instructions, index): MassOption => {
    const firstPart = instructions.split(/[;,]/)[0].trim()
    const explicitColorMatch = instructions.match(
      new RegExp(`\\((${VESTMENT_COLORS.join("|")})\\)`, "i"),
    )
    const explicitColor = explicitColorMatch
      ? findVestmentColor(explicitColorMatch[1])
      : null
    return {
      id: `mass-${index + 1}`,
      label: firstPart || `Mass option ${index + 1}`,
      instructions,
      vestmentColor:
        explicitColor || (validOptions.length === 1 ? primaryColor : null),
      gloria: /\bno\s+Gloria\b/i.test(instructions)
        ? false
        : /\bGloria\b/i.test(instructions)
          ? true
          : null,
      credo: /\bno\s+Credo\b/i.test(instructions)
        ? false
        : /\bCredo\b/i.test(instructions)
          ? true
          : null,
      preface: extractInstructionPart(instructions, /\bpreface\b/i),
      commemoration: extractInstructionPart(
        instructions,
        /\bcommemoration\b/i,
      ),
    }
  })
}

const parseBreviary = (paragraphs: string[]) => {
  const breviary: Record<string, string> = {}
  for (const paragraph of paragraphs) {
    const match = paragraph.match(/^([^:]{2,40}):\s*([\s\S]+)$/)
    if (match) breviary[match[1].trim()] = match[2].trim()
  }
  return breviary
}

export const parseOrdoDayHtml = (
  html: string,
  sourceUrl: string,
): ParsedOrdoDay => {
  const sectionMatch = html.match(
    /<section[^>]*data-liturgical-day=["'](\d{8})["'][^>]*>([\s\S]*?)<\/section>/i,
  )
  if (!sectionMatch) {
    throw Object.assign(new Error("The 1962 Ordo page format was not recognized"), {
      status: 502,
    })
  }

  const compactDate = sectionMatch[1]
  const liturgicalDate = `${compactDate.slice(0, 4)}-${compactDate.slice(
    4,
    6,
  )}-${compactDate.slice(6, 8)}`
  const contentBlocks = [
    ...sectionMatch[2].matchAll(
      /<div[^>]*class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    ),
  ].map((match) => match[1])

  let celebration = ""
  let classLabel: string | null = null
  let vestmentColor: string | null = null
  let commemorations: string[] = []
  let generalInformation: string[] = []
  let massParagraphs: string[] = []
  let breviary: Record<string, string> = {}
  let reminders: string[] = []

  for (const block of contentBlocks) {
    const heading = extractTagText(block, "h2")
    const paragraphs = extractParagraphs(block)
    const normalizedHeading = heading.replace(/:$/, "").toLowerCase()

    if (
      heading &&
      !["general info", "mass", "breviary", "reminder", "local info"].includes(
        normalizedHeading,
      )
    ) {
      celebration = heading
      const lines = paragraphs.flatMap((paragraph) => paragraph.split("\n"))
      classLabel =
        lines.map(normalizeClass).find((value) => Boolean(value)) || null
      vestmentColor =
        lines.map(findVestmentColor).find((value) => Boolean(value)) || null
      commemorations = lines.filter((line) => /commemorat/i.test(line))
    } else if (normalizedHeading === "general info") {
      generalInformation = paragraphs
    } else if (normalizedHeading === "mass") {
      massParagraphs = paragraphs
    } else if (normalizedHeading === "breviary") {
      breviary = parseBreviary(paragraphs)
    } else if (normalizedHeading === "reminder") {
      reminders = paragraphs
    } else if (normalizedHeading === "local info") {
      generalInformation = [...generalInformation, ...paragraphs]
    }
  }

  if (!celebration) {
    throw Object.assign(new Error("The 1962 Ordo celebration was not found"), {
      status: 502,
    })
  }

  const publishedMatch = html.match(/"datePublished":"([^"]+)"/)
  const modifiedMatch = html.match(/"dateModified":"([^"]+)"/)
  const normalized = {
    liturgicalDate,
    celebration,
    classLabel,
    vestmentColor,
    commemorations,
    generalInformation,
    massOptions: parseMassOptions(massParagraphs, vestmentColor),
    breviary,
    reminders,
    sourceUrl,
    sourcePublishedAt: publishedMatch?.[1] || null,
    sourceModifiedAt: modifiedMatch?.[1] || null,
  }

  return {
    ...normalized,
    sourceHash: createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex"),
  }
}

const isSafeOrdoUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === ORDO_HOSTNAME
  } catch {
    return false
  }
}

const fetchOrdo = async (url: string) => {
  if (!isSafeOrdoUrl(url)) {
    throw Object.assign(new Error("The 1962 Ordo source URL is invalid"), {
      status: 502,
    })
  }
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/json",
      "User-Agent": "MyLatinMass-Ministry-Ordo/1.0",
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw Object.assign(
      new Error(`The 1962 Ordo source returned ${response.status}`),
      { status: 502 },
    )
  }
  return response
}

const firstSectionText = (proper: any, id: string) => {
  const section = Array.isArray(proper?.sections)
    ? proper.sections.find((item: any) => item?.id === id)
    : null
  const firstBody = Array.isArray(section?.body) ? section.body[0] : null
  return Array.isArray(firstBody) ? cleanText(firstBody[0], 10000) : ""
}

const readingReference = (proper: any, id: string, label: string) => {
  const text = firstSectionText(proper, id)
  const citation = text.match(/\*([^*]{2,100})\*/)?.[1]
  return citation ? `${label}: ${citation}` : ""
}

const divinumColor = (value: unknown) =>
  typeof value === "string" ? DIVINUM_COLORS[value.toLowerCase()] || null : null

export const parseDivinumFallback = (
  payload: unknown,
  liturgicalDate: string,
) => {
  const propers = Array.isArray(payload)
    ? payload.filter((proper: any) => proper?.info?.title)
    : []
  if (!propers.length) {
    throw Object.assign(
      new Error("Divinum Officium did not return Mass details for this date"),
      { status: 502 },
    )
  }

  const primary = propers[0]
  const primaryInfo = primary.info || {}
  const primaryColor = divinumColor(primaryInfo.colors?.[0])
  const rank = Number(primaryInfo.rank)
  const normalized = {
    liturgicalDate,
    celebration: cleanText(primaryInfo.title) || "Mass details pending verification",
    classLabel:
      Number.isInteger(rank) && rank >= 1 && rank <= 4
        ? CLASS_LABELS[rank]
        : null,
    vestmentColor: primaryColor,
    commemorations: Array.isArray(primaryInfo.commemorations)
      ? primaryInfo.commemorations
          .map((item: any) => cleanText(item?.title))
          .filter(Boolean)
          .map((title: string) => `Commemoration of ${title}`)
      : [],
    generalInformation: [
      cleanText(primaryInfo.description),
      cleanText(primaryInfo.tempora),
    ].filter(Boolean),
    massOptions: propers.map((proper: any, index: number): MassOption => {
      const info = proper.info || {}
      const instructions = [
        cleanText(info.description),
        readingReference(proper, "Lectio", "Epistle"),
        readingReference(proper, "Evangelium", "Gospel"),
      ].filter(Boolean)
      const prefaceText = firstSectionText(proper, "Prefatio")
      return {
        id: `divinum-mass-${index + 1}`,
        label: cleanText(info.title) || `Mass option ${index + 1}`,
        instructions:
          instructions.join(" · ") || "Mass details require verification.",
        vestmentColor: divinumColor(info.colors?.[0]),
        gloria: null,
        credo: null,
        preface: prefaceText.match(/\*([^*]{2,100})\*/)?.[1] || null,
        commemoration: Array.isArray(info.commemorations)
          ? info.commemorations
              .map((item: any) => cleanText(item?.title))
              .filter(Boolean)
              .join(", ") || null
          : null,
      }
    }),
    breviary: {},
    reminders: [],
    sourceUrl: `${DIVINUM_FALLBACK_PAGE}/${liturgicalDate}`,
    sourcePublishedAt: null,
    sourceModifiedAt: null,
  }

  return {
    ...normalized,
    id: null,
    sourceHash: createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex"),
    fetchedAt: new Date().toISOString(),
    stale: false,
    dataSource: "divinum_officium",
    verificationRequired: true,
    verificationMessage:
      "1962 Ordo was unavailable. These details came from a Divinum Officium-based fallback and must be verified before sacristy preparation.",
  }
}

const loadDivinumFallback = async (liturgicalDate: string) => {
  const response = await fetch(
    `${DIVINUM_FALLBACK_API}/${encodeURIComponent(liturgicalDate)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "MyLatinMass-Ministry-Ordo-Fallback/1.0",
      },
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!response.ok) {
    throw Object.assign(
      new Error(`Divinum Officium fallback returned ${response.status}`),
      { status: 502 },
    )
  }
  return parseDivinumFallback(await response.json(), liturgicalDate)
}

const placeholderOrdoDay = (liturgicalDate: string) => ({
  id: null,
  liturgicalDate,
  celebration: "Liturgical details pending verification",
  classLabel: null,
  vestmentColor: null,
  commemorations: [],
  generalInformation: [],
  massOptions: [],
  breviary: {},
  reminders: [],
  sourceUrl: null,
  sourcePublishedAt: null,
  sourceModifiedAt: null,
  sourceHash: "",
  fetchedAt: null,
  stale: false,
  dataSource: "placeholder",
  verificationRequired: true,
  verificationMessage:
    "1962 Ordo and the Divinum Officium fallback are unavailable. The readings, Mass, and vestment color must be entered and verified before sacristy preparation.",
})

const discoverOrdoUrl = async (liturgicalDate: string) => {
  const response = await fetchOrdo(ORDO_INDEX_URL)
  const result = await response.json()
  const compactDate = liturgicalDate.replaceAll("-", "")
  const day = Array.isArray(result?.liturgicalDays)
    ? result.liturgicalDays.find((item: any) => item?.date === compactDate)
    : null
  const sourceUrl = cleanText(day?.permalink, 1000)
  if (!sourceUrl || !isSafeOrdoUrl(sourceUrl)) {
    throw Object.assign(
      new Error("No 1962 Ordo entry is available for this date"),
      { status: 404 },
    )
  }
  return sourceUrl
}

const toDateKey = (value: unknown) => {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})$/)
    if (match) return match[1]
  }
  const date = new Date(value as string | number | Date)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHAPEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

const rowToOrdoDay = (row: any) => ({
  id: row.id,
  liturgicalDate: toDateKey(row.liturgical_date),
  celebration: row.celebration,
  classLabel: row.class_label || null,
  vestmentColor: row.vestment_color || null,
  commemorations: row.commemorations || [],
  generalInformation: row.general_information || [],
  massOptions: row.mass_options || [],
  breviary: row.breviary || {},
  reminders: row.reminders || [],
  sourceUrl: row.source_url,
  sourcePublishedAt: row.source_published_at || null,
  sourceModifiedAt: row.source_modified_at || null,
  sourceHash: row.source_hash,
  fetchedAt: row.fetched_at,
  dataSource: "1962ordo",
  verificationRequired: false,
  verificationMessage: null,
})

const storeOrdoDay = async (
  client: PoolClient,
  parsed: ParsedOrdoDay,
) => {
  const result = await client.query(
    `
      INSERT INTO ordo_days (
        liturgical_date,
        celebration,
        class_label,
        vestment_color,
        commemorations,
        general_information,
        mass_options,
        breviary,
        reminders,
        source_url,
        source_published_at,
        source_modified_at,
        source_hash,
        fetched_at
      )
      VALUES (
        $1::DATE, $2, $3, $4, $5::JSONB, $6::JSONB, $7::JSONB,
        $8::JSONB, $9::JSONB, $10, $11, $12, $13, now()
      )
      ON CONFLICT (liturgical_date) DO UPDATE SET
        celebration = excluded.celebration,
        class_label = excluded.class_label,
        vestment_color = excluded.vestment_color,
        commemorations = excluded.commemorations,
        general_information = excluded.general_information,
        mass_options = excluded.mass_options,
        breviary = excluded.breviary,
        reminders = excluded.reminders,
        source_url = excluded.source_url,
        source_published_at = excluded.source_published_at,
        source_modified_at = excluded.source_modified_at,
        source_hash = excluded.source_hash,
        fetched_at = now(),
        updated_at = now()
      RETURNING *
    `,
    [
      parsed.liturgicalDate,
      parsed.celebration,
      parsed.classLabel,
      parsed.vestmentColor,
      JSON.stringify(parsed.commemorations),
      JSON.stringify(parsed.generalInformation),
      JSON.stringify(parsed.massOptions),
      JSON.stringify(parsed.breviary),
      JSON.stringify(parsed.reminders),
      parsed.sourceUrl,
      parsed.sourcePublishedAt,
      parsed.sourceModifiedAt,
      parsed.sourceHash,
    ],
  )
  return rowToOrdoDay(result.rows[0])
}

const loadOrdoDay = async (
  client: PoolClient,
  liturgicalDate: string,
  forceRefresh = false,
) => {
  const currentResult = await client.query(
    `SELECT * FROM ordo_days WHERE liturgical_date = $1::DATE LIMIT 1`,
    [liturgicalDate],
  )
  const current = currentResult.rows[0]
  const refreshHours = Math.max(
    1,
    Number(process.env.ORDO_REFRESH_HOURS) || DEFAULT_REFRESH_HOURS,
  )
  const isFresh =
    current &&
    Date.now() - new Date(current.fetched_at).getTime() <
      refreshHours * 60 * 60 * 1000
  if (current && isFresh && !forceRefresh) {
    return { ...rowToOrdoDay(current), stale: false }
  }

  try {
    const sourceUrl =
      current?.source_url || (await discoverOrdoUrl(liturgicalDate))
    const response = await fetchOrdo(sourceUrl)
    const parsed = parseOrdoDayHtml(await response.text(), sourceUrl)
    if (parsed.liturgicalDate !== liturgicalDate) {
      throw Object.assign(
        new Error("The 1962 Ordo returned a different liturgical date"),
        { status: 502 },
      )
    }
    return { ...(await storeOrdoDay(client, parsed)), stale: false }
  } catch (error) {
    if (current) return { ...rowToOrdoDay(current), stale: true }
    console.warn("1962 Ordo unavailable; trying Divinum Officium fallback", error)
    try {
      return await loadDivinumFallback(liturgicalDate)
    } catch (fallbackError) {
      console.warn(
        "Divinum Officium fallback unavailable; returning verification placeholder",
        fallbackError,
      )
      return placeholderOrdoDay(liturgicalDate)
    }
  }
}

const loadEventAccess = async (
  client: PoolClient,
  user: Record<string, any>,
  eventId: string,
) => {
  const eventResult = await client.query(
    `
      SELECT id, ministry_id, status, start_time
      FROM events
      WHERE id = $1
      LIMIT 1
    `,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) throw Object.assign(new Error("Event not found"), { status: 404 })

  const participantResult = await client.query(
    `SELECT ministry_id FROM event_ministries WHERE event_id = $1`,
    [eventId],
  )
  const coordinatorAccess = await getMinistryAccess(
    client,
    user,
    event.ministry_id,
  )
  const participantAccess = await Promise.all(
    participantResult.rows.map((participant) =>
      getMinistryAccess(client, user, participant.ministry_id),
    ),
  )
  const canViewRelated =
    coordinatorAccess.canView ||
    participantAccess.some((access) => access.canView)
  const publiclyVisible = ["published", "cancelled", "completed"].includes(
    event.status,
  )
  if (!canViewRelated && !publiclyVisible) {
    throw Object.assign(new Error("You do not have access to this event"), {
      status: 403,
    })
  }

  return {
    event,
    canViewRelated,
    canSelectMass: coordinatorAccess.canManage,
    canEditSacristyNotes:
      coordinatorAccess.canManage ||
      participantAccess.some((access) => access.canManage),
  }
}

const loadSelection = async (
  client: PoolClient,
  eventId: string,
  day: any,
  access: any,
) => {
  if (!day.id) {
    return {
      selectedMassOptionId: null,
      selectedMassOption: null,
      sacristyNotes: "",
      sourceChanged: false,
      canSelectMass: false,
      canEditSacristyNotes: false,
    }
  }
  const result = await client.query(
    `
      SELECT *
      FROM event_ordo_selections
      WHERE event_id = $1
      LIMIT 1
    `,
    [eventId],
  )
  const selection = result.rows[0]
  const belongsToDay = selection?.ordo_day_id === day.id
  return {
    selectedMassOptionId: belongsToDay
      ? selection.selected_mass_option_id
      : null,
    selectedMassOption: belongsToDay
      ? selection.selected_mass_option_snapshot
      : null,
    sacristyNotes:
      belongsToDay && access.canViewRelated
        ? selection.sacristy_notes || ""
        : "",
    sourceChanged:
      Boolean(belongsToDay && selection.source_hash_at_selection) &&
      selection.source_hash_at_selection !== day.sourceHash,
    canSelectMass: access.canSelectMass,
    canEditSacristyNotes: access.canEditSacristyNotes,
  }
}

const updateSelection = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const eventId = cleanText(body.eventId, 100)
  if (!eventId) {
    throw Object.assign(new Error("Event is required"), { status: 400 })
  }
  const access = await loadEventAccess(client, context.user, eventId)
  const hasMassSelection = Object.hasOwn(body, "selectedMassOptionId")
  const hasSacristyNotes = Object.hasOwn(body, "sacristyNotes")
  if (!hasMassSelection && !hasSacristyNotes) {
    throw Object.assign(new Error("No Ordo changes were provided"), {
      status: 400,
    })
  }
  if (hasMassSelection && !access.canSelectMass) {
    throw Object.assign(
      new Error("You do not have permission to select the Mass"),
      { status: 403 },
    )
  }
  if (hasSacristyNotes && !access.canEditSacristyNotes) {
    throw Object.assign(
      new Error("You do not have permission to update sacristy notes"),
      { status: 403 },
    )
  }

  const liturgicalDate = toDateKey(access.event.start_time)
  const day = await loadOrdoDay(client, liturgicalDate)
  if (!day.id || day.verificationRequired) {
    throw Object.assign(
      new Error(
        "Verify the fallback liturgical details before saving an Ordo selection",
      ),
      { status: 409 },
    )
  }
  const currentResult = await client.query(
    `SELECT * FROM event_ordo_selections WHERE event_id = $1 FOR UPDATE`,
    [eventId],
  )
  const stored = currentResult.rows[0]
  const current = stored?.ordo_day_id === day.id ? stored : null

  const selectedMassOptionId = hasMassSelection
    ? cleanText(body.selectedMassOptionId, 100) || null
    : current?.selected_mass_option_id || null
  const selectedMassOption = hasMassSelection
    ? selectedMassOptionId
      ? day.massOptions.find(
          (option: MassOption) => option.id === selectedMassOptionId,
        )
      : null
    : current?.selected_mass_option_snapshot || null
  if (hasMassSelection && selectedMassOptionId && !selectedMassOption) {
    throw Object.assign(
      new Error("Select a Mass option listed by the 1962 Ordo"),
      { status: 400 },
    )
  }
  const sacristyNotes = hasSacristyNotes
    ? cleanText(body.sacristyNotes)
    : current?.sacristy_notes || ""
  const sourceHashAtSelection = hasMassSelection
    ? selectedMassOption
      ? day.sourceHash
      : null
    : current?.source_hash_at_selection || null
  const selectedBy = hasMassSelection
    ? selectedMassOption
      ? context.user.id
      : null
    : current?.selected_by || null
  const selectedAt = hasMassSelection
    ? selectedMassOption
      ? new Date()
      : null
    : current?.selected_at || null

  const updatedResult = await client.query(
    `
      INSERT INTO event_ordo_selections (
        event_id,
        ordo_day_id,
        selected_mass_option_id,
        selected_mass_option_snapshot,
        source_hash_at_selection,
        sacristy_notes,
        selected_by,
        selected_at,
        updated_by
      )
      VALUES (
        $1, $2, $3, $4::JSONB, $5, $6, $7, $8, $9
      )
      ON CONFLICT (event_id) DO UPDATE SET
        ordo_day_id = excluded.ordo_day_id,
        selected_mass_option_id = excluded.selected_mass_option_id,
        selected_mass_option_snapshot = excluded.selected_mass_option_snapshot,
        source_hash_at_selection = excluded.source_hash_at_selection,
        sacristy_notes = excluded.sacristy_notes,
        selected_by = excluded.selected_by,
        selected_at = excluded.selected_at,
        updated_by = excluded.updated_by,
        updated_at = now()
      RETURNING *
    `,
    [
      eventId,
      day.id,
      selectedMassOptionId,
      selectedMassOption ? JSON.stringify(selectedMassOption) : null,
      sourceHashAtSelection,
      sacristyNotes || null,
      selectedBy,
      selectedAt,
      context.user.id,
    ],
  )
  const updated = updatedResult.rows[0]

  await writeSchedulingAudit(client, context, {
    action: "event.ordo_updated",
    entityType: "event",
    entityId: eventId,
    ministryId: access.event.ministry_id,
    beforeData: stored || null,
    afterData: {
      liturgicalDate,
      celebration: day.celebration,
      classLabel: day.classLabel,
      vestmentColor: day.vestmentColor,
      selectedMassOption,
      sacristyNotes: sacristyNotes || null,
      sourceUrl: day.sourceUrl,
    },
  })

  return {
    day,
    event: {
      selectedMassOptionId: updated.selected_mass_option_id,
      selectedMassOption: updated.selected_mass_option_snapshot,
      sacristyNotes: updated.sacristy_notes || "",
      sourceChanged: false,
      canSelectMass: access.canSelectMass,
      canEditSacristyNotes: access.canEditSacristyNotes,
    },
  }
}

export const handleOrdo = async (request: Request) => {
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    if (request.method === "GET") {
      const url = new URL(request.url)
      const eventId = cleanText(url.searchParams.get("eventId"), 100)
      const requestedDate = cleanText(url.searchParams.get("date"), 10)
      let liturgicalDate = requestedDate
      let access = null

      if (eventId) {
        access = await loadEventAccess(client, context.user, eventId)
        const eventDate = toDateKey(access.event.start_time)
        if (liturgicalDate && liturgicalDate !== eventDate) {
          return json({ message: "The Ordo date does not match the event" }, 400)
        }
        liturgicalDate = eventDate
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(liturgicalDate)) {
        return json({ message: "A valid Ordo date is required" }, 400)
      }

      const forceRefresh =
        url.searchParams.get("refresh") === "true" &&
        Boolean(access?.canEditSacristyNotes)
      const day = await loadOrdoDay(client, liturgicalDate, forceRefresh)
      return json({
        day,
        event:
          eventId && access
            ? await loadSelection(client, eventId, day, access)
            : null,
      })
    }

    if (request.method === "PATCH") {
      const body = await request.json().catch(() => ({}))
      await client.query("BEGIN")
      try {
        const result = await updateSelection(client, context, body)
        await client.query("COMMIT")
        return json({
          ...result,
          message: "Ordo details updated",
        })
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    }
    return json({ message: "Method not allowed" }, 405)
  } catch (error: any) {
    const status =
      error?.status ||
      (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    if (status === 500) console.error("Unable to load 1962 Ordo:", error)
    return json(
      { message: error?.message || "Unable to load the 1962 Ordo" },
      status,
    )
  } finally {
    client.release()
  }
}
