import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import { sendAssignmentChangeRequestedNotification } from "../notifications/assignment-notifications"
import {
  getIdentityContext,
  requireMinistryAccess,
  writeSchedulingAudit,
} from "./authorization"
import { syncFutureAllMemberAssignmentsForMinistry } from "./events"
import {
  eventFits,
  loadAvailabilityConfiguration,
  monthAvailabilityDays,
} from "./availability-rules"

const ASSIGNED_DUTY_STATUSES = [
  "assigned",
  "confirmed",
  "change_requested",
]
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_BLOCK_DAYS = 366
const chapelDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const toDateKey = (value: string | Date) => {
  const parts = chapelDateFormatter.formatToParts(new Date(value))
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

const toDateKeyInTimezone = (value: string | Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

const toStoredDateKey = (value: string | Date) => {
  if (typeof value === "string") {
    const dateKey = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (dateKey) return dateKey
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

const parseDateKey = (value: unknown, fieldName: string) => {
  const dateKey = typeof value === "string" ? value.trim() : ""
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  if (
    !DATE_KEY_PATTERN.test(dateKey) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateKey
  ) {
    throw Object.assign(new Error(`${fieldName} is invalid`), { status: 400 })
  }
  return { dateKey, date }
}

const cleanText = (value: unknown, maximum = 250) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const normalizeAvailabilityRule = (body: any) => {
  const ministryIds: string[] = Array.from(new Set<string>(
    (Array.isArray(body.ministryIds) ? body.ministryIds : [])
      .map((value: unknown) => cleanText(value, 100))
      .filter(Boolean),
  ))
  if (!ministryIds.length) {
    throw Object.assign(new Error("Choose at least one ministry"), {
      status: 400,
    })
  }
  const dayOfWeek = Number(body.dayOfWeek)
  const occurrence = ["every", "first", "second", "third", "fourth", "last"]
    .includes(body.occurrence)
    ? body.occurrence
    : "every"
  const allDay = body.allDay === true
  const startTime = allDay ? "" : cleanText(body.startTime, 5)
  const endTime = allDay ? "" : cleanText(body.endTime, 5)
  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    (!allDay && (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
      Number(startTime.slice(3, 5)) % 15 !== 0 ||
      Number(endTime.slice(3, 5)) % 15 !== 0 ||
      endTime <= startTime
    ))
  ) {
    throw Object.assign(new Error("Choose a valid day and time"), {
      status: 400,
    })
  }
  return { ministryIds, dayOfWeek, occurrence, allDay, startTime, endTime }
}

const loadAssignments = async (
  client: PoolClient,
  userId: string,
  ministryId: string | null = null,
) => {
  const result = await client.query(
    `
      SELECT
        assignment.id,
        assignment.event_id,
        assignment.status,
        event.title AS event_title,
        event.start_time,
        event.end_time,
        responsibility.name AS responsibility_name,
        responsibility.assignment_mode,
        ministry.id AS ministry_id,
        ministry.name AS ministry_name,
        change_request.id AS change_request_id,
        change_request.status AS change_request_status
      FROM responsibility_assignments assignment
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      JOIN events event ON event.id = assignment.event_id
      JOIN ministries ministry
        ON ministry.id = COALESCE(responsibility.ministry_id, event.ministry_id)
      LEFT JOIN assignment_change_requests change_request
        ON change_request.assignment_id = assignment.id
       AND change_request.status = 'pending'
      WHERE assignment.user_id = $1
        AND assignment.status = ANY($2)
        AND event.status = 'published'
        AND ($3::UUID IS NULL OR ministry.id = $3::UUID)
      ORDER BY event.start_time, lower(responsibility.name)
    `,
    [userId, ASSIGNED_DUTY_STATUSES, ministryId],
  )

  return result.rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    status: row.status,
    eventTitle: row.event_title,
    startTime: row.start_time,
    endTime: row.end_time,
    date: toDateKey(row.start_time),
    responsibilityName: row.responsibility_name,
    assignmentMode: row.assignment_mode || "standard",
    ministryId: row.ministry_id,
    ministryName: row.ministry_name,
    changeRequestId: row.change_request_id,
    changeRequestStatus: row.change_request_status,
  }))
}

