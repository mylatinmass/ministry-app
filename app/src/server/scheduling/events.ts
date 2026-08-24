import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import {
  sendEventScheduleNotifications,
  sendSubstitutionAcceptedNotifications,
  sendSubstitutionRequestNotifications,
} from "../notifications/assignment-notifications"
import {
  getIdentityContext,
  getMinistryAccess,
  requireMinistryAccess,
  writeSchedulingAudit,
} from "./authorization"
import {
  acceptAssignmentSubstitute,
  loadEventSubstitutionState,
  requestAssignmentSubstitute,
} from "./substitutions"
import { getPriestPrivacyAccess } from "./priest-privacy"
import {
  assertPriestAllocation,
  checkPrioryAllocation,
} from "./priory-allocations"

const EVENT_STATUSES = new Set([
  "draft",
  "published",
  "cancelled",
  "completed",
  "archived",
])
const RESPONSIBILITY_TYPES = new Set([
  "position",
  "food",
  "task",
  "time_slot",
])
const RESPONSIBILITY_ACTIONS = new Set([
  "add_responsibility",
  "update_responsibility",
  "cancel_responsibility",
])
const ACTIVE_ASSIGNMENT_STATUSES = [
  "interested",
  "pending",
  "assigned",
  "confirmed",
  "change_requested",
]
const SERVICE_OUTCOMES = new Set([
  "served",
  "no_show",
  "substitute_served",
  "excused",
])
const PARTICIPATION_TYPES = new Set(["members", "volunteers", "both"])
const EVENT_VISIBILITIES = new Set(["public", "ministry", "private"])
const SIGNUP_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RESERVED_SIGNUP_CODES = new Set([
  "api",
  "admin",
  "login",
  "invite",
  "volunteer",
  "support",
])
const chapelDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const chapelDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

