import type { PoolClient } from "pg"

export type AvailabilityPolicy = "generally_available" | "rules_only"

type RuleRow = {
  id?: string
  day_of_week: number
  week_of_month?: "every" | "first" | "second" | "third" | "fourth" | "last"
  start_time: string | null
  end_time: string | null
}

type OverrideRow = {
  id?: string
  override_date: string | Date
  preference: "available" | "unavailable"
  start_time?: string | null
  end_time?: string | null
}

type BlockRow = {
  start_date: string | Date
  end_date: string | Date
}

const dateKey = (value: string | Date) => {
  if (typeof value === "string") return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

const timeMinutes = (value: string | null) => {
  if (!value) return null
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number)
  return hours * 60 + minutes
}

const zonedParts = (value: string | Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value))
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    minutes: Number(map.hour) * 60 + Number(map.minute),
  }
}

const weekday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay()

const matchesOccurrence = (day: string, occurrence = "every") => {
  if (occurrence === "every") return true
  const date = new Date(`${day}T12:00:00Z`)
  const occurrenceNumber = Math.ceil(date.getUTCDate() / 7)
  if (occurrence === "last") {
    const followingWeek = new Date(date)
    followingWeek.setUTCDate(date.getUTCDate() + 7)
    return followingWeek.getUTCMonth() !== date.getUTCMonth()
  }
  return occurrenceNumber === {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
  }[occurrence]
}

const mergeWindows = (windows: Array<{ start: number; end: number }>) => {
  const sorted = windows
    .filter((window) => window.end > window.start)
    .sort((left, right) => left.start - right.start)
  return sorted.reduce<Array<{ start: number; end: number }>>((merged, window) => {
    const previous = merged[merged.length - 1]
    if (!previous || window.start > previous.end) {
      merged.push({ ...window })
    } else {
      previous.end = Math.max(previous.end, window.end)
    }
    return merged
  }, [])
}

const availableOutsideExclusions = (
  exclusions: Array<{ start: number; end: number }>,
) => {
  const windows: Array<{ start: number; end: number; allDay: false }> = []
  let cursor = 0
  for (const exclusion of exclusions) {
    if (exclusion.start > cursor) {
      windows.push({ start: cursor, end: exclusion.start, allDay: false })
    }
    cursor = Math.max(cursor, exclusion.end)
  }
  if (cursor < 1440) windows.push({ start: cursor, end: 1440, allDay: false })
  return windows
}

export const effectiveAvailabilityDay = ({
  day,
  policy: _policy,
  rules,
  overrides,
  blocks,
}: {
  day: string
  policy: AvailabilityPolicy
  rules: RuleRow[]
  overrides: OverrideRow[]
  blocks: BlockRow[]
}) => {
  const override = overrides.find((item) => dateKey(item.override_date) === day)
  if (override) {
    const start = timeMinutes(override.start_time || null)
    const end = timeMinutes(override.end_time || null)
    const partiallyAvailable =
      override.preference === "available" && start !== null && end !== null
    return {
      date: day,
      status: override.preference,
      source: "override",
      explicit: true,
      windows: override.preference === "available"
        ? partiallyAvailable
          ? [{ start, end, allDay: false }]
          : [{ start: 0, end: 1440, allDay: true }]
        : [],
      exclusions: partiallyAvailable
        ? [
            ...(start > 0 ? [{ start: 0, end: start, allDay: false }] : []),
            ...(end < 1440 ? [{ start: end, end: 1440, allDay: false }] : []),
          ]
        : [],
    }
  }

  const blocked = blocks.some(
    (item) => dateKey(item.start_date) <= day && dateKey(item.end_date) >= day,
  )
  if (blocked) {
    return {
      date: day,
      status: "unavailable",
      source: "range",
      explicit: false,
      windows: [],
      exclusions: [{ start: 0, end: 1440, allDay: true }],
    }
  }

  const matchingRules = rules.filter(
    (rule) =>
      Number(rule.day_of_week) === weekday(day) &&
      matchesOccurrence(day, rule.week_of_month || "every"),
  )
  if (!matchingRules.length) {
    return {
      date: day,
      status: "available",
      source: "default",
      explicit: false,
      windows: [{ start: 0, end: 1440, allDay: true }],
      exclusions: [],
    }
  }

  const exclusions = mergeWindows(matchingRules.map((rule) => {
      const start = timeMinutes(rule.start_time)
      const end = timeMinutes(rule.end_time)
      return start === null || end === null
        ? { start: 0, end: 1440 }
        : { start, end }
    }))
  const windows = availableOutsideExclusions(exclusions)
  const unavailableAllDay = !windows.length
  return {
    date: day,
    status: unavailableAllDay ? "unavailable" : "available",
    source: "exclusion_rule",
    explicit: false,
    windows,
    exclusions: exclusions.map((window) => ({
      ...window,
      allDay: window.start === 0 && window.end === 1440,
    })),
  }
}

