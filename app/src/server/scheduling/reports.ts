import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import { getIdentityContext, requireMinistryAccess } from "./authorization"
import {
  emptyReliabilitySummary,
  loadReliabilitySummaries,
} from "./reliability"

const cleanId = (value: string | null) =>
  typeof value === "string" ? value.trim().slice(0, 100) : ""

const formatTimeKey = (value: string | Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

export const loadReports = async (
  client: PoolClient,
  context: Awaited<ReturnType<typeof getIdentityContext>>,
  ministryId: string,
) => {
  await requireMinistryAccess(client, context.user, ministryId, true)

  const [ministryResult, serviceResult, coverageResult, levelAuditResult] =
    await Promise.all([
      client.query(`SELECT id, name FROM ministries WHERE id = $1`, [ministryId]),
      client.query(
        `
          WITH service_history AS (
            SELECT
              assignment.user_id,
              assignment.id AS assignment_id,
              assignment.status,
              assignment.service_outcome,
              assignment.outcome_recorded_at,
              event.id AS event_id,
              event.title AS event_title,
              event.start_time,
              responsibility.name AS responsibility_name
            FROM responsibility_assignments assignment
            JOIN events event ON event.id = assignment.event_id
            JOIN event_responsibilities responsibility
              ON responsibility.id = assignment.responsibility_id
            WHERE event.start_time >= now() - INTERVAL '6 months'
              AND event.start_time <= now()
              AND event.status NOT IN ('cancelled', 'archived')
              AND COALESCE(responsibility.ministry_id, event.ministry_id) = $1
          )
          SELECT
            member.id AS user_id,
            member.first_name,
            member.last_name,
            history.assignment_id,
            history.status,
            history.service_outcome,
            history.outcome_recorded_at,
            history.event_id,
            history.event_title,
            history.start_time,
            history.responsibility_name
          FROM ministry_members membership
          JOIN ministry_accounts member ON member.id = membership.user_id
          LEFT JOIN service_history history ON history.user_id = member.id
          WHERE membership.ministry_id = $1
            AND membership.status = 'active'
          ORDER BY lower(member.last_name), lower(member.first_name), history.start_time DESC
        `,
        [ministryId],
      ),
      client.query(
        `
          SELECT
            event.id AS event_id,
            event.title,
            event.start_time,
            responsibility.id AS responsibility_id,
            responsibility.name AS responsibility_name,
            responsibility.quantity_needed,
            COALESCE(sum(
              CASE
                WHEN assignment.status NOT IN ('declined', 'cancelled') THEN assignment.quantity
                ELSE 0
              END
            ), 0)::INT AS assigned_quantity
          FROM events event
          JOIN event_responsibilities responsibility
            ON responsibility.event_id = event.id
           AND responsibility.status <> 'cancelled'
          LEFT JOIN responsibility_assignments assignment
            ON assignment.responsibility_id = responsibility.id
          WHERE COALESCE(responsibility.ministry_id, event.ministry_id) = $1
            AND event.start_time >= now()
            AND event.status IN ('draft', 'published')
          GROUP BY
            event.id, event.title, event.start_time,
            responsibility.id, responsibility.name, responsibility.quantity_needed
          ORDER BY event.start_time, lower(responsibility.name)
        `,
        [ministryId],
      ),
      client.query(
        `
          SELECT
            audit.id,
            audit.entity_id AS membership_id,
            audit.after_data,
            audit.created_at,
            actor.first_name AS actor_first_name,
            actor.last_name AS actor_last_name,
            member.first_name,
            member.last_name
          FROM ministry_audit_log audit
          JOIN ministry_accounts actor ON actor.id = audit.actor_user_id
          LEFT JOIN ministry_members membership ON membership.id = audit.entity_id
          LEFT JOIN ministry_accounts member ON member.id = membership.user_id
          WHERE audit.ministry_id = $1
            AND audit.action = 'ministry_member.level_granted'
          ORDER BY audit.created_at DESC
          LIMIT 250
        `,
        [ministryId],
      ),
    ])

  if (!ministryResult.rowCount) {
    throw Object.assign(new Error("Ministry not found"), { status: 404 })
  }

  const levelIds = Array.from(
    new Set(
      levelAuditResult.rows
        .map((row) => row.after_data?.highestLevelId)
        .filter(Boolean),
    ),
  )
  const levelsResult = levelIds.length
    ? await client.query(
        `SELECT id, name, rank_order FROM ministry_levels WHERE id = ANY($1::UUID[])`,
        [levelIds],
      )
    : { rows: [] }
  const levels = new Map(levelsResult.rows.map((level) => [level.id, level]))

  const members = new Map<string, any>()
  for (const row of serviceResult.rows) {
    if (!members.has(row.user_id)) {
      members.set(row.user_id, {
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        confirmed: 0,
        served: 0,
        noShows: 0,
        substitutes: 0,
        excused: 0,
        unrecorded: 0,
        recentWorkload: 0,
        recentAssignments: [],
        timePatterns: {},
      })
    }
    if (!row.assignment_id || !row.event_id) continue
    const member = members.get(row.user_id)
    if (["confirmed", "completed"].includes(row.status)) member.confirmed += 1
    if (
      new Date(row.start_time).getTime() >=
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ) {
      member.recentWorkload += 1
    }
    if (row.service_outcome === "served") member.served += 1
    else if (row.service_outcome === "no_show") member.noShows += 1
    else if (row.service_outcome === "substitute_served") member.substitutes += 1
    else if (row.service_outcome === "excused") member.excused += 1
    else member.unrecorded += 1

    const timeKey = formatTimeKey(row.start_time)
    const pattern = member.timePatterns[timeKey] || {
      time: timeKey,
      recorded: 0,
      served: 0,
      noShows: 0,
    }
    if (["served", "no_show"].includes(row.service_outcome)) pattern.recorded += 1
    if (row.service_outcome === "served") pattern.served += 1
    if (row.service_outcome === "no_show") pattern.noShows += 1
    member.timePatterns[timeKey] = pattern
    member.recentAssignments.push({
      assignmentId: row.assignment_id,
      eventId: row.event_id,
      eventTitle: row.event_title,
      startTime: row.start_time,
      responsibilityName: row.responsibility_name,
      status: row.status,
      outcome: row.service_outcome || "not_recorded",
    })
  }

  const reliability = await loadReliabilitySummaries(
    client,
    Array.from(members.keys()),
    [ministryId],
  )
  const participation = Array.from(members.values()).map((member) => {
    const reliabilitySummary =
      reliability.get(`${ministryId}:${member.userId}`) ||
      emptyReliabilitySummary()
    return {
      ...member,
      timePatterns: Object.values(member.timePatterns).sort((a: any, b: any) =>
        a.time.localeCompare(b.time),
      ),
      reliabilityPercent: reliabilitySummary.score,
      reliability: reliabilitySummary,
    }
  })

  return {
    ministry: ministryResult.rows[0],
    generatedAt: new Date().toISOString(),
    rangeMonths: 6,
    participation,
    coverage: coverageResult.rows.map((row) => ({
      eventId: row.event_id,
      title: row.title,
      startTime: row.start_time,
      responsibilityId: row.responsibility_id,
      responsibilityName: row.responsibility_name,
      quantityNeeded: Number(row.quantity_needed),
      assignedQuantity: Number(row.assigned_quantity),
      shortage: Math.max(
        0,
        Number(row.quantity_needed) - Number(row.assigned_quantity),
      ),
    })),
    levelHistory: levelAuditResult.rows.map((row) => {
      const level = levels.get(row.after_data?.highestLevelId)
      return {
        id: row.id,
        membershipId: row.membership_id,
        memberName:
          [row.first_name, row.last_name].filter(Boolean).join(" ") ||
          "Former member",
        levelName: level?.name || "Level removed",
        levelRank: level ? Number(level.rank_order) : null,
        actorName: [row.actor_first_name, row.actor_last_name]
          .filter(Boolean)
          .join(" "),
        createdAt: row.created_at,
      }
    }),
  }
}

export const handleReports = async (request: Request) => {
  const client = await getPool().connect()
  try {
    if (request.method !== "GET") {
      return json({ message: "Method not allowed" }, 405, { Allow: "GET" })
    }
    const context = await getIdentityContext(client, request)
    const ministryId = cleanId(new URL(request.url).searchParams.get("ministryId"))
    if (!ministryId) return json({ message: "Ministry is required" }, 400)
    return json(await loadReports(client, context, ministryId))
  } catch (error: any) {
    const status = Number(
      error?.status ||
        (/session|token|inactive/i.test(error?.message) ? 401 : 500),
    )
    if (status === 500) console.error("Unable to load ministry reports:", error)
    return json(
      { message: status === 500 ? "Unable to load ministry reports" : error.message },
      status,
    )
  } finally {
    client.release()
  }
}