const cleanText = (value: unknown, maximum = 5000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const normalizeSignupCode = (value: unknown) =>
  cleanText(value, 64).toLowerCase()

const normalizeEventResponsibility = (body: any) => {
  const name = cleanText(body.name, 250)
  const responsibilityType = RESPONSIBILITY_TYPES.has(
    body.responsibilityType,
  )
    ? body.responsibilityType
    : "position"
  const quantityNeeded = Number.parseInt(body.quantityNeeded, 10)
  const relativeStartMinutes = Number.parseInt(
    body.relativeStartMinutes,
    10,
  )

  if (!name) {
    throw Object.assign(new Error("Responsibility name is required"), {
      status: 400,
    })
  }
  if (
    !Number.isInteger(quantityNeeded) ||
    quantityNeeded < 1 ||
    quantityNeeded > 100
  ) {
    throw Object.assign(
      new Error("Responsibility quantity must be between 1 and 100"),
      { status: 400 },
    )
  }
  if (![0, -15, -30, -45, -60, -120].includes(relativeStartMinutes)) {
    throw Object.assign(
      new Error("Choose a valid responsibility time offset"),
      { status: 400 },
    )
  }

  return {
    name,
    responsibilityType,
    quantityNeeded,
    approvalRequired: Boolean(body.approvalRequired),
    substitutionAllowed: body.substitutionAllowed !== false,
    isRequired: body.isRequired !== false,
    requiredLevelId: cleanText(body.requiredLevelId, 100) || null,
    requiredGroupId: cleanText(body.requiredGroupId, 100) || null,
    relativeStartMinutes,
    instructions: cleanText(body.instructions) || null,
  }
}

const parseDate = (value: unknown, fieldName: string) => {
  const date = new Date(typeof value === "string" ? value : "")
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${fieldName} is invalid`), { status: 400 })
  }
  return date
}

const normalizeRoomIds = (value: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((roomId) => cleanText(roomId, 100))
        .filter(Boolean),
    ),
  )

const loadActiveRooms = async (client: PoolClient) => {
  const result = await client.query(
    `
      SELECT id, name, description, sort_order
      FROM chapel_rooms
      WHERE status = 'active'
      ORDER BY sort_order, lower(name)
    `,
  )
  return result.rows.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description || "",
    sortOrder: Number(room.sort_order) || 0,
  }))
}

const validateRoomIds = async (client: PoolClient, roomIds: string[]) => {
  if (!roomIds.length) return
  const result = await client.query(
    `SELECT id FROM chapel_rooms WHERE id = ANY($1::UUID[]) AND status = 'active'`,
    [roomIds],
  )
  if (result.rowCount !== roomIds.length) {
    throw Object.assign(new Error("Select only active chapel rooms"), {
      status: 400,
    })
  }
}

const replaceEventRooms = async (
  client: PoolClient,
  eventId: string,
  roomIds: string[],
  actorUserId: string,
) => {
  await client.query(`DELETE FROM event_room_reservations WHERE event_id = $1`, [
    eventId,
  ])
  for (const roomId of roomIds) {
    await client.query(
      `
        INSERT INTO event_room_reservations (event_id, room_id, created_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (event_id, room_id) DO NOTHING
      `,
      [eventId, roomId, actorUserId],
    )
  }
}

const excludeReservationMinistry = async (
  client: PoolClient,
  ministryIds: string[],
) => {
  if (!ministryIds.length) return []
  const result = await client.query(
    `SELECT id FROM ministries WHERE id = ANY($1::UUID[]) AND slug <> 'reservations'`,
    [ministryIds],
  )
  return result.rows.map((row) => row.id)
}

const findRoomConflicts = async (
  client: PoolClient,
  roomIds: string[],
  start: Date,
  end: Date,
  excludeEventIds: string[] = [],
) => {
  if (!roomIds.length) return []
  const result = await client.query(
    `
      SELECT event.id, event.title, event.start_time, event.end_time,
        string_agg(room.name, ', ' ORDER BY room.sort_order, room.name) AS room_names
      FROM events event
      JOIN event_room_reservations reservation ON reservation.event_id = event.id
      JOIN chapel_rooms room ON room.id = reservation.room_id
      WHERE reservation.room_id = ANY($1::UUID[])
        AND event.status IN ('draft', 'published')
        AND event.start_time < $3
        AND event.end_time > $2
        AND NOT (event.id = ANY($4::UUID[]))
      GROUP BY event.id, event.title, event.start_time, event.end_time
      ORDER BY event.start_time, event.id
      LIMIT 20
    `,
    [roomIds, start, end, excludeEventIds],
  )
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    kind: "room",
    roomNames: row.room_names || "",
  }))
}

const findEventConflicts = async (
  client: PoolClient,
  ministryIds: string[],
  start: Date,
  end: Date,
  excludeEventIds: string[] = [],
) => {
  if (!ministryIds.length) return []
  const result = await client.query(
    `
      SELECT DISTINCT event.id, event.title, event.start_time, event.end_time
      FROM events event
      LEFT JOIN event_ministries event_ministry
        ON event_ministry.event_id = event.id
      WHERE event.status IN ('draft', 'published')
        AND (
          event.ministry_id = ANY($1::UUID[])
          OR event_ministry.ministry_id = ANY($1::UUID[])
        )
        AND event.start_time < $3
        AND event.end_time > $2
        AND NOT (event.id = ANY($4::UUID[]))
      ORDER BY event.start_time, event.id
      LIMIT 20
    `,
    [ministryIds, start, end, excludeEventIds],
  )
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
  }))
}

const previewEventConflicts = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const start = parseDate(body.startTime, "Start time")
  const end = parseDate(body.endTime, "End time")
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
  }
  const eventId = cleanText(body.eventId, 100)
  const roomIds = normalizeRoomIds(body.roomIds)
  await validateRoomIds(client, roomIds)
  let ministryIds: string[] = []
  if (eventId) {
    const eventResult = await client.query(
      `SELECT id, ministry_id FROM events WHERE id = $1 LIMIT 1`,
      [eventId],
    )
    const event = eventResult.rows[0]
    if (!event) throw Object.assign(new Error("Event not found"), { status: 404 })
    await requireMinistryAccess(client, context.user, event.ministry_id, true)
    const participants = await client.query(
      `SELECT ministry_id FROM event_ministries WHERE event_id = $1`,
      [eventId],
    )
    ministryIds = Array.from(
      new Set([event.ministry_id, ...participants.rows.map((row) => row.ministry_id)]),
    ).filter(Boolean) as string[]
  } else {
    const structure = await loadTemplateStructure(
      client,
      cleanText(body.templateId, 100),
    )
    await requireMinistryAccess(
      client,
      context.user,
      structure.template.ministry_id,
      true,
    )
    ministryIds = Array.from(
      new Set([
        structure.template.ministry_id,
        ...structure.blocks.map((block: any) => block.ministry_id),
      ]),
    ).filter(Boolean) as string[]
  }
  ministryIds = await excludeReservationMinistry(client, ministryIds)
  const [scheduleConflicts, roomConflicts] = await Promise.all([
    findEventConflicts(
      client,
      ministryIds,
      start,
      end,
      eventId ? [eventId] : [],
    ),
    findRoomConflicts(
      client,
      roomIds,
      start,
      end,
      eventId ? [eventId] : [],
    ),
  ])
  return { conflicts: [...scheduleConflicts, ...roomConflicts] }
}

const toChapelDateKey = (value: string | Date) => {
  const parts = chapelDateFormatter.formatToParts(new Date(value))
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

const addMonths = (source: Date, months: number) => {
  const result = new Date(source)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

const toChapelWallClock = (instant: Date) => {
  const values = Object.fromEntries(
    chapelDateTimeFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  )
  return new Date(Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
    instant.getUTCMilliseconds(),
  ))
}

const fromChapelWallClock = (wallClock: Date) => {
  const target = wallClock.getTime()
  let candidate = new Date(target)
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = toChapelWallClock(candidate).getTime()
    candidate = new Date(candidate.getTime() + (target - observed))
  }
  return candidate
}

const nthWeekdayOfMonth = (
  source: Date,
  months: number,
  weekday: number,
  ordinal: number,
) => {
  const month = new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth() + months,
    1,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ))
  if (ordinal === -1) {
    month.setUTCMonth(month.getUTCMonth() + 1)
    month.setUTCDate(0)
    month.setUTCDate(month.getUTCDate() - ((month.getUTCDay() - weekday + 7) % 7))
    return month
  }
  month.setUTCDate(1 + ((weekday - month.getUTCDay() + 7) % 7) + (ordinal - 1) * 7)
  return month
}

const normalizeRecurrence = (recurrence: any, minimumCount = 2) => {
  const frequency = [
    "weekly",
    "monthly",
    "monthly_nth_weekday",
    "first_friday",
    "first_saturday",
    "friday_before_first_saturday",
  ].includes(recurrence?.frequency)
    ? recurrence.frequency
    : "none"
  return {
    frequency,
    interval: Math.min(12, Math.max(1, Number(recurrence?.interval) || 1)),
    count:
      frequency === "none"
        ? 1
        : Math.min(52, Math.max(minimumCount, Number(recurrence?.count) || 12)),
    weekday: Math.min(6, Math.max(0, Number(recurrence?.weekday) || 0)),
    ordinal: [-1, 1, 2, 3, 4].includes(Number(recurrence?.ordinal))
      ? Number(recurrence.ordinal)
      : 1,
  }
}

const monthlyRuleCandidate = (
  start: Date,
  monthOffset: number,
  recurrence: ReturnType<typeof normalizeRecurrence>,
) => {
  if (recurrence.frequency === "first_friday") {
    return nthWeekdayOfMonth(start, monthOffset, 5, 1)
  }
  if (recurrence.frequency === "first_saturday") {
    return nthWeekdayOfMonth(start, monthOffset, 6, 1)
  }
  if (recurrence.frequency === "friday_before_first_saturday") {
    const firstSaturday = nthWeekdayOfMonth(start, monthOffset, 6, 1)
    return new Date(firstSaturday.getTime() - 86_400_000)
  }
  return nthWeekdayOfMonth(
    start,
    monthOffset,
    recurrence.weekday,
    recurrence.ordinal,
  )
}

export const getOccurrenceStarts = (
  startInstant: Date,
  recurrence: any,
  minimumCount = 2,
) => {
  const start = toChapelWallClock(startInstant)
  const normalized = normalizeRecurrence(recurrence, minimumCount)
  const { frequency, count, interval } = normalized
  let firstRuleMonthOffset = 0
  if ([
    "first_friday",
    "first_saturday",
    "friday_before_first_saturday",
    "monthly_nth_weekday",
  ].includes(frequency)) {
    while (
      firstRuleMonthOffset < 24 &&
      monthlyRuleCandidate(start, firstRuleMonthOffset, normalized) < start
    ) {
      firstRuleMonthOffset += 1
    }
  }

  return Array.from({ length: count }, (_, index) => {
    if (frequency === "weekly") {
      return new Date(start.getTime() + index * interval * 7 * 86_400_000)
    }
    if (frequency === "monthly") return addMonths(start, index * interval)
    if ([
      "first_friday",
      "first_saturday",
      "friday_before_first_saturday",
      "monthly_nth_weekday",
    ].includes(frequency)) {
      return monthlyRuleCandidate(
        start,
        firstRuleMonthOffset + index * interval,
        normalized,
      )
    }
    return new Date(start)
  }).map(fromChapelWallClock)
}

const loadTemplateStructure = async (
  client: PoolClient,
  templateId: string,
) => {
  const templateResult = await client.query(
    `
      SELECT
        id,
        ministry_id,
        name,
        description,
        participation_type,
        responsibilities,
        status,
        version
      FROM templates
      WHERE id = $1
      LIMIT 1
    `,
    [templateId],
  )
  const template = templateResult.rows[0]
  if (!template || template.status !== "active") {
    throw Object.assign(new Error("Template is unavailable"), { status: 404 })
  }

  const [blockResult, responsibilityResult] = await Promise.all([
    client.query(
      `
        SELECT
          id,
          ministry_id,
          is_required,
          instructions,
          sort_order,
          ARRAY(SELECT scoped.group_id FROM template_ministry_groups scoped WHERE scoped.template_ministry_id = template_ministries.id) AS group_ids
        FROM template_ministries
        WHERE template_id = $1
        ORDER BY sort_order
      `,
      [templateId],
    ),
    client.query(
      `
        SELECT
          responsibility.id,
          block.ministry_id,
          responsibility.name,
          responsibility.description,
          responsibility.responsibility_type,
          responsibility.quantity_needed,
          responsibility.approval_required,
          responsibility.substitution_allowed,
          responsibility.is_required,
          responsibility.required_ministry_level_id,
          responsibility.required_group_id,
          responsibility.required_qualification,
          responsibility.relative_start_minutes,
          responsibility.instructions,
          responsibility.sort_order
        FROM template_responsibilities responsibility
        JOIN template_ministries block
          ON block.id = responsibility.template_ministry_id
        WHERE responsibility.template_id = $1
          AND responsibility.status = 'active'
        ORDER BY responsibility.sort_order
      `,
      [templateId],
    ),
  ])

  const blocks = blockResult.rows.length
    ? blockResult.rows
    : [
        {
          id: null,
          ministry_id: template.ministry_id,
          is_required: true,
          instructions: null,
          sort_order: 0,
        },
      ]
  let responsibilities = responsibilityResult.rows

  if (!responsibilities.length && Array.isArray(template.responsibilities)) {
    responsibilities = template.responsibilities
      .map((responsibility: any, index: number) => {
        const name =
          typeof responsibility === "string"
            ? responsibility
            : responsibility?.name || responsibility?.title
        if (!name) return null
        return {
          id: null,
          ministry_id: template.ministry_id,
          name,
          description: responsibility?.description || null,
          responsibility_type:
            responsibility?.responsibility_type ||
            responsibility?.type ||
            "position",
          quantity_needed:
            Number(
              responsibility?.quantity_needed || responsibility?.quantity,
            ) || 1,
          approval_required: Boolean(responsibility?.approval_required),
          is_required: responsibility?.is_required !== false,
          required_ministry_level_id: null,
          required_qualification:
            responsibility?.required_qualification || null,
          relative_start_minutes:
            Number(responsibility?.relative_start_minutes) || 0,
          instructions: responsibility?.instructions || null,
          sort_order: index,
        }
      })
      .filter(Boolean)
  }

  return { template, blocks, responsibilities }
}

const previewTemplateAssignments = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const templateId = cleanText(body.templateId, 100)
  const structure = await loadTemplateStructure(client, templateId)
  await requireMinistryAccess(
    client,
    context.user,
    structure.template.ministry_id,
    true,
  )
  const start = parseDate(body.startTime, "Start time")
  const end = parseDate(body.endTime, "End time")
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
  }

  const result = await client.query(
    `
      SELECT
        responsibility.id AS responsibility_id,
        member.id AS user_id,
        member.first_name,
        member.last_name,
        granted_level.name AS highest_level_name,
        granted_level.rank_order AS highest_level_rank,
        membership.serving_preference,
        membership.monthly_frequency_limit,
        member.automatic_assignment_monthly_limit,
        (
          SELECT count(*)
          FROM responsibility_assignments monthly_assignment
          JOIN events monthly_event ON monthly_event.id = monthly_assignment.event_id
          JOIN event_responsibilities monthly_responsibility
            ON monthly_responsibility.id = monthly_assignment.responsibility_id
          WHERE monthly_assignment.user_id = member.id
            AND monthly_assignment.status = ANY($4)
            AND date_trunc('month', monthly_event.start_time AT TIME ZONE 'America/New_York')
              = date_trunc('month', $2::TIMESTAMPTZ AT TIME ZONE 'America/New_York')
            AND COALESCE(monthly_responsibility.ministry_id, monthly_event.ministry_id)
              = block.ministry_id
        )::INT AS ministry_monthly_count,
        (
          SELECT count(*)
          FROM responsibility_assignments monthly_assignment
          JOIN events monthly_event ON monthly_event.id = monthly_assignment.event_id
          WHERE monthly_assignment.user_id = member.id
            AND monthly_assignment.status = ANY($4)
            AND date_trunc('month', monthly_event.start_time AT TIME ZONE 'America/New_York')
              = date_trunc('month', $2::TIMESTAMPTZ AT TIME ZONE 'America/New_York')
        )::INT AS overall_monthly_count
      FROM template_responsibilities responsibility
      JOIN template_ministries block
        ON block.id = responsibility.template_ministry_id
      JOIN ministry_members membership
        ON membership.ministry_id = block.ministry_id
       AND membership.status = 'active'
       AND membership.serving_preference <> 'cannot_serve'
       AND (
         responsibility.required_group_id IS NULL
         OR EXISTS (SELECT 1 FROM ministry_group_members group_member WHERE group_member.ministry_member_id = membership.id AND group_member.group_id = responsibility.required_group_id)
       )
      JOIN ministry_accounts member ON member.id = membership.user_id
      LEFT JOIN ministry_levels required_level
        ON required_level.id = responsibility.required_ministry_level_id
      LEFT JOIN ministry_levels granted_level
        ON granted_level.id = membership.highest_level_id
      WHERE responsibility.template_id = $1
        AND responsibility.status = 'active'
        AND COALESCE(member.is_volunteer_profile, false) = false
        AND (
          required_level.id IS NULL
          OR (
            granted_level.ministry_id = block.ministry_id
            AND granted_level.rank_order >= required_level.rank_order
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM availability_blocks unavailable
          WHERE unavailable.user_id = member.id
            AND unavailable.status = 'active'
            AND (
              unavailable.ministry_id IS NULL
              OR unavailable.ministry_id = block.ministry_id
            )
            AND unavailable.start_date <= $5::DATE
            AND unavailable.end_date >= $5::DATE
        )
        AND NOT EXISTS (
          SELECT 1
          FROM responsibility_assignments other_assignment
          JOIN events other_event ON other_event.id = other_assignment.event_id
          JOIN event_responsibilities other_responsibility
            ON other_responsibility.id = other_assignment.responsibility_id
          WHERE other_assignment.user_id = member.id
            AND other_assignment.status = ANY($4)
            AND other_event.status NOT IN ('cancelled', 'archived')
            AND other_event.start_time
              + COALESCE(other_responsibility.relative_start_minutes, 0)
                * INTERVAL '1 minute' < $3
            AND other_event.end_time >
              $2::TIMESTAMPTZ
              + COALESCE(responsibility.relative_start_minutes, 0)
                * INTERVAL '1 minute'
        )
      ORDER BY
        responsibility.sort_order,
        CASE membership.serving_preference
          WHEN 'prefer' THEN 0
          WHEN 'sometimes' THEN 1
          WHEN 'if_necessary' THEN 2
          ELSE 3
        END,
        granted_level.rank_order DESC NULLS LAST,
        ministry_monthly_count,
        overall_monthly_count,
        lower(member.last_name),
        lower(member.first_name)
    `,
    [
      templateId,
      start,
      end,
      ACTIVE_ASSIGNMENT_STATUSES,
      toChapelDateKey(start),
    ],
  )

  const priestMinistry = await client.query(
    `SELECT id FROM ministries WHERE slug = 'priests' LIMIT 1`,
  )
  const priestMinistryId = priestMinistry.rows[0]?.id || ""
  const responsibilityMinistries = new Map(
    structure.responsibilities.map((responsibility: any) => [
      responsibility.id,
      responsibility.ministry_id || structure.template.ministry_id,
    ]),
  )
  const membersByResponsibility = new Map<string, any[]>()
  for (const member of result.rows) {
    if (
      responsibilityMinistries.get(member.responsibility_id) ===
      priestMinistryId
    ) {
      const responsibility = structure.responsibilities.find(
        (item: any) => item.id === member.responsibility_id,
      )
      const allocation = await checkPrioryAllocation(
        client,
        member.user_id,
        new Date(
          start.getTime() +
            Number(responsibility?.relative_start_minutes || 0) * 60_000,
        ),
        end,
      )
      if (!allocation.allowed) continue
    }
    const ministryCount = Number(member.ministry_monthly_count || 0)
    const overallCount = Number(member.overall_monthly_count || 0)
    const ministryLimit = member.monthly_frequency_limit == null
      ? null
      : Number(member.monthly_frequency_limit)
    const overallLimit = member.automatic_assignment_monthly_limit == null
      ? null
      : Number(member.automatic_assignment_monthly_limit)
    const members = membersByResponsibility.get(member.responsibility_id) || []
    members.push({
      userId: member.user_id,
      firstName: member.first_name,
      lastName: member.last_name || "",
      highestLevelName: member.highest_level_name || "",
      highestLevelRank: Number(member.highest_level_rank) || null,
      servingPreference: member.serving_preference || "prefer",
      ministryMonthlyCount: ministryCount,
      overallMonthlyCount: overallCount,
      automaticEligible:
        (ministryLimit === null || ministryCount < ministryLimit) &&
        (overallLimit === null || overallCount < overallLimit),
    })
    membersByResponsibility.set(member.responsibility_id, members)
  }

  return {
    responsibilities: structure.responsibilities.map((responsibility: any) => ({
      templateResponsibilityId: responsibility.id,
      availableMembers: membersByResponsibility.get(responsibility.id) || [],
    })),
  }
}

type AutomaticScheduleResult = {
  eventId: string
  published: boolean
  assignmentIds: string[]
  shortages: Array<{
    responsibilityId: string
    responsibilityName: string
    ministryId: string
    missing: number
  }>
  conflicts: any[]
}

const fillAndReviewAutomaticSchedule = async (
  client: PoolClient,
  context: any,
  eventId: string,
  eventConflicts: any[] = [],
  targetMinistryId: string | null = null,
  generation = "repeating_schedule",
  reviewPublication = true,
): Promise<AutomaticScheduleResult> => {
  const eventResult = await client.query(
    `SELECT * FROM events WHERE id = $1 FOR UPDATE`,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) {
    throw Object.assign(new Error("Event not found"), { status: 404 })
  }

  const responsibilities = await client.query(
    `
      SELECT
        responsibility.id,
        responsibility.template_responsibility_id,
        responsibility.name,
        responsibility.quantity_needed,
        responsibility.is_required,
        responsibility.is_public_assignment,
        responsibility.required_ministry_level_id,
        responsibility.required_group_id,
        responsibility.required_qualification,
        responsibility.relative_start_minutes,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        COALESCE((
          SELECT sum(assignment.quantity)
          FROM responsibility_assignments assignment
          WHERE assignment.responsibility_id = responsibility.id
            AND assignment.status NOT IN ('declined', 'cancelled')
        ), 0)::INT AS assigned_quantity
      FROM event_responsibilities responsibility
      JOIN events event ON event.id = responsibility.event_id
      LEFT JOIN ministry_levels required_level
        ON required_level.id = responsibility.required_ministry_level_id
      WHERE responsibility.event_id = $1
        AND responsibility.status <> 'cancelled'
        AND (
          $2::UUID IS NULL
          OR COALESCE(responsibility.ministry_id, event.ministry_id) = $2
        )
      ORDER BY
        required_level.rank_order DESC NULLS LAST,
        responsibility.sort_order,
        responsibility.id
    `,
    [eventId, targetMinistryId],
  )

  const assignmentIds: string[] = []
  for (const responsibility of responsibilities.rows) {
    if (
      responsibility.is_public_assignment ||
      event.participation_type === "volunteers"
    ) {
      continue
    }
    const responsibilityMinistry = await client.query(
      `SELECT slug FROM ministries WHERE id = $1`,
      [responsibility.ministry_id],
    )
    const isPriestResponsibility =
      responsibilityMinistry.rows[0]?.slug === "priests"
    let missing = Math.max(
      0,
      Number(responsibility.quantity_needed) -
        Number(responsibility.assigned_quantity),
    )
    while (missing > 0) {
      const candidateResult = await client.query(
        `
          SELECT
            member.id,
            member.first_name,
            member.last_name,
            granted_level.rank_order AS granted_level_rank,
            required_level.rank_order AS required_level_rank,
            membership.serving_preference,
            COALESCE(monthly.ministry_count, 0)::INT AS ministry_monthly_count,
            COALESCE(monthly.overall_count, 0)::INT AS overall_monthly_count,
            history.last_served_at,
            COALESCE(history.same_position_count, 0)::INT AS same_position_count
          FROM ministry_members membership
          JOIN ministry_accounts member ON member.id = membership.user_id
          LEFT JOIN ministry_levels required_level
            ON required_level.id = $7
          LEFT JOIN ministry_levels granted_level
            ON granted_level.id = membership.highest_level_id
          LEFT JOIN LATERAL (
            SELECT
              count(*) FILTER (
                WHERE COALESCE(monthly_responsibility.ministry_id, monthly_event.ministry_id) = $1
              ) AS ministry_count,
              count(*) AS overall_count
            FROM responsibility_assignments monthly_assignment
            JOIN events monthly_event ON monthly_event.id = monthly_assignment.event_id
            JOIN event_responsibilities monthly_responsibility
              ON monthly_responsibility.id = monthly_assignment.responsibility_id
            WHERE monthly_assignment.user_id = member.id
              AND monthly_assignment.status = ANY($3)
              AND date_trunc('month', monthly_event.start_time AT TIME ZONE 'America/New_York')
                = date_trunc('month', $5::TIMESTAMPTZ AT TIME ZONE 'America/New_York')
          ) monthly ON true
          LEFT JOIN LATERAL (
            SELECT
              max(history_event.start_time) AS last_served_at,
              count(*) FILTER (
                WHERE history_responsibility.template_responsibility_id = $9
              ) AS same_position_count
            FROM responsibility_assignments history_assignment
            JOIN events history_event ON history_event.id = history_assignment.event_id
            JOIN event_responsibilities history_responsibility
              ON history_responsibility.id = history_assignment.responsibility_id
            WHERE history_assignment.user_id = member.id
              AND history_assignment.status IN ('assigned', 'confirmed', 'completed')
              AND history_event.start_time < $5
          ) history ON true
          WHERE membership.ministry_id = $1
            AND membership.status = 'active'
            AND membership.serving_preference <> 'cannot_serve'
            AND ($10::UUID IS NULL OR EXISTS (SELECT 1 FROM ministry_group_members group_member WHERE group_member.ministry_member_id = membership.id AND group_member.group_id = $10))
            AND COALESCE(member.is_volunteer_profile, false) = false
            AND (
              required_level.id IS NULL
              OR (
                granted_level.ministry_id = $1
                AND granted_level.rank_order >= required_level.rank_order
              )
            )
            AND (
              membership.monthly_frequency_limit IS NULL
              OR COALESCE(monthly.ministry_count, 0) < membership.monthly_frequency_limit
            )
            AND (
              member.automatic_assignment_monthly_limit IS NULL
              OR COALESCE(monthly.overall_count, 0) < member.automatic_assignment_monthly_limit
            )
            AND NOT EXISTS (
              SELECT 1
              FROM availability_blocks block
              WHERE block.user_id = member.id
                AND block.status = 'active'
                AND (block.ministry_id IS NULL OR block.ministry_id = $1)
                AND block.start_date <= $2::DATE
                AND block.end_date >= $2::DATE
            )
            AND NOT EXISTS (
              SELECT 1
              FROM responsibility_assignments event_assignment
              WHERE event_assignment.user_id = member.id
                AND event_assignment.event_id = $4
                AND event_assignment.status = ANY($3)
            )
            AND NOT EXISTS (
              SELECT 1
              FROM responsibility_assignments other_assignment
              JOIN events other_event ON other_event.id = other_assignment.event_id
              JOIN event_responsibilities other_responsibility
                ON other_responsibility.id = other_assignment.responsibility_id
              WHERE other_assignment.user_id = member.id
                AND other_assignment.status = ANY($3)
                AND other_event.id <> $4
                AND other_event.status NOT IN ('cancelled', 'archived')
                AND other_event.start_time
                  + COALESCE(other_responsibility.relative_start_minutes, 0)
                    * INTERVAL '1 minute' < $6
                AND other_event.end_time >
                  $5::TIMESTAMPTZ + COALESCE($8::INT, 0) * INTERVAL '1 minute'
            )
          ORDER BY
            CASE
              WHEN required_level.rank_order IS NULL THEN 0
              ELSE granted_level.rank_order - required_level.rank_order
            END,
            CASE membership.serving_preference
              WHEN 'prefer' THEN 0
              WHEN 'sometimes' THEN 1
              WHEN 'if_necessary' THEN 2
              ELSE 3
            END,
            COALESCE(monthly.ministry_count, 0),
            COALESCE(monthly.overall_count, 0),
            history.last_served_at NULLS FIRST,
            history.same_position_count,
            lower(member.last_name),
            lower(member.first_name)
          LIMIT 50
        `,
        [
          responsibility.ministry_id,
          toChapelDateKey(event.start_time),
          ACTIVE_ASSIGNMENT_STATUSES,
          event.id,
          event.start_time,
          event.end_time,
          responsibility.required_ministry_level_id,
          Number(responsibility.relative_start_minutes || 0),
          responsibility.template_responsibility_id,
          responsibility.required_group_id,
        ],
      )
      let candidate = candidateResult.rows[0]
      let prioryAllocationId: string | null = null
      if (isPriestResponsibility) {
        candidate = null
        for (const possible of candidateResult.rows) {
          const allocation = await checkPrioryAllocation(
            client,
            possible.id,
            new Date(
              new Date(event.start_time).getTime() +
                Number(responsibility.relative_start_minutes || 0) * 60_000,
            ),
            new Date(event.end_time),
          )
          if (allocation.allowed) {
            candidate = possible
            prioryAllocationId = allocation.allocationId || null
            break
          }
        }
      }
      if (!candidate) break

      const assignmentResult = await client.query(
        `
          INSERT INTO responsibility_assignments (
            event_id, responsibility_id, user_id, quantity, status,
            assigned_by, signup_source, notify_email,
            priory_allocation_id, priory_allocation_conflict,
            priory_allocation_checked_at
          )
          VALUES ($1, $2, $3, 1, 'assigned', $4, 'admin_assignment', true,
            $5, false, CASE WHEN $5 IS NULL THEN NULL ELSE now() END)
          RETURNING id
        `,
        [
          event.id,
          responsibility.id,
          candidate.id,
          context.actor.id,
          prioryAllocationId,
        ],
      )
      const assignmentId = assignmentResult.rows[0].id
      assignmentIds.push(assignmentId)
      await writeSchedulingAudit(client, context, {
        action: "responsibility_assignment.auto_assigned",
        entityType: "responsibility_assignment",
        entityId: assignmentId,
        ministryId: responsibility.ministry_id,
        afterData: {
          eventId: event.id,
          responsibilityId: responsibility.id,
          userId: candidate.id,
          status: "assigned",
        },
        metadata: {
          generation,
          responsibilityName: responsibility.name,
          memberName: `${candidate.first_name} ${candidate.last_name}`,
        },
      })
      missing -= 1
    }
  }

  await client.query(
    `
      UPDATE event_responsibilities responsibility
      SET status = CASE
            WHEN responsibility.unlimited_capacity THEN 'open'
            WHEN (
              SELECT COALESCE(sum(assignment.quantity), 0)
              FROM responsibility_assignments assignment
              WHERE assignment.responsibility_id = responsibility.id
                AND assignment.status NOT IN ('declined', 'cancelled')
            ) >= responsibility.quantity_needed THEN 'filled'
            ELSE 'open'
          END,
          updated_at = now()
      WHERE responsibility.event_id = $1
        AND responsibility.status <> 'cancelled'
    `,
    [event.id],
  )

  const shortageResult = await client.query(
    `
      SELECT
        responsibility.id AS responsibility_id,
        responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        GREATEST(
          responsibility.quantity_needed - COALESCE(sum(assignment.quantity), 0),
          0
        )::INT AS missing
      FROM event_responsibilities responsibility
      JOIN events event ON event.id = responsibility.event_id
      LEFT JOIN responsibility_assignments assignment
        ON assignment.responsibility_id = responsibility.id
       AND assignment.status NOT IN ('declined', 'cancelled')
      WHERE responsibility.event_id = $1
        AND responsibility.status <> 'cancelled'
        AND responsibility.is_required = true
        AND responsibility.is_public_assignment = false
        AND event.participation_type <> 'volunteers'
      GROUP BY responsibility.id, responsibility.name, responsibility.ministry_id,
        event.ministry_id, responsibility.quantity_needed
      HAVING COALESCE(sum(assignment.quantity), 0) < responsibility.quantity_needed
      ORDER BY responsibility.name
    `,
    [event.id],
  )
  const shortages = shortageResult.rows.map((row) => ({
    responsibilityId: row.responsibility_id,
    responsibilityName: row.responsibility_name,
    ministryId: row.ministry_id,
    missing: Number(row.missing),
  }))
  const published = reviewPublication
    ? shortages.length === 0 && eventConflicts.length === 0
    : event.status === "published"
  if (reviewPublication) {
    await client.query(
    `
      UPDATE events
      SET status = $2,
          published_at = CASE
            WHEN $2 = 'published' THEN COALESCE(published_at, now())
            ELSE NULL
          END,
          version = version + 1,
          updated_at = now()
      WHERE id = $1
    `,
    [event.id, published ? "published" : "draft"],
  )
    await client.query(
    `
      UPDATE event_ministries
      SET schedule_status = $2,
          published_at = CASE
            WHEN $2 = 'published' THEN COALESCE(published_at, now())
            ELSE published_at
          END,
          updated_at = now()
      WHERE event_id = $1
    `,
    [event.id, published ? "published" : "incomplete"],
  )
    await writeSchedulingAudit(client, context, {
    action: published ? "event.auto_published" : "event.auto_publish_held",
    entityType: "event",
    entityId: event.id,
    ministryId: event.ministry_id,
    afterData: {
      status: published ? "published" : "draft",
      automaticAssignments: assignmentIds.length,
      shortages,
      conflicts: eventConflicts,
    },
    metadata: { generation },
  })
    if (!published) {
      const adminResult = await client.query(
      `
        SELECT DISTINCT administrator.id
        FROM ministry_accounts administrator
        LEFT JOIN ministry_members membership
          ON membership.user_id = administrator.id
         AND membership.status = 'active'
        WHERE administrator.status = 'active'
          AND (
            administrator.global_role IN ('owner', 'super_admin')
            OR (
              membership.level IN ('owner', 'admin')
              AND membership.ministry_id = ANY($1::UUID[])
            )
          )
      `,
      [Array.from(new Set([
        event.ministry_id,
        ...shortages.map((shortage) => shortage.ministryId),
      ])).filter(Boolean)],
    )
      const issueSummary = [
      shortages.length
        ? `${shortages.length} unfilled required position${shortages.length === 1 ? "" : "s"}`
        : null,
      eventConflicts.length
        ? `${eventConflicts.length} overlapping event${eventConflicts.length === 1 ? "" : "s"}`
        : null,
    ].filter(Boolean).join(" and ")
      for (const administrator of adminResult.rows) {
        await client.query(
        `
          INSERT INTO ministry_alerts (
            subject_user_id, recipient_user_id, kind, title, message,
            event_id, ministry_id, dedupe_key, metadata
          )
          VALUES ($1, $1, 'schedule_review', 'Schedule needs review', $2,
            $3, $4, $5, $6::JSONB)
          ON CONFLICT (dedupe_key) DO UPDATE
          SET message = excluded.message,
              event_id = excluded.event_id,
              read_at = NULL,
              delivery_status = 'pending',
              digest_after = now(),
              updated_at = now()
        `,
        [
          administrator.id,
          `${event.title} has ${issueSummary || "an unresolved scheduling issue"}. Open the app to review the affected dates.`,
          event.id,
          event.ministry_id,
          `schedule-review:${administrator.id}:${event.recurrence_group_id || event.id}`,
          JSON.stringify({
            notificationCategory: "changes",
            notificationUrl: `/?event=${event.id}`,
            recurrenceGroupId: event.recurrence_group_id || null,
            shortageCount: shortages.length,
            conflictCount: eventConflicts.length,
          }),
        ],
      )
      }
    }
  } else {
    await writeSchedulingAudit(client, context, {
      action: "event.assignments_auto_filled",
      entityType: "event",
      entityId: event.id,
      ministryId: targetMinistryId || event.ministry_id,
      afterData: {
        status: event.status,
        automaticAssignments: assignmentIds.length,
        shortages,
      },
      metadata: { generation },
    })
  }
  return {
    eventId: event.id,
    published,
    assignmentIds,
    shortages,
    conflicts: eventConflicts,
  }
}

const ensureDefaultGeneralVolunteer = async (
  client: PoolClient,
  eventId: string,
) => {
  const existing = await client.query(
    `
      UPDATE event_responsibilities
      SET is_public_assignment = true,
          unlimited_capacity = CASE
            WHEN is_public_assignment THEN unlimited_capacity
            ELSE true
          END,
          status = CASE WHEN is_public_assignment THEN status ELSE 'open' END,
          updated_at = now()
      WHERE event_id = $1
        AND lower(btrim(name)) = 'general volunteer'
        AND status <> 'cancelled'
      RETURNING id
    `,
    [eventId],
  )
  if (existing.rowCount) return
  await client.query(
    `
      INSERT INTO event_responsibilities (
        event_id, ministry_id, name, description, responsibility_type,
        quantity_needed, approval_required, is_required,
        relative_start_minutes, sort_order, status,
        is_public_assignment, unlimited_capacity
      )
      VALUES (
        $1, NULL, 'General Volunteer',
        'Sign up to help. Your specific task will be assigned by email or during the event.',
        'task', 1, false, true, 0, -100, 'open', true, true
      )
    `,
    [eventId],
  )
}

const createEventFromStructure = async (
  client: PoolClient,
  context: any,
  {
    structure,
    title,
    description,
    location,
    start,
    end,
    status,
    recurrenceGroupId,
    recurrenceRule,
    recurrenceAnchorAt = null,
    recurrenceParentGroupId = null,
    participationType,
    visibility = "public",
    confirmationDeadline = null,
    sourceEventId = null,
    conflictOverride = false,
    conflictOverrideReason = null,
    roomIds = [],
  }: any,
) => {
  const resolvedParticipationType = PARTICIPATION_TYPES.has(participationType)
    ? participationType
    : structure.template.participation_type || "members"
  const eventResult = await client.query(
    `
      INSERT INTO events (
        ministry_id,
        template_id,
        template_version,
        title,
        description,
        location,
        start_time,
        end_time,
        participation_type,
        visibility,
        status,
        published_at,
        confirmation_deadline_at,
        version,
        source_event_id,
        recurrence_group_id,
        recurrence_rule,
        recurrence_anchor_at,
        recurrence_parent_group_id,
        conflict_override,
        conflict_override_reason,
        conflict_override_by,
        conflict_override_at,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, CASE WHEN $11 = 'published' THEN now() ELSE NULL END,
        $12, 1, $13, $14, $15::JSONB, $16, $17,
        $18, $19,
        CASE WHEN $18 THEN $20 ELSE NULL END,
        CASE WHEN $18 THEN now() ELSE NULL END,
        $20
      )
      RETURNING id
    `,
    [
      structure.template.ministry_id,
      structure.template.id,
      structure.template.version,
      title,
      description || null,
      location || null,
      start,
      end,
      resolvedParticipationType,
      visibility,
      status,
      confirmationDeadline,
      sourceEventId,
      recurrenceGroupId,
      recurrenceRule ? JSON.stringify(recurrenceRule) : null,
      recurrenceAnchorAt,
      recurrenceParentGroupId,
      Boolean(conflictOverride),
      conflictOverrideReason || null,
      context.user.id,
    ],
  )
  const eventId = eventResult.rows[0].id
  await replaceEventRooms(client, eventId, roomIds, context.actor.id)

  for (const block of structure.blocks) {
    const eventBlockResult = await client.query(
      `
        INSERT INTO event_ministries (
          event_id,
          ministry_id,
          template_ministry_id,
          is_required,
          schedule_status,
          instructions
        )
        VALUES ($1, $2, $3, $4, 'generated', $5)
        RETURNING id
      `,
      [
        eventId,
        block.ministry_id,
        block.id,
        block.is_required !== false,
        block.instructions || null,
      ],
    )
    for (const groupId of block.group_ids || []) {
      await client.query(`INSERT INTO event_ministry_groups (event_ministry_id, group_id) VALUES ($1, $2)`, [eventBlockResult.rows[0].id, groupId])
    }
  }

  for (const responsibility of structure.responsibilities) {
    await client.query(
      `
        INSERT INTO event_responsibilities (
          event_id,
          ministry_id,
          template_responsibility_id,
          name,
          description,
          responsibility_type,
          quantity_needed,
          approval_required,
          substitution_allowed,
          is_required,
          required_ministry_level_id,
          required_group_id,
          relative_start_minutes,
          instructions,
          sort_order,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'open'
        )
      `,
      [
        eventId,
        responsibility.ministry_id,
        responsibility.id,
        responsibility.name,
        responsibility.description || null,
        responsibility.responsibility_type || "position",
        Number(responsibility.quantity_needed) || 1,
        Boolean(responsibility.approval_required),
        responsibility.substitution_allowed !== false,
        responsibility.is_required !== false,
        responsibility.required_ministry_level_id || null,
        responsibility.required_group_id || null,
        Number(responsibility.relative_start_minutes) || 0,
        responsibility.instructions || null,
        Number(responsibility.sort_order) || 0,
      ],
    )
  }

  if (["volunteers", "both"].includes(resolvedParticipationType)) {
    await ensureDefaultGeneralVolunteer(client, eventId)
  }

  await writeSchedulingAudit(client, context, {
    action: "event.created",
    entityType: "event",
    entityId: eventId,
    ministryId: structure.template.ministry_id,
    afterData: {
      templateId: structure.template.id,
      templateVersion: Number(structure.template.version),
      title,
      startTime: start,
      endTime: end,
      status,
      participatingMinistries: structure.blocks.map(
        (block: any) => block.ministry_id,
      ),
      generatedResponsibilities: structure.responsibilities.length,
      conflictOverride: Boolean(conflictOverride),
      conflictOverrideReason: conflictOverrideReason || null,
      roomIds,
    },
  })
  return eventId
}

const loadEventList = async (
  client: PoolClient,
  context: any,
  ministryId: string,
) => {
  const access = await requireMinistryAccess(
    client,
    context.user,
    ministryId,
    false,
  )
  const result = await client.query(
    `
      SELECT DISTINCT
        event.id,
        event.ministry_id AS coordinator_ministry_id,
        COALESCE(coordinator.name, 'Volunteer Event') AS coordinator_ministry_name,
        event.template_id,
        template.name AS template_name,
        event.template_version,
        event.title,
        event.description,
        event.location,
        event.start_time,
        event.end_time,
        event.confirmation_deadline_at,
        event.published_at,
        event.participation_type,
        event.visibility,
        event.signup_code,
        event.signup_open,
        event.status,
        event.version,
        event.recurrence_group_id,
        event.recurrence_rule,
        event.recurrence_anchor_at,
        event.recurrence_parent_group_id,
        event.conflict_override,
        event.conflict_override_reason,
        event.updated_at,
        (
          SELECT count(*)
          FROM event_responsibilities responsibility
          WHERE responsibility.event_id = event.id
            AND responsibility.status <> 'cancelled'
        ) AS responsibility_count
      FROM events event
      LEFT JOIN ministries coordinator ON coordinator.id = event.ministry_id
      LEFT JOIN templates template ON template.id = event.template_id
      LEFT JOIN event_ministries event_ministry
        ON event_ministry.event_id = event.id
      WHERE (
          event.ministry_id = $1
          OR event_ministry.ministry_id = $1
        )
        AND (
          $2 = true
          OR event.status IN ('published', 'cancelled', 'completed')
        )
        AND ($2 = false OR event.status <> 'archived')
        AND (
          $2 = true
          OR EXISTS (SELECT 1 FROM responsibility_assignments assignment WHERE assignment.event_id = event.id AND assignment.user_id = $3 AND assignment.status NOT IN ('declined', 'cancelled'))
          OR NOT EXISTS (
            SELECT 1 FROM event_ministries scoped_block
            JOIN event_ministry_groups scoped ON scoped.event_ministry_id = scoped_block.id
            WHERE scoped_block.event_id = event.id AND scoped_block.ministry_id = $1
          )
          OR EXISTS (
            SELECT 1 FROM event_ministries scoped_block
            JOIN event_ministry_groups scoped ON scoped.event_ministry_id = scoped_block.id
            JOIN ministry_members membership ON membership.ministry_id = scoped_block.ministry_id AND membership.user_id = $3 AND membership.status = 'active'
            JOIN ministry_group_members group_member ON group_member.ministry_member_id = membership.id AND group_member.group_id = scoped.group_id
            WHERE scoped_block.event_id = event.id AND scoped_block.ministry_id = $1
          )
        )
      ORDER BY event.start_time
    `,
    [ministryId, access.canManage, context.user.id],
  )
  const eventIds = result.rows.map((event) => event.id)
  const roomResult = eventIds.length
    ? await client.query(
        `
          SELECT reservation.event_id, room.id, room.name
          FROM event_room_reservations reservation
          JOIN chapel_rooms room ON room.id = reservation.room_id
          WHERE reservation.event_id = ANY($1::UUID[])
          ORDER BY room.sort_order, lower(room.name)
        `,
        [eventIds],
      )
    : { rows: [] }
  const roomsByEvent = new Map<string, any[]>()
  for (const room of roomResult.rows) {
    const rooms = roomsByEvent.get(room.event_id) || []
    rooms.push({ id: room.id, name: room.name })
    roomsByEvent.set(room.event_id, rooms)
  }
  return Promise.all(result.rows.map(async (event) => {
    const privacy = await getPriestPrivacyAccess(client, context.user, event)
    if (!privacy.canSeeEvent) return null
    return {
      ...event,
      description:
        event.visibility === "private" && !privacy.canSeeProtectedDetails
          ? null
          : event.description,
      location:
        event.visibility === "private" && !privacy.canSeeProtectedDetails
          ? null
          : event.location,
      canSeeProtectedDetails: privacy.canSeeProtectedDetails,
      template_version: Number(event.template_version || 0) || null,
      version: Number(event.version),
      responsibility_count: Number(event.responsibility_count),
      rooms:
        event.visibility === "private" && !privacy.canSeeProtectedDetails
          ? []
          : roomsByEvent.get(event.id) || [],
      room_ids:
        event.visibility === "private" && !privacy.canSeeProtectedDetails
          ? []
          : (roomsByEvent.get(event.id) || []).map((room) => room.id),
    }
  })).then((events) => events.filter(Boolean))
}

const loadEventDetails = async (
  client: PoolClient,
  context: any,
  eventId: string,
) => {
  const eventResult = await client.query(
    `
      SELECT
        event.*,
        COALESCE(coordinator.name, 'Volunteer Event') AS coordinator_ministry_name,
        template.name AS template_name
      FROM events event
      LEFT JOIN ministries coordinator ON coordinator.id = event.ministry_id
      LEFT JOIN templates template ON template.id = event.template_id
      WHERE event.id = $1
      LIMIT 1
    `,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) throw Object.assign(new Error("Event not found"), { status: 404 })
  const privacyAccess = await getPriestPrivacyAccess(client, context.user, event)
  if (!privacyAccess.canSeeEvent) {
    throw Object.assign(new Error("You do not have access to this private event"), {
      status: 403,
    })
  }
  if (event.visibility === "private" && !privacyAccess.canSeeProtectedDetails) {
    event.description = null
    event.location = null
  }

  const ministryGroupSchemaResult = await client.query(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'event_responsibilities'
            AND column_name = 'required_group_id'
        )
        AND to_regclass(current_schema() || '.event_ministry_groups') IS NOT NULL
        AND to_regclass(current_schema() || '.ministry_group_members') IS NOT NULL
          AS is_available
    `,
  )
  const hasMinistryGroupSchema = Boolean(
    ministryGroupSchemaResult.rows[0]?.is_available,
  )

  const participantResult = await client.query(
    hasMinistryGroupSchema
      ? `
      SELECT
        event_ministry.ministry_id,
        ministry.name AS ministry_name,
        event_ministry.is_required,
        event_ministry.schedule_status,
        event_ministry.instructions,
        event_ministry.reviewed_at,
        event_ministry.published_at,
        ARRAY(SELECT scoped.group_id FROM event_ministry_groups scoped WHERE scoped.event_ministry_id = event_ministry.id) AS group_ids,
        EXISTS (
          SELECT 1 FROM ministry_members membership
          JOIN ministry_group_members group_member ON group_member.ministry_member_id = membership.id
          JOIN event_ministry_groups scoped ON scoped.group_id = group_member.group_id
          WHERE membership.user_id = $2 AND membership.status = 'active'
            AND membership.ministry_id = event_ministry.ministry_id
            AND scoped.event_ministry_id = event_ministry.id
        ) AS belongs_to_scoped_group
      FROM event_ministries event_ministry
      JOIN ministries ministry ON ministry.id = event_ministry.ministry_id
      WHERE event_ministry.event_id = $1
      ORDER BY lower(ministry.name)
    `
      : `
      SELECT
        event_ministry.ministry_id,
        ministry.name AS ministry_name,
        event_ministry.is_required,
        event_ministry.schedule_status,
        event_ministry.instructions,
        event_ministry.reviewed_at,
        event_ministry.published_at,
        ARRAY[]::UUID[] AS group_ids,
        true AS belongs_to_scoped_group
      FROM event_ministries event_ministry
      JOIN ministries ministry ON ministry.id = event_ministry.ministry_id
      WHERE event_ministry.event_id = $1
      ORDER BY lower(ministry.name)
    `,
    hasMinistryGroupSchema
      ? [eventId, context.user.id]
      : [eventId],
  )
  const rawAccessChecks = await Promise.all(
    participantResult.rows.map((participant) =>
      getMinistryAccess(client, context.user, participant.ministry_id),
    ),
  )
  const accessChecks = rawAccessChecks.map((access, index) => {
    const participant = participantResult.rows[index]
    const restricted = Array.isArray(participant.group_ids) && participant.group_ids.length > 0
    return restricted && !participant.belongs_to_scoped_group && !access.canManage
      ? { ...access, canView: false }
      : access
  })
  const coordinatorAccess = event.ministry_id
    ? await getMinistryAccess(client, context.user, event.ministry_id)
    : { canView: false, canManage: false }
  const eventParticipantResult = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM responsibility_assignments assignment
        WHERE assignment.event_id = $1
          AND assignment.user_id = $2
          AND assignment.status NOT IN ('declined', 'cancelled')
      ) AS is_participant
    `,
    [eventId, context.user.id],
  )
  const isEventParticipant = Boolean(
    eventParticipantResult.rows[0]?.is_participant,
  )
  const isPublicEvent = event.ministry_id === null
  const canViewAny =
    isEventParticipant ||
    coordinatorAccess.canView ||
    accessChecks.some((access) => access.canView)
  const canManageAny = accessChecks.some((access) => access.canManage)
  const canManageEvent = isPublicEvent
    ? ["owner", "super_admin"].includes(context.user.global_role) ||
      event.created_by === context.user.id
    : coordinatorAccess.canManage
  const canManageAllResponsibilities = ["owner", "super_admin"].includes(
    context.user.global_role,
  )
  const publicView = !canViewAny && !canManageEvent
  if (
    publicView &&
    !["published", "cancelled", "completed"].includes(event.status)
  ) {
    throw Object.assign(new Error("You do not have access to this event"), {
      status: 403,
    })
  }
  if (
    !canManageEvent &&
    !canManageAny &&
    !["published", "cancelled", "completed"].includes(event.status)
  ) {
    throw Object.assign(new Error("This event is not published"), {
      status: 403,
    })
  }

  const responsibilityResult = await client.query(
    hasMinistryGroupSchema
      ? `
      SELECT
        responsibility.id,
        responsibility.ministry_id,
        responsibility.template_responsibility_id,
        ministry.name AS ministry_name,
        responsibility.name,
        responsibility.description,
        responsibility.responsibility_type,
        responsibility.quantity_needed,
        responsibility.is_public_assignment,
        responsibility.unlimited_capacity,
        responsibility.approval_required,
        responsibility.substitution_allowed,
        responsibility.is_required,
        responsibility.required_ministry_level_id,
        required_level.name AS required_level_name,
        required_level.rank_order AS required_level_rank,
        responsibility.required_group_id,
        required_group.name AS required_group_name,
        responsibility.required_qualification,
        responsibility.relative_start_minutes,
        responsibility.instructions,
        responsibility.status,
        responsibility.sort_order,
        (
          SELECT count(*)
          FROM responsibility_assignments assignment
          WHERE assignment.responsibility_id = responsibility.id
            AND assignment.status IN (
              'interested', 'pending', 'assigned', 'confirmed',
              'change_requested', 'completed'
            )
        ) AS assigned_quantity
      FROM event_responsibilities responsibility
      LEFT JOIN ministries ministry ON ministry.id = responsibility.ministry_id
      LEFT JOIN ministry_levels required_level
        ON required_level.id = responsibility.required_ministry_level_id
      LEFT JOIN ministry_groups required_group
        ON required_group.id = responsibility.required_group_id
      WHERE responsibility.event_id = $1
      ORDER BY lower(ministry.name), responsibility.sort_order, lower(responsibility.name)
    `
      : `
      SELECT
        responsibility.id,
        responsibility.ministry_id,
        responsibility.template_responsibility_id,
        ministry.name AS ministry_name,
        responsibility.name,
        responsibility.description,
        responsibility.responsibility_type,
        responsibility.quantity_needed,
        responsibility.is_public_assignment,
        responsibility.unlimited_capacity,
        responsibility.approval_required,
        responsibility.substitution_allowed,
        responsibility.is_required,
        responsibility.required_ministry_level_id,
        required_level.name AS required_level_name,
        required_level.rank_order AS required_level_rank,
        NULL::UUID AS required_group_id,
        NULL::STRING AS required_group_name,
        responsibility.required_qualification,
        responsibility.relative_start_minutes,
        responsibility.instructions,
        responsibility.status,
        responsibility.sort_order,
        (
          SELECT count(*)
          FROM responsibility_assignments assignment
          WHERE assignment.responsibility_id = responsibility.id
            AND assignment.status IN (
              'interested', 'pending', 'assigned', 'confirmed',
              'change_requested', 'completed'
            )
        ) AS assigned_quantity
      FROM event_responsibilities responsibility
      LEFT JOIN ministries ministry ON ministry.id = responsibility.ministry_id
      LEFT JOIN ministry_levels required_level
        ON required_level.id = responsibility.required_ministry_level_id
      WHERE responsibility.event_id = $1
      ORDER BY lower(ministry.name), responsibility.sort_order, lower(responsibility.name)
    `,
    [eventId],
  )
  const responsibilityMinistryIds = Array.from(new Set(
    responsibilityResult.rows
      .map((responsibility) =>
        responsibility.is_public_assignment
          ? null
          : responsibility.ministry_id || event.ministry_id,
      )
      .filter(Boolean),
  ))
  const responsibilityAccessChecks = await Promise.all(
    responsibilityMinistryIds.map((ministryId) =>
      getMinistryAccess(client, context.user, ministryId),
    ),
  )
  const responsibilityAccessByMinistry = new Map(
    responsibilityMinistryIds.map((ministryId, index) => [
      ministryId,
      responsibilityAccessChecks[index],
    ]),
  )
  const visibleResponsibilities = responsibilityResult.rows.filter(
    (responsibility) => {
      const ministryId = responsibility.is_public_assignment
        ? null
        : responsibility.ministry_id || event.ministry_id
      return canManageEvent || isEventParticipant || !ministryId || responsibilityAccessByMinistry.get(ministryId)?.canView
    },
  )
  const manageableMinistryIds = participantResult.rows
        .filter((_, index) => accessChecks[index].canManage)
        .map((participant) => participant.ministry_id)
  if (
    canManageEvent &&
    event.ministry_id &&
    !manageableMinistryIds.includes(event.ministry_id)
  ) {
    manageableMinistryIds.push(event.ministry_id)
  }
  if (canManageAllResponsibilities) {
    for (const ministryId of responsibilityMinistryIds) {
      if (!manageableMinistryIds.includes(ministryId)) {
        manageableMinistryIds.push(ministryId)
      }
    }
  }

  const assignmentResult = await client.query(
        `
          SELECT
            assignment.id,
            assignment.responsibility_id,
            assignment.user_id,
            assignment.status,
            assignment.quantity,
            assignment.confirmed_at,
            assignment.confirmation_overdue_at,
            assignment.service_outcome,
            assignment.outcome_recorded_at,
            assignment.outcome_note,
            assignment.volunteer_name,
            assignment.signup_source,
            assignment.created_at,
            (
              SELECT count(*)
              FROM responsibility_assignments other_assignment
              JOIN events other_event ON other_event.id = other_assignment.event_id
              JOIN event_responsibilities other_responsibility
                ON other_responsibility.id = other_assignment.responsibility_id
              WHERE other_assignment.user_id = assignment.user_id
                AND other_assignment.event_id <> assignment.event_id
                AND other_assignment.status = ANY($4)
                AND other_event.status NOT IN ('cancelled', 'archived')
                AND other_event.start_time
                  + COALESCE(other_responsibility.relative_start_minutes, 0)
                    * INTERVAL '1 minute' < $3
                AND other_event.end_time >
                  $2::TIMESTAMPTZ
                  + COALESCE(assigned_responsibility.relative_start_minutes, 0)
                    * INTERVAL '1 minute'
            ) AS conflict_count,
            COALESCE(member.first_name, assignment.volunteer_name) AS first_name,
            member.last_name,
            COALESCE(member.is_volunteer_profile, false) AS is_volunteer_profile
          FROM responsibility_assignments assignment
          JOIN event_responsibilities assigned_responsibility
            ON assigned_responsibility.id = assignment.responsibility_id
          LEFT JOIN ministry_accounts member ON member.id = assignment.user_id
          WHERE assignment.event_id = $1
            AND assignment.status NOT IN ('declined', 'cancelled')
          ORDER BY lower(COALESCE(member.last_name, '')), lower(COALESCE(member.first_name, assignment.volunteer_name))
        `,
        [eventId, event.start_time, event.end_time, ACTIVE_ASSIGNMENT_STATUSES],
      )
  const substitutionState = await loadEventSubstitutionState(
    client,
    context,
    eventId,
  )
  const candidateResult = manageableMinistryIds.length
    ? await client.query(
        hasMinistryGroupSchema
          ? `
          SELECT
            responsibility.id AS responsibility_id,
            member.id AS user_id,
            member.first_name,
            member.last_name,
            granted_level.name AS highest_level_name,
            granted_level.rank_order AS highest_level_rank,
            membership.serving_preference,
            membership.monthly_frequency_limit,
            member.automatic_assignment_monthly_limit,
            (
              SELECT count(*)
              FROM responsibility_assignments monthly_assignment
              JOIN events monthly_event ON monthly_event.id = monthly_assignment.event_id
              JOIN event_responsibilities monthly_responsibility
                ON monthly_responsibility.id = monthly_assignment.responsibility_id
              WHERE monthly_assignment.user_id = member.id
                AND monthly_assignment.status = ANY($5)
                AND date_trunc('month', monthly_event.start_time AT TIME ZONE 'America/New_York')
                  = date_trunc('month', $6::TIMESTAMPTZ AT TIME ZONE 'America/New_York')
                AND COALESCE(monthly_responsibility.ministry_id, monthly_event.ministry_id)
                  = COALESCE(responsibility.ministry_id, $2)
            )::INT AS ministry_monthly_count,
            (
              SELECT count(*)
              FROM responsibility_assignments monthly_assignment
              JOIN events monthly_event ON monthly_event.id = monthly_assignment.event_id
              WHERE monthly_assignment.user_id = member.id
                AND monthly_assignment.status = ANY($5)
                AND date_trunc('month', monthly_event.start_time AT TIME ZONE 'America/New_York')
                  = date_trunc('month', $6::TIMESTAMPTZ AT TIME ZONE 'America/New_York')
            )::INT AS overall_monthly_count
          FROM event_responsibilities responsibility
          JOIN ministry_members membership
            ON membership.ministry_id =
              COALESCE(responsibility.ministry_id, $2)
           AND membership.status = 'active'
           AND membership.serving_preference <> 'cannot_serve'
           AND (
             responsibility.required_group_id IS NULL
             OR EXISTS (SELECT 1 FROM ministry_group_members group_member WHERE group_member.ministry_member_id = membership.id AND group_member.group_id = responsibility.required_group_id)
           )
          JOIN ministry_accounts member ON member.id = membership.user_id
          LEFT JOIN ministry_levels required_level
            ON required_level.id =
              responsibility.required_ministry_level_id
          LEFT JOIN ministry_levels granted_level
            ON granted_level.id = membership.highest_level_id
          WHERE responsibility.event_id = $1
            AND responsibility.status <> 'cancelled'
            AND COALESCE(member.is_volunteer_profile, false) = false
            AND COALESCE(responsibility.ministry_id, $2)
              = ANY($3::UUID[])
            AND (
              required_level.id IS NULL
              OR (
                granted_level.ministry_id =
                  COALESCE(responsibility.ministry_id, $2)
                AND granted_level.rank_order >= required_level.rank_order
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM availability_blocks block
              WHERE block.user_id = member.id
                AND block.status = 'active'
                AND (
                  block.ministry_id IS NULL
                  OR block.ministry_id = COALESCE(responsibility.ministry_id, $2)
                )
                AND block.start_date <= $4::DATE
                AND block.end_date >= $4::DATE
            )
            AND NOT EXISTS (
              SELECT 1
              FROM responsibility_assignments current_assignment
              WHERE current_assignment.event_id = $1
                AND current_assignment.user_id = member.id
                AND current_assignment.status NOT IN ('declined', 'cancelled')
            )
            AND NOT EXISTS (
              SELECT 1
              FROM responsibility_assignments other_assignment
              JOIN events other_event
                ON other_event.id = other_assignment.event_id
              JOIN event_responsibilities other_responsibility
                ON other_responsibility.id = other_assignment.responsibility_id
              WHERE other_assignment.user_id = member.id
                AND other_assignment.status = ANY($5)
                AND other_event.id <> $1
                AND other_event.status NOT IN ('cancelled', 'archived')
                AND other_event.start_time
                  + COALESCE(other_responsibility.relative_start_minutes, 0)
                    * INTERVAL '1 minute' < $7
                AND other_event.end_time >
                  $6::TIMESTAMPTZ
                  + COALESCE(responsibility.relative_start_minutes, 0)
                    * INTERVAL '1 minute'
            )
          ORDER BY
            responsibility.id,
            CASE membership.serving_preference
              WHEN 'prefer' THEN 0
              WHEN 'sometimes' THEN 1
              WHEN 'if_necessary' THEN 2
              ELSE 3
            END,
            granted_level.rank_order DESC NULLS LAST,
            ministry_monthly_count,
            overall_monthly_count,
            lower(member.last_name),
            lower(member.first_name)
        `
          : `
          SELECT
            responsibility.id AS responsibility_id,
            member.id AS user_id,
            member.first_name,
            member.last_name,
            granted_level.name AS highest_level_name,
            granted_level.rank_order AS highest_level_rank,
            membership.serving_preference,
            membership.monthly_frequency_limit,
            member.automatic_assignment_monthly_limit,
            (
              SELECT count(*)
              FROM responsibility_assignments monthly_assignment
              JOIN events monthly_event ON monthly_event.id = monthly_assignment.event_id
              JOIN event_responsibilities monthly_responsibility
                ON monthly_responsibility.id = monthly_assignment.responsibility_id
              WHERE monthly_assignment.user_id = member.id
                AND monthly_assignment.status = ANY($5)
                AND date_trunc('month', monthly_event.start_time AT TIME ZONE 'America/New_York')
                  = date_trunc('month', $6::TIMESTAMPTZ AT TIME ZONE 'America/New_York')
                AND COALESCE(monthly_responsibility.ministry_id, monthly_event.ministry_id)
                  = COALESCE(responsibility.ministry_id, $2)
            )::INT AS ministry_monthly_count,
            (
              SELECT count(*)
              FROM responsibility_assignments monthly_assignment
              JOIN events monthly_event ON monthly_event.id = monthly_assignment.event_id
              WHERE monthly_assignment.user_id = member.id
                AND monthly_assignment.status = ANY($5)
                AND date_trunc('month', monthly_event.start_time AT TIME ZONE 'America/New_York')
                  = date_trunc('month', $6::TIMESTAMPTZ AT TIME ZONE 'America/New_York')
            )::INT AS overall_monthly_count
          FROM event_responsibilities responsibility
          JOIN ministry_members membership
            ON membership.ministry_id = COALESCE(responsibility.ministry_id, $2)
           AND membership.status = 'active'
           AND membership.serving_preference <> 'cannot_serve'
          JOIN ministry_accounts member ON member.id = membership.user_id
          LEFT JOIN ministry_levels required_level
            ON required_level.id = responsibility.required_ministry_level_id
          LEFT JOIN ministry_levels granted_level
            ON granted_level.id = membership.highest_level_id
          WHERE responsibility.event_id = $1
            AND responsibility.status <> 'cancelled'
            AND COALESCE(member.is_volunteer_profile, false) = false
            AND COALESCE(responsibility.ministry_id, $2) = ANY($3::UUID[])
            AND (
              required_level.id IS NULL
              OR (
                granted_level.ministry_id = COALESCE(responsibility.ministry_id, $2)
                AND granted_level.rank_order >= required_level.rank_order
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM availability_blocks block
              WHERE block.user_id = member.id
                AND block.status = 'active'
                AND (
                  block.ministry_id IS NULL
                  OR block.ministry_id = COALESCE(responsibility.ministry_id, $2)
                )
                AND block.start_date <= $4::DATE
                AND block.end_date >= $4::DATE
            )
            AND NOT EXISTS (
              SELECT 1
              FROM responsibility_assignments current_assignment
              WHERE current_assignment.event_id = $1
                AND current_assignment.user_id = member.id
                AND current_assignment.status NOT IN ('declined', 'cancelled')
            )
            AND NOT EXISTS (
              SELECT 1
              FROM responsibility_assignments other_assignment
              JOIN events other_event ON other_event.id = other_assignment.event_id
              JOIN event_responsibilities other_responsibility
                ON other_responsibility.id = other_assignment.responsibility_id
              WHERE other_assignment.user_id = member.id
                AND other_assignment.status = ANY($5)
                AND other_event.id <> $1
                AND other_event.status NOT IN ('cancelled', 'archived')
                AND other_event.start_time
                  + COALESCE(other_responsibility.relative_start_minutes, 0)
                    * INTERVAL '1 minute' < $7
                AND other_event.end_time >
                  $6::TIMESTAMPTZ
                  + COALESCE(responsibility.relative_start_minutes, 0)
                    * INTERVAL '1 minute'
            )
          ORDER BY
            responsibility.id,
            CASE membership.serving_preference
              WHEN 'prefer' THEN 0
              WHEN 'sometimes' THEN 1
              WHEN 'if_necessary' THEN 2
              ELSE 3
            END,
            granted_level.rank_order DESC NULLS LAST,
            ministry_monthly_count,
            overall_monthly_count,
            lower(member.last_name),
            lower(member.first_name)
        `,
        [
          eventId,
          event.ministry_id,
          manageableMinistryIds,
          toChapelDateKey(event.start_time),
          ACTIVE_ASSIGNMENT_STATUSES,
          event.start_time,
          event.end_time,
        ],
      )
    : { rows: [] }

  const assignmentsByResponsibility = new Map<string, any[]>()
  const responsibilityById = new Map(
    responsibilityResult.rows.map((responsibility) => [
      responsibility.id,
      responsibility,
    ]),
  )
  for (const assignment of assignmentResult.rows) {
    const responsibility = responsibilityById.get(
      assignment.responsibility_id,
    )
    const responsibilityMinistryId =
      responsibility?.is_public_assignment
        ? null
        : responsibility?.ministry_id || event.ministry_id
    const canManageAssignment = canManageAllResponsibilities || (responsibilityMinistryId
      ? Boolean(
          responsibilityAccessByMinistry.get(responsibilityMinistryId)
            ?.canManage,
        )
      : canManageEvent)
    const assignments =
      assignmentsByResponsibility.get(assignment.responsibility_id) || []
    const substitutionRequest = substitutionState.requests.find(
      (request) => request.assignment_id === assignment.id,
    )
    const canSeeSubstitutionRequest =
      assignment.user_id === context.user.id || canManageAssignment
    const canSeeAssignmentDetails =
      canManageAssignment || assignment.user_id === context.user.id
    if (!canSeeAssignmentDetails) {
      assignments.push({
        id: assignment.id,
        firstName: assignment.first_name,
        lastName: assignment.last_name || "",
      })
      assignmentsByResponsibility.set(
        assignment.responsibility_id,
        assignments,
      )
      continue
    }
    assignments.push({
      id: assignment.id,
      firstName: assignment.first_name,
      lastName: assignment.last_name || "",
      userId: assignment.user_id,
      isVolunteer:
        assignment.signup_source === "public_link" ||
        Boolean(assignment.is_volunteer_profile),
      status: assignment.status,
      quantity: Number(assignment.quantity),
      confirmedAt: assignment.confirmed_at,
      confirmationOverdueAt: assignment.confirmation_overdue_at,
      serviceOutcome: assignment.service_outcome || "",
      outcomeRecordedAt: assignment.outcome_recorded_at,
      outcomeNote: assignment.outcome_note || "",
      prioryAllocationId: assignment.priory_allocation_id || null,
      prioryAllocationConflict: Boolean(
        assignment.priory_allocation_conflict,
      ),
      prioryAllocationCheckedAt:
        assignment.priory_allocation_checked_at || null,
      createdAt: assignment.created_at,
      conflictCount: canManageAssignment
        ? Number(assignment.conflict_count)
        : 0,
      canRequestSubstitute:
        assignment.user_id === context.user.id &&
        responsibility.substitution_allowed !== false &&
        ["pending", "assigned", "confirmed"].includes(assignment.status) &&
        event.status === "published" &&
        new Date(event.start_time).getTime() > Date.now() &&
        !substitutionRequest,
      canRequestAdminChange:
        assignment.user_id === context.user.id &&
        responsibility.substitution_allowed === false &&
        ["pending", "assigned", "confirmed"].includes(assignment.status) &&
        event.status === "published" &&
        new Date(event.start_time).getTime() > Date.now() &&
        !substitutionRequest,
      substitutionRequest: canSeeSubstitutionRequest && substitutionRequest
        ? {
            id: substitutionRequest.id,
            reason: substitutionRequest.reason || "",
            status: substitutionRequest.status,
            expiresAt: substitutionRequest.expires_at,
            minimumLevelRank: Number(
              substitutionRequest.minimum_level_rank || 0,
            ),
            acceptedByUserId:
              substitutionRequest.accepted_by_user_id || null,
            replacementAssignmentId:
              substitutionRequest.replacement_assignment_id || null,
            createdAt: substitutionRequest.created_at,
          }
        : null,
    })
    assignmentsByResponsibility.set(
      assignment.responsibility_id,
      assignments,
    )
  }
  const candidatesByResponsibility = new Map<string, any[]>()
  const candidateIds = Array.from(
    new Set(candidateResult.rows.map((candidate) => candidate.user_id)),
  )
  const reliabilityResult = candidateIds.length
    ? await client.query(
        `
          SELECT
            assignment.user_id,
            assignment.service_outcome,
            history_event.start_time
          FROM responsibility_assignments assignment
          JOIN events history_event ON history_event.id = assignment.event_id
          JOIN event_responsibilities history_responsibility
            ON history_responsibility.id = assignment.responsibility_id
          WHERE assignment.user_id = ANY($1::UUID[])
            AND assignment.service_outcome IS NOT NULL
            AND history_event.start_time >= now() - INTERVAL '12 months'
            AND COALESCE(history_responsibility.ministry_id, history_event.ministry_id)
              = ANY($2::UUID[])
        `,
        [candidateIds, manageableMinistryIds],
      )
    : { rows: [] }
  const reliabilityByUser = new Map<string, any[]>()
  for (const row of reliabilityResult.rows) {
    const history = reliabilityByUser.get(row.user_id) || []
    history.push(row)
    reliabilityByUser.set(row.user_id, history)
  }
  const eventTimeKey = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.start_time))
  for (const candidate of candidateResult.rows) {
    const candidates =
      candidatesByResponsibility.get(candidate.responsibility_id) || []
    const history = reliabilityByUser.get(candidate.user_id) || []
    const sameTimeHistory = history.filter(
      (item) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(item.start_time)) === eventTimeKey,
    )
    const summarizeReliability = (items: any[]) => {
      const completed = items.filter((item) =>
        ["served", "no_show"].includes(
          item.service_outcome,
        ),
      )
      const served = completed.filter((item) =>
        item.service_outcome === "served",
      ).length
      const noShows = completed.filter(
        (item) => item.service_outcome === "no_show",
      ).length
      return {
        recorded: completed.length,
        served,
        noShows,
        percent: completed.length
          ? Math.round((served / completed.length) * 100)
          : null,
      }
    }
    candidates.push({
      userId: candidate.user_id,
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      highestLevelName: candidate.highest_level_name || "",
      highestLevelRank: Number(candidate.highest_level_rank) || null,
      servingPreference: candidate.serving_preference || "prefer",
      monthlyFrequencyLimit:
        candidate.monthly_frequency_limit == null
          ? null
          : Number(candidate.monthly_frequency_limit),
      automaticAssignmentMonthlyLimit:
        candidate.automatic_assignment_monthly_limit == null
          ? null
          : Number(candidate.automatic_assignment_monthly_limit),
      ministryMonthlyCount: Number(candidate.ministry_monthly_count || 0),
      overallMonthlyCount: Number(candidate.overall_monthly_count || 0),
      automaticEligible:
        (candidate.monthly_frequency_limit == null ||
          Number(candidate.ministry_monthly_count || 0) <
            Number(candidate.monthly_frequency_limit)) &&
        (candidate.automatic_assignment_monthly_limit == null ||
          Number(candidate.overall_monthly_count || 0) <
            Number(candidate.automatic_assignment_monthly_limit)),
      reliability: summarizeReliability(history),
      sameTimeReliability: {
        time: eventTimeKey,
        ...summarizeReliability(sameTimeHistory),
      },
    })
    candidatesByResponsibility.set(candidate.responsibility_id, candidates)
  }

  const levelResult = manageableMinistryIds.length
    ? await client.query(
        `
          SELECT id, ministry_id, name, description, rank_order
          FROM ministry_levels
          WHERE ministry_id = ANY($1::UUID[])
            AND status = 'active'
          ORDER BY ministry_id, rank_order
        `,
        [manageableMinistryIds],
      )
    : { rows: [] }
  const groupResult = manageableMinistryIds.length
    && hasMinistryGroupSchema
      ? await client.query(
        `SELECT id, ministry_id, name, description, automatic_membership FROM ministry_groups WHERE ministry_id = ANY($1::UUID[]) AND status = 'active' ORDER BY ministry_id, sort_order, lower(name)`,
        [manageableMinistryIds],
      )
    : { rows: [] }

  const roomResult = await client.query(
    `
      SELECT room.id, room.name
      FROM event_room_reservations reservation
      JOIN chapel_rooms room ON room.id = reservation.room_id
      WHERE reservation.event_id = $1
      ORDER BY room.sort_order, lower(room.name)
    `,
    [eventId],
  )

  return {
    ...event,
    version: Number(event.version),
    template_version: Number(event.template_version || 0) || null,
    rooms:
      event.visibility === "private" && !privacyAccess.canSeeProtectedDetails
        ? []
        : roomResult.rows,
    room_ids:
      event.visibility === "private" && !privacyAccess.canSeeProtectedDetails
        ? []
        : roomResult.rows.map((room) => room.id),
    ministries: participantResult.rows.map((participant, index) => ({
      ministryId: participant.ministry_id,
      ministryName: participant.ministry_name,
      isRequired: participant.is_required,
      scheduleStatus: participant.schedule_status,
      instructions: accessChecks[index].canView
        ? participant.instructions || ""
        : "",
      reviewedAt: participant.reviewed_at,
      publishedAt: participant.published_at,
      canManage: accessChecks[index].canManage,
    })),
    responsibilities: visibleResponsibilities.map((responsibility) => {
      const responsibilityMinistryId = responsibility.is_public_assignment
        ? null
        : responsibility.ministry_id || event.ministry_id
      const canSeeResponsibilityDetails =
        canManageEvent ||
        !responsibilityMinistryId ||
        Boolean(
          responsibilityAccessByMinistry.get(responsibilityMinistryId)?.canView,
        )
      const assignments =
        assignmentsByResponsibility.get(responsibility.id) || []
      if (!canSeeResponsibilityDetails) {
        return {
          id: responsibility.id,
          ministryId: responsibility.ministry_id,
          ministryName: responsibility.ministry_name,
          name: responsibility.name,
          summaryOnly: true,
          canManage: false,
          assignments,
        }
      }
      const canManageResponsibility =
        canManageAllResponsibilities ||
        (responsibilityMinistryId
          ? Boolean(
              responsibilityAccessByMinistry.get(responsibilityMinistryId)
                ?.canManage,
            )
          : canManageEvent)
      return {
      id: responsibility.id,
      ministryId: responsibility.ministry_id,
      templateResponsibilityId: responsibility.template_responsibility_id,
      ministryName: responsibility.ministry_name,
      name: responsibility.name,
      description: responsibility.description || "",
      responsibilityType: responsibility.responsibility_type,
      quantityNeeded: Number(responsibility.quantity_needed),
      isPublicAssignment: Boolean(responsibility.is_public_assignment),
      unlimitedCapacity: Boolean(responsibility.unlimited_capacity),
      assignedQuantity: Number(responsibility.assigned_quantity),
      approvalRequired: responsibility.approval_required,
      substitutionAllowed: responsibility.substitution_allowed !== false,
      isRequired: responsibility.is_required,
      requiredLevelId: responsibility.required_ministry_level_id || "",
      requiredLevelName: responsibility.required_level_name || "",
      requiredLevelRank: Number(responsibility.required_level_rank) || null,
      requiredGroupId: responsibility.required_group_id || "",
      requiredGroupName: responsibility.required_group_name || "",
      relativeStartMinutes: Number(responsibility.relative_start_minutes),
      instructions: responsibility.instructions || "",
      status: responsibility.status,
      sortOrder: Number(responsibility.sort_order),
      canManage: canManageResponsibility,
      assignments,
      availableMembers:
        candidatesByResponsibility.get(responsibility.id) || [],
      }
    }),
    levels: levelResult.rows.map((level) => ({
      id: level.id,
      ministryId: level.ministry_id,
      name: level.name,
      description: level.description || "",
      rankOrder: Number(level.rank_order),
    })),
    groups: groupResult.rows.map((group) => ({
      id: group.id,
      ministryId: group.ministry_id,
      name: group.name,
      description: group.description || "",
      automaticMembership: Boolean(group.automatic_membership),
    })),
    canManageEvent: publicView ? false : canManageEvent,
    canSeeProtectedDetails: privacyAccess.canSeeProtectedDetails,
    isPublicView: publicView,
    assignmentVisibilityRestricted:
      visibleResponsibilities.length < responsibilityResult.rows.length,
    currentUserId: context.user.id,
    substitutionOffers: substitutionState.offers.map((offer) => ({
      requestId: offer.request_id,
      assignmentId: offer.assignment_id,
      responsibilityId: offer.responsibility_id,
      responsibilityName: offer.responsibility_name,
      reason: offer.reason || "",
      expiresAt: offer.expires_at,
      minimumLevelRank: Number(offer.minimum_level_rank || 0),
      relativeStartMinutes: Number(offer.relative_start_minutes || 0),
      eventStartTime: offer.start_time,
      requesterFirstName: offer.first_name,
      requesterLastName: offer.last_name || "",
    })),
  }
}

const recordServiceOutcome = async (
  client: PoolClient,
  context: any,
  event: any,
  body: any,
) => {
  const assignmentId = cleanText(body.assignmentId, 100)
  const outcome = cleanText(body.outcome, 40)
  const note = cleanText(body.note, 1000) || null
  if (!SERVICE_OUTCOMES.has(outcome)) {
    throw Object.assign(new Error("Choose a valid service outcome"), {
      status: 400,
    })
  }
  if (new Date(event.start_time).getTime() > Date.now()) {
    throw Object.assign(
      new Error("Service outcomes can be recorded after the event begins"),
      { status: 409 },
    )
  }
  const assignmentResult = await client.query(
    `
      SELECT
        assignment.*,
        COALESCE(responsibility.ministry_id, $3) AS ministry_id
      FROM responsibility_assignments assignment
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      WHERE assignment.id = $1
        AND assignment.event_id = $2
      LIMIT 1
      FOR UPDATE
    `,
    [assignmentId, event.id, event.ministry_id],
  )
  const assignment = assignmentResult.rows[0]
  if (!assignment) {
    throw Object.assign(new Error("Assignment not found"), { status: 404 })
  }
  await requireMinistryAccess(
    client,
    context.user,
    assignment.ministry_id,
    true,
  )
  await client.query(
    `
      UPDATE responsibility_assignments
      SET service_outcome = $2,
          outcome_recorded_at = now(),
          outcome_recorded_by = $3,
          outcome_note = $4,
          updated_at = now()
      WHERE id = $1
    `,
    [assignment.id, outcome, context.actor.id, note],
  )
  await writeSchedulingAudit(client, context, {
    action: "responsibility_assignment.outcome_recorded",
    entityType: "responsibility_assignment",
    entityId: assignment.id,
    ministryId: assignment.ministry_id,
    beforeData: {
      status: assignment.status,
      serviceOutcome: assignment.service_outcome,
      outcomeNote: assignment.outcome_note,
    },
    afterData: {
      status: assignment.status,
      serviceOutcome: outcome,
      outcomeNote: note,
    },
    metadata: { eventId: event.id },
  })
  return "Service outcome recorded"
}

export const createEvents = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const templateId = cleanText(body.templateId, 100)
  if (!templateId) {
    throw Object.assign(new Error("Select an event template"), { status: 400 })
  }
  const structure = await loadTemplateStructure(client, templateId)
  await requireMinistryAccess(
    client,
    context.user,
    structure.template.ministry_id,
    true,
  )

  const title = cleanText(body.title, 250) || structure.template.name
  let description =
    cleanText(body.description) || structure.template.description || ""
  let location = cleanText(body.location, 500)
  const start = parseDate(body.startTime, "Start time")
  const end = parseDate(body.endTime, "End time")
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
  }
  const duration = end.getTime() - start.getTime()
  const confirmationDeadline = body.confirmationDeadline
    ? parseDate(body.confirmationDeadline, "Confirmation deadline")
    : null
  if (confirmationDeadline && confirmationDeadline >= start) {
    throw Object.assign(
      new Error("Confirmation deadline must be before the event starts"),
      { status: 400 },
    )
  }
  const confirmationOffset = confirmationDeadline
    ? confirmationDeadline.getTime() - start.getTime()
    : null
  const occurrenceStarts = getOccurrenceStarts(start, body.recurrence)
  if (
    occurrenceStarts.length > 1 &&
    !["owner", "super_admin"].includes(context.user.global_role)
  ) {
    throw Object.assign(
      new Error("Only a Super Admin can create repeating events"),
      { status: 403 },
    )
  }
  const recurrenceGroupId =
    occurrenceStarts.length > 1 ? randomUUID() : null
  const recurrenceRule =
    occurrenceStarts.length > 1
      ? { ...normalizeRecurrence(body.recurrence), effectiveFrom: start.toISOString() }
      : null
  const status = body.status === "published" ? "published" : "draft"
  const participationType = PARTICIPATION_TYPES.has(body.participationType)
    ? body.participationType
    : structure.template.participation_type || "members"
  const privateByDefault = /sick call|private appointment|travel/i.test(
    structure.template.name || "",
  )
  const visibility = EVENT_VISIBILITIES.has(body.visibility)
    ? body.visibility
    : privateByDefault
      ? "private"
      : "public"
  const roomIds = normalizeRoomIds(body.roomIds)
  await validateRoomIds(client, roomIds)
  if (visibility === "private") {
    description = ""
    location = ""
  }
  let ministryIds = Array.from(
    new Set([
      structure.template.ministry_id,
      ...structure.blocks.map((block: any) => block.ministry_id),
    ]),
  ).filter(Boolean) as string[]
  ministryIds = await excludeReservationMinistry(client, ministryIds)
  const conflictOverride = body.conflictOverride === true
  const conflictOverrideReason = conflictOverride
    ? cleanText(body.conflictOverrideReason, 500) || "Overlap reviewed by ministry administrator"
    : null
  const eventIds: string[] = []
  const assignmentIds: string[] = []
  const generatedSchedules: AutomaticScheduleResult[] = []
  const requestedAssignments = Array.isArray(body.assignments)
    ? body.assignments
        .map((assignment: any) => ({
          templateResponsibilityId: cleanText(
            assignment.templateResponsibilityId,
            100,
          ),
          userId: cleanText(assignment.userId, 100),
        }))
        .filter(
          (assignment: any) =>
            assignment.templateResponsibilityId && assignment.userId,
        )
    : []
  if (
    new Set(requestedAssignments.map((assignment: any) => assignment.userId))
      .size !== requestedAssignments.length
  ) {
    throw Object.assign(
      new Error("A member can fill only one position in an event"),
      { status: 409 },
    )
  }
  if (occurrenceStarts.length > 1 && requestedAssignments.length) {
    throw Object.assign(
      new Error("Assign members after creating repeating events"),
      { status: 409 },
    )
  }
  if (participationType === "volunteers" && requestedAssignments.length) {
    throw Object.assign(
      new Error("Volunteer events cannot use automatic member assignments"),
      { status: 409 },
    )
  }

  const prioryEnabled = await client.query(
    `SELECT enabled FROM priory_integration_settings WHERE setting_key='primary'`,
  )
  if (prioryEnabled.rows[0]?.enabled && status === "published") {
    const priestMinistry = await client.query(
      `SELECT id FROM ministries WHERE slug='priests' LIMIT 1`,
    )
    const priestMinistryId = priestMinistry.rows[0]?.id
    const priestResponsibilities = structure.responsibilities.filter(
      (responsibility: any) =>
        (responsibility.ministry_id || structure.template.ministry_id) ===
        priestMinistryId,
    )
    if (priestResponsibilities.length) {
      const requestedByResponsibility = new Map(
        requestedAssignments.map((assignment: any) => [
          assignment.templateResponsibilityId,
          assignment.userId,
        ]),
      )
      const selectedPriestAssignments = priestResponsibilities.filter(
        (responsibility: any) => requestedByResponsibility.has(responsibility.id),
      )
      if (!selectedPriestAssignments.length) {
        throw Object.assign(
          new Error(
            "Save this event as a draft and request Priory availability before publishing",
          ),
          { status: 409, prioryAllocationRequired: true },
        )
      }
      for (const responsibility of selectedPriestAssignments) {
        await assertPriestAllocation(
          client,
          priestMinistryId,
          String(requestedByResponsibility.get(responsibility.id) || ""),
          new Date(
            start.getTime() +
              Number(responsibility.relative_start_minutes || 0) * 60_000,
          ),
          end,
        )
      }
    }
  }

  for (const occurrenceStart of occurrenceStarts) {
    const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)
    const [scheduleConflicts, roomConflicts] = await Promise.all([
      findEventConflicts(
        client,
        ministryIds,
        occurrenceStart,
        occurrenceEnd,
        [],
      ),
      findRoomConflicts(
        client,
        roomIds,
        occurrenceStart,
        occurrenceEnd,
        [],
      ),
    ])
    const conflicts = [...scheduleConflicts, ...roomConflicts]
    if (
      conflicts.length &&
      !conflictOverride &&
      occurrenceStarts.length === 1
    ) {
      throw Object.assign(
        new Error("This event overlaps another event. Fix the time or explicitly ignore the warning."),
        { status: 409, conflicts },
      )
    }
    const eventId = await createEventFromStructure(client, context, {
        structure,
        title,
        description,
        location,
        start: occurrenceStart,
        end: occurrenceEnd,
        status: occurrenceStarts.length > 1 ? "draft" : status,
        recurrenceGroupId,
        recurrenceRule,
        recurrenceAnchorAt:
          occurrenceStarts.length > 1 ? occurrenceStart : null,
        participationType,
        visibility,
        confirmationDeadline:
          confirmationOffset === null
            ? null
            : new Date(occurrenceStart.getTime() + confirmationOffset),
        conflictOverride: conflicts.length > 0 && conflictOverride,
        conflictOverrideReason,
        roomIds,
      })
    eventIds.push(eventId)
    if (occurrenceStarts.length > 1) {
      const generated = await fillAndReviewAutomaticSchedule(
        client,
        context,
        eventId,
        conflicts,
      )
      generatedSchedules.push(generated)
      assignmentIds.push(...generated.assignmentIds)
    }
    if (requestedAssignments.length) {
      const generatedResponsibilities = await client.query(
        `
          SELECT id, template_responsibility_id
          FROM event_responsibilities
          WHERE event_id = $1
            AND template_responsibility_id IS NOT NULL
        `,
        [eventId],
      )
      const generatedByTemplateId = new Map(
        generatedResponsibilities.rows.map((responsibility) => [
          responsibility.template_responsibility_id,
          responsibility.id,
        ]),
      )
      for (const assignment of requestedAssignments) {
        const responsibilityId = generatedByTemplateId.get(
          assignment.templateResponsibilityId,
        )
        if (!responsibilityId) {
          throw Object.assign(
            new Error("One of the selected positions is no longer in this template"),
            { status: 409 },
          )
        }
        const assigned = await assignMemberToResponsibility(
          client,
          context,
          {
            id: eventId,
            ministry_id: structure.template.ministry_id,
            status,
            start_time: occurrenceStart,
            end_time: occurrenceEnd,
          },
          { responsibilityId, userId: assignment.userId },
        )
        assignmentIds.push(assigned.assignmentId)
      }
    }
  }
  return { eventIds, assignmentIds, generatedSchedules }
}

const configureVolunteerSignup = async (
  client: PoolClient,
  context: any,
  event: any,
  body: any,
) => {
  await requireMinistryAccess(client, context.user, event.ministry_id, true)
  if (!["volunteers", "both"].includes(event.participation_type)) {
    throw Object.assign(
      new Error("Set event participation to Volunteers or Members and volunteers first"),
      { status: 409 },
    )
  }
  const code = normalizeSignupCode(body.signupCode)
  const signupOpen = body.signupOpen === true
  const generalVolunteerUnlimited = body.generalVolunteerUnlimited !== false
  const parsedGeneralVolunteerLimit = Number.parseInt(
    body.generalVolunteerLimit,
    10,
  )
  if (
    !generalVolunteerUnlimited &&
    (!Number.isInteger(parsedGeneralVolunteerLimit) ||
      parsedGeneralVolunteerLimit < 1 ||
      parsedGeneralVolunteerLimit > 10000)
  ) {
    throw Object.assign(
      new Error("General Volunteer spots must be between 1 and 10,000"),
      { status: 400 },
    )
  }
  const generalVolunteerLimit = generalVolunteerUnlimited
    ? 1
    : parsedGeneralVolunteerLimit
  if (
    code.length < 4 ||
    !SIGNUP_CODE_PATTERN.test(code) ||
    RESERVED_SIGNUP_CODES.has(code)
  ) {
    throw Object.assign(
      new Error("Choose 4–64 lowercase letters, numbers, or hyphens for the link"),
      { status: 400 },
    )
  }
  if (signupOpen && event.status !== "published") {
    throw Object.assign(new Error("Publish the event before opening volunteer signups"), {
      status: 409,
    })
  }
  const existingGeneralVolunteer = await client.query(
    `
      SELECT id
      FROM event_responsibilities
      WHERE event_id = $1
        AND lower(btrim(name)) = 'general volunteer'
        AND status <> 'cancelled'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE
    `,
    [event.id],
  )
  if (existingGeneralVolunteer.rowCount) {
    await client.query(
      `
        UPDATE event_responsibilities responsibility
        SET quantity_needed = $2,
            unlimited_capacity = $3,
            is_public_assignment = true,
            status = CASE
              WHEN $3 THEN 'open'
              WHEN (
                SELECT COALESCE(sum(quantity), 0)
                FROM responsibility_assignments assignment
                WHERE assignment.responsibility_id = responsibility.id
                  AND assignment.status NOT IN ('declined', 'cancelled')
              ) >= $2 THEN 'filled'
              ELSE 'open'
            END,
            updated_at = now()
        WHERE id = $1
      `,
      [
        existingGeneralVolunteer.rows[0].id,
        generalVolunteerLimit,
        generalVolunteerUnlimited,
      ],
    )
  } else {
    await client.query(
      `
        INSERT INTO event_responsibilities (
          event_id, ministry_id, name, description, responsibility_type,
          quantity_needed, approval_required, is_required,
          relative_start_minutes, sort_order, status,
          is_public_assignment, unlimited_capacity
        )
        VALUES (
          $1, NULL, 'General Volunteer',
          'Sign up to help. Your specific task will be assigned by email or during the event.',
          'task', $2, false, true, 0, -100, 'open', true, $3
        )
      `,
      [event.id, generalVolunteerLimit, generalVolunteerUnlimited],
    )
  }
  try {
    await client.query(
      `
        UPDATE events
        SET signup_code = $2,
            signup_open = $3,
            version = version + 1,
            updated_at = now()
        WHERE id = $1
      `,
      [event.id, code, signupOpen],
    )
  } catch (error: any) {
    if (error?.code === "23505") {
      throw Object.assign(new Error("That volunteer URL is already in use"), {
        status: 409,
      })
    }
    throw error
  }
  await writeSchedulingAudit(client, context, {
    action: "event.volunteer_signup_configured",
    entityType: "event",
    entityId: event.id,
    ministryId: event.ministry_id,
    beforeData: {
      signupCode: event.signup_code,
      signupOpen: event.signup_open,
    },
    afterData: {
      signupCode: code,
      signupOpen,
      generalVolunteerUnlimited,
      generalVolunteerLimit: generalVolunteerUnlimited
        ? null
        : generalVolunteerLimit,
    },
  })
  return signupOpen ? "Volunteer signup link is open" : "Volunteer signup link saved and closed"
}

const cloneEvent = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const sourceEventId = cleanText(body.sourceEventId, 100)
  const sourceResult = await client.query(
    `SELECT * FROM events WHERE id = $1 FOR UPDATE`,
    [sourceEventId],
  )
  const source = sourceResult.rows[0]
  if (!source) throw Object.assign(new Error("Event not found"), { status: 404 })
  await requireMinistryAccess(client, context.user, source.ministry_id, true)

  const [blocks, responsibilities, sourceRooms] = await Promise.all([
    client.query(
      `SELECT event_ministries.*, ARRAY(SELECT scoped.group_id FROM event_ministry_groups scoped WHERE scoped.event_ministry_id = event_ministries.id) AS group_ids FROM event_ministries WHERE event_id = $1 ORDER BY created_at`,
      [sourceEventId],
    ),
    client.query(
      `
        SELECT *
        FROM event_responsibilities
        WHERE event_id = $1
          AND status <> 'cancelled'
        ORDER BY sort_order
      `,
      [sourceEventId],
    ),
    client.query(
      `SELECT room_id FROM event_room_reservations WHERE event_id = $1`,
      [sourceEventId],
    ),
  ])
  const start = parseDate(body.startTime, "Start time")
  const end = parseDate(body.endTime, "End time")
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
  }
  const confirmationDeadline = body.confirmationDeadline
    ? parseDate(body.confirmationDeadline, "Confirmation deadline")
    : null
  if (confirmationDeadline && confirmationDeadline >= start) {
    throw Object.assign(
      new Error("Confirmation deadline must be before the event starts"),
      { status: 400 },
    )
  }

  const structure = {
    template: {
      id: source.template_id,
      version: source.template_version,
      ministry_id: source.ministry_id,
      participation_type: source.participation_type,
    },
    blocks: blocks.rows.map((block) => ({
      id: block.template_ministry_id,
      ministry_id: block.ministry_id,
      is_required: block.is_required,
      instructions: block.instructions,
      group_ids: block.group_ids || [],
    })),
    responsibilities: responsibilities.rows.map((responsibility) => ({
      id: responsibility.template_responsibility_id,
      ministry_id: responsibility.ministry_id,
      name: responsibility.name,
      description: responsibility.description,
      responsibility_type: responsibility.responsibility_type,
      quantity_needed: responsibility.quantity_needed,
      approval_required: responsibility.approval_required,
      is_required: responsibility.is_required,
      required_ministry_level_id:
        responsibility.required_ministry_level_id,
      required_group_id: responsibility.required_group_id,
      required_qualification: responsibility.required_qualification,
      relative_start_minutes: responsibility.relative_start_minutes,
      instructions: responsibility.instructions,
      sort_order: responsibility.sort_order,
    })),
  }
  let ministryIds = Array.from(
    new Set([
      source.ministry_id,
      ...blocks.rows.map((block) => block.ministry_id),
    ]),
  ).filter(Boolean) as string[]
  ministryIds = await excludeReservationMinistry(client, ministryIds)
  const roomIds = body.roomIds === undefined
    ? sourceRooms.rows.map((room) => room.room_id)
    : normalizeRoomIds(body.roomIds)
  await validateRoomIds(client, roomIds)
  const [scheduleConflicts, roomConflicts] = await Promise.all([
    findEventConflicts(client, ministryIds, start, end, []),
    findRoomConflicts(client, roomIds, start, end, []),
  ])
  const conflicts = [...scheduleConflicts, ...roomConflicts]
  const conflictOverride = body.conflictOverride === true
  if (conflicts.length && !conflictOverride) {
    throw Object.assign(
      new Error("This event overlaps another event. Fix the time or explicitly ignore the warning."),
      { status: 409, conflicts },
    )
  }
  return createEventFromStructure(client, context, {
    structure,
    title: cleanText(body.title, 250) || `${source.title} Copy`,
    description:
      body.description === undefined
        ? source.description
        : cleanText(body.description),
    location:
      body.location === undefined ? source.location : cleanText(body.location),
    start,
    end,
    status: "draft",
    recurrenceGroupId: null,
    recurrenceRule: null,
    confirmationDeadline,
    sourceEventId,
    conflictOverride: conflicts.length > 0 && conflictOverride,
    conflictOverrideReason: conflictOverride
      ? cleanText(body.conflictOverrideReason, 500) || "Overlap reviewed by ministry administrator"
      : null,
    roomIds,
  })
}

const previewTemplateReplacement = async (
  client: PoolClient,
  context: any,
  body: any,
): Promise<any> => {
  const eventId = cleanText(body.eventId, 100)
  const templateId = cleanText(body.templateId, 100)
  const eventResult = await client.query(
    `SELECT id, ministry_id, template_id, template_version, recurrence_group_id,
      recurrence_anchor_at, start_time FROM events WHERE id = $1`,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) throw Object.assign(new Error("Event not found"), { status: 404 })
  if (body.updateScope === "this_and_future") {
    if (!event.recurrence_group_id) {
      throw Object.assign(new Error("This event is not part of a repeating series"), {
        status: 409,
      })
    }
    if (!["owner", "super_admin"].includes(context.user.global_role)) {
      throw Object.assign(
        new Error("Only a Super Admin can change a repeating-event rule"),
        { status: 403 },
      )
    }
    const futureEvents = await client.query(
      `
        SELECT id, recurrence_rule
        FROM events
        WHERE recurrence_group_id = $1
          AND COALESCE(recurrence_anchor_at, start_time) >= $2
          AND status <> 'archived'
        ORDER BY COALESCE(recurrence_anchor_at, start_time), id
      `,
      [event.recurrence_group_id, event.recurrence_anchor_at || event.start_time],
    )
    const previews: any[] = []
    for (const futureEvent of futureEvents.rows) {
      previews.push(
        await previewTemplateReplacement(client, context, {
          ...body,
          eventId: futureEvent.id,
          updateScope: "this_event",
        }),
      )
    }
    const first = previews[0]
    return {
      ...first,
      affectedEvents: previews.length,
      preserved: previews.flatMap((preview) => preview.preserved),
      added: previews.flatMap((preview) => preview.added),
      removed: previews.flatMap((preview) => preview.removed),
      affectedAssignments: previews.reduce(
        (total, preview) => total + Number(preview.affectedAssignments || 0),
        0,
      ),
    }
  }
  await requireMinistryAccess(client, context.user, event.ministry_id, true)
  const structure = await loadTemplateStructure(client, templateId)
  await requireMinistryAccess(
    client,
    context.user,
    structure.template.ministry_id,
    true,
  )
  const currentResult = await client.query(
    `
      SELECT
        responsibility.id,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        responsibility.template_responsibility_id,
        responsibility.name,
        responsibility.responsibility_type,
        EXISTS (
          SELECT 1
          FROM responsibility_assignments assignment
          WHERE assignment.responsibility_id = responsibility.id
            AND assignment.status NOT IN ('cancelled', 'declined')
        ) AS has_assignments
      FROM event_responsibilities responsibility
      JOIN events event ON event.id = responsibility.event_id
      WHERE responsibility.event_id = $1
        AND responsibility.status <> 'cancelled'
    `,
    [eventId],
  )
  const nextKeys = new Set(
    structure.responsibilities.map((responsibility: any) =>
      [
        responsibility.ministry_id,
        responsibility.name.toLowerCase(),
        responsibility.responsibility_type,
      ].join("|"),
    ),
  )
  const currentKeys = new Set(
    currentResult.rows.map((responsibility) =>
      [
        responsibility.ministry_id,
        responsibility.name.toLowerCase(),
        responsibility.responsibility_type,
      ].join("|"),
    ),
  )
  const preserved = currentResult.rows.filter(
    (responsibility) =>
      !responsibility.template_responsibility_id ||
      nextKeys.has(
        [
          responsibility.ministry_id,
          responsibility.name.toLowerCase(),
          responsibility.responsibility_type,
        ].join("|"),
      ),
  )
  const removed = currentResult.rows.filter(
    (responsibility) =>
      responsibility.template_responsibility_id &&
      !nextKeys.has(
        [
          responsibility.ministry_id,
          responsibility.name.toLowerCase(),
          responsibility.responsibility_type,
        ].join("|"),
      ),
  )
  const added = structure.responsibilities.filter(
    (responsibility: any) =>
      !currentKeys.has(
        [
          responsibility.ministry_id,
          responsibility.name.toLowerCase(),
          responsibility.responsibility_type,
        ].join("|"),
      ),
  )
  return {
    currentTemplateId: event.template_id,
    currentTemplateVersion: event.template_version,
    nextTemplateId: structure.template.id,
    nextTemplateName: structure.template.name,
    nextTemplateVersion: Number(structure.template.version),
    preserved: preserved.map((responsibility) => ({
      name: responsibility.name,
      ministryId: responsibility.ministry_id,
      hasAssignments: responsibility.has_assignments,
    })),
    added: added.map((responsibility: any) => ({
      name: responsibility.name,
      ministryId: responsibility.ministry_id,
    })),
    removed: removed.map((responsibility) => ({
      name: responsibility.name,
      ministryId: responsibility.ministry_id,
      hasAssignments: responsibility.has_assignments,
    })),
    affectedAssignments: removed.filter(
      (responsibility) => responsibility.has_assignments,
    ).length,
  }
}

const markEventMinistryChanged = async (
  client: PoolClient,
  eventId: string,
  _ministryId: string,
) => {
  await client.query(
    `
      UPDATE events
      SET version = version + 1,
          updated_at = now()
      WHERE id = $1
    `,
    [eventId],
  )
}

const assignMemberToResponsibility = async (
  client: PoolClient,
  context: any,
  event: any,
  body: any,
) => {
  if (["cancelled", "completed", "archived"].includes(event.status)) {
    throw Object.assign(
      new Error("Members cannot be assigned to this event"),
      { status: 409 },
    )
  }

  // Serialize every assignment change for this event so two administrators
  // cannot place the same member into different positions concurrently.
  await client.query(`SELECT id FROM events WHERE id = $1 FOR UPDATE`, [event.id])

  const responsibilityId = cleanText(body.responsibilityId, 100)
  const userId = cleanText(body.userId, 100)
  if (!responsibilityId || !userId) {
    throw Object.assign(
      new Error("Responsibility and member are required"),
      { status: 400 },
    )
  }

  const ministryGroupSchemaResult = await client.query(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'event_responsibilities'
            AND column_name = 'required_group_id'
        )
        AND to_regclass(current_schema() || '.ministry_group_members') IS NOT NULL
          AS is_available
    `,
  )
  const hasMinistryGroupSchema = Boolean(
    ministryGroupSchemaResult.rows[0]?.is_available,
  )

  const responsibilityResult = await client.query(
    hasMinistryGroupSchema
      ? `
      SELECT
        responsibility.id,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        responsibility.name,
        responsibility.quantity_needed,
        responsibility.required_ministry_level_id,
        responsibility.required_group_id,
        responsibility.required_qualification,
        responsibility.relative_start_minutes,
        responsibility.status
      FROM event_responsibilities responsibility
      JOIN events event ON event.id = responsibility.event_id
      WHERE responsibility.id = $1
        AND responsibility.event_id = $2
      LIMIT 1
      FOR UPDATE
    `
      : `
      SELECT
        responsibility.id,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        responsibility.name,
        responsibility.quantity_needed,
        responsibility.required_ministry_level_id,
        NULL::UUID AS required_group_id,
        responsibility.required_qualification,
        responsibility.relative_start_minutes,
        responsibility.status
      FROM event_responsibilities responsibility
      JOIN events event ON event.id = responsibility.event_id
      WHERE responsibility.id = $1
        AND responsibility.event_id = $2
      LIMIT 1
      FOR UPDATE
    `,
    [responsibilityId, event.id],
  )
  const responsibility = responsibilityResult.rows[0]
  if (!responsibility || responsibility.status === "cancelled") {
    throw Object.assign(new Error("Responsibility is unavailable"), {
      status: 404,
    })
  }
  await requireMinistryAccess(
    client,
    context.user,
    responsibility.ministry_id,
    true,
  )

  const eventDate = toChapelDateKey(event.start_time)
  const eligibleResult = await client.query(
    hasMinistryGroupSchema
      ? `
      SELECT member.id, member.first_name, member.last_name
      FROM ministry_members membership
      JOIN ministry_accounts member ON member.id = membership.user_id
      LEFT JOIN ministry_levels required_level
        ON required_level.id = $8
      LEFT JOIN ministry_levels granted_level
        ON granted_level.id = membership.highest_level_id
      WHERE membership.ministry_id = $1
        AND membership.user_id = $2
        AND membership.status = 'active'
        AND COALESCE(member.is_volunteer_profile, false) = false
        AND membership.serving_preference <> 'cannot_serve'
        AND ($10::UUID IS NULL OR EXISTS (SELECT 1 FROM ministry_group_members group_member WHERE group_member.ministry_member_id = membership.id AND group_member.group_id = $10))
        AND (
          required_level.id IS NULL
          OR (
            granted_level.ministry_id = $1
            AND granted_level.rank_order >= required_level.rank_order
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM availability_blocks block
          WHERE block.user_id = member.id
            AND block.status = 'active'
            AND (
              block.ministry_id IS NULL
              OR block.ministry_id = $1
            )
            AND block.start_date <= $3::DATE
            AND block.end_date >= $3::DATE
        )
        AND NOT EXISTS (
          SELECT 1
          FROM responsibility_assignments event_assignment
          WHERE event_assignment.user_id = member.id
            AND event_assignment.event_id = $5
            AND event_assignment.status = ANY($4)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM responsibility_assignments other_assignment
          JOIN events other_event
            ON other_event.id = other_assignment.event_id
          JOIN event_responsibilities other_responsibility
            ON other_responsibility.id = other_assignment.responsibility_id
          WHERE other_assignment.user_id = member.id
            AND other_assignment.status = ANY($4)
            AND other_event.id <> $5
            AND other_event.status NOT IN ('cancelled', 'archived')
            AND other_event.start_time
              + COALESCE(other_responsibility.relative_start_minutes, 0)
                * INTERVAL '1 minute' < $7
            AND other_event.end_time >
              $6::TIMESTAMPTZ
              + COALESCE($9::INT, 0) * INTERVAL '1 minute'
        )
      LIMIT 1
    `
      : `
      SELECT member.id, member.first_name, member.last_name
      FROM ministry_members membership
      JOIN ministry_accounts member ON member.id = membership.user_id
      LEFT JOIN ministry_levels required_level ON required_level.id = $8
      LEFT JOIN ministry_levels granted_level ON granted_level.id = membership.highest_level_id
      WHERE membership.ministry_id = $1
        AND membership.user_id = $2
        AND membership.status = 'active'
        AND COALESCE(member.is_volunteer_profile, false) = false
        AND membership.serving_preference <> 'cannot_serve'
        AND (
          required_level.id IS NULL
          OR (
            granted_level.ministry_id = $1
            AND granted_level.rank_order >= required_level.rank_order
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM availability_blocks block
          WHERE block.user_id = member.id
            AND block.status = 'active'
            AND (block.ministry_id IS NULL OR block.ministry_id = $1)
            AND block.start_date <= $3::DATE
            AND block.end_date >= $3::DATE
        )
        AND NOT EXISTS (
          SELECT 1 FROM responsibility_assignments event_assignment
          WHERE event_assignment.user_id = member.id
            AND event_assignment.event_id = $5
            AND event_assignment.status = ANY($4)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM responsibility_assignments other_assignment
          JOIN events other_event ON other_event.id = other_assignment.event_id
          JOIN event_responsibilities other_responsibility
            ON other_responsibility.id = other_assignment.responsibility_id
          WHERE other_assignment.user_id = member.id
            AND other_assignment.status = ANY($4)
            AND other_event.id <> $5
            AND other_event.status NOT IN ('cancelled', 'archived')
            AND other_event.start_time
              + COALESCE(other_responsibility.relative_start_minutes, 0)
                * INTERVAL '1 minute' < $7
            AND other_event.end_time >
              $6::TIMESTAMPTZ
              + COALESCE($9::INT, 0) * INTERVAL '1 minute'
        )
      LIMIT 1
    `,
    hasMinistryGroupSchema
      ? [
          responsibility.ministry_id,
          userId,
          eventDate,
          ACTIVE_ASSIGNMENT_STATUSES,
          event.id,
          event.start_time,
          event.end_time,
          responsibility.required_ministry_level_id,
          Number(responsibility.relative_start_minutes || 0),
          responsibility.required_group_id,
        ]
      : [
          responsibility.ministry_id,
          userId,
          eventDate,
          ACTIVE_ASSIGNMENT_STATUSES,
          event.id,
          event.start_time,
          event.end_time,
          responsibility.required_ministry_level_id,
          Number(responsibility.relative_start_minutes || 0),
        ],
  )
  const member = eligibleResult.rows[0]
  if (!member) {
    throw Object.assign(
      new Error(
        "This member is unavailable, already scheduled, or no longer eligible for this ministry",
      ),
      { status: 409 },
    )
  }

  const prioryAllocationId = await assertPriestAllocation(
    client,
    responsibility.ministry_id,
    userId,
    new Date(
      new Date(event.start_time).getTime() +
        Number(responsibility.relative_start_minutes || 0) * 60_000,
    ),
    new Date(event.end_time),
  )

  const coverageResult = await client.query(
    `
      SELECT COALESCE(sum(quantity), 0)::INT AS assigned_quantity
      FROM responsibility_assignments
      WHERE responsibility_id = $1
        AND status NOT IN ('declined', 'cancelled')
    `,
    [responsibility.id],
  )
  if (
    Number(coverageResult.rows[0].assigned_quantity) >=
    Number(responsibility.quantity_needed)
  ) {
    throw Object.assign(new Error("This responsibility is already filled"), {
      status: 409,
    })
  }

  const existingResult = await client.query(
    `
      SELECT id, status
      FROM responsibility_assignments
      WHERE responsibility_id = $1
        AND user_id = $2
      LIMIT 1
      FOR UPDATE
    `,
    [responsibility.id, userId],
  )
  const existing = existingResult.rows[0]
  if (existing && !["declined", "cancelled"].includes(existing.status)) {
    throw Object.assign(
      new Error("This member is already assigned to the responsibility"),
      { status: 409 },
    )
  }

  let assignment
  if (existing) {
    const updatedResult = await client.query(
      `
        UPDATE responsibility_assignments
        SET status = 'assigned',
            quantity = 1,
            assigned_by = $2,
            signup_source = 'admin_assignment',
            notify_email = true,
            priory_allocation_id = $3,
            priory_allocation_conflict = false,
            priory_allocation_checked_at = CASE
              WHEN $3 IS NULL THEN NULL ELSE now()
            END,
            confirmation_overdue_at = NULL,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [existing.id, context.actor.id, prioryAllocationId],
    )
    assignment = updatedResult.rows[0]
  } else {
    const createdResult = await client.query(
      `
        INSERT INTO responsibility_assignments (
          event_id,
          responsibility_id,
          user_id,
          quantity,
          status,
          assigned_by,
          signup_source,
          notify_email,
          priory_allocation_id,
          priory_allocation_conflict,
          priory_allocation_checked_at
        )
        VALUES ($1, $2, $3, 1, 'assigned', $4, 'admin_assignment', true,
          $5, false, CASE WHEN $5 IS NULL THEN NULL ELSE now() END)
        RETURNING *
      `,
      [
        event.id,
        responsibility.id,
        userId,
        context.actor.id,
        prioryAllocationId,
      ],
    )
    assignment = createdResult.rows[0]
  }

  await client.query(
    `
      UPDATE event_responsibilities responsibility
      SET status = CASE
            WHEN responsibility.unlimited_capacity THEN 'open'
            WHEN (
              SELECT COALESCE(sum(quantity), 0)
              FROM responsibility_assignments assignment
              WHERE assignment.responsibility_id = responsibility.id
                AND assignment.status NOT IN ('declined', 'cancelled')
            ) >= responsibility.quantity_needed
              THEN 'filled'
            ELSE 'open'
          END,
          updated_at = now()
      WHERE responsibility.id = $1
    `,
    [responsibility.id],
  )
  await markEventMinistryChanged(
    client,
    event.id,
    responsibility.ministry_id,
  )
  await writeSchedulingAudit(client, context, {
    action: "responsibility_assignment.assigned",
    entityType: "responsibility_assignment",
    entityId: assignment.id,
    ministryId: responsibility.ministry_id,
    afterData: {
      userId,
      status: "assigned",
      responsibilityId: responsibility.id,
    },
    metadata: {
      eventId: event.id,
      eventDate,
      responsibilityName: responsibility.name,
      memberName: `${member.first_name} ${member.last_name}`,
      notificationStatus: "delivery_requested",
    },
  })
  return { message: "Member assigned", assignmentId: assignment.id }
}

const saveEventAssignments = async (
  client: PoolClient,
  context: any,
  event: any,
  body: any,
) => {
  if (["cancelled", "completed", "archived"].includes(event.status)) {
    throw Object.assign(new Error("Assignments cannot be changed for this event"), {
      status: 409,
    })
  }
  await client.query(`SELECT id FROM events WHERE id = $1 FOR UPDATE`, [event.id])
  const slots = Array.isArray(body.slots) ? body.slots : []
  if (!slots.length) {
    throw Object.assign(new Error("No assignment positions were supplied"), {
      status: 400,
    })
  }
  const normalizedSlots = slots.map((slot: any) => ({
    responsibilityId: cleanText(slot.responsibilityId, 100),
    assignmentId: cleanText(slot.assignmentId, 100) || null,
    userId: cleanText(slot.userId, 100) || null,
  }))
  if (normalizedSlots.some((slot: any) => !slot.responsibilityId)) {
    throw Object.assign(new Error("Every assignment slot needs a position"), {
      status: 400,
    })
  }
  const desiredUserIds = normalizedSlots
    .map((slot: any) => slot.userId)
    .filter(Boolean)
  if (new Set(desiredUserIds).size !== desiredUserIds.length) {
    throw Object.assign(
      new Error("A member can fill only one position in an event"),
      { status: 409 },
    )
  }

  const responsibilityIds = Array.from(
    new Set(normalizedSlots.map((slot: any) => slot.responsibilityId).filter(Boolean)),
  )
  const responsibilityResult = await client.query(
    `
      SELECT
        responsibility.id,
        responsibility.quantity_needed,
        responsibility.is_public_assignment,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id
      FROM event_responsibilities responsibility
      JOIN events event ON event.id = responsibility.event_id
      WHERE responsibility.event_id = $1
        AND responsibility.id = ANY($2::UUID[])
        AND responsibility.status <> 'cancelled'
      FOR UPDATE
    `,
    [event.id, responsibilityIds],
  )
  if (responsibilityResult.rowCount !== responsibilityIds.length) {
    throw Object.assign(new Error("One or more positions are unavailable"), {
      status: 409,
    })
  }
  for (const responsibility of responsibilityResult.rows) {
    if (responsibility.is_public_assignment) {
      throw Object.assign(
        new Error("Volunteer positions are managed through volunteer signups"),
        { status: 409 },
      )
    }
    await requireMinistryAccess(
      client,
      context.user,
      responsibility.ministry_id,
      true,
    )
    const positionSlots = normalizedSlots.filter(
      (slot: any) => slot.responsibilityId === responsibility.id,
    )
    if (positionSlots.length !== Number(responsibility.quantity_needed)) {
      throw Object.assign(
        new Error("Every position slot must be included, even when left blank"),
        { status: 400 },
      )
    }
  }

  const activeAssignments = await client.query(
    `
      SELECT assignment.id, assignment.responsibility_id, assignment.user_id
      FROM responsibility_assignments assignment
      LEFT JOIN ministry_accounts member ON member.id = assignment.user_id
      WHERE assignment.event_id = $1
        AND assignment.responsibility_id = ANY($2::UUID[])
        AND assignment.status = ANY($3)
        AND COALESCE(assignment.signup_source, '') <> 'public_link'
        AND COALESCE(member.is_volunteer_profile, false) = false
      FOR UPDATE
    `,
    [event.id, responsibilityIds, ACTIVE_ASSIGNMENT_STATUSES],
  )

  const activeById = new Map(
    activeAssignments.rows.map((assignment) => [assignment.id, assignment]),
  )
  const retainedAssignmentIds = new Set(
    normalizedSlots
      .filter((slot: any) => {
        const current = slot.assignmentId
          ? activeById.get(slot.assignmentId)
          : null
        return current &&
          current.responsibility_id === slot.responsibilityId &&
          current.user_id === slot.userId
      })
      .map((slot: any) => slot.assignmentId),
  )
  const cancelledIds = activeAssignments.rows
    .filter((assignment) => !retainedAssignmentIds.has(assignment.id))
    .map((assignment) => assignment.id)
  if (cancelledIds.length) {
    await client.query(
      `
        UPDATE responsibility_assignments
        SET status = 'cancelled', updated_at = now()
        WHERE id = ANY($1::UUID[])
      `,
      [cancelledIds],
    )
  }

  await client.query(
    `
      UPDATE event_responsibilities responsibility
      SET status = CASE
            WHEN responsibility.unlimited_capacity THEN 'open'
            WHEN (
              SELECT COALESCE(sum(quantity), 0)
              FROM responsibility_assignments assignment
              WHERE assignment.responsibility_id = responsibility.id
                AND assignment.status NOT IN ('declined', 'cancelled')
            ) >= responsibility.quantity_needed THEN 'filled'
            ELSE 'open'
          END,
          updated_at = now()
      WHERE responsibility.id = ANY($1::UUID[])
    `,
    [responsibilityIds],
  )

  const assignmentIds: string[] = []
  for (const slot of normalizedSlots) {
    if (!slot.userId || retainedAssignmentIds.has(slot.assignmentId)) continue
    const result = await assignMemberToResponsibility(client, context, event, {
      responsibilityId: slot.responsibilityId,
      userId: slot.userId,
    })
    assignmentIds.push(result.assignmentId)
  }
  await writeSchedulingAudit(client, context, {
    action: "event.assignments_saved",
    entityType: "event",
    entityId: event.id,
    ministryId: event.ministry_id,
    beforeData: { cancelledAssignmentIds: cancelledIds },
    afterData: {
      positions: normalizedSlots.map((slot: any) => ({
        responsibilityId: slot.responsibilityId,
        userId: slot.userId,
      })),
    },
  })
  const automaticReview =
    event.recurrence_group_id && event.status === "draft"
      ? await fillAndReviewAutomaticSchedule(client, context, event.id)
      : null
  return {
    message: "Assignments saved",
    assignmentIds,
    eventIds: [event.id],
    publishedEventIds: automaticReview?.published ? [event.id] : [],
  }
}

const matchingConflictCandidates = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const sourceEventId = cleanText(body.eventId, 100)
  const responsibilityId = cleanText(body.responsibilityId, 100)
  const userId = cleanText(body.userId, 100)
  const replacedUserId = cleanText(body.replacedUserId, 100) || null
  if (!sourceEventId || !responsibilityId || !userId) {
    throw Object.assign(
      new Error("Event, responsibility, and replacement member are required"),
      { status: 400 },
    )
  }
  const sourceResult = await client.query(
    `
      SELECT
        event.id AS event_id,
        event.ministry_id AS event_ministry_id,
        event.recurrence_group_id,
        event.start_time,
        responsibility.template_responsibility_id,
        responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id
      FROM events event
      JOIN event_responsibilities responsibility
        ON responsibility.event_id = event.id
      WHERE event.id = $1
        AND responsibility.id = $2
        AND responsibility.status <> 'cancelled'
      LIMIT 1
    `,
    [sourceEventId, responsibilityId],
  )
  const source = sourceResult.rows[0]
  if (!source) {
    throw Object.assign(new Error("Position not found"), { status: 404 })
  }
  if (!source.recurrence_group_id || !source.template_responsibility_id) {
    throw Object.assign(
      new Error("This position is not part of a repeating template schedule"),
      { status: 409 },
    )
  }
  await requireMinistryAccess(client, context.user, source.ministry_id, true)

  const targetResult = await client.query(
    `
      SELECT
        event.id AS event_id,
        event.title,
        event.start_time,
        event.end_time,
        event.status,
        event.ministry_id AS event_ministry_id,
        responsibility.id AS responsibility_id,
        responsibility.name AS responsibility_name,
        responsibility.quantity_needed,
        responsibility.required_ministry_level_id,
        responsibility.relative_start_minutes,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        COALESCE((
          SELECT sum(assignment.quantity)
          FROM responsibility_assignments assignment
          WHERE assignment.responsibility_id = responsibility.id
            AND assignment.status NOT IN ('declined', 'cancelled')
        ), 0)::INT AS assigned_quantity,
        (
          SELECT assignment.id
          FROM responsibility_assignments assignment
          WHERE assignment.responsibility_id = responsibility.id
            AND assignment.user_id = $5
            AND assignment.status = ANY($6)
          LIMIT 1
        ) AS replace_assignment_id
      FROM events event
      JOIN event_responsibilities responsibility
        ON responsibility.event_id = event.id
       AND responsibility.template_responsibility_id = $3
      WHERE event.recurrence_group_id = $1
        AND event.id <> $2
        AND event.start_time >= $4
        AND event.status IN ('draft', 'published')
        AND responsibility.status <> 'cancelled'
      ORDER BY event.start_time
    `,
    [
      source.recurrence_group_id,
      source.event_id,
      source.template_responsibility_id,
      source.start_time,
      replacedUserId,
      ACTIVE_ASSIGNMENT_STATUSES,
    ],
  )
  const eligible: any[] = []
  const skipped: any[] = []
  for (const target of targetResult.rows) {
    if (
      Number(target.assigned_quantity) >= Number(target.quantity_needed) &&
      !target.replace_assignment_id
    ) {
      skipped.push({
        eventId: target.event_id,
        title: target.title,
        startTime: target.start_time,
        reason: "Position is already filled",
      })
      continue
    }
    const memberResult = await client.query(
      `
        SELECT member.id
        FROM ministry_members membership
        JOIN ministry_accounts member ON member.id = membership.user_id
        LEFT JOIN ministry_levels required_level ON required_level.id = $8
        LEFT JOIN ministry_levels granted_level ON granted_level.id = membership.highest_level_id
        WHERE membership.ministry_id = $1
          AND membership.user_id = $2
          AND membership.status = 'active'
          AND membership.serving_preference <> 'cannot_serve'
          AND COALESCE(member.is_volunteer_profile, false) = false
          AND (
            required_level.id IS NULL
            OR (
              granted_level.ministry_id = $1
              AND granted_level.rank_order >= required_level.rank_order
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM availability_blocks block
            WHERE block.user_id = member.id
              AND block.status = 'active'
              AND (block.ministry_id IS NULL OR block.ministry_id = $1)
              AND block.start_date <= $3::DATE
              AND block.end_date >= $3::DATE
          )
          AND NOT EXISTS (
            SELECT 1 FROM responsibility_assignments assignment
            WHERE assignment.user_id = member.id
              AND assignment.event_id = $5
              AND assignment.status = ANY($4)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM responsibility_assignments assignment
            JOIN events other_event ON other_event.id = assignment.event_id
            JOIN event_responsibilities other_responsibility
              ON other_responsibility.id = assignment.responsibility_id
            WHERE assignment.user_id = member.id
              AND assignment.status = ANY($4)
              AND other_event.id <> $5
              AND other_event.status NOT IN ('cancelled', 'archived')
              AND other_event.start_time
                + COALESCE(other_responsibility.relative_start_minutes, 0)
                  * INTERVAL '1 minute' < $7
              AND other_event.end_time >
                $6::TIMESTAMPTZ + COALESCE($9::INT, 0) * INTERVAL '1 minute'
          )
        LIMIT 1
      `,
      [
        target.ministry_id,
        userId,
        toChapelDateKey(target.start_time),
        ACTIVE_ASSIGNMENT_STATUSES,
        target.event_id,
        target.start_time,
        target.end_time,
        target.required_ministry_level_id,
        Number(target.relative_start_minutes || 0),
      ],
    )
    const item = {
      eventId: target.event_id,
      title: target.title,
      startTime: target.start_time,
      responsibilityId: target.responsibility_id,
      responsibilityName: target.responsibility_name,
      replaceAssignmentId: target.replace_assignment_id || null,
    }
    if (memberResult.rowCount) eligible.push(item)
    else skipped.push({ ...item, reason: "Member is unavailable, already scheduled, or below the required level" })
  }
  return { source, userId, replacedUserId, eligible, skipped }
}

const applyMatchingConflictResolution = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const preview = await matchingConflictCandidates(client, context, body)
  const applied: any[] = []
  const skipped = [...preview.skipped]
  const bulkResolutionId = randomUUID()
  const publishedEventIds: string[] = []
  for (const target of preview.eligible) {
    const eventResult = await client.query(
      `SELECT * FROM events WHERE id = $1 FOR UPDATE`,
      [target.eventId],
    )
    if (target.replaceAssignmentId) {
      await client.query(
        `
          UPDATE responsibility_assignments
          SET status = 'cancelled', updated_at = now()
          WHERE id = $1
            AND event_id = $2
        `,
        [target.replaceAssignmentId, target.eventId],
      )
      await writeSchedulingAudit(client, context, {
        action: "responsibility_assignment.replaced_across_series",
        entityType: "responsibility_assignment",
        entityId: target.replaceAssignmentId,
        ministryId: preview.source.ministry_id,
        beforeData: {
          userId: preview.replacedUserId,
          status: "assigned",
        },
        afterData: { status: "cancelled" },
        metadata: {
          bulkResolutionId,
          eventId: target.eventId,
          replacementUserId: preview.userId,
        },
      })
    }
    const result = await assignMemberToResponsibility(
      client,
      context,
      eventResult.rows[0],
      {
        responsibilityId: target.responsibilityId,
        userId: preview.userId,
      },
    )
    const schedule = await fillAndReviewAutomaticSchedule(
      client,
      context,
      target.eventId,
    )
    if (eventResult.rows[0].status === "draft" && schedule.published) {
      publishedEventIds.push(target.eventId)
    }
    applied.push({ ...target, assignmentId: result.assignmentId })
  }
  await writeSchedulingAudit(client, context, {
    action: "event.matching_conflicts_resolved",
    entityType: "event",
    entityId: preview.source.event_id,
    ministryId: preview.source.ministry_id,
    afterData: {
      replacementUserId: preview.userId,
      appliedEventIds: applied.map((item) => item.eventId),
      skippedEventIds: skipped.map((item) => item.eventId),
    },
    metadata: {
      bulkResolutionId,
      templateResponsibilityId: preview.source.template_responsibility_id,
      responsibilityName: preview.source.responsibility_name,
    },
  })
  return {
    message: `${applied.length} matching schedule${applied.length === 1 ? "" : "s"} updated`,
    applied,
    skipped,
    publishedEventIds,
  }
}

const validateRequiredMinistryLevel = async (
  client: PoolClient,
  requiredLevelId: string | null,
  ministryId: string,
) => {
  if (!requiredLevelId) return
  const result = await client.query(
    `
      SELECT id
      FROM ministry_levels
      WHERE id = $1
        AND ministry_id = $2
        AND status = 'active'
      LIMIT 1
    `,
    [requiredLevelId, ministryId],
  )
  if (!result.rowCount) {
    throw Object.assign(
      new Error("Select an active level from this responsibility's ministry"),
      { status: 400 },
    )
  }
}

const validateRequiredGroup = async (
  client: PoolClient,
  requiredGroupId: string | null,
  ministryId: string,
) => {
  if (!requiredGroupId) return
  const result = await client.query(
    `SELECT 1 FROM ministry_groups WHERE id = $1 AND ministry_id = $2 AND status = 'active'`,
    [requiredGroupId, ministryId],
  )
  if (!result.rowCount) {
    throw Object.assign(new Error("Select an active group from this responsibility's ministry"), { status: 400 })
  }
}

const mutateEventResponsibility = async (
  client: PoolClient,
  context: any,
  event: any,
  body: any,
) => {
  if (["cancelled", "completed", "archived"].includes(event.status)) {
    throw Object.assign(
      new Error("Responsibilities cannot be changed for this event"),
      { status: 409 },
    )
  }

  if (body.action === "add_responsibility") {
    const ministryId = cleanText(body.ministryId, 100)
    if (!ministryId) {
      throw Object.assign(new Error("Ministry is required"), { status: 400 })
    }
    await requireMinistryAccess(client, context.user, ministryId, true)
    const participantResult = await client.query(
      `
        SELECT ministry_id
        FROM event_ministries
        WHERE event_id = $1
          AND ministry_id = $2
          AND schedule_status <> 'cancelled'
        FOR UPDATE
      `,
      [event.id, ministryId],
    )
    if (!participantResult.rowCount) {
      throw Object.assign(
        new Error("This ministry is not participating in the event"),
        { status: 400 },
      )
    }

    const input = normalizeEventResponsibility(body)
    await validateRequiredMinistryLevel(
      client,
      input.requiredLevelId,
      ministryId,
    )
    await validateRequiredGroup(
      client,
      input.requiredGroupId,
      ministryId,
    )
    const createdResult = await client.query(
      `
        INSERT INTO event_responsibilities (
          event_id,
          ministry_id,
          template_responsibility_id,
          name,
          responsibility_type,
          quantity_needed,
          approval_required,
          substitution_allowed,
          is_required,
          required_ministry_level_id,
          required_group_id,
          relative_start_minutes,
          instructions,
          sort_order,
          status
        )
        VALUES (
          $1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          (
            SELECT COALESCE(max(sort_order), -1) + 1
            FROM event_responsibilities
            WHERE event_id = $1
              AND ministry_id = $2
          ),
          'open'
        )
        RETURNING *
      `,
      [
        event.id,
        ministryId,
        input.name,
        input.responsibilityType,
        input.quantityNeeded,
        input.approvalRequired,
        input.substitutionAllowed,
        input.isRequired,
        input.requiredLevelId,
        input.requiredGroupId,
        input.relativeStartMinutes,
        input.instructions,
      ],
    )
    const created = createdResult.rows[0]
    await markEventMinistryChanged(client, event.id, ministryId)
    await writeSchedulingAudit(client, context, {
      action: "event_responsibility.created",
      entityType: "event_responsibility",
      entityId: created.id,
      ministryId,
      afterData: created,
      metadata: {
        eventId: event.id,
        source: "event_override",
      },
    })
    return "Responsibility added to this event"
  }

  const responsibilityId = cleanText(body.responsibilityId, 100)
  if (!responsibilityId) {
    throw Object.assign(new Error("Responsibility is required"), {
      status: 400,
    })
  }
  const responsibilityResult = await client.query(
    `
      SELECT
        responsibility.*,
        (
          SELECT count(*)::INT
          FROM responsibility_assignments assignment
          WHERE assignment.responsibility_id = responsibility.id
            AND assignment.status IN (
              'interested', 'pending', 'assigned', 'confirmed',
              'change_requested', 'completed'
            )
        ) AS assigned_quantity
      FROM event_responsibilities responsibility
      WHERE responsibility.id = $1
        AND responsibility.event_id = $2
      FOR UPDATE
    `,
    [responsibilityId, event.id],
  )
  const responsibility = responsibilityResult.rows[0]
  if (!responsibility) {
    throw Object.assign(new Error("Responsibility not found"), {
      status: 404,
    })
  }
  await requireMinistryAccess(
    client,
    context.user,
    responsibility.ministry_id,
    true,
  )
  if (responsibility.status === "cancelled") {
    throw Object.assign(new Error("Responsibility is already cancelled"), {
      status: 409,
    })
  }

  if (body.action === "update_responsibility") {
    const input = normalizeEventResponsibility(body)
    await validateRequiredMinistryLevel(
      client,
      input.requiredLevelId,
      responsibility.ministry_id,
    )
    await validateRequiredGroup(
      client,
      input.requiredGroupId,
      responsibility.ministry_id,
    )
    if (input.quantityNeeded < Number(responsibility.assigned_quantity)) {
      throw Object.assign(
        new Error(
          "Quantity cannot be lower than the number of active assignments",
        ),
        { status: 409 },
      )
    }
    const updatedResult = await client.query(
      `
        UPDATE event_responsibilities
        SET name = $2,
            responsibility_type = $3,
            quantity_needed = $4,
            approval_required = $5,
            substitution_allowed = $6,
            is_required = $7,
            required_ministry_level_id = $8,
            required_group_id = $9,
            relative_start_minutes = $10,
            instructions = $11,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [
        responsibilityId,
        input.name,
        input.responsibilityType,
        input.quantityNeeded,
        input.approvalRequired,
        input.substitutionAllowed,
        input.isRequired,
        input.requiredLevelId,
        input.requiredGroupId,
        input.relativeStartMinutes,
        input.instructions,
      ],
    )
    const updated = updatedResult.rows[0]
    await markEventMinistryChanged(
      client,
      event.id,
      responsibility.ministry_id,
    )
    await writeSchedulingAudit(client, context, {
      action: "event_responsibility.updated",
      entityType: "event_responsibility",
      entityId: responsibilityId,
      ministryId: responsibility.ministry_id,
      beforeData: responsibility,
      afterData: updated,
      metadata: { eventId: event.id },
    })
    return "Event responsibility updated"
  }

  await client.query(
    `
      UPDATE event_responsibilities
      SET status = 'cancelled',
          updated_at = now()
      WHERE id = $1
    `,
    [responsibilityId],
  )
  await client.query(
    `
      UPDATE responsibility_assignments
      SET status = 'cancelled',
          updated_at = now()
      WHERE responsibility_id = $1
        AND status NOT IN ('cancelled', 'completed')
    `,
    [responsibilityId],
  )
  await markEventMinistryChanged(
    client,
    event.id,
    responsibility.ministry_id,
  )
  await writeSchedulingAudit(client, context, {
    action: "event_responsibility.cancelled",
    entityType: "event_responsibility",
    entityId: responsibilityId,
    ministryId: responsibility.ministry_id,
    beforeData: responsibility,
    afterData: { ...responsibility, status: "cancelled" },
    metadata: { eventId: event.id },
  })
  return "Responsibility cancelled and retained in history"
}

const updateEvent = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const eventId = cleanText(body.eventId, 100)
  const eventResult = await client.query(
    `SELECT * FROM events WHERE id = $1 FOR UPDATE`,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) throw Object.assign(new Error("Event not found"), { status: 404 })

  if (
    body.action === "replace_template" &&
    body.updateScope === "this_and_future"
  ) {
    if (!event.recurrence_group_id) {
      throw Object.assign(new Error("This event is not part of a repeating series"), {
        status: 409,
      })
    }
    if (!["owner", "super_admin"].includes(context.user.global_role)) {
      throw Object.assign(
        new Error("Only a Super Admin can change a repeating-event rule"),
        { status: 403 },
      )
    }
    const futureEvents = await client.query(
      `
        SELECT id
        FROM events
        WHERE recurrence_group_id = $1
          AND COALESCE(recurrence_anchor_at, start_time) >= $2
          AND status <> 'archived'
        ORDER BY COALESCE(recurrence_anchor_at, start_time), id
      `,
      [
        event.recurrence_group_id,
        event.recurrence_anchor_at || event.start_time,
      ],
    )
    const nextGroupId = randomUUID()
    const nextRule = {
      ...(event.recurrence_rule || {}),
      effectiveFrom: new Date(event.start_time).toISOString(),
      previousGroupId: event.recurrence_group_id,
    }
    if (futureEvents.rowCount) {
      await client.query(
        `
          UPDATE events
          SET recurrence_group_id = $2,
              recurrence_rule = $3::JSONB,
              recurrence_parent_group_id = $1,
              updated_at = now()
          WHERE id = ANY($4::UUID[])
        `,
        [
          event.recurrence_group_id,
          nextGroupId,
          JSON.stringify(nextRule),
          futureEvents.rows.map((futureEvent) => futureEvent.id),
        ],
      )
    }
    for (const futureEvent of futureEvents.rows) {
      await updateEvent(client, context, {
        ...body,
        eventId: futureEvent.id,
        updateScope: "this_event",
      })
    }
    return {
      message: `Template applied to ${futureEvents.rowCount || 0} future events`,
      eventIds: futureEvents.rows.map((futureEvent) => futureEvent.id),
    }
  }

  if (body.action === "request_substitute") {
    return requestAssignmentSubstitute(client, context, event, body)
  }

  if (body.action === "accept_substitute") {
    return acceptAssignmentSubstitute(client, context, event, body)
  }

  if (body.action === "assign_member") {
    return assignMemberToResponsibility(client, context, event, body)
  }

  if (body.action === "save_assignments") {
    return saveEventAssignments(client, context, event, body)
  }

  if (body.action === "auto_fill_event") {
    const targetMinistryId = cleanText(body.ministryId, 100)
    if (!targetMinistryId) {
      throw Object.assign(new Error("Ministry is required"), { status: 400 })
    }
    await requireMinistryAccess(
      client,
      context.user,
      targetMinistryId,
      true,
    )
    const eventMinistryResult = await client.query(
      `
        SELECT 1
        WHERE $1::UUID = $2::UUID
          OR EXISTS (
            SELECT 1
            FROM event_ministries
            WHERE event_id = $3
              AND ministry_id = $2
          )
          OR EXISTS (
            SELECT 1
            FROM event_responsibilities
            WHERE event_id = $3
              AND ministry_id = $2
          )
      `,
      [event.ministry_id, targetMinistryId, event.id],
    )
    if (!eventMinistryResult.rowCount) {
      throw Object.assign(
        new Error("This ministry does not participate in the event"),
        { status: 409 },
      )
    }
    const schedule = await fillAndReviewAutomaticSchedule(
      client,
      context,
      event.id,
      [],
      targetMinistryId,
      "ministry_overview_auto_fill",
      false,
    )
    return {
      ...schedule,
      shortages: schedule.shortages.filter(
        (shortage) => shortage.ministryId === targetMinistryId,
      ),
    }
  }

  if (body.action === "apply_matching_conflicts") {
    return applyMatchingConflictResolution(client, context, body)
  }

  if (body.action === "record_service_outcome") {
    return recordServiceOutcome(client, context, event, body)
  }

  if (body.action === "configure_volunteer_signup") {
    return configureVolunteerSignup(client, context, event, body)
  }

  if (RESPONSIBILITY_ACTIONS.has(body.action)) {
    return mutateEventResponsibility(client, context, event, body)
  }

  await requireMinistryAccess(client, context.user, event.ministry_id, true)

  if (body.action === "replace_template") {
    const nextTemplateId = cleanText(body.templateId, 100)
    const structure = await loadTemplateStructure(client, nextTemplateId)
    await requireMinistryAccess(
      client,
      context.user,
      structure.template.ministry_id,
      true,
    )
    const currentResponsibilities = await client.query(
      `
        SELECT *
        FROM event_responsibilities
        WHERE event_id = $1
          AND status <> 'cancelled'
        ORDER BY sort_order
      `,
      [eventId],
    )
    const currentByKey = new Map(
      currentResponsibilities.rows.map((responsibility) => [
        [
          responsibility.ministry_id || event.ministry_id,
          responsibility.name.toLowerCase(),
          responsibility.responsibility_type,
        ].join("|"),
        responsibility,
      ]),
    )
    const retainedIds = new Set<string>()
    const added: string[] = []
    const preserved: string[] = []

    for (const responsibility of structure.responsibilities) {
      const key = [
        responsibility.ministry_id,
        responsibility.name.toLowerCase(),
        responsibility.responsibility_type,
      ].join("|")
      const existing = currentByKey.get(key)
      if (existing) {
        retainedIds.add(existing.id)
        preserved.push(existing.name)
        await client.query(
          `
            UPDATE event_responsibilities
            SET template_responsibility_id = $2,
                description = $3,
                quantity_needed = $4,
                approval_required = $5,
                substitution_allowed = $6,
                is_required = $7,
                required_ministry_level_id = $8,
                required_group_id = $9,
                relative_start_minutes = $10,
                instructions = $11,
                sort_order = $12,
                updated_at = now()
            WHERE id = $1
          `,
          [
            existing.id,
            responsibility.id,
            responsibility.description || null,
            Number(responsibility.quantity_needed) || 1,
            Boolean(responsibility.approval_required),
            responsibility.substitution_allowed !== false,
            responsibility.is_required !== false,
            responsibility.required_ministry_level_id || null,
            responsibility.required_group_id || null,
            Number(responsibility.relative_start_minutes) || 0,
            responsibility.instructions || null,
            Number(responsibility.sort_order) || 0,
          ],
        )
      } else {
        added.push(responsibility.name)
        await client.query(
          `
            INSERT INTO event_responsibilities (
              event_id,
              ministry_id,
              template_responsibility_id,
              name,
              description,
              responsibility_type,
              quantity_needed,
              approval_required,
              substitution_allowed,
              is_required,
              required_ministry_level_id,
              required_group_id,
              relative_start_minutes,
              instructions,
              sort_order,
              status
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'open'
            )
          `,
          [
            eventId,
            responsibility.ministry_id,
            responsibility.id,
            responsibility.name,
            responsibility.description || null,
            responsibility.responsibility_type || "position",
            Number(responsibility.quantity_needed) || 1,
            Boolean(responsibility.approval_required),
            responsibility.substitution_allowed !== false,
            responsibility.is_required !== false,
            responsibility.required_ministry_level_id || null,
            responsibility.required_group_id || null,
            Number(responsibility.relative_start_minutes) || 0,
            responsibility.instructions || null,
            Number(responsibility.sort_order) || 0,
          ],
        )
      }
    }

    const removed = currentResponsibilities.rows.filter(
      (responsibility) =>
        responsibility.template_responsibility_id &&
        !retainedIds.has(responsibility.id),
    )
    if (removed.length) {
      const removedIds = removed.map((responsibility) => responsibility.id)
      await client.query(
        `
          UPDATE event_responsibilities
          SET status = 'cancelled', updated_at = now()
          WHERE id = ANY($1::UUID[])
        `,
        [removedIds],
      )
      await client.query(
        `
          UPDATE responsibility_assignments
          SET status = 'cancelled', updated_at = now()
          WHERE responsibility_id = ANY($1::UUID[])
            AND status NOT IN ('cancelled', 'completed')
        `,
        [removedIds],
      )
    }

    const nextMinistryIds = structure.blocks.map(
      (block: any) => block.ministry_id,
    )
    await client.query(
      `
        UPDATE event_ministries
        SET schedule_status = 'cancelled', updated_at = now()
        WHERE event_id = $1
          AND NOT (ministry_id = ANY($2::UUID[]))
      `,
      [eventId, nextMinistryIds],
    )
    for (const block of structure.blocks) {
      const replacedBlock = await client.query(
        `
          INSERT INTO event_ministries (
            event_id,
            ministry_id,
            template_ministry_id,
            is_required,
            schedule_status,
            instructions
          )
          VALUES ($1, $2, $3, $4, 'generated', $5)
          ON CONFLICT (event_id, ministry_id) DO UPDATE SET
            template_ministry_id = excluded.template_ministry_id,
            is_required = excluded.is_required,
            schedule_status = CASE
              WHEN event_ministries.schedule_status = 'cancelled'
                THEN 'generated'
              ELSE event_ministries.schedule_status
            END,
            instructions = excluded.instructions,
            updated_at = now()
          RETURNING id
        `,
        [
          eventId,
          block.ministry_id,
          block.id,
          block.is_required !== false,
          block.instructions || null,
        ],
      )
      await client.query(`DELETE FROM event_ministry_groups WHERE event_ministry_id = $1`, [replacedBlock.rows[0].id])
      for (const groupId of block.group_ids || []) {
        await client.query(`INSERT INTO event_ministry_groups (event_ministry_id, group_id) VALUES ($1, $2)`, [replacedBlock.rows[0].id, groupId])
      }
    }

    await client.query(
      `
        UPDATE events
        SET ministry_id = $2,
            template_id = $3,
            template_version = $4,
            participation_type = $5,
            version = version + 1,
            updated_at = now()
        WHERE id = $1
      `,
      [
        eventId,
        structure.template.ministry_id,
        structure.template.id,
        structure.template.version,
        structure.template.participation_type,
      ],
    )
    if (["volunteers", "both"].includes(structure.template.participation_type)) {
      await ensureDefaultGeneralVolunteer(client, eventId)
    }
    await writeSchedulingAudit(client, context, {
      action: "event.template_replaced",
      entityType: "event",
      entityId: eventId,
      ministryId: structure.template.ministry_id,
      beforeData: {
        templateId: event.template_id,
        templateVersion: event.template_version,
      },
      afterData: {
        templateId: structure.template.id,
        templateVersion: Number(structure.template.version),
        preserved,
        added,
        removed: removed.map((responsibility) => responsibility.name),
      },
    })
    return
  }

  if (body.action === "set_status") {
    const status = cleanText(body.status, 30)
    if (!EVENT_STATUSES.has(status)) {
      throw Object.assign(new Error("Invalid event status"), { status: 400 })
    }
    if (status === "published") {
      const prioryEnabled = await client.query(
        `SELECT enabled FROM priory_integration_settings WHERE setting_key='primary'`,
      )
      if (prioryEnabled.rows[0]?.enabled) {
        const priestResponsibilities = await client.query(
          `SELECT responsibility.id, responsibility.relative_start_minutes,
             COALESCE(responsibility.ministry_id, $2) AS ministry_id,
             assignment.user_id
           FROM event_responsibilities responsibility
           JOIN ministries ministry ON ministry.id=COALESCE(responsibility.ministry_id, $2)
           LEFT JOIN responsibility_assignments assignment
             ON assignment.responsibility_id=responsibility.id
            AND assignment.status NOT IN ('declined','cancelled')
           WHERE responsibility.event_id=$1 AND responsibility.status <> 'cancelled'
             AND ministry.slug='priests'`,
          [eventId, event.ministry_id],
        )
        if (priestResponsibilities.rowCount &&
            priestResponsibilities.rows.some((responsibility) => !responsibility.user_id)) {
          throw Object.assign(
            new Error("Assign an allocated priest before publishing this event"),
            { status: 409, prioryAllocationRequired: true },
          )
        }
        for (const responsibility of priestResponsibilities.rows) {
          await assertPriestAllocation(
            client,
            responsibility.ministry_id,
            responsibility.user_id,
            new Date(
              new Date(event.start_time).getTime() +
                Number(responsibility.relative_start_minutes || 0) * 60_000,
            ),
            new Date(event.end_time),
          )
        }
      }
    }
    await client.query(
      `
      UPDATE events
        SET status = $2,
            published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
            version = version + 1,
            updated_at = now()
        WHERE id = $1
      `,
      [eventId, status],
    )
    await client.query(
      `
        UPDATE event_ministries
        SET schedule_status = CASE
              WHEN $2 = 'published' THEN 'published'
              WHEN $2 = 'cancelled' THEN 'cancelled'
              WHEN $2 = 'completed' THEN 'completed'
              ELSE 'generated'
            END,
            published_by = CASE
              WHEN $2 = 'published' THEN $3
              ELSE published_by
            END,
            published_at = CASE
              WHEN $2 = 'published' THEN now()
              ELSE published_at
            END,
            updated_at = now()
        WHERE event_id = $1
      `,
      [eventId, status, context.user.id],
    )
    if (status === "cancelled") {
      await client.query(
        `
          UPDATE event_responsibilities
          SET status = 'cancelled', updated_at = now()
          WHERE event_id = $1
            AND status <> 'cancelled'
        `,
        [eventId],
      )
      await client.query(
        `
          UPDATE responsibility_assignments
          SET status = 'cancelled', updated_at = now()
          WHERE event_id = $1
            AND status NOT IN ('cancelled', 'completed')
        `,
        [eventId],
      )
    }
    await writeSchedulingAudit(client, context, {
      action: `event.${status}`,
      entityType: "event",
      entityId: eventId,
      ministryId: event.ministry_id,
      beforeData: { status: event.status },
      afterData: { status },
    })
    return
  }

  const title = cleanText(body.title, 250)
  const participationType = PARTICIPATION_TYPES.has(body.participationType)
    ? body.participationType
    : event.participation_type
  const visibility = EVENT_VISIBILITIES.has(body.visibility)
    ? body.visibility
    : event.visibility || "public"
  const start = parseDate(body.startTime, "Start time")
  const end = parseDate(body.endTime, "End time")
  if (!title) {
    throw Object.assign(new Error("Event title is required"), { status: 400 })
  }
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
  }
  const confirmationDeadline = body.confirmationDeadline
    ? parseDate(body.confirmationDeadline, "Confirmation deadline")
    : null
  if (confirmationDeadline && confirmationDeadline >= start) {
    throw Object.assign(
      new Error("Confirmation deadline must be before the event starts"),
      { status: 400 },
    )
  }
  const roomIds = normalizeRoomIds(body.roomIds)
  await validateRoomIds(client, roomIds)
  const updateScope = body.updateScope === "this_and_future"
    ? "this_and_future"
    : "this_event"
  if (updateScope === "this_and_future") {
    if (!event.recurrence_group_id) {
      throw Object.assign(new Error("This event is not part of a repeating series"), {
        status: 409,
      })
    }
    if (!["owner", "super_admin"].includes(context.user.global_role)) {
      throw Object.assign(
        new Error("Only a Super Admin can change a repeating-event rule"),
        { status: 403 },
      )
    }
    const anchor = event.recurrence_anchor_at || event.start_time
    const affectedResult = await client.query(
      `
        SELECT *
        FROM events
        WHERE recurrence_group_id = $1
          AND COALESCE(recurrence_anchor_at, start_time) >= $2
          AND status <> 'archived'
        ORDER BY COALESCE(recurrence_anchor_at, start_time), id
        FOR UPDATE
      `,
      [event.recurrence_group_id, anchor],
    )
    const affected = affectedResult.rows
    const normalizedRule = normalizeRecurrence({
      ...(event.recurrence_rule || {}),
      ...(body.recurrence || {}),
      count: affected.length,
    }, 1)
    if (normalizedRule.frequency === "none") {
      throw Object.assign(new Error("Choose a repeating-event rule"), {
        status: 400,
      })
    }
    const occurrenceStarts = getOccurrenceStarts(start, normalizedRule, 1)
    const duration = end.getTime() - start.getTime()
    const confirmationOffset = confirmationDeadline
      ? confirmationDeadline.getTime() - start.getTime()
      : null
    const nextGroupId = randomUUID()
    const nextRule = {
      ...normalizedRule,
      effectiveFrom: start.toISOString(),
      previousGroupId: event.recurrence_group_id,
    }
    const recurrenceConflictPreview = await previewRecurrenceChange(
      client,
      context,
      body,
    )
    const affectedEventIds = affected.map((item) => item.id)
    const roomConflictGroups = await Promise.all(
      occurrenceStarts.map((occurrenceStart) =>
        findRoomConflicts(
          client,
          roomIds,
          occurrenceStart,
          new Date(occurrenceStart.getTime() + duration),
          affectedEventIds,
        ),
      ),
    )
    const allConflicts = [
      ...recurrenceConflictPreview.conflicts,
      ...roomConflictGroups.flat(),
    ]
    const conflictOverride = body.conflictOverride === true
    if (allConflicts.length && !conflictOverride) {
      throw Object.assign(
        new Error("These changes overlap other events. Fix the schedule or explicitly ignore the warning."),
        { status: 409, conflicts: allConflicts },
      )
    }
    const conflictOverrideReason =
      allConflicts.length && conflictOverride
        ? cleanText(body.conflictOverrideReason, 500) ||
          "Overlap reviewed by ministry administrator"
        : null
    const changedEventIds: string[] = []
    for (const [index, affectedEvent] of affected.entries()) {
      const occurrenceStart = occurrenceStarts[index]
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)
      const nextConfirmationDeadline = confirmationOffset === null
        ? null
        : new Date(occurrenceStart.getTime() + confirmationOffset)
      await client.query(
        `
          UPDATE events
          SET title = $2,
              description = $3,
              location = $4,
              start_time = $5,
              end_time = $6,
              participation_type = $7,
              visibility = $8,
              confirmation_deadline_at = $9,
              recurrence_group_id = $10,
              recurrence_rule = $11::JSONB,
              recurrence_anchor_at = $5,
              recurrence_parent_group_id = $12,
              conflict_override = $13,
              conflict_override_reason = $14,
              conflict_override_by = CASE WHEN $13 THEN $15 ELSE NULL END,
              conflict_override_at = CASE WHEN $13 THEN now() ELSE NULL END,
              signup_open = CASE
                WHEN $7 IN ('volunteers', 'both') THEN signup_open
                ELSE false
              END,
              version = version + 1,
              updated_at = now()
          WHERE id = $1
        `,
        [
          affectedEvent.id,
          title,
          visibility === "private" ? null : cleanText(body.description) || null,
          visibility === "private" ? null : cleanText(body.location, 500) || null,
          occurrenceStart,
          occurrenceEnd,
          participationType,
          visibility,
          nextConfirmationDeadline,
          nextGroupId,
          JSON.stringify(nextRule),
          event.recurrence_group_id,
          allConflicts.length > 0 && conflictOverride,
          conflictOverrideReason,
          context.user.id,
        ],
      )
      await replaceEventRooms(
        client,
        affectedEvent.id,
        roomIds,
        context.actor.id,
      )
      if (
        toChapelDateKey(affectedEvent.start_time) !==
        toChapelDateKey(occurrenceStart)
      ) {
        await client.query(
          `DELETE FROM event_ordo_selections WHERE event_id = $1`,
          [affectedEvent.id],
        )
      }
      if (["volunteers", "both"].includes(participationType)) {
        await ensureDefaultGeneralVolunteer(client, affectedEvent.id)
      }
      await writeSchedulingAudit(client, context, {
        action: "event.recurrence_rule_changed",
        entityType: "event",
        entityId: affectedEvent.id,
        ministryId: affectedEvent.ministry_id,
        beforeData: affectedEvent,
        afterData: {
          title,
          startTime: occurrenceStart,
          endTime: occurrenceEnd,
          recurrenceGroupId: nextGroupId,
          recurrenceRule: nextRule,
          conflictOverride:
            allConflicts.length > 0 && conflictOverride,
          conflictOverrideReason,
          roomIds,
        },
        metadata: {
          effectiveFromEventId: eventId,
          previousRecurrenceGroupId: event.recurrence_group_id,
        },
      })
      changedEventIds.push(affectedEvent.id)
    }
    return {
      message: `${changedEventIds.length} future events updated with the new rule`,
      eventIds: changedEventIds,
    }
  }
  const participantResult = await client.query(
    `SELECT ministry_id FROM event_ministries WHERE event_id = $1`,
    [eventId],
  )
  let ministryIds = Array.from(
    new Set([
      event.ministry_id,
      ...participantResult.rows.map((row) => row.ministry_id),
    ]),
  ).filter(Boolean) as string[]
  ministryIds = await excludeReservationMinistry(client, ministryIds)
  const [scheduleConflicts, roomConflicts] = await Promise.all([
    findEventConflicts(client, ministryIds, start, end, [eventId]),
    findRoomConflicts(client, roomIds, start, end, [eventId]),
  ])
  const conflicts = [...scheduleConflicts, ...roomConflicts]
  const conflictOverride = body.conflictOverride === true
  if (conflicts.length && !conflictOverride) {
    throw Object.assign(
      new Error("This event overlaps another event. Fix the time or explicitly ignore the warning."),
      { status: 409, conflicts },
    )
  }
  const conflictOverrideReason = conflicts.length && conflictOverride
    ? cleanText(body.conflictOverrideReason, 500) || "Overlap reviewed by ministry administrator"
    : null
  const previousOrdoDate = toChapelDateKey(event.start_time)
  const nextOrdoDate = toChapelDateKey(start)
  if (previousOrdoDate !== nextOrdoDate) {
    const previousSelection = await client.query(
      `DELETE FROM event_ordo_selections WHERE event_id = $1 RETURNING *`,
      [eventId],
    )
    if (previousSelection.rowCount) {
      await writeSchedulingAudit(client, context, {
        action: "event.ordo_reset_for_date_change",
        entityType: "event",
        entityId: eventId,
        ministryId: event.ministry_id,
        beforeData: previousSelection.rows[0],
        afterData: {
          previousOrdoDate,
          nextOrdoDate,
        },
      })
    }
  }
  await client.query(
    `
      UPDATE events
      SET title = $2,
          description = $3,
          location = $4,
          start_time = $5,
          end_time = $6,
          participation_type = $7,
          visibility = $8,
          confirmation_deadline_at = $9,
          conflict_override = $10,
          conflict_override_reason = $11,
          conflict_override_by = CASE WHEN $10 THEN $12 ELSE NULL END,
          conflict_override_at = CASE WHEN $10 THEN now() ELSE NULL END,
          signup_open = CASE
            WHEN $7 IN ('volunteers', 'both') THEN signup_open
            ELSE false
          END,
          version = version + 1,
          updated_at = now()
      WHERE id = $1
    `,
    [
      eventId,
      title,
      visibility === "private" ? null : cleanText(body.description) || null,
      visibility === "private" ? null : cleanText(body.location, 500) || null,
      start,
      end,
      participationType,
      visibility,
      confirmationDeadline,
      conflicts.length > 0 && conflictOverride,
      conflictOverrideReason,
      context.user.id,
    ],
  )
  await replaceEventRooms(client, eventId, roomIds, context.actor.id)
  if (["volunteers", "both"].includes(participationType)) {
    await ensureDefaultGeneralVolunteer(client, eventId)
  }
  await writeSchedulingAudit(client, context, {
    action: "event.updated",
    entityType: "event",
    entityId: eventId,
    ministryId: event.ministry_id,
    beforeData: event,
    afterData: {
      title,
      description: visibility === "private" ? null : cleanText(body.description),
      location: visibility === "private" ? null : cleanText(body.location, 500),
      startTime: start,
      endTime: end,
      participationType,
      visibility,
      confirmationDeadline,
      conflictOverride: conflicts.length > 0 && conflictOverride,
      conflictOverrideReason,
      roomIds,
    },
  })
  return { message: "Event updated", eventIds: [eventId] }
}

