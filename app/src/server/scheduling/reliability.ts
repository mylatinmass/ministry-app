import type { PoolClient } from "pg"

export type ReliabilityEvent = {
  occurredAt: string | Date
  delta: number
  kind: "served" | "no_show" | "cancellation"
  assignmentId?: string | null
  noticeHours?: number | null
}

export type ReliabilitySummary = {
  score: number
  recentTrend: number
  recordedEvents: number
  needsFollowUp: boolean
  lastIssue: null | {
    kind: "no_show" | "cancellation"
    occurredAt: string
    delta: number
    noticeHours: number | null
  }
}

const clampScore = (value: number) => Math.max(0, Math.min(100, value))

export const cancellationDeduction = (noticeHours: number) => {
  if (noticeHours < 24) return -5
  if (noticeHours < 48) return -3
  return -1
}

export const summarizeReliabilityEvents = (
  sourceEvents: ReliabilityEvent[],
): ReliabilitySummary => {
  const events = [...sourceEvents].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  )
  let score = 100
  for (const event of events) score = clampScore(score + event.delta)

  const recent = [...events].reverse().slice(0, 15)
  const recentTrend = recent.reduce((total, event, index) => {
    const multiplier = index < 5 ? 3 : 2
    return total + event.delta * multiplier
  }, 0)
  const lastIssue = [...events]
    .reverse()
    .find((event) => event.delta < 0)

  return {
    score,
    recentTrend,
    recordedEvents: events.length,
    needsFollowUp: score < 100,
    lastIssue: lastIssue
      ? {
          kind: lastIssue.kind === "no_show" ? "no_show" : "cancellation",
          occurredAt: new Date(lastIssue.occurredAt).toISOString(),
          delta: lastIssue.delta,
          noticeHours: lastIssue.noticeHours ?? null,
        }
      : null,
  }
}

export const loadReliabilitySummaries = async (
  client: PoolClient,
  userIds: string[],
  ministryIds: string[],
) => {
  const summaries = new Map<string, ReliabilitySummary>()
  if (!userIds.length || !ministryIds.length) return summaries

  const [outcomes, cancellations] = await Promise.all([
    client.query(
      `
        SELECT assignment.user_id,
          COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
          assignment.id AS assignment_id,
          assignment.service_outcome,
          COALESCE(assignment.outcome_recorded_at, event.end_time) AS occurred_at
        FROM responsibility_assignments assignment
        JOIN events event ON event.id = assignment.event_id
        JOIN event_responsibilities responsibility
          ON responsibility.id = assignment.responsibility_id
        WHERE assignment.user_id = ANY($1::UUID[])
          AND COALESCE(responsibility.ministry_id, event.ministry_id)
            = ANY($2::UUID[])
          AND assignment.service_outcome IN ('served', 'no_show')
        ORDER BY occurred_at
      `,
      [userIds, ministryIds],
    ),
    client.query(
      `
        SELECT DISTINCT ON (request.assignment_id)
          request.subject_user_id AS user_id,
          COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
          request.assignment_id,
          request.created_at AS occurred_at,
          event.start_time,
          EXTRACT(EPOCH FROM (event.start_time - request.created_at)) / 3600
            AS notice_hours
        FROM assignment_change_requests request
        JOIN responsibility_assignments assignment
          ON assignment.id = request.assignment_id
        JOIN events event ON event.id = assignment.event_id
        JOIN event_responsibilities responsibility
          ON responsibility.id = assignment.responsibility_id
        WHERE request.subject_user_id = ANY($1::UUID[])
          AND COALESCE(responsibility.ministry_id, event.ministry_id)
            = ANY($2::UUID[])
          AND request.status NOT IN ('accepted', 'cancelled', 'declined')
          AND assignment.service_outcome IS NULL
          AND (
            request.requested_by_user_id = request.subject_user_id
            OR EXISTS (
              SELECT 1 FROM managed_profiles guardian_link
              WHERE guardian_link.child_user_id = request.subject_user_id
                AND guardian_link.guardian_user_id = request.requested_by_user_id
                AND guardian_link.status = 'active'
            )
          )
        ORDER BY request.assignment_id, request.created_at DESC
      `,
      [userIds, ministryIds],
    ),
  ])

  const eventsByMember = new Map<string, ReliabilityEvent[]>()
  const append = (userId: string, ministryId: string, event: ReliabilityEvent) => {
    const key = `${ministryId}:${userId}`
    const events = eventsByMember.get(key) || []
    events.push(event)
    eventsByMember.set(key, events)
  }
  for (const row of outcomes.rows) {
    append(row.user_id, row.ministry_id, {
      occurredAt: row.occurred_at,
      delta: row.service_outcome === "served" ? 1 : -10,
      kind: row.service_outcome,
      assignmentId: row.assignment_id,
    })
  }
  for (const row of cancellations.rows) {
    const noticeHours = Math.max(0, Number(row.notice_hours || 0))
    append(row.user_id, row.ministry_id, {
      occurredAt: row.occurred_at,
      delta: cancellationDeduction(noticeHours),
      kind: "cancellation",
      assignmentId: row.assignment_id,
      noticeHours,
    })
  }
  for (const [key, events] of eventsByMember) {
    summaries.set(key, summarizeReliabilityEvents(events))
  }
  return summaries
}

export const emptyReliabilitySummary = (): ReliabilitySummary =>
  summarizeReliabilityEvents([])
