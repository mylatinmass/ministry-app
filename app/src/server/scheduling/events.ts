import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  getMinistryAccess,
  requireMinistryAccess,
  writeSchedulingAudit,
} from "./authorization"

const EVENT_STATUSES = new Set([
  "draft",
  "published",
  "cancelled",
  "completed",
  "archived",
])
const SCHEDULE_STATUSES = new Set([
  "generated",
  "under_review",
  "ready",
  "published",
  "incomplete",
  "cancelled",
  "completed",
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

const cleanText = (value: unknown, maximum = 5000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

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

  return {
    name,
    responsibilityType,
    quantityNeeded,
    approvalRequired: Boolean(body.approvalRequired),
    isRequired: body.isRequired !== false,
    requiredQualification:
      cleanText(body.requiredQualification, 500) || null,
    relativeStartMinutes: Number.isInteger(relativeStartMinutes)
      ? relativeStartMinutes
      : 0,
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

const getOccurrenceStarts = (start: Date, recurrence: any) => {
  const frequency = ["weekly", "monthly"].includes(recurrence?.frequency)
    ? recurrence.frequency
    : "none"
  const count =
    frequency === "none"
      ? 1
      : Math.min(52, Math.max(1, Number(recurrence?.count) || 1))
  const interval = Math.min(
    12,
    Math.max(1, Number(recurrence?.interval) || 1),
  )

  return Array.from({ length: count }, (_, index) => {
    if (frequency === "weekly") {
      return new Date(start.getTime() + index * interval * 7 * 86_400_000)
    }
    if (frequency === "monthly") return addMonths(start, index * interval)
    return new Date(start)
  })
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
          sort_order
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
          responsibility.is_required,
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
    sourceEventId = null,
  }: any,
) => {
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
        status,
        version,
        source_event_id,
        recurrence_group_id,
        recurrence_rule,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        1, $11, $12, $13::JSONB, $14
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
      structure.template.participation_type || "members",
      status,
      sourceEventId,
      recurrenceGroupId,
      recurrenceRule ? JSON.stringify(recurrenceRule) : null,
      context.user.id,
    ],
  )
  const eventId = eventResult.rows[0].id

  for (const block of structure.blocks) {
    await client.query(
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
      `,
      [
        eventId,
        block.ministry_id,
        block.id,
        block.is_required !== false,
        block.instructions || null,
      ],
    )
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
          is_required,
          required_qualification,
          relative_start_minutes,
          instructions,
          sort_order,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'open'
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
        responsibility.is_required !== false,
        responsibility.required_qualification || null,
        Number(responsibility.relative_start_minutes) || 0,
        responsibility.instructions || null,
        Number(responsibility.sort_order) || 0,
      ],
    )
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
        coordinator.name AS coordinator_ministry_name,
        event.template_id,
        template.name AS template_name,
        event.template_version,
        event.title,
        event.description,
        event.location,
        event.start_time,
        event.end_time,
        event.participation_type,
        event.status,
        event.version,
        event.recurrence_group_id,
        event.recurrence_rule,
        event.updated_at,
        (
          SELECT count(*)
          FROM event_responsibilities responsibility
          WHERE responsibility.event_id = event.id
            AND responsibility.status <> 'cancelled'
        ) AS responsibility_count
      FROM events event
      JOIN ministries coordinator ON coordinator.id = event.ministry_id
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
      ORDER BY event.start_time
    `,
    [ministryId, access.canManage],
  )
  return result.rows.map((event) => ({
    ...event,
    template_version: Number(event.template_version || 0) || null,
    version: Number(event.version),
    responsibility_count: Number(event.responsibility_count),
  }))
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
        coordinator.name AS coordinator_ministry_name,
        template.name AS template_name
      FROM events event
      JOIN ministries coordinator ON coordinator.id = event.ministry_id
      LEFT JOIN templates template ON template.id = event.template_id
      WHERE event.id = $1
      LIMIT 1
    `,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) throw Object.assign(new Error("Event not found"), { status: 404 })

  const participantResult = await client.query(
    `
      SELECT
        event_ministry.ministry_id,
        ministry.name AS ministry_name,
        event_ministry.is_required,
        event_ministry.schedule_status,
        event_ministry.instructions,
        event_ministry.reviewed_at,
        event_ministry.published_at
      FROM event_ministries event_ministry
      JOIN ministries ministry ON ministry.id = event_ministry.ministry_id
      WHERE event_ministry.event_id = $1
      ORDER BY lower(ministry.name)
    `,
    [eventId],
  )
  const accessChecks = await Promise.all(
    participantResult.rows.map((participant) =>
      getMinistryAccess(client, context.user, participant.ministry_id),
    ),
  )
  const canViewAny = accessChecks.some((access) => access.canView)
  const canManageAny = accessChecks.some((access) => access.canManage)
  const canManageEvent = (
    await getMinistryAccess(client, context.user, event.ministry_id)
  ).canManage
  if (!canViewAny && !canManageEvent) {
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
    `
      SELECT
        responsibility.id,
        responsibility.ministry_id,
        responsibility.template_responsibility_id,
        ministry.name AS ministry_name,
        responsibility.name,
        responsibility.description,
        responsibility.responsibility_type,
        responsibility.quantity_needed,
        responsibility.approval_required,
        responsibility.is_required,
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
      WHERE responsibility.event_id = $1
      ORDER BY lower(ministry.name), responsibility.sort_order, lower(responsibility.name)
    `,
    [eventId],
  )

  return {
    ...event,
    version: Number(event.version),
    template_version: Number(event.template_version || 0) || null,
    ministries: participantResult.rows.map((participant, index) => ({
      ministryId: participant.ministry_id,
      ministryName: participant.ministry_name,
      isRequired: participant.is_required,
      scheduleStatus: participant.schedule_status,
      instructions: participant.instructions || "",
      reviewedAt: participant.reviewed_at,
      publishedAt: participant.published_at,
      canManage: accessChecks[index].canManage,
    })),
    responsibilities: responsibilityResult.rows.map((responsibility) => ({
      id: responsibility.id,
      ministryId: responsibility.ministry_id,
      templateResponsibilityId: responsibility.template_responsibility_id,
      ministryName: responsibility.ministry_name,
      name: responsibility.name,
      description: responsibility.description || "",
      responsibilityType: responsibility.responsibility_type,
      quantityNeeded: Number(responsibility.quantity_needed),
      assignedQuantity: Number(responsibility.assigned_quantity),
      approvalRequired: responsibility.approval_required,
      isRequired: responsibility.is_required,
      requiredQualification: responsibility.required_qualification || "",
      relativeStartMinutes: Number(responsibility.relative_start_minutes),
      instructions: responsibility.instructions || "",
      status: responsibility.status,
      sortOrder: Number(responsibility.sort_order),
    })),
    canManageEvent,
  }
}

const createEvents = async (
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
  const description =
    cleanText(body.description) || structure.template.description || ""
  const location = cleanText(body.location, 500)
  const start = parseDate(body.startTime, "Start time")
  const end = parseDate(body.endTime, "End time")
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
  }
  const duration = end.getTime() - start.getTime()
  const occurrenceStarts = getOccurrenceStarts(start, body.recurrence)
  const recurrenceGroupId =
    occurrenceStarts.length > 1 ? randomUUID() : null
  const status = body.status === "published" ? "published" : "draft"
  const eventIds: string[] = []

  for (const occurrenceStart of occurrenceStarts) {
    const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)
    eventIds.push(
      await createEventFromStructure(client, context, {
        structure,
        title,
        description,
        location,
        start: occurrenceStart,
        end: occurrenceEnd,
        status,
        recurrenceGroupId,
        recurrenceRule:
          occurrenceStarts.length > 1 ? body.recurrence : null,
      }),
    )
  }
  return eventIds
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

  const [blocks, responsibilities] = await Promise.all([
    client.query(
      `SELECT * FROM event_ministries WHERE event_id = $1 ORDER BY created_at`,
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
  ])
  const start = parseDate(body.startTime, "Start time")
  const end = parseDate(body.endTime, "End time")
  if (end <= start) {
    throw Object.assign(new Error("End time must be after start time"), {
      status: 400,
    })
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
      required_qualification: responsibility.required_qualification,
      relative_start_minutes: responsibility.relative_start_minutes,
      instructions: responsibility.instructions,
      sort_order: responsibility.sort_order,
    })),
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
    sourceEventId,
  })
}

const previewTemplateReplacement = async (
  client: PoolClient,
  context: any,
  body: any,
) => {
  const eventId = cleanText(body.eventId, 100)
  const templateId = cleanText(body.templateId, 100)
  const eventResult = await client.query(
    `SELECT id, ministry_id, template_id, template_version FROM events WHERE id = $1`,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) throw Object.assign(new Error("Event not found"), { status: 404 })
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
  ministryId: string,
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
  await client.query(
    `
      UPDATE event_ministries
      SET schedule_status = CASE
            WHEN schedule_status IN ('under_review', 'ready', 'published')
              THEN 'incomplete'
            ELSE schedule_status
          END,
          updated_at = now()
      WHERE event_id = $1
        AND ministry_id = $2
    `,
    [eventId, ministryId],
  )
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
          is_required,
          required_qualification,
          relative_start_minutes,
          instructions,
          sort_order,
          status
        )
        VALUES (
          $1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10,
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
        input.isRequired,
        input.requiredQualification,
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
            is_required = $6,
            required_qualification = $7,
            relative_start_minutes = $8,
            instructions = $9,
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
        input.isRequired,
        input.requiredQualification,
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

  if (RESPONSIBILITY_ACTIONS.has(body.action)) {
    return mutateEventResponsibility(client, context, event, body)
  }

  if (body.action !== "set_schedule_status") {
    await requireMinistryAccess(client, context.user, event.ministry_id, true)
  }

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
                is_required = $6,
                required_qualification = $7,
                relative_start_minutes = $8,
                instructions = $9,
                sort_order = $10,
                updated_at = now()
            WHERE id = $1
          `,
          [
            existing.id,
            responsibility.id,
            responsibility.description || null,
            Number(responsibility.quantity_needed) || 1,
            Boolean(responsibility.approval_required),
            responsibility.is_required !== false,
            responsibility.required_qualification || null,
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
              is_required,
              required_qualification,
              relative_start_minutes,
              instructions,
              sort_order,
              status
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'open'
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
            responsibility.is_required !== false,
            responsibility.required_qualification || null,
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
      await client.query(
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
        `,
        [
          eventId,
          block.ministry_id,
          block.id,
          block.is_required !== false,
          block.instructions || null,
        ],
      )
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
    await client.query(
      `
        UPDATE events
        SET status = $2, version = version + 1, updated_at = now()
        WHERE id = $1
      `,
      [eventId, status],
    )
    if (status === "cancelled") {
      await client.query(
        `
          UPDATE event_ministries
          SET schedule_status = 'cancelled', updated_at = now()
          WHERE event_id = $1
        `,
        [eventId],
      )
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

  if (body.action === "set_schedule_status") {
    const ministryId = cleanText(body.ministryId, 100)
    const status = cleanText(body.status, 30)
    if (!SCHEDULE_STATUSES.has(status)) {
      throw Object.assign(new Error("Invalid ministry schedule status"), {
        status: 400,
      })
    }
    await requireMinistryAccess(client, context.user, ministryId, true)
    const result = await client.query(
      `
        UPDATE event_ministries
        SET schedule_status = $3,
            reviewed_by = CASE
              WHEN $3 IN ('ready', 'published', 'incomplete') THEN $4
              ELSE reviewed_by
            END,
            reviewed_at = CASE
              WHEN $3 IN ('ready', 'published', 'incomplete') THEN now()
              ELSE reviewed_at
            END,
            published_by = CASE WHEN $3 = 'published' THEN $4 ELSE published_by END,
            published_at = CASE WHEN $3 = 'published' THEN now() ELSE published_at END,
            updated_at = now()
        WHERE event_id = $1
          AND ministry_id = $2
        RETURNING ministry_id
      `,
      [eventId, ministryId, status, context.user.id],
    )
    if (!result.rowCount) {
      throw Object.assign(new Error("Ministry is not part of this event"), {
        status: 404,
      })
    }
    await writeSchedulingAudit(client, context, {
      action: `event_ministry.${status}`,
      entityType: "event",
      entityId: eventId,
      ministryId,
      afterData: { scheduleStatus: status },
    })
    return
  }

  const title = cleanText(body.title, 250)
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
  await client.query(
    `
      UPDATE events
      SET title = $2,
          description = $3,
          location = $4,
          start_time = $5,
          end_time = $6,
          version = version + 1,
          updated_at = now()
      WHERE id = $1
    `,
    [
      eventId,
      title,
      cleanText(body.description) || null,
      cleanText(body.location, 500) || null,
      start,
      end,
    ],
  )
  await writeSchedulingAudit(client, context, {
    action: "event.updated",
    entityType: "event",
    entityId: eventId,
    ministryId: event.ministry_id,
    beforeData: event,
    afterData: {
      title,
      description: cleanText(body.description),
      location: cleanText(body.location, 500),
      startTime: start,
      endTime: end,
    },
  })
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
      return json({ events: await loadEventList(client, context, ministryId) })
    }

    const body = await request.json().catch(() => ({}))
    await client.query("BEGIN")
    try {
      if (request.method === "POST") {
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
        const eventIds = await createEvents(client, context, body)
        await client.query("COMMIT")
        return json(
          {
            message:
              eventIds.length === 1
                ? "Event created"
                : `${eventIds.length} repeating events created`,
            eventIds,
          },
          201,
        )
      }
      if (request.method === "PATCH") {
        const message = await updateEvent(client, context, body)
        await client.query("COMMIT")
        return json({
          message: message || "Event updated",
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
    return json({ message: error?.message || "Unable to manage events" }, status)
  } finally {
    client.release()
  }
}