export const eventFits = ({
  start,
  end,
  timezone,
  policy,
  rules,
  overrides,
  blocks,
}: {
  start: string | Date
  end: string | Date
  timezone: string
  policy: AvailabilityPolicy
  rules: RuleRow[]
  overrides: OverrideRow[]
  blocks: BlockRow[]
}) => {
  const localStart = zonedParts(start, timezone)
  const localEnd = zonedParts(end, timezone)
  if (localStart.date !== localEnd.date) return false
  const day = effectiveAvailabilityDay({
    day: localStart.date,
    policy,
    rules,
    overrides,
    blocks,
  })
  return day.status === "available" && day.windows.some(
    (window) => localStart.minutes >= window.start && localEnd.minutes <= window.end,
  )
}

export const loadAvailabilityConfiguration = async (
  client: PoolClient,
  userId: string,
  ministryId: string,
) => {
  const [membershipResult, ruleResult, overrideResult, blockResult] =
    await Promise.all([
      client.query(
        `SELECT membership.availability_policy, ministry.timezone
         FROM ministry_members membership
         JOIN ministries ministry ON ministry.id = membership.ministry_id
         WHERE membership.user_id = $1 AND membership.ministry_id = $2
           AND membership.status = 'active'
         LIMIT 1`,
        [userId, ministryId],
      ),
      client.query(
        `SELECT id, day_of_week, week_of_month, start_time, end_time
         FROM availability_weekly_rules
         WHERE user_id = $1 AND ministry_id = $2 AND status = 'active'
         ORDER BY day_of_week, start_time`,
        [userId, ministryId],
      ),
      client.query(
        `SELECT id, override_date, preference, start_time, end_time
         FROM availability_date_overrides
         WHERE user_id = $1 AND ministry_id = $2
         ORDER BY override_date`,
        [userId, ministryId],
      ),
      client.query(
        `SELECT start_date, end_date
         FROM availability_blocks
         WHERE user_id = $1 AND status = 'active'
           AND (ministry_id IS NULL OR ministry_id = $2)`,
        [userId, ministryId],
      ),
    ])
  const membership = membershipResult.rows[0]
  if (!membership) return null
  return {
    policy: membership.availability_policy as AvailabilityPolicy,
    timezone: membership.timezone || "America/New_York",
    rules: ruleResult.rows as RuleRow[],
    overrides: overrideResult.rows as OverrideRow[],
    blocks: blockResult.rows as BlockRow[],
  }
}

export const filterAvailableMemberIds = async (
  client: PoolClient,
  userIds: string[],
  ministryId: string,
  start: string | Date,
  end: string | Date,
) => {
  if (!userIds.length) return []
  const uniqueIds = Array.from(new Set(userIds))
  const [membershipResult, ruleResult, overrideResult, blockResult] =
    await Promise.all([
      client.query(
        `SELECT membership.user_id, membership.availability_policy, ministry.timezone
         FROM ministry_members membership
         JOIN ministries ministry ON ministry.id = membership.ministry_id
         WHERE membership.ministry_id = $1 AND membership.user_id = ANY($2::UUID[])
           AND membership.status = 'active'`,
        [ministryId, uniqueIds],
      ),
      client.query(
        `SELECT user_id, day_of_week, week_of_month, start_time, end_time
         FROM availability_weekly_rules
         WHERE ministry_id = $1 AND user_id = ANY($2::UUID[]) AND status = 'active'`,
        [ministryId, uniqueIds],
      ),
      client.query(
        `SELECT user_id, override_date, preference, start_time, end_time
         FROM availability_date_overrides
         WHERE ministry_id = $1 AND user_id = ANY($2::UUID[])`,
        [ministryId, uniqueIds],
      ),
      client.query(
        `SELECT user_id, start_date, end_date
         FROM availability_blocks
         WHERE user_id = ANY($1::UUID[]) AND status = 'active'
           AND (ministry_id IS NULL OR ministry_id = $2)`,
        [uniqueIds, ministryId],
      ),
    ])
  const group = (rows: any[]) => rows.reduce((map, row) => {
    const current = map.get(row.user_id) || []
    current.push(row)
    map.set(row.user_id, current)
    return map
  }, new Map<string, any[]>())
  const memberships = new Map(
    membershipResult.rows.map((row) => [row.user_id, row]),
  )
  const rules = group(ruleResult.rows)
  const overrides = group(overrideResult.rows)
  const blocks = group(blockResult.rows)
  return uniqueIds.filter((userId) => {
    const membership = memberships.get(userId)
    if (!membership) return false
    return eventFits({
      start,
      end,
      timezone: membership.timezone || "America/New_York",
      policy: membership.availability_policy,
      rules: rules.get(userId) || [],
      overrides: overrides.get(userId) || [],
      blocks: blocks.get(userId) || [],
    })
  })
}

export const monthAvailabilityDays = (
  month: string,
  configuration: NonNullable<Awaited<ReturnType<typeof loadAvailabilityConfiguration>>>,
) => {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Month is invalid")
  const [year, monthNumber] = month.split("-").map(Number)
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return Array.from({ length: count }, (_, index) =>
    effectiveAvailabilityDay({
      day: `${month}-${String(index + 1).padStart(2, "0")}`,
      ...configuration,
    }),
  )
}
