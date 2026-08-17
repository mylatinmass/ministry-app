import type { PoolClient } from "pg"
import { getPool } from "../database"
import { writeSchedulingAudit } from "./authorization"

const ACTIVE_ASSIGNMENT_STATUSES = [
  "interested",
  "pending",
  "assigned",
  "confirmed",
  "change_requested",
]

const cleanText = (value: unknown, maximum = 1000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

export const requestAssignmentSubstitute = async (
  client: PoolClient,
  context: any,
  event: any,
  body: any,
) => {
  const assignmentId = cleanText(body.assignmentId, 100)
  const assignmentResult = await client.query(
    `
      SELECT assignment.*, responsibility.name AS responsibility_name,
        responsibility.required_ministry_level_id,
        responsibility.substitution_allowed,
        responsibility.relative_start_minutes,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        event.title AS event_title, event.start_time, event.end_time,
        event.status AS event_status,
        COALESCE(granted_level.rank_order, 0) AS member_level_rank,
        COALESCE(required_level.rank_order, 0) AS required_level_rank
      FROM responsibility_assignments assignment
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      JOIN events event ON event.id = assignment.event_id
      LEFT JOIN ministry_members membership
        ON membership.ministry_id = COALESCE(responsibility.ministry_id, event.ministry_id)
       AND membership.user_id = assignment.user_id
       AND membership.status = 'active'
      LEFT JOIN ministry_levels granted_level
        ON granted_level.id = membership.highest_level_id
      LEFT JOIN ministry_levels required_level
        ON required_level.id = responsibility.required_ministry_level_id
      WHERE assignment.id = $1
        AND assignment.event_id = $2
        AND assignment.user_id = $3
      LIMIT 1
      FOR UPDATE OF assignment
    `,
    [assignmentId, event.id, context.user.id],
  )
  const assignment = assignmentResult.rows[0]
  if (!assignment) {
    throw Object.assign(new Error("This assignment is not available"), {
      status: 404,
    })
  }
  if (!["pending", "assigned", "confirmed"].includes(assignment.status)) {
    throw Object.assign(
      new Error("A substitute cannot be requested for this assignment"),
      { status: 409 },
    )
  }
  if (
    assignment.event_status !== "published" ||
    new Date(assignment.start_time).getTime() <= Date.now()
  ) {
    throw Object.assign(
      new Error("Substitutions close when the event begins"),
      { status: 409 },
    )
  }
  if (!assignment.ministry_id) {
    throw Object.assign(
      new Error("Only ministry assignments can request substitutes"),
      { status: 409 },
    )
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
    throw Object.assign(
      new Error("A substitute has already been requested for this duty"),
      { status: 409 },
    )
  }

  const minimumLevelRank = Math.max(
    Number(assignment.member_level_rank || 0),
    Number(assignment.required_level_rank || 0),
  )
  const reason = cleanText(body.reason) || null
  const requestResult = await client.query(
    `
      INSERT INTO assignment_change_requests (
        assignment_id, subject_user_id, requested_by_user_id, reason,
        request_type, ministry_id, event_id, responsibility_id,
        minimum_level_rank, expires_at
      )
      VALUES ($1, $2, $3, $4, 'substitute', $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [
      assignment.id,
      context.user.id,
      context.actor.id,
      reason,
      assignment.ministry_id,
      event.id,
      assignment.responsibility_id,
      minimumLevelRank,
      assignment.start_time,
    ],
  )
  const requestId = requestResult.rows[0].id
  const offers = assignment.substitution_allowed === false
    ? { rows: [], rowCount: 0 }
    : await client.query(
    `
      INSERT INTO assignment_substitution_offers (
        change_request_id, recipient_user_id
      )
      SELECT $1, membership.user_id
      FROM ministry_members membership
      JOIN ministry_accounts member ON member.id = membership.user_id
      LEFT JOIN ministry_levels granted_level
        ON granted_level.id = membership.highest_level_id
      WHERE membership.ministry_id = $2
        AND membership.status = 'active'
        AND membership.can_serve = true
        AND membership.serving_preference <> 'cannot_serve'
        AND member.status = 'active'
        AND membership.user_id <> $3
        AND COALESCE(granted_level.rank_order, 0) >= $4
      ON CONFLICT (change_request_id, recipient_user_id) DO NOTHING
      RETURNING recipient_user_id
    `,
    [requestId, assignment.ministry_id, context.user.id, minimumLevelRank],
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
    action: assignment.substitution_allowed === false
      ? "assignment.admin_change_requested"
      : "assignment.substitute_requested",
    entityType: "responsibility_assignment",
    entityId: assignment.id,
    ministryId: assignment.ministry_id,
    beforeData: { status: assignment.status },
    afterData: { status: "change_requested" },
    metadata: {
      changeRequestId: requestId,
      eventId: event.id,
      responsibilityId: assignment.responsibility_id,
      minimumLevelRank,
      eligibleOfferCount: offers.rowCount || 0,
      adminManaged: assignment.substitution_allowed === false,
      reason,
    },
  })
  return {
    message: assignment.substitution_allowed === false
      ? "Change requested from the ministry admin"
      : `Substitute requested from ${offers.rowCount || 0} eligible members`,
    substitutionRequestId: requestId,
    assignmentId: assignment.id,
    eligibleOfferCount: offers.rowCount || 0,
  }
}

export const acceptAssignmentSubstitute = async (
  client: PoolClient,
  context: any,
  event: any,
  body: any,
) => {
  const requestId = cleanText(body.substitutionRequestId, 100)
  const requestResult = await client.query(
    `
      SELECT request.*, assignment.status AS assignment_status,
        assignment.user_id AS original_user_id,
        assignment.quantity, responsibility.name AS responsibility_name,
        responsibility.substitution_allowed,
        responsibility.relative_start_minutes,
        event.title AS event_title, event.start_time, event.end_time,
        event.status AS event_status
      FROM assignment_change_requests request
      JOIN responsibility_assignments assignment
        ON assignment.id = request.assignment_id
      JOIN event_responsibilities responsibility
        ON responsibility.id = request.responsibility_id
      JOIN events event ON event.id = request.event_id
      WHERE request.id = $1
        AND request.request_type = 'substitute'
        AND request.event_id = $2
      LIMIT 1
      FOR UPDATE OF request, assignment
    `,
    [requestId, event.id],
  )
  const request = requestResult.rows[0]
  if (!request) {
    throw Object.assign(new Error("Substitution request not found"), {
      status: 404,
    })
  }
  if (request.status !== "pending") {
    throw Object.assign(
      new Error("Another member has already accepted this substitution"),
      { status: 409 },
    )
  }
  if (request.substitution_allowed === false) {
    throw Object.assign(
      new Error("This assignment change must be managed by a ministry admin"),
      { status: 409 },
    )
  }
  if (
    request.event_status !== "published" ||
    new Date(request.expires_at || request.start_time).getTime() <= Date.now()
  ) {
    throw Object.assign(new Error("This substitution request has expired"), {
      status: 409,
    })
  }

  const offerResult = await client.query(
    `
      SELECT id
      FROM assignment_substitution_offers
      WHERE change_request_id = $1
        AND recipient_user_id = $2
        AND status = 'offered'
      LIMIT 1
      FOR UPDATE
    `,
    [request.id, context.user.id],
  )
  const offer = offerResult.rows[0]
  if (!offer) {
    throw Object.assign(
      new Error("This substitution offer is not available to this profile"),
      { status: 403 },
    )
  }

  const eventDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(request.start_time))
  const eligibility = await client.query(
    `
      SELECT membership.user_id
      FROM ministry_members membership
      JOIN ministry_accounts member ON member.id = membership.user_id
      LEFT JOIN ministry_levels granted_level
        ON granted_level.id = membership.highest_level_id
      WHERE membership.ministry_id = $1
        AND membership.user_id = $2
        AND membership.status = 'active'
        AND membership.can_serve = true
        AND membership.serving_preference <> 'cannot_serve'
        AND member.status = 'active'
        AND COALESCE(granted_level.rank_order, 0) >= $3
        AND NOT EXISTS (
          SELECT 1
          FROM availability_blocks block
          WHERE block.user_id = membership.user_id
            AND block.status = 'active'
            AND (block.ministry_id IS NULL OR block.ministry_id = $1)
            AND block.start_date <= $4::DATE
            AND block.end_date >= $4::DATE
        )
      LIMIT 1
    `,
    [
      request.ministry_id,
      context.user.id,
      Number(request.minimum_level_rank || 0),
      eventDate,
    ],
  )
  if (!eligibility.rowCount) {
    throw Object.assign(
      new Error("You are no longer eligible or available for this assignment"),
      { status: 409 },
    )
  }

  const conflict = await client.query(
    `
      SELECT other_assignment.id, other_event.title
      FROM responsibility_assignments other_assignment
      JOIN events other_event ON other_event.id = other_assignment.event_id
      JOIN event_responsibilities other_responsibility
        ON other_responsibility.id = other_assignment.responsibility_id
      WHERE other_assignment.user_id = $1
        AND other_assignment.id <> $2
        AND other_assignment.status = ANY($3)
        AND other_event.status NOT IN ('cancelled', 'archived')
        AND other_event.start_time
          + COALESCE(other_responsibility.relative_start_minutes, 0)
            * INTERVAL '1 minute' < $5
        AND other_event.end_time >
          $4::TIMESTAMPTZ
          + COALESCE($6::INT, 0) * INTERVAL '1 minute'
      ORDER BY other_event.start_time
      LIMIT 1
    `,
    [
      context.user.id,
      request.assignment_id,
      ACTIVE_ASSIGNMENT_STATUSES,
      request.start_time,
      request.end_time,
      Number(request.relative_start_minutes || 0),
    ],
  )
  if (conflict.rowCount) {
    throw Object.assign(
      new Error(
        "You have a conflicting assignment and cannot accept this substitution. Contact the ministry admin outside the app if assignments need to be rearranged.",
      ),
      { status: 409 },
    )
  }

  const existing = await client.query(
    `
      SELECT id, status
      FROM responsibility_assignments
      WHERE responsibility_id = $1
        AND user_id = $2
      LIMIT 1
      FOR UPDATE
    `,
    [request.responsibility_id, context.user.id],
  )
  let replacementAssignmentId: string
  if (existing.rowCount) {
    if (!['declined', 'cancelled'].includes(existing.rows[0].status)) {
      throw Object.assign(
        new Error("You already have this responsibility"),
        { status: 409 },
      )
    }
    const replacement = await client.query(
      `
        UPDATE responsibility_assignments
        SET status = 'confirmed', quantity = $2, assigned_by = $3,
            signup_source = 'member_signup', confirmed_at = now(),
            replaces_assignment_id = $4, confirmation_overdue_at = NULL,
            updated_at = now()
        WHERE id = $1
        RETURNING id
      `,
      [existing.rows[0].id, request.quantity, context.actor.id, request.assignment_id],
    )
    replacementAssignmentId = replacement.rows[0].id
  } else {
    const replacement = await client.query(
      `
        INSERT INTO responsibility_assignments (
          event_id, responsibility_id, user_id, quantity, status,
          assigned_by, signup_source, notify_email, confirmed_at,
          replaces_assignment_id
        )
        VALUES ($1, $2, $3, $4, 'confirmed', $5, 'member_signup', true, now(), $6)
        RETURNING id
      `,
      [
        request.event_id,
        request.responsibility_id,
        context.user.id,
        request.quantity,
        context.actor.id,
        request.assignment_id,
      ],
    )
    replacementAssignmentId = replacement.rows[0].id
  }

  await client.query(
    `
      UPDATE responsibility_assignments
      SET status = 'replaced', updated_at = now()
      WHERE id = $1
    `,
    [request.assignment_id],
  )
  await client.query(
    `
      UPDATE assignment_change_requests
      SET status = 'accepted', accepted_by_user_id = $2,
          replacement_assignment_id = $3, resolved_by_user_id = $4,
          resolved_at = now(), resolution_note = 'Accepted by eligible member',
          updated_at = now()
      WHERE id = $1
    `,
    [request.id, context.user.id, replacementAssignmentId, context.actor.id],
  )
  await client.query(
    `
      UPDATE assignment_substitution_offers
      SET status = CASE WHEN recipient_user_id = $2 THEN 'accepted' ELSE 'closed' END,
          responded_at = CASE WHEN recipient_user_id = $2 THEN now() ELSE responded_at END,
          updated_at = now()
      WHERE change_request_id = $1
        AND status = 'offered'
    `,
    [request.id, context.user.id],
  )
  await client.query(
    `
      UPDATE ministry_reminders
      SET status = 'cancelled', canceled_at = now(), updated_at = now()
      WHERE assignment_id = $1
        AND status IN ('pending', 'retry', 'processing')
    `,
    [request.assignment_id],
  )
  await writeSchedulingAudit(client, context, {
    action: "assignment.substitute_accepted",
    entityType: "responsibility_assignment",
    entityId: replacementAssignmentId,
    ministryId: request.ministry_id,
    beforeData: {
      originalAssignmentId: request.assignment_id,
      originalUserId: request.original_user_id,
      originalStatus: request.assignment_status,
    },
    afterData: {
      replacementAssignmentId,
      replacementUserId: context.user.id,
      status: "confirmed",
    },
    metadata: {
      changeRequestId: request.id,
      eventId: request.event_id,
      responsibilityId: request.responsibility_id,
    },
  })
  return {
    message: "Substitution accepted. The assignment is now yours.",
    substitutionRequestId: request.id,
    assignmentId: replacementAssignmentId,
    originalAssignmentId: request.assignment_id,
  }
}

export const loadEventSubstitutionState = async (
  client: PoolClient,
  context: any,
  eventId: string,
) => {
  const [requests, offers] = await Promise.all([
    client.query(
      `
        SELECT request.id, request.assignment_id, request.subject_user_id,
          request.reason, request.status, request.minimum_level_rank,
          request.expires_at, request.accepted_by_user_id,
          request.replacement_assignment_id, request.created_at
        FROM assignment_change_requests request
        WHERE request.event_id = $1
          AND request.request_type = 'substitute'
        ORDER BY request.created_at DESC
      `,
      [eventId],
    ),
    client.query(
      `
        SELECT request.id AS request_id, request.assignment_id,
          request.reason, request.expires_at, request.minimum_level_rank,
          responsibility.id AS responsibility_id,
          responsibility.name AS responsibility_name,
          responsibility.relative_start_minutes,
          event.start_time, requester.first_name, requester.last_name
        FROM assignment_substitution_offers offer
        JOIN assignment_change_requests request
          ON request.id = offer.change_request_id
        JOIN responsibility_assignments assignment
          ON assignment.id = request.assignment_id
        JOIN event_responsibilities responsibility
          ON responsibility.id = request.responsibility_id
        JOIN events event ON event.id = request.event_id
        JOIN ministry_accounts requester ON requester.id = request.subject_user_id
        WHERE offer.recipient_user_id = $1
          AND offer.status = 'offered'
          AND request.status = 'pending'
          AND request.event_id = $2
          AND request.expires_at > now()
          AND responsibility.substitution_allowed = true
        ORDER BY request.created_at
      `,
      [context.user.id, eventId],
    ),
  ])
  return { requests: requests.rows, offers: offers.rows }
}

export const expireAssignmentSubstitutionRequests = async () => {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    const expired = await client.query(
      `
        UPDATE assignment_change_requests
        SET status = 'expired', updated_at = now()
        WHERE request_type = 'substitute'
          AND status = 'pending'
          AND expires_at <= now()
        RETURNING id
      `,
    )
    if (expired.rowCount) {
      await client.query(
        `
          UPDATE assignment_substitution_offers
          SET status = 'expired', updated_at = now()
          WHERE change_request_id = ANY($1::UUID[])
            AND status = 'offered'
        `,
        [expired.rows.map((row) => row.id)],
      )
    }
    await client.query("COMMIT")
    return expired.rowCount || 0
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