const previewRecurrenceChange = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  if (!["owner", "super_admin"].includes(context.user.global_role)) {
    throw Object.assign(
      new Error("Only a Super Admin can change a repeating-event rule"),
      { status: 403 },
    )
  }
  const eventId = cleanText(body.eventId, 100)
  const result = await client.query(
    `SELECT * FROM events WHERE id = $1 LIMIT 1`,
    [eventId],
  )
  const event = result.rows[0]
  if (!event?.recurrence_group_id) {
    throw Object.assign(new Error("This event is not part of a repeating series"), {
      status: 409,
    })
  }
  await requireMinistryAccess(client, context.user, event.ministry_id, true)
  const start = parseDate(body.startTime, "Start time")
  const affected = await client.query(
    `
      SELECT event.id, event.title, event.start_time,
        (SELECT count(*) FROM responsibility_assignments assignment
          WHERE assignment.event_id = event.id
            AND assignment.status NOT IN ('declined', 'cancelled'))::INT
          AS assignment_count
      FROM events event
      WHERE event.recurrence_group_id = $1
        AND COALESCE(event.recurrence_anchor_at, event.start_time) >= $2
        AND event.status <> 'archived'
      ORDER BY COALESCE(event.recurrence_anchor_at, event.start_time), event.id
    `,
    [event.recurrence_group_id, event.recurrence_anchor_at || event.start_time],
  )
  const rule = normalizeRecurrence({
    ...(event.recurrence_rule || {}),
    ...(body.recurrence || {}),
    count: affected.rowCount || 1,
  }, 1)
  const dates = getOccurrenceStarts(start, rule, 1)
  const end = parseDate(body.endTime, "End time")
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
  }
  const duration = end.getTime() - start.getTime()
  const affectedIds = affected.rows.map((row) => row.id)
  const conflicts: any[] = []
  for (const date of dates) {
    const proposedEnd = new Date(date.getTime() + duration)
    const conflictResult = await client.query(
      `
        SELECT id, title, start_time, end_time
        FROM events
        WHERE ministry_id = $1
          AND id <> ALL($2::UUID[])
          AND status IN ('draft', 'published')
          AND start_time < $4
          AND end_time > $3
        ORDER BY start_time
        LIMIT 5
      `,
      [event.ministry_id, affectedIds, date, proposedEnd],
    )
    for (const conflict of conflictResult.rows) {
      conflicts.push({
        id: conflict.id,
        title: conflict.title,
        startTime: conflict.start_time,
      })
    }
  }
  const recipients = affectedIds.length
    ? await client.query(
        `
          SELECT count(DISTINCT COALESCE(guardian.guardian_user_id, assignment.user_id))::INT
            AS recipient_count
          FROM responsibility_assignments assignment
          LEFT JOIN managed_profiles guardian
            ON guardian.child_user_id = assignment.user_id
           AND guardian.status IN ('active', 'separation_pending')
          WHERE assignment.event_id = ANY($1::UUID[])
            AND assignment.user_id IS NOT NULL
            AND assignment.status NOT IN ('declined', 'cancelled')
        `,
        [affectedIds],
      )
    : { rows: [{ recipient_count: 0 }] }
  return {
    affectedEvents: affected.rowCount || 0,
    affectedAssignments: affected.rows.reduce(
      (total, row) => total + Number(row.assignment_count || 0),
      0,
    ),
    dates: dates.slice(0, 8).map((date) => date.toISOString()),
    remainingDates: Math.max(0, dates.length - 8),
    conflicts,
    peopleToNotify: Number(recipients.rows[0]?.recipient_count || 0),
    rule,
  }
}

