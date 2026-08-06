import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  writeSchedulingAudit,
} from "./authorization"

const ACTIVE_ASSIGNMENT_STATUSES = [
  "pending",
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

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + amount)
  return next
}

const dateKeyFromUtc = (date: Date) => date.toISOString().slice(0, 10)

const cleanText = (value: unknown, maximum = 250) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const loadAssignments = async (client: PoolClient, userId: string) => {
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
      ORDER BY event.start_time, lower(responsibility.name)
    `,
    [userId, ACTIVE_ASSIGNMENT_STATUSES],
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
    ministryId: row.ministry_id,
    ministryName: row.ministry_name,
    changeRequestId: row.change_request_id,
    changeRequestStatus: row.change_request_status,
  }))
}

const loadBlocks = async (client: PoolClient, userId: string) => {
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
      ORDER BY block.start_date, block.end_date, block.created_at
    `,
    [userId],
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

const splitAroundAssignedDates = (
  start: Date,
  end: Date,
  assignedDates: Set<string>,
) => {
  const segments: Array<{ startDate: string; endDate: string }> = []
  let segmentStart: Date | null = null

  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor = addDays(cursor, 1)
  ) {
    const key = dateKeyFromUtc(cursor)
    if (assignedDates.has(key)) {
      if (segmentStart) {
        segments.push({
          startDate: dateKeyFromUtc(segmentStart),
          endDate: dateKeyFromUtc(addDays(cursor, -1)),
        })
        segmentStart = null
      }
    } else if (!segmentStart) {
      segmentStart = new Date(cursor)
    }
  }

  if (segmentStart) {
    segments.push({
      startDate: dateKeyFromUtc(segmentStart),
      endDate: dateKeyFromUtc(end),
    })
  }
  return segments
}

const createBlock = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  body: any,
) => {
  const ministryId = cleanText(body.ministryId, 100) || null
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
      [context.user.id, ministryId],
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

  const assignments = await loadAssignments(client, context.user.id)
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
    [context.user.id, startDate, endDate, ministryId],
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
  const assignedDates = new Set(
    conflicts.map((assignment) => assignment.date),
  )
  const segments = splitAroundAssignedDates(
    new Date(`${mergedStart}T00:00:00.000Z`),
    new Date(`${mergedEnd}T00:00:00.000Z`),
    assignedDates,
  )
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
        context.user.id,
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
      },
    })
  }

  return {
    message: conflicts.length
      ? createdBlocks.length
        ? "Available dates were blocked. Assigned dates still require a change request."
        : "These dates already contain assignments. Request a change for each duty."
      : "Availability blocked",
    blocks: createdBlocks,
    conflicts,
    updated: createdBlocks.length > 0,
  }
}

const cancelBlock = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  body: any,
) => {
  const blockId = typeof body.blockId === "string" ? body.blockId : ""
  const blockResult = await client.query(
    `
      SELECT id, ministry_id, start_date, end_date, label
      FROM availability_blocks
      WHERE id = $1
        AND user_id = $2
        AND status = 'active'
      LIMIT 1
      FOR UPDATE
    `,
    [blockId, context.user.id],
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
  return { message: "Availability block removed" }
}

const declineAssignment = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  body: any,
) => {
  const assignmentId = cleanText(body.assignmentId, 100)
  const assignmentResult = await client.query(
    `
      SELECT
        assignment.id,
        assignment.status,
        assignment.event_id,
        assignment.responsibility_id,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id
      FROM responsibility_assignments assignment
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      JOIN events event ON event.id = assignment.event_id
      WHERE assignment.id = $1
        AND assignment.user_id = $2
        AND assignment.status IN ('pending', 'assigned')
        AND event.status = 'published'
      LIMIT 1
      FOR UPDATE
    `,
    [assignmentId, context.user.id],
  )
  const assignment = assignmentResult.rows[0]
  if (!assignment) {
    throw Object.assign(
      new Error("Only an active, unconfirmed assignment can be declined"),
      { status: 409 },
    )
  }
  await client.query(
    `UPDATE responsibility_assignments SET status = 'declined', updated_at = now() WHERE id = $1`,
    [assignment.id],
  )
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
      WHERE responsibility.id = $1
    `,
    [assignment.responsibility_id],
  )
  await writeSchedulingAudit(client, context, {
    action: "responsibility_assignment.declined",
    entityType: "responsibility_assignment",
    entityId: assignment.id,
    ministryId: assignment.ministry_id,
    beforeData: { status: assignment.status },
    afterData: { status: "declined" },
    metadata: { eventId: assignment.event_id },
  })
  return { message: "Assignment declined" }
}

const requestAssignmentChange = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  body: any,
) => {
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
    [assignmentId, context.user.id, ACTIVE_ASSIGNMENT_STATUSES],
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
    [assignment.id, context.user.id, context.actor.id, reason],
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
      notificationStatus: "pending_implementation",
    },
  })
  return {
    message: "Change request recorded",
    changeRequestId: requestResult.rows[0].id,
  }
}

export const handleAvailability = async (request: Request) => {
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    if (request.method === "GET") {
      const [blocks, assignments, ministriesResult] = await Promise.all([
        loadBlocks(client, context.user.id),
        loadAssignments(client, context.user.id),
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
      return json({
        user: {
          id: context.user.id,
          firstName: context.user.first_name,
          lastName: context.user.last_name,
        },
        blocks,
        assignments,
        ministries: ministriesResult.rows,
      })
    }
    if (request.method !== "POST") {
      return json({ message: "Method not allowed" }, 405, { Allow: "GET, POST" })
    }

    const body = await request.json().catch(() => ({}))
    await client.query("BEGIN")
    try {
      let result
      if (body.action === "create_block") {
        result = await createBlock(client, context, body)
      } else if (body.action === "cancel_block") {
        result = await cancelBlock(client, context, body)
      } else if (body.action === "request_change") {
        result = await requestAssignmentChange(client, context, body)
      } else if (body.action === "decline_assignment") {
        result = await declineAssignment(client, context, body)
      } else {
        throw Object.assign(new Error("Unknown availability action"), {
          status: 400,
        })
      }
      await client.query("COMMIT")
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
