const origin = "https://ordo.fsspx.org"
const settings = { lang: "en", source: "civitates-foederatae", congregation: "fsspx", mode: "civil" }
const colors = { albus: "white", ruber: "red", viridis: "green", violaceus: "violet", niger: "black", roseus: "rose" }
const plainText = value => typeof value === "string" ? value
  .replace(/<[^>]*>/g, "")
  .replace(/&(?:nbsp|#160);/gi, " ")
  .replace(/&(?:apos|#39);/gi, "'")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ").trim() : ""

const referenceUrl = date => `${origin}/en/day/${date}?source=${settings.source}`
const normalizeDay = day => {
  const { date, celebration } = day || {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(celebration?.id) || !plainText(celebration.name)) {
    throw new Error("Invalid SSPX Ordo day")
  }
  return {
    date: date.replaceAll("-", ""),
    name: plainText(celebration.name),
    permalink: referenceUrl(date),
    id: celebration.id,
    rank: /^[1-4]$/.test(celebration.rank) ? Number(celebration.rank) : null,
    color: colors[celebration.color] || "",
    officeColor: colors[celebration.colorOfficii] || "",
    ...(celebration.textsOf ? { textsOf: { id: celebration.textsOf.id, name: plainText(celebration.textsOf.name) } } : {}),
  }
}

const getCalendar = async (period, options = {}) => {
  if (!/^\d{4}(?:\/\d{2}\/\d{2})?$/.test(period)) throw new Error("Invalid Ordo period")
  const query = new URLSearchParams({ ...settings, ...(options.rules ? { regulae: "1" } : {}) })
  const response = await (options.fetchImpl || fetch)(`${origin}/api/v1/calendar/${period}?${query}`, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`SSPX Ordo returned HTTP ${response.status}`)
  const payload = await response.json()
  if (Object.entries(settings).some(([key, value]) => payload[key] !== value)) {
    throw new Error("SSPX Ordo returned an unexpected calendar")
  }
  return payload
}

const getYear = async (year, options) => {
  if (!/^\d{4}$/.test(year)) throw new Error("Invalid Ordo year")
  const payload = await getCalendar(year, options)
  const days = Array.isArray(payload.days) ? payload.days.map(normalizeDay) : []
  const expected = (Date.UTC(Number(year) + 1, 0, 1) - Date.UTC(Number(year), 0, 1)) / 86400000
  if (days.length !== expected || days.some((day, i) =>
    day.date !== new Date(Date.UTC(Number(year), 0, i + 1)).toISOString().slice(0, 10).replaceAll("-", "")
  )) throw new Error("SSPX Ordo returned an incomplete or mismatched year")
  return days
}

const displayColor = code => colors[code] ? colors[code][0].toUpperCase() + colors[code].slice(1) : null
const observanceLabel = (observances) => {
  const rules = observances?.fsspx || observances
  if (rules?.fast && rules.abstinence === true) return "Fast and complete abstinence"
  if (rules?.fast && rules.abstinence === "partial") return "Fast and partial abstinence"
  if (rules?.fast) return "Fast"
  if (rules?.abstinence === true) return "Complete abstinence"
  return ""
}
const toMinistryDay = (payload, date) => {
  const day = payload.day
  const normalized = normalizeDay(day)
  if (day.date !== date) throw new Error("SSPX Ordo returned a different date")
  const directives = Array.isArray(payload.regulae?.directives) ? payload.regulae.directives : []
  const massRules = directives.filter(rule => rule.section === "missa")
  const rule = code => massRules.find(rule => rule.code === code)
  const yesNo = code => ({ praescriptum: true, vetitum: false })[rule(code)?.level] ?? null
  const labels = rules => rules.map(rule => plainText(rule.label)).filter(Boolean)
  const commemorations = (day.commemorations || []).map(item => plainText(item.name)).filter(Boolean)
  const office = Object.fromEntries(directives.filter(rule => rule.scope === "officium")
    .map(rule => [plainText(rule.label), plainText(rule.hint) || plainText(rule.label)]).filter(([name]) => name))
  const celebrations = [...new Map([day.celebration, day.solemnity, ...(day.votives || [])]
    .filter(item => Number.isInteger(item?.id) && plainText(item.name)).map(item => [item.id, item])).values()]
  return {
    liturgicalDate: date,
    celebration: normalized.name,
    classLabel: [null, "I Class", "II Class", "III Class", "IV Class"][normalized.rank] || null,
    vestmentColor: displayColor(day.celebration.color),
    commemorations,
    generalInformation: [
      ...(normalized.textsOf?.name ? [`Texts of ${normalized.textsOf.name}`] : []),
      ...labels(massRules),
    ],
    massOptions: celebrations.map(item => {
      const primary = item.id === day.celebration.id
      return {
        id: `sspx-${item.id}`,
        label: plainText(item.name),
        instructions: primary ? labels(massRules).join(" · ") : "",
        vestmentColor: displayColor(item.color),
        gloria: primary ? yesNo("gloria") : null,
        credo: primary ? yesNo("credo") : null,
        preface: primary ? plainText(rule("praefatio")?.label) || null : null,
        commemoration: primary ? commemorations.join(", ") || null : null,
      }
    }),
    breviary: office,
    reminders: labels(directives.filter(rule => rule.section === "missae" && rule.level === "permissum")),
    fastingObservance: observanceLabel(day.observances),
    sourceUrl: normalized.permalink,
    sourcePublishedAt: null,
    sourceModifiedAt: null,
  }
}

export default { getCalendar, getYear, normalizeDay, plainText, colors, referenceUrl, toMinistryDay }
