import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  writeSchedulingAudit,
} from "./authorization"

const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RESERVED_CODES = new Set([
  "api",
  "admin",
  "login",
  "invite",
  "volunteer",
  "support",
])
const ACTIVE_ASSIGNMENT_STATUSES = [
  "interested",
  "pending",
  "assigned",
  "confirmed",
  "change_requested",
  "completed",
]

const cleanText = (value: unknown, maximum = 5000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const normalizeCode = (value: unknown) => cleanText(value, 64).toLowerCase()

const requireStandaloneEventManager = async (
  client: PoolClient,
  context: any,
) => {
  if (["owner", "super_admin"].includes(context.user.global_role)) return
  const result = await client.query(
    `
      SELECT 1
      FROM ministry_members
      WHERE user_id = $1
        AND status = 'active'
        AND level IN ('owner', 'admin')
      LIMIT 1
    `,
    [context.user.id],
  )
  if (!result.rowCount) {
    throw Object.assign(
      new Error("Leader access is required to manage volunteer events"),
      { status: 403 },
    )
  }
}

const canManageAll = (context: any) =>
  ["owner", "super_admin"].includes(context.user.global_role)

const parseDate = (value: unknown, field: string) => {
  const result = new Date(typeof value === "string" ? value : "")
  if (Number.isNaN(result.getTime())) {
    throw Object.assign(new Error(`${field} is invalid`), { status: 400 })
  }
  return result
}

const normalizeAssignments = (value: unknown) => {
  if (!Array.isArray(value)) return []
  const assignments = value.map((item: any, index) => {
    const name = cleanText(item?.name, 250)
    const description = cleanText(item?.description, 1000) || null
    const quantityNeeded = Number.parseInt(item?.quantityNeeded, 10)
    if (!name) {
      throw Object.assign(
        new Error(`Assignment ${index + 1} needs a name`),
        { status: 400 },
      )
    }
    if (
      !Number.isInteger(quantityNeeded) ||
      quantityNeeded < 1 ||
      quantityNeeded > 100
    ) {
      throw Object.assign(
        new Error(`Assignment ${index + 1} openings must be between 1 and 100`),
        { status: 400 },
      )
    }
    return {
      name,
      description,
      quantityNeeded,
      approvalRequired: Boolean(item?.approvalRequired),
      sortOrder: index,
    }
  })
  return assignments
}

const normalizeGeneralVolunteerCapacity = (body: any) => {
  const unlimited = body.generalVolunteerUnlimited !== false
  const limit = Number.parseInt(body.generalVolunteerLimit, 10)
  if (!unlimited && (!Number.isInteger(limit) || limit < 1 || limit > 10000)) {
    throw Object.assign(
      new Error("General Volunteer spots must be between 1 and 10,000"),
      { status: 400 },
    )
  }
  return { unlimited, limit: unlimited ? 1 : limit }
}

const assertCodeAvailable = async (
  client: PoolClient,
  code: string,
  eventId: string | null = null,
) => {
  if (!CODE_PATTERN.test(code) || RESERVED_CODES.has(code)) {
    throw Object.assign(
      new Error("Use lowercase letters, numbers, and single hyphens for the link"),
      { status: 400 },
    )
  }
  const result = await client.query(
    `
      SELECT 1
      FROM events
      WHERE signup_code = $1
        AND ($2::UUID IS NULL OR id <> $2)
      LIMIT 1
    `,
    [code, eventId],
  )
  if (result.rowCount) {
    throw Object.assign(new Error("That volunteer URL is already in use"), {
      status: 409,
    })
  }
}

const loadEvents = async (client: PoolClient, context: any) => {
  const result = await client.query(
    `
      SELECT
        event.id,
        event.title,
        event.description,
        event.location,
        event.start_time,
        event.end_time,
        event.signup_code,
        event.signup_open,
        event.status,
        event.created_by,
        count(DISTINCT responsibility.id)::INT AS assignment_count,
        COALESCE(sum(
          CASE WHEN responsibility.unlimited_capacity THEN 0
          ELSE responsibility.quantity_needed END
        ), 0)::INT AS opening_count,
        COALESCE(bool_or(responsibility.unlimited_capacity), false) AS has_unlimited_capacity,
        COALESCE(sum(coverage.filled), 0)::INT AS filled_count
      FROM events event
      LEFT JOIN event_responsibilities responsibility
        ON responsibility.event_id = event.id
       AND responsibility.status <> 'cancelled'
      LEFT JOIN LATERAL (
        SELECT COALESCE(sum(assignment.quantity), 0)::INT AS filled
        FROM responsibility_assignments assignment
        WHERE assignment.responsibility_id = responsibility.id
          AND assignment.status = ANY($2)
      ) coverage ON true
      WHERE event.ministry_id IS NULL
        AND event.participation_type = 'volunteers'
        AND event.status <> 'archived'
        AND ($3 = true OR event.created_by = $1)
      GROUP BY event.id
      ORDER BY event.start_time DESC
    `,
    [context.user.id, ACTIVE_ASSIGNMENT_STATUSES, canManageAll(context)],
  )
  return result.rows.map((event) => ({
    ...event,
    assignment_count: Number(event.assignment_count),
    opening_count: Number(event.opening_count),
    filled_count: Number(event.filled_count),
  }))
}

const createEvent = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const title = cleanText(body.title, 250)
  const description = cleanText(body.description) || null
  const location = cleanText(body.location, 500) || null
  const code = normalizeCode(body.signupCode)
  const start = parseDate(body.startTime, "Start time")
  const end = parseDate(body.endTime, "End time")
  const assignments = normalizeAssignments(body.assignments)
  const generalVolunteer = normalizeGeneralVolunteerCapacity(body)
  if (!title) {
    throw Object.assign(new Error("Event title is required"), { status: 400 })
  }
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
  }
  await assertCodeAvailable(client, code)

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
        signup_code,
        signup_open,
        status,
        created_by
      )
      VALUES (
        NULL, NULL, NULL, $1, $2, $3, $4, $5,
        'volunteers', $6, true, 'published', $7
      )
      RETURNING id
    `,
    [title, description, location, start, end, code, context.user.id],
  )
  const eventId = eventResult.rows[0].id

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
    [eventId, generalVolunteer.limit, generalVolunteer.unlimited],
  )

  for (const assignment of assignments) {
    await client.query(
      `
        INSERT INTO event_responsibilities (
          event_id,
          ministry_id,
          name,
          description,
          responsibility_type,
          quantity_needed,
          approval_required,
          is_required,
          relative_start_minutes,
          sort_order,
          status,
          is_public_assignment,
          unlimited_capacity
        )
        VALUES ($1, NULL, $2, $3, 'position', $4, $5, true, 0, $6, 'open', true, false)
      `,
      [
        eventId,
        assignment.name,
        assignment.description,
        assignment.quantityNeeded,
        assignment.approvalRequired,
        assignment.sortOrder,
      ],
    )
  }

  await writeSchedulingAudit(client, context, {
    action: "volunteer_event.created",
    entityType: "event",
    entityId: eventId,
    afterData: {
      title,
      startTime: start,
      endTime: end,
      signupCode: code,
      assignmentCount: assignments.length + 1,
      generalVolunteerUnlimited: generalVolunteer.unlimited,
      generalVolunteerLimit: generalVolunteer.unlimited
        ? null
        : generalVolunteer.limit,
      standalone: true,
    },
  })
  return { eventId, code }
}

const setSignupOpen = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const eventId = cleanText(body.eventId, 100)
  const eventResult = await client.query(
    `
      SELECT id, title, signup_open, created_by
      FROM events
      WHERE id = $1
        AND ministry_id IS NULL
        AND participation_type = 'volunteers'
      LIMIT 1
      FOR UPDATE
    `,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) {
    throw Object.assign(new Error("Volunteer event not found"), { status: 404 })
  }
  if (!canManageAll(context) && event.created_by !== context.user.id) {
    throw Object.assign(new Error("You cannot manage this volunteer event"), {
      status: 403,
    })
  }
  const signupOpen = body.signupOpen === true
  await client.query(
    `UPDATE events SET signup_open = $2, updated_at = now() WHERE id = $1`,
    [event.id, signupOpen],
  )
  await writeSchedulingAudit(client, context, {
    action: signupOpen
      ? "volunteer_event.signup_opened"
      : "volunteer_event.signup_closed",
    entityType: "event",
    entityId: event.id,
    beforeData: { signupOpen: event.signup_open },
    afterData: { signupOpen },
  })
  return signupOpen ? "Volunteer signup opened" : "Volunteer signup closed"
}

export const handleVolunteerEvents = async (request: Request) => {
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    await requireStandaloneEventManager(client, context)
    if (request.method === "GET") {
      return json({ events: await loadEvents(client, context) })
    }
    const body = await request.json().catch(() => ({}))
    await client.query("BEGIN")
    try {
      if (request.method === "POST") {
        const created = await createEvent(client, context, body)
        await client.query("COMMIT")
        return json(
          {
            message: "Volunteer event created and signup opened",
            ...created,
          },
          201,
        )
      }
      if (request.method === "PATCH" && body.action === "set_signup_open") {
        const message = await setSignupOpen(client, context, body)
        await client.query("COMMIT")
        return json({ message })
      }
      await client.query("ROLLBACK")
      return json({ message: "Method not allowed" }, 405)
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  } catch (error: any) {
    const status = Number(
      error?.status ||
        (/session|token|inactive/i.test(error?.message) ? 401 : 500),
    )
    if (status === 500) {
      console.error("Unable to manage standalone volunteer events:", error)
    }
    return json(
      {
        message:
          status === 500
            ? "Unable to manage volunteer events"
            : error.message,
      },
      status,
    )
  } finally {
    client.release()
  }
}