const loadBlocks = async (
  client: PoolClient,
  userId: string,
  ministryId: string | null = null,
) => {
  const result = await client.query(
    `
      SELECT
        block.id,
        block.start_date,
        block.end_date,
        block.label,
        block.ministry_id,
        ministry.name AS ministry_name,
        block.created_at,
        block.updated_at
      FROM availability_blocks block
      LEFT JOIN ministries ministry ON ministry.id = block.ministry_id
      WHERE block.user_id = $1
        AND block.status = 'active'
        AND (
          $2::UUID IS NULL
          OR block.ministry_id IS NULL
          OR block.ministry_id = $2::UUID
        )
      ORDER BY block.start_date, block.end_date, block.created_at
    `,
    [userId, ministryId],
  )
  return result.rows.map((row) => ({
    id: row.id,
    startDate: toStoredDateKey(row.start_date),
    endDate: toStoredDateKey(row.end_date),
    label: row.label || "",
    ministryId: row.ministry_id || "",
    ministryName: row.ministry_name || "All ministries",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

const createBlock = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  body: any,
  subjectUserId = context.user.id,
  forcedMinistryId: string | null = null,
) => {
  const ministryId = forcedMinistryId || cleanText(body.ministryId, 100) || null
  let ministryName = "All ministries"
  if (ministryId) {
    const ministryResult = await client.query(
      `
        SELECT ministry.name
        FROM ministry_members membership
        JOIN ministries ministry ON ministry.id = membership.ministry_id
        WHERE membership.user_id = $1
          AND membership.ministry_id = $2
          AND membership.status = 'active'
        LIMIT 1
      `,
      [subjectUserId, ministryId],
    )
    if (!ministryResult.rowCount) {
      throw Object.assign(new Error("Choose one of your active ministries"), {
        status: 403,
      })
    }
    ministryName = ministryResult.rows[0].name
  }
  const { dateKey: startDate, date: start } = parseDateKey(
    body.startDate,
    "Start date",
  )
  const { dateKey: endDate, date: end } = parseDateKey(
    body.endDate,
    "End date",
  )
  const today = toDateKey(new Date())
  const duration =
    Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1

  if (end < start) {
    throw Object.assign(new Error("End date must be on or after start date"), {
      status: 400,
    })
  }
  if (startDate < today) {
    throw Object.assign(new Error("Availability can only be changed for today or later"), {
      status: 400,
    })
  }
  if (duration > MAX_BLOCK_DAYS) {
    throw Object.assign(
      new Error(`An availability block cannot exceed ${MAX_BLOCK_DAYS} days`),
      { status: 400 },
    )
  }

  const assignments = await loadAssignments(client, subjectUserId)
  const overlapping = await client.query(
    `
      SELECT id, start_date, end_date
      FROM availability_blocks
      WHERE user_id = $1
        AND status = 'active'
        AND start_date <= $3::DATE
        AND end_date >= $2::DATE
        AND (
          (ministry_id IS NULL AND $4::UUID IS NULL)
          OR ministry_id = $4::UUID
        )
      FOR UPDATE
    `,
    [subjectUserId, startDate, endDate, ministryId],
  )
  let mergedStart = startDate
  let mergedEnd = endDate
  for (const block of overlapping.rows) {
    const blockStart = toStoredDateKey(block.start_date)
    const blockEnd = toStoredDateKey(block.end_date)
    if (blockStart < mergedStart) mergedStart = blockStart
    if (blockEnd > mergedEnd) mergedEnd = blockEnd
  }

  const conflicts = assignments.filter(
    (assignment) =>
      assignment.date >= mergedStart &&
      assignment.date <= mergedEnd &&
      (!ministryId || assignment.ministryId === ministryId),
  )
  if (body.requireConflictFree === true && conflicts.length) {
    return {
      message:
        conflicts.length === 1
          ? "This range contains an assigned duty. Request a change before updating availability."
          : `This range contains ${conflicts.length} assigned duties. Request changes before updating availability.`,
      blocks: [],
      conflicts,
      updated: false,
    }
  }
  if (body.previewOnly === true) {
    return { message: "Availability checked", blocks: [], conflicts, updated: false }
  }
  if (conflicts.length && body.requestChanges !== true) {
    throw Object.assign(
      new Error("Confirm that change requests should be sent for assigned duties"),
      { status: 409 },
    )
  }
  const changeRequestedAssignmentIds = []
  for (const assignment of conflicts) {
    if (assignment.assignmentMode === "all_available_members") {
      await client.query(
        `UPDATE responsibility_assignments SET status = 'cancelled', updated_at = now() WHERE id = $1`,
        [assignment.id],
      )
      continue
    }
    const change = await requestAssignmentChange(client, context, {
      assignmentId: assignment.id,
      reason: `Availability marked unavailable from ${mergedStart} through ${mergedEnd}.`,
    }, subjectUserId)
    if (change.created) changeRequestedAssignmentIds.push(assignment.id)
  }

  const segments = [{ startDate: mergedStart, endDate: mergedEnd }]
  const label = cleanText(body.label) || null
  const createdBlocks = []

  if (overlapping.rowCount) {
    await client.query(
      `
        UPDATE availability_blocks
        SET status = 'cancelled',
            cancelled_by = $2,
            cancelled_at = now(),
            updated_at = now()
        WHERE id = ANY($1)
      `,
      [overlapping.rows.map((block) => block.id), context.actor.id],
    )
  }

  for (const segment of segments) {
    const result = await client.query(
      `
        INSERT INTO availability_blocks (
          user_id, ministry_id, start_date, end_date, label, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, ministry_id, start_date, end_date, label, created_at, updated_at
      `,
      [
        subjectUserId,
        ministryId,
        segment.startDate,
        segment.endDate,
        label,
        context.actor.id,
      ],
    )
    const block = result.rows[0]
    createdBlocks.push({
      id: block.id,
      startDate: toStoredDateKey(block.start_date),
      endDate: toStoredDateKey(block.end_date),
      label: block.label || "",
      ministryId: block.ministry_id || "",
      ministryName,
      createdAt: block.created_at,
      updatedAt: block.updated_at,
    })
    await writeSchedulingAudit(client, context, {
      action: "availability.block_created",
      entityType: "availability_block",
      entityId: block.id,
      afterData: {
        startDate: toStoredDateKey(block.start_date),
        endDate: toStoredDateKey(block.end_date),
        label: block.label,
        ministryId: block.ministry_id,
      },
      metadata: {
        replacedBlockIds: overlapping.rows.map((item) => item.id),
        subjectUserId,
      },
    })
  }

  const ministriesToSync = ministryId
    ? [ministryId]
    : (
        await client.query(
          `SELECT ministry_id FROM ministry_members WHERE user_id = $1 AND status = 'active'`,
          [subjectUserId],
        )
      ).rows.map((membership) => membership.ministry_id)
  for (const affectedMinistryId of new Set(ministriesToSync)) {
    await syncFutureAllMemberAssignmentsForMinistry(
      client,
      context,
      affectedMinistryId,
    )
  }

  return {
    message: changeRequestedAssignmentIds.length
      ? `Availability blocked and ${changeRequestedAssignmentIds.length} ${changeRequestedAssignmentIds.length === 1 ? "change request was" : "change requests were"} sent`
      : "Availability blocked",
    blocks: createdBlocks,
    conflicts,
    updated: createdBlocks.length > 0,
    changeRequestedAssignmentIds,
  }
}

const cancelBlock = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  body: any,
  subjectUserId = context.user.id,
  forcedMinistryId: string | null = null,
) => {
  const blockId = typeof body.blockId === "string" ? body.blockId : ""
  const blockResult = await client.query(
    `
      SELECT id, ministry_id, start_date, end_date, label
      FROM availability_blocks
      WHERE id = $1
        AND user_id = $2
        AND ($3::UUID IS NULL OR ministry_id = $3::UUID)
        AND status = 'active'
      LIMIT 1
      FOR UPDATE
    `,
    [blockId, subjectUserId, forcedMinistryId],
  )
  const block = blockResult.rows[0]
  if (!block) {
    throw Object.assign(new Error("Availability block not found"), {
      status: 404,
    })
  }

  await client.query(
    `
      UPDATE availability_blocks
      SET status = 'cancelled',
          cancelled_by = $2,
          cancelled_at = now(),
          updated_at = now()
      WHERE id = $1
    `,
    [block.id, context.actor.id],
  )
  await writeSchedulingAudit(client, context, {
    action: "availability.block_cancelled",
    entityType: "availability_block",
    entityId: block.id,
    beforeData: {
      startDate: toStoredDateKey(block.start_date),
      endDate: toStoredDateKey(block.end_date),
      label: block.label,
      ministryId: block.ministry_id,
    },
  })
  const ministriesToSync = block.ministry_id
    ? [block.ministry_id]
    : (
        await client.query(
          `SELECT ministry_id FROM ministry_members WHERE user_id = $1 AND status = 'active'`,
          [subjectUserId],
        )
      ).rows.map((membership) => membership.ministry_id)
  for (const affectedMinistryId of new Set(ministriesToSync)) {
    await syncFutureAllMemberAssignmentsForMinistry(
      client,
      context,
      affectedMinistryId,
    )
  }
  return { message: "Availability block removed" }
}

const updateBlock = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  body: any,
) => {
  const blockId = cleanText(body.blockId, 100)
  const existing = await client.query(
    `
      SELECT id
      FROM availability_blocks
      WHERE id = $1
        AND user_id = $2
        AND status = 'active'
      LIMIT 1
      FOR UPDATE
    `,
    [blockId, context.user.id],
  )
  if (!existing.rowCount) {
    throw Object.assign(new Error("Unavailable date range was not found"), {
      status: 404,
    })
  }
  await client.query(
    `
      UPDATE availability_blocks
      SET status = 'cancelled', cancelled_by = $2,
        cancelled_at = now(), updated_at = now()
      WHERE id = $1
    `,
    [blockId, context.actor.id],
  )
  const result = await createBlock(client, context, body)
  return { ...result, message: "Unavailable date range updated" }
}

async function requestAssignmentChange(
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  body: any,
  subjectUserId = context.user.id,
) {
  const assignmentId =
    typeof body.assignmentId === "string" ? body.assignmentId : ""
  const assignmentResult = await client.query(
    `
      SELECT
        assignment.id,
        assignment.status,
        assignment.event_id,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id
      FROM responsibility_assignments assignment
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      JOIN events event ON event.id = assignment.event_id
      WHERE assignment.id = $1
        AND assignment.user_id = $2
        AND assignment.status = ANY($3)
        AND event.status = 'published'
      LIMIT 1
      FOR UPDATE
    `,
    [assignmentId, subjectUserId, ASSIGNED_DUTY_STATUSES],
  )
  const assignment = assignmentResult.rows[0]
  if (!assignment) {
    throw Object.assign(new Error("Active assignment not found"), {
      status: 404,
    })
  }

  const existing = await client.query(
    `
      SELECT id
      FROM assignment_change_requests
      WHERE assignment_id = $1
        AND status = 'pending'
      LIMIT 1
    `,
    [assignment.id],
  )
  if (existing.rowCount) {
    return {
      message: "A change has already been requested for this duty",
      changeRequestId: existing.rows[0].id,
      assignmentId: assignment.id,
      created: false,
      changeRequestedAssignmentIds: [],
    }
  }

  const reason = cleanText(body.reason, 1000) || null
  const requestResult = await client.query(
    `
      INSERT INTO assignment_change_requests (
        assignment_id,
        subject_user_id,
        requested_by_user_id,
        reason
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [assignment.id, subjectUserId, context.actor.id, reason],
  )
  await client.query(
    `
      UPDATE responsibility_assignments
      SET status = 'change_requested', updated_at = now()
      WHERE id = $1
    `,
    [assignment.id],
  )
  await writeSchedulingAudit(client, context, {
    action: "assignment.change_requested",
    entityType: "responsibility_assignment",
    entityId: assignment.id,
    ministryId: assignment.ministry_id,
    beforeData: { status: assignment.status },
    afterData: { status: "change_requested" },
    metadata: {
      changeRequestId: requestResult.rows[0].id,
      eventId: assignment.event_id,
      reason,
      notificationStatus: "delivery_requested",
    },
  })
  return {
    message: "Change request recorded",
    changeRequestId: requestResult.rows[0].id,
    assignmentId: assignment.id,
    created: true,
    changeRequestedAssignmentIds: [assignment.id],
  }
}

const loadManagedMembers = async (
  client: PoolClient,
  ministryId: string,
) => {
  const result = await client.query(
    `
      SELECT user_account.id, user_account.first_name, user_account.last_name
      FROM ministry_members membership
      JOIN ministry_accounts user_account ON user_account.id = membership.user_id
      WHERE membership.ministry_id = $1
        AND membership.status = 'active'
        AND user_account.status = 'active'
      ORDER BY lower(user_account.first_name), lower(user_account.last_name), user_account.id
    `,
    [ministryId],
  )
  return result.rows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
  }))
}

const resolveManagedSubjects = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  ministryId: string,
  requestedIds: unknown,
) => {
  await requireMinistryAccess(client, context.user, ministryId, true)
  const ids = Array.from(
    new Set(
      (Array.isArray(requestedIds) ? requestedIds : [requestedIds])
        .map((value) => cleanText(value, 100))
        .filter(Boolean),
    ),
  )
  if (!ids.length) {
    throw Object.assign(new Error("Choose at least one ministry member"), {
      status: 400,
    })
  }
  const result = await client.query(
    `
      SELECT user_id
      FROM ministry_members
      WHERE ministry_id = $1
        AND user_id = ANY($2::UUID[])
        AND status = 'active'
    `,
    [ministryId, ids],
  )
  if (result.rowCount !== ids.length) {
    throw Object.assign(
      new Error("Availability can only be managed for active members of this ministry"),
      { status: 403 },
    )
  }
  return ids
}

export const handleAvailability = async (request: Request) => {
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    if (request.method === "GET") {
      const url = new URL(request.url)
      const managedMinistryId = cleanText(url.searchParams.get("ministryId"), 100)
      const requestedSubjectId = cleanText(url.searchParams.get("subjectUserId"), 100)
      let subjectUserId = context.user.id
      let managedMembers: any[] = []
      if (managedMinistryId) {
        const access = await requireMinistryAccess(
          client,
          context.user,
          managedMinistryId,
          false,
        )
        if (access.canManage) {
          managedMembers = await loadManagedMembers(client, managedMinistryId)
          if (requestedSubjectId) {
            await resolveManagedSubjects(
              client,
              context,
              managedMinistryId,
              [requestedSubjectId],
            )
            subjectUserId = requestedSubjectId
          }
        }
      }
      const subjectResult = await client.query(
        `SELECT id, first_name, last_name FROM ministry_accounts WHERE id = $1 LIMIT 1`,
        [subjectUserId],
      )
      const subject = subjectResult.rows[0] || context.user
      const [blocks, assignments, ministriesResult] = await Promise.all([
        loadBlocks(
          client,
          subjectUserId,
          subjectUserId === context.user.id ? null : managedMinistryId || null,
        ),
        loadAssignments(
          client,
          subjectUserId,
          subjectUserId === context.user.id ? null : managedMinistryId || null,
        ),
        client.query(
          `
            SELECT ministry.id, ministry.name
            FROM ministry_members membership
            JOIN ministries ministry ON ministry.id = membership.ministry_id
            WHERE membership.user_id = $1
              AND membership.status = 'active'
            ORDER BY lower(ministry.name)
          `,
          [context.user.id],
        ),
      ])
      const availabilityMinistryId = cleanText(
        url.searchParams.get("availabilityMinistryId"),
        100,
      ) || managedMinistryId || ministriesResult.rows[0]?.id || ""
      const configuration = availabilityMinistryId
        ? await loadAvailabilityConfiguration(
            client,
            subjectUserId,
            availabilityMinistryId,
          )
        : null
      const availabilityRulesResult = ministriesResult.rows.length
        ? await client.query(
            `SELECT rule.id, rule.ministry_id, ministry.name AS ministry_name,
                    rule.day_of_week, rule.week_of_month,
                    rule.start_time, rule.end_time
             FROM availability_weekly_rules rule
             JOIN ministries ministry ON ministry.id = rule.ministry_id
             WHERE rule.user_id = $1
               AND rule.ministry_id = ANY($2::UUID[])
               AND rule.status = 'active'
             ORDER BY rule.day_of_week, rule.start_time, lower(ministry.name)`,
            [subjectUserId, ministriesResult.rows.map((ministry) => ministry.id)],
          )
        : { rows: [] }
      const requestedMonth =
        cleanText(url.searchParams.get("month"), 7) || toDateKey(new Date()).slice(0, 7)
      let effectiveDays: any[] = []
      if (configuration) {
        try {
          effectiveDays = monthAvailabilityDays(requestedMonth, configuration)
        } catch (error) {
          throw Object.assign(new Error("Month is invalid"), { status: 400 })
        }
      }
      return json({
        user: {
          id: subject.id,
          firstName: subject.first_name,
          lastName: subject.last_name,
        },
        blocks,
        assignments,
        ministries: ministriesResult.rows,
        managedMembers,
        managedMinistryId,
        availabilityMinistryId,
        policy: configuration?.policy || "generally_available",
        timezone: configuration?.timezone || "America/New_York",
        weeklyRules: (configuration?.rules || []).map((rule: any) => ({
          id: rule.id,
          dayOfWeek: Number(rule.day_of_week),
          occurrence: rule.week_of_month || "every",
          startTime: rule.start_time ? String(rule.start_time).slice(0, 5) : "",
          endTime: rule.end_time ? String(rule.end_time).slice(0, 5) : "",
          allDay: !rule.start_time,
        })),
        availabilityRules: availabilityRulesResult.rows.map((rule: any) => ({
          id: rule.id,
          ministryId: rule.ministry_id,
          ministryName: rule.ministry_name,
          dayOfWeek: Number(rule.day_of_week),
          occurrence: rule.week_of_month || "every",
          startTime: rule.start_time ? String(rule.start_time).slice(0, 5) : "",
          endTime: rule.end_time ? String(rule.end_time).slice(0, 5) : "",
          allDay: !rule.start_time,
        })),
        dateOverrides: (configuration?.overrides || []).map((override: any) => ({
          id: override.id,
          date: toStoredDateKey(override.override_date),
          preference: override.preference,
          startTime: override.start_time ? String(override.start_time).slice(0, 5) : "",
          endTime: override.end_time ? String(override.end_time).slice(0, 5) : "",
          partial: override.preference === "available" && Boolean(override.start_time),
        })),
        effectiveDays,
        today: toDateKeyInTimezone(
          new Date(),
          configuration?.timezone || "America/New_York",
        ),
      })
    }
    if (request.method !== "POST") {
      return json({ message: "Method not allowed" }, 405, { Allow: "GET, POST" })
    }

    const body = await request.json().catch(() => ({}))
    await client.query("BEGIN")
    try {
      let result: any
      if (body.action === "create_availability_rule") {
        const {
          ministryIds,
          dayOfWeek,
          occurrence,
          allDay,
          startTime,
          endTime,
        } = normalizeAvailabilityRule(body)
        let created = 0
        for (const ministryId of ministryIds) {
          await requireMinistryAccess(client, context.user, ministryId, false)
          const membership = await client.query(
            `SELECT id FROM ministry_members
             WHERE user_id = $1 AND ministry_id = $2 AND status = 'active'
             LIMIT 1 FOR UPDATE`,
            [context.user.id, ministryId],
          )
          if (!membership.rowCount) {
            throw Object.assign(new Error("Rules can only be created for ministries you belong to"), {
              status: 403,
            })
          }
          await client.query(
            `UPDATE ministry_members
             SET availability_policy = 'generally_available', updated_at = now()
             WHERE id = $1`,
            [membership.rows[0].id],
          )
          const existing = await client.query(
            `SELECT id FROM availability_weekly_rules
             WHERE user_id = $1 AND ministry_id = $2 AND day_of_week = $3
               AND week_of_month = $4
               AND start_time IS NOT DISTINCT FROM $5::TIME
               AND end_time IS NOT DISTINCT FROM $6::TIME
               AND status = 'active'
             LIMIT 1`,
            [context.user.id, ministryId, dayOfWeek, occurrence, allDay ? null : startTime, allDay ? null : endTime],
          )
          if (!existing.rowCount) {
            const inserted = await client.query(
              `INSERT INTO availability_weekly_rules (
                 user_id, ministry_id, day_of_week, week_of_month,
                 start_time, end_time
               ) VALUES ($1, $2, $3, $4, $5::TIME, $6::TIME)
               RETURNING id`,
              [context.user.id, ministryId, dayOfWeek, occurrence, allDay ? null : startTime, allDay ? null : endTime],
            )
            await writeSchedulingAudit(client, context, {
              action: "availability.rule_created",
              entityType: "availability_weekly_rule",
              entityId: inserted.rows[0].id,
              ministryId,
              afterData: {
                dayOfWeek,
                occurrence,
                startTime: allDay ? null : startTime,
                endTime: allDay ? null : endTime,
              },
            })
            created += 1
          }
          await syncFutureAllMemberAssignmentsForMinistry(client, context, ministryId)
        }
        result = {
          message: created
            ? "Exclusion rule created"
            : "That exclusion rule already exists",
        }
      } else if (body.action === "update_availability_rule") {
        const ruleIds: string[] = Array.from(new Set<string>(
          (Array.isArray(body.ruleIds) ? body.ruleIds : [body.ruleId])
            .map((value: unknown) => cleanText(value, 100))
            .filter(Boolean),
        ))
        if (!ruleIds.length) {
          throw Object.assign(new Error("Choose an exclusion rule"), {
            status: 400,
          })
        }
        const previous = await client.query(
          `SELECT id, ministry_id
           FROM availability_weekly_rules
           WHERE id = ANY($1::UUID[]) AND user_id = $2 AND status = 'active'
           FOR UPDATE`,
          [ruleIds, context.user.id],
        )
        if (previous.rowCount !== ruleIds.length) {
          throw Object.assign(new Error("Availability rule was not found"), {
            status: 404,
          })
        }
        const {
          ministryIds,
          dayOfWeek,
          occurrence,
          allDay,
          startTime,
          endTime,
        } = normalizeAvailabilityRule(body)
        for (const ministryId of ministryIds) {
          await requireMinistryAccess(client, context.user, ministryId, false)
          const membership = await client.query(
            `SELECT id FROM ministry_members
             WHERE user_id = $1 AND ministry_id = $2 AND status = 'active'
             LIMIT 1 FOR UPDATE`,
            [context.user.id, ministryId],
          )
          if (!membership.rowCount) {
            throw Object.assign(new Error("Rules can only be created for ministries you belong to"), {
              status: 403,
            })
          }
        }
        await client.query(
          `UPDATE availability_weekly_rules
           SET status = 'cancelled', updated_at = now()
           WHERE id = ANY($1::UUID[])`,
          [ruleIds],
        )
        for (const ministryId of ministryIds) {
          const duplicate = await client.query(
            `SELECT id FROM availability_weekly_rules
             WHERE user_id = $1 AND ministry_id = $2 AND day_of_week = $3
               AND week_of_month = $4
               AND start_time IS NOT DISTINCT FROM $5::TIME
               AND end_time IS NOT DISTINCT FROM $6::TIME
               AND status = 'active'
             LIMIT 1`,
            [context.user.id, ministryId, dayOfWeek, occurrence, allDay ? null : startTime, allDay ? null : endTime],
          )
          if (!duplicate.rowCount) {
            const inserted = await client.query(
              `INSERT INTO availability_weekly_rules (
                 user_id, ministry_id, day_of_week, week_of_month,
                 start_time, end_time
               ) VALUES ($1, $2, $3, $4, $5::TIME, $6::TIME)
               RETURNING id`,
              [context.user.id, ministryId, dayOfWeek, occurrence, allDay ? null : startTime, allDay ? null : endTime],
            )
            await writeSchedulingAudit(client, context, {
              action: "availability.rule_updated",
              entityType: "availability_weekly_rule",
              entityId: inserted.rows[0].id,
              ministryId,
              afterData: {
                dayOfWeek,
                occurrence,
                startTime: allDay ? null : startTime,
                endTime: allDay ? null : endTime,
              },
              metadata: { replacedRuleIds: ruleIds },
            })
          }
        }
        const affectedMinistryIds = new Set([
          ...previous.rows.map((rule) => rule.ministry_id),
          ...ministryIds,
        ])
        for (const ministryId of affectedMinistryIds) {
          await syncFutureAllMemberAssignmentsForMinistry(client, context, ministryId)
        }
        result = { message: "Exclusion rule updated" }
      } else if (body.action === "delete_availability_rule") {
        const ruleIds: string[] = Array.from(new Set<string>(
          (Array.isArray(body.ruleIds) ? body.ruleIds : [body.ruleId])
            .map((value: unknown) => cleanText(value, 100))
            .filter(Boolean),
        ))
        if (!ruleIds.length) {
          throw Object.assign(new Error("Choose an exclusion rule"), {
            status: 400,
          })
        }
        const existing = await client.query(
          `SELECT id, ministry_id
           FROM availability_weekly_rules
           WHERE id = ANY($1::UUID[]) AND user_id = $2 AND status = 'active'
           FOR UPDATE`,
          [ruleIds, context.user.id],
        )
        if (existing.rowCount !== ruleIds.length) {
          throw Object.assign(new Error("Availability rule was not found"), {
            status: 404,
          })
        }
        const affectedMinistryIds = Array.from(new Set<string>(
          existing.rows.map((rule) => rule.ministry_id),
        ))
        for (const ministryId of affectedMinistryIds) {
          await requireMinistryAccess(client, context.user, ministryId, false)
        }
        await client.query(
          `UPDATE availability_weekly_rules
           SET status = 'cancelled', updated_at = now()
           WHERE id = ANY($1::UUID[])`,
          [ruleIds],
        )
        for (const rule of existing.rows) {
          await writeSchedulingAudit(client, context, {
            action: "availability.rule_deleted",
            entityType: "availability_weekly_rule",
            entityId: rule.id,
            ministryId: rule.ministry_id,
          })
        }
        for (const ministryId of affectedMinistryIds) {
          await syncFutureAllMemberAssignmentsForMinistry(client, context, ministryId)
        }
        result = { message: "Exclusion rule removed" }
      } else if (body.action === "save_weekly_rules") {
        const ministryIds: string[] = Array.from(new Set<string>(
          (Array.isArray(body.ministryIds) ? body.ministryIds : [body.ministryId])
            .map((value: unknown) => cleanText(value, 100))
            .filter(Boolean),
        ))
        if (!ministryIds.length) {
          throw Object.assign(new Error("Choose at least one ministry"), {
            status: 400,
          })
        }
        const policy = "generally_available"
        const rules = Array.isArray(body.rules) ? body.rules : []
        if (rules.length > 50) {
          throw Object.assign(new Error("Use no more than 50 exclusion rules"), {
            status: 400,
          })
        }
        const normalizedRules = rules.map((rule: any) => {
          const dayOfWeek = Number(rule.dayOfWeek)
          const occurrence = ["every", "first", "second", "third", "fourth", "last"]
            .includes(rule.occurrence)
            ? rule.occurrence
            : "every"
          const allDay = rule.allDay === true
          const startTime = allDay ? "" : cleanText(rule.startTime, 5)
          const endTime = allDay ? "" : cleanText(rule.endTime, 5)
          if (
            !Number.isInteger(dayOfWeek) ||
            dayOfWeek < 0 ||
            dayOfWeek > 6 ||
            (!allDay && (
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
              Number(startTime.slice(3, 5)) % 15 !== 0 ||
              Number(endTime.slice(3, 5)) % 15 !== 0 ||
              endTime <= startTime
            ))
          ) {
            throw Object.assign(new Error("Every exclusion rule needs a valid day and time"), {
              status: 400,
            })
          }
          return {
            dayOfWeek,
            occurrence,
            startTime: allDay ? null : startTime,
            endTime: allDay ? null : endTime,
          }
        })
        for (const ministryId of ministryIds) {
          await requireMinistryAccess(client, context.user, ministryId, false)
          const membership = await client.query(
            `SELECT id FROM ministry_members
             WHERE user_id = $1 AND ministry_id = $2 AND status = 'active'
             LIMIT 1 FOR UPDATE`,
            [context.user.id, ministryId],
          )
          if (!membership.rowCount) {
            throw Object.assign(new Error("Rules can only be saved for ministries you belong to"), {
              status: 403,
            })
          }
          await client.query(
            `UPDATE ministry_members SET availability_policy = $1, updated_at = now()
             WHERE id = $2`,
            [policy, membership.rows[0].id],
          )
          await client.query(
            `UPDATE availability_weekly_rules SET status = 'cancelled', updated_at = now()
             WHERE user_id = $1 AND ministry_id = $2 AND status = 'active'`,
            [context.user.id, ministryId],
          )
          for (const rule of normalizedRules) {
            await client.query(
              `INSERT INTO availability_weekly_rules (
                 user_id, ministry_id, day_of_week, week_of_month,
                 start_time, end_time
               ) VALUES ($1, $2, $3, $4, $5::TIME, $6::TIME)`,
              [context.user.id, ministryId, rule.dayOfWeek, rule.occurrence, rule.startTime, rule.endTime],
            )
          }
          await writeSchedulingAudit(client, context, {
            action: "availability.weekly_rules_updated",
            entityType: "ministry_member",
            entityId: membership.rows[0].id,
            ministryId,
            afterData: { policy, weeklyWindows: normalizedRules.length },
          })
          await syncFutureAllMemberAssignmentsForMinistry(client, context, ministryId)
        }
        result = {
          message: `Availability rules saved for ${ministryIds.length} ${ministryIds.length === 1 ? "ministry" : "ministries"}`,
        }
      } else if (body.action === "set_date_override") {
        const ministryIds: string[] = Array.from(new Set<string>(
          (Array.isArray(body.ministryIds) ? body.ministryIds : [body.ministryId])
            .map((value: unknown) => cleanText(value, 100))
            .filter(Boolean),
        ))
        if (!ministryIds.length) {
          throw Object.assign(new Error("Join a ministry before setting availability"), {
            status: 403,
          })
        }
        const { dateKey } = parseDateKey(body.date, "Date")
        for (const ministryId of ministryIds) {
          await requireMinistryAccess(client, context.user, ministryId, false)
          const membership = await client.query(
            `SELECT ministry.timezone
             FROM ministry_members membership
             JOIN ministries ministry ON ministry.id = membership.ministry_id
             WHERE membership.user_id = $1 AND membership.ministry_id = $2
               AND membership.status = 'active' LIMIT 1`,
            [context.user.id, ministryId],
          )
          if (!membership.rowCount) {
            throw Object.assign(new Error("Dates can only be set for ministries you belong to"), {
              status: 403,
            })
          }
          if (dateKey < toDateKeyInTimezone(
            new Date(),
            membership.rows[0].timezone || "America/New_York",
          )) {
            throw Object.assign(new Error("Past availability cannot be changed"), {
              status: 400,
            })
          }
        }
        const preference = body.preference === "available"
          ? "available"
          : body.preference === "unavailable"
            ? "unavailable"
            : ""
        if (!preference) {
          throw Object.assign(new Error("Choose available or unavailable"), {
            status: 400,
          })
        }
        const requestedStartTime = cleanText(body.startTime, 5)
        const requestedEndTime = cleanText(body.endTime, 5)
        const partial = preference === "available" && (
          body.partial === true || requestedStartTime || requestedEndTime
        )
        const startTime = partial ? requestedStartTime : ""
        const endTime = partial ? requestedEndTime : ""
        if (partial && (
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
          Number(startTime.slice(3, 5)) % 15 !== 0 ||
          Number(endTime.slice(3, 5)) % 15 !== 0 ||
          endTime <= startTime
        )) {
          throw Object.assign(new Error("Choose a valid available time window"), {
            status: 400,
          })
        }
        const changeRequestedAssignmentIds: string[] = []
        if (preference === "unavailable" || partial) {
          const assignmentsById = new Map<string, any>()
          for (const ministryId of ministryIds) {
            const configuration = await loadAvailabilityConfiguration(
              client,
              context.user.id,
              ministryId,
            )
            const timezone = configuration?.timezone || "America/New_York"
            const assignments = (await loadAssignments(
              client,
              context.user.id,
              ministryId,
            )).filter(
              (assignment) =>
                toDateKeyInTimezone(assignment.startTime, timezone) === dateKey,
            )
            for (const assignment of assignments) {
              const conflicts = preference === "unavailable" || !eventFits({
                start: assignment.startTime,
                end: assignment.endTime,
                timezone,
                policy: "generally_available",
                rules: [],
                overrides: [{
                  override_date: dateKey,
                  preference: "available",
                  start_time: startTime,
                  end_time: endTime,
                }],
                blocks: [],
              })
              if (conflicts) assignmentsById.set(assignment.id, assignment)
            }
          }
          const assignments = [...assignmentsById.values()]
          for (const assignment of assignments) {
            if (assignment.assignmentMode === "all_available_members") {
              await client.query(
                `UPDATE responsibility_assignments
                 SET status = 'cancelled', updated_at = now()
                 WHERE id = $1`,
                [assignment.id],
              )
            } else {
              const change = await requestAssignmentChange(
                client,
                context,
                {
                  assignmentId: assignment.id,
                  reason: `Availability marked unavailable for ${dateKey}.`,
                },
              )
              if (change.created) changeRequestedAssignmentIds.push(assignment.id)
            }
          }
        }
        for (const ministryId of ministryIds) {
          const override = await client.query(
            `INSERT INTO availability_date_overrides (
               user_id, ministry_id, override_date, preference, start_time, end_time
             ) VALUES ($1, $2, $3::DATE, $4, $5::TIME, $6::TIME)
             ON CONFLICT (user_id, ministry_id, override_date)
             DO UPDATE SET preference = excluded.preference,
                           start_time = excluded.start_time,
                           end_time = excluded.end_time,
                           updated_at = now()
             RETURNING id`,
            [context.user.id, ministryId, dateKey, preference, partial ? startTime : null, partial ? endTime : null],
          )
          await writeSchedulingAudit(client, context, {
            action: "availability.date_overridden",
            entityType: "availability_date_override",
            entityId: override.rows[0].id,
            ministryId,
            afterData: {
              date: dateKey,
              preference,
              startTime: partial ? startTime : null,
              endTime: partial ? endTime : null,
            },
          })
          await syncFutureAllMemberAssignmentsForMinistry(client, context, ministryId)
        }
        result = {
          message: partial
            ? "Date marked partially available"
            : `Date marked ${preference}`,
          changeRequestedAssignmentIds,
        }
      } else if (body.action === "reset_date_override") {
        const ministryIds: string[] = Array.from(new Set<string>(
          (Array.isArray(body.ministryIds) ? body.ministryIds : [body.ministryId])
            .map((value: unknown) => cleanText(value, 100))
            .filter(Boolean),
        ))
        if (!ministryIds.length) {
          throw Object.assign(new Error("Join a ministry before setting availability"), {
            status: 403,
          })
        }
        const { dateKey } = parseDateKey(body.date, "Date")
        for (const ministryId of ministryIds) {
          await requireMinistryAccess(client, context.user, ministryId, false)
          const membership = await client.query(
            `SELECT ministry.timezone
             FROM ministry_members membership
             JOIN ministries ministry ON ministry.id = membership.ministry_id
             WHERE membership.user_id = $1 AND membership.ministry_id = $2
               AND membership.status = 'active' LIMIT 1`,
            [context.user.id, ministryId],
          )
          if (!membership.rowCount) {
            throw Object.assign(new Error("Dates can only be changed for ministries you belong to"), {
              status: 403,
            })
          }
          if (dateKey < toDateKeyInTimezone(
            new Date(),
            membership.rows[0].timezone || "America/New_York",
          )) {
            throw Object.assign(new Error("Past availability cannot be changed"), {
              status: 400,
            })
          }
          await client.query(
            `DELETE FROM availability_date_overrides
             WHERE user_id = $1 AND ministry_id = $2 AND override_date = $3::DATE`,
            [context.user.id, ministryId, dateKey],
          )
          await writeSchedulingAudit(client, context, {
            action: "availability.date_override_reset",
            entityType: "availability_date_override",
            ministryId,
            afterData: { date: dateKey },
          })
          await syncFutureAllMemberAssignmentsForMinistry(client, context, ministryId)
        }
        result = { message: "Date-specific availability removed" }
      } else if (["preview_blocks", "create_blocks"].includes(body.action)) {
        const ministryId = cleanText(body.ministryId, 100)
        if (!ministryId) {
          throw Object.assign(new Error("Choose the ministry being managed"), {
            status: 400,
          })
        }
        const subjectIds = await resolveManagedSubjects(
          client,
          context,
          ministryId,
          body.subjectUserIds,
        )
        const results = []
        for (const subjectUserId of subjectIds) {
          results.push({
            subjectUserId,
            result: await createBlock(
              client,
              context,
              {
                ...body,
                previewOnly: body.action === "preview_blocks",
                requireConflictFree: false,
              },
              subjectUserId,
              ministryId,
            ),
          })
        }
        const conflicts = results.flatMap((item) =>
          (item.result.conflicts || []).map((conflict) => ({
            ...conflict,
            subjectUserId: item.subjectUserId,
          })),
        )
        result = {
          message:
            body.action === "preview_blocks"
              ? "Availability checked"
              : `Availability updated for ${subjectIds.length} ${subjectIds.length === 1 ? "member" : "members"}`,
          conflicts,
          updated: results.some((item) => item.result.updated),
          changeRequestedAssignmentIds: results.flatMap(
            (item) => item.result.changeRequestedAssignmentIds || [],
          ),
        }
      } else if (body.action === "create_block") {
        result = await createBlock(client, context, body)
      } else if (body.action === "update_block") {
        result = await updateBlock(client, context, body)
      } else if (body.action === "cancel_block") {
        const ministryId = cleanText(body.managedMinistryId, 100)
        const subjectUserId = cleanText(body.subjectUserId, 100)
        if (ministryId && subjectUserId) {
          await resolveManagedSubjects(client, context, ministryId, [subjectUserId])
          result = await cancelBlock(
            client,
            context,
            body,
            subjectUserId,
            ministryId,
          )
        } else {
          result = await cancelBlock(client, context, body)
        }
      } else if (body.action === "request_change") {
        result = await requestAssignmentChange(client, context, body)
      } else {
        throw Object.assign(new Error("Unknown availability action"), {
          status: 400,
        })
      }
      await client.query("COMMIT")
      for (const assignmentId of result.changeRequestedAssignmentIds || []) {
        await sendAssignmentChangeRequestedNotification(assignmentId).catch(
          (error) => {
            console.error("Unable to notify leaders about a requested assignment change:", error)
          },
        )
      }
      return json(result)
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  } catch (error: any) {
    const status = Number(
      error?.status ||
        (/session|token|inactive/i.test(error?.message) ? 401 : 500),
    )
    if (status === 500) console.error("Unable to manage availability:", error)
    return json(
      {
        message:
          status === 500
            ? "Unable to manage availability"
            : error.message,
      },
      status,
    )
  } finally {
    client.release()
  }
}