export const handleEvents = async (request: Request) => {
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    const url = new URL(request.url)

    if (request.method === "GET") {
      const eventId = url.searchParams.get("eventId")
      if (eventId) return json(await loadEventDetails(client, context, eventId))
      const ministryId = url.searchParams.get("ministryId")
      if (!ministryId) return json({ message: "Ministry is required" }, 400)
      const [events, rooms] = await Promise.all([
        loadEventList(client, context, ministryId),
        loadActiveRooms(client),
      ])
      return json({ events, rooms })
    }

    const body = await request.json().catch(() => ({}))
    await client.query("BEGIN")
    try {
      if (request.method === "POST") {
        if (body.action === "preview_event_conflicts") {
          const preview = await previewEventConflicts(client, context, body)
          await client.query("COMMIT")
          return json(preview)
        }
        if (body.action === "preview_template_assignments") {
          const preview = await previewTemplateAssignments(client, context, body)
          await client.query("COMMIT")
          return json(preview)
        }
        if (body.action === "preview_matching_conflicts") {
          const preview = await matchingConflictCandidates(
            client,
            context,
            body,
          )
          await client.query("COMMIT")
          return json({
            eligible: preview.eligible,
            skipped: preview.skipped,
          })
        }
        if (body.action === "preview_recurrence_change") {
          const preview = await previewRecurrenceChange(client, context, body)
          await client.query("COMMIT")
          return json(preview)
        }
        if (body.action === "preview_template_change") {
          const preview = await previewTemplateReplacement(
            client,
            context,
            body,
          )
          await client.query("COMMIT")
          return json(preview)
        }
        if (body.action === "clone") {
          const eventId = await cloneEvent(client, context, body)
          await client.query("COMMIT")
          return json({ message: "Event copied as a draft", eventIds: [eventId] }, 201)
        }
        const creation = await createEvents(client, context, body)
        await client.query("COMMIT")
        const publishedEventIds = creation.generatedSchedules
          .filter((schedule) => schedule.published)
          .map((schedule) => schedule.eventId)
        for (const eventId of publishedEventIds) {
          await sendEventScheduleNotifications(eventId, "published").catch(
            (error) => {
              console.error(
                "Generated event published but notifications could not be prepared:",
                error,
              )
            },
          )
        }
        const heldCount = creation.generatedSchedules.filter(
          (schedule) => !schedule.published,
        ).length
        return json(
          {
            message:
              creation.eventIds.length === 1
                ? body.status === "published"
                  ? "Event published"
                  : "Event saved as a draft"
                : heldCount
                  ? `${publishedEventIds.length} repeating events published; ${heldCount} need review`
                  : `${creation.eventIds.length} repeating events created and published`,
            eventIds: creation.eventIds,
            publishedEventIds,
            heldSchedules: creation.generatedSchedules.filter(
              (schedule) => !schedule.published,
            ),
          },
          201,
        )
      }
      if (request.method === "PATCH") {
        const result: any = await updateEvent(client, context, body)
        await client.query("COMMIT")
        for (const eventId of result?.publishedEventIds || []) {
          await sendEventScheduleNotifications(eventId, "published").catch(
            (error) => {
              console.error(
                "Schedule published but notifications could not be prepared:",
                error,
              )
            },
          )
        }
        if (
          body.action === "request_substitute" &&
          result?.substitutionRequestId
        ) {
          await sendSubstitutionRequestNotifications(
            result.substitutionRequestId,
          ).catch((error) => {
            console.error(
              "Substitute requested but notifications could not be prepared:",
              error,
            )
          })
        } else if (
          body.action === "accept_substitute" &&
          result?.substitutionRequestId
        ) {
          await sendSubstitutionAcceptedNotifications(
            result.substitutionRequestId,
          ).catch((error) => {
            console.error(
              "Substitute accepted but notifications could not be prepared:",
              error,
            )
          })
        }
        try {
          if (
            body.action === "set_status" &&
            body.status === "cancelled"
          ) {
            await sendEventScheduleNotifications(body.eventId, "cancelled")
          } else if (
            body.action === "record_service_outcome" &&
            body.outcome === "substitute_served"
          ) {
            await sendEventScheduleNotifications(body.eventId, "substituted")
          }
        } catch (error) {
          console.error(
            "Event saved but its schedule notifications could not be prepared:",
            error,
          )
        }
        return json({
          message:
            (typeof result === "string" ? result : result?.message) ||
            "Event updated",
          eventId: body.eventId,
        })
      }
      await client.query("ROLLBACK")
      return json({ message: "Method not allowed" }, 405)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  } catch (error: any) {
    const status = error?.status || (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    if (status === 500) console.error("Unable to manage events:", error)
    return json(
      {
        message: error?.message || "Unable to manage events",
        conflicts: Array.isArray(error?.conflicts) ? error.conflicts : undefined,
        prioryAllocationRequired: Boolean(error?.prioryAllocationRequired),
        requestedPriestId: error?.requestedPriestId || null,
      },
      status,
    )
  } finally {
    client.release()
  }
}
