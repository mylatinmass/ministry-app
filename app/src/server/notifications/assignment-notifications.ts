import crypto from "node:crypto"
import { getPool } from "../database"
import { sendKlaviyoAlertDue } from "./klaviyo"
import { sendTelegramMessage } from "./telegram"
import { sendAccountPush, sendReliableEmail } from "./delivery"

const deliveryAllowed = () =>
  process.env.VERCEL_ENV === "production" ||
  process.env.ALLOW_PREVIEW_DELIVERY === "true"

const digestDelayMinutes = () => {
  const configured = Number.parseInt(
    process.env.MINISTRY_NOTIFICATION_DIGEST_MINUTES || "5",
    10,
  )
  return Number.isFinite(configured) && configured >= 0 ? configured : 5
}

const formatAssignmentDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value))

const notificationRecipientsForProfile = async (profileUserId: string) => {
  const result = await getPool().query(
    `
      SELECT guardian_user_id AS recipient_user_id
      FROM managed_profiles
      WHERE child_user_id = $1
        AND status IN ('active', 'separation_pending')
      UNION ALL
      SELECT $1::UUID
      WHERE NOT EXISTS (
        SELECT 1
        FROM managed_profiles
        WHERE child_user_id = $1
          AND status IN ('active', 'separation_pending')
      )
    `,
    [profileUserId],
  )
  return result.rows.map((row) => row.recipient_user_id)
}

export const enqueueAlert = async ({
  subjectUserId,
  recipientUserId,
  kind,
  title,
  message,
  assignmentId,
  eventId,
  ministryId,
  dedupeKey,
  metadata = {},
  immediate = false,
  acknowledgmentRequired = false,
  acknowledgmentDeadline = null,
}: Record<string, any>) => {
  const digestAfter = immediate
    ? new Date()
    : new Date(Date.now() + digestDelayMinutes() * 60_000)
  await getPool().query(
    `
      INSERT INTO ministry_alerts (
        subject_user_id, recipient_user_id, kind, title, message,
        assignment_id, event_id, ministry_id, dedupe_key, metadata,
        digest_after, acknowledgment_required, acknowledgment_deadline_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::JSONB, $11, $12, $13)
      ON CONFLICT (dedupe_key) DO NOTHING
    `,
    [
      subjectUserId,
      recipientUserId,
      kind,
      title,
      message,
      assignmentId || null,
      eventId || null,
      ministryId || null,
      dedupeKey,
      JSON.stringify(metadata),
      digestAfter,
      acknowledgmentRequired,
      acknowledgmentDeadline,
    ],
  )
}

export const sendSubstitutionRequestNotifications = async (
  substitutionRequestId: string,
) => {
  const requestResult = await getPool().query(
    `
      SELECT request.id, request.reason, request.subject_user_id,
        request.event_id, request.assignment_id, request.ministry_id,
        event.title AS event_title,
        event.start_time + COALESCE(responsibility.relative_start_minutes, 0)
          * INTERVAL '1 minute' AS duty_start_time,
        responsibility.name AS responsibility_name,
        responsibility.substitution_allowed,
        ministry.slug AS ministry_slug
      FROM assignment_change_requests request
      JOIN events event ON event.id = request.event_id
      JOIN event_responsibilities responsibility
        ON responsibility.id = request.responsibility_id
      JOIN ministries ministry ON ministry.id = request.ministry_id
      WHERE request.id = $1
        AND request.request_type = 'substitute'
        AND request.status = 'pending'
      LIMIT 1
    `,
    [substitutionRequestId],
  )
  const request = requestResult.rows[0]
  if (!request) return { offered: 0, leaders: 0 }
  const offers = await getPool().query(
    `
      SELECT offer.id, offer.recipient_user_id AS subject_user_id,
        COALESCE(guardian.guardian_user_id, offer.recipient_user_id)
          AS recipient_user_id
      FROM assignment_substitution_offers offer
      LEFT JOIN managed_profiles guardian
        ON guardian.child_user_id = offer.recipient_user_id
       AND guardian.status IN ('active', 'separation_pending')
      WHERE offer.change_request_id = $1
        AND offer.status = 'offered'
    `,
    [request.id],
  )
  const leaders = await getPool().query(
    `
      SELECT DISTINCT leader.id
      FROM users leader
      WHERE leader.status = 'active'
        AND (
          leader.global_role IN ('owner', 'super_admin')
          OR EXISTS (
            SELECT 1
            FROM ministry_members membership
            WHERE membership.user_id = leader.id
              AND membership.ministry_id = $1
              AND membership.status = 'active'
              AND membership.level IN ('owner', 'admin')
          )
        )
    `,
    [request.ministry_id],
  )
  const when = formatAssignmentDate(request.duty_start_time)
  for (const offer of offers.rows) {
    await enqueueAlert({
      subjectUserId: offer.subject_user_id,
      recipientUserId: offer.recipient_user_id,
      kind: "substitution_available",
      title: `Substitute needed: ${request.event_title}`,
      message: `${request.responsibility_name} · ${when}${request.reason ? ` · ${request.reason}` : ""}`,
      eventId: request.event_id,
      ministryId: request.ministry_id,
      dedupeKey: `substitution-offer:${request.id}:${offer.subject_user_id}:${offer.recipient_user_id}`,
      metadata: {
        notificationCategory: "schedule_changes",
        notificationUrl: `/${request.ministry_slug}?event=${request.event_id}`,
        privacySafeMessage: "An eligible ministry assignment needs a substitute.",
        substitutionRequestId: request.id,
      },
      immediate: true,
    })
  }
  if (offers.rowCount) {
    await getPool().query(
      `UPDATE assignment_substitution_offers SET notified_at = now(), updated_at = now() WHERE change_request_id = $1 AND status = 'offered'`,
      [request.id],
    )
  }
  const offeredUserIds = new Set(
    offers.rows.map((offer) => offer.subject_user_id),
  )
  for (const leader of leaders.rows) {
    if (offeredUserIds.has(leader.id)) continue
    await enqueueAlert({
      subjectUserId: leader.id,
      recipientUserId: leader.id,
      kind: "substitution_requested",
      title: request.substitution_allowed === false
        ? `Assignment change requested: ${request.event_title}`
        : `Substitute requested: ${request.event_title}`,
      message: `${request.responsibility_name} · ${when}${request.reason ? ` · ${request.reason}` : ""}`,
      assignmentId: request.assignment_id,
      eventId: request.event_id,
      ministryId: request.ministry_id,
      dedupeKey: `substitution-leader:${request.id}:${leader.id}`,
      metadata: {
        notificationCategory: "schedule_changes",
        notificationUrl: `/${request.ministry_slug}?event=${request.event_id}`,
        privacySafeMessage: request.substitution_allowed === false
          ? "A ministry assignment needs administrator attention."
          : "A ministry assignment needs a substitute.",
        substitutionRequestId: request.id,
      },
      immediate: true,
    })
  }
  return { offered: offers.rowCount || 0, leaders: leaders.rowCount || 0 }
}

export const sendSubstitutionAcceptedNotifications = async (
  substitutionRequestId: string,
) => {
  const result = await getPool().query(
    `
      SELECT request.id, request.subject_user_id,
        request.accepted_by_user_id, request.event_id, request.ministry_id,
        request.assignment_id, request.replacement_assignment_id,
        event.title AS event_title,
        event.start_time + COALESCE(responsibility.relative_start_minutes, 0)
          * INTERVAL '1 minute' AS duty_start_time,
        responsibility.name AS responsibility_name,
        ministry.slug AS ministry_slug,
        request.subject_user_id AS original_profile_user_id,
        request.accepted_by_user_id AS replacement_profile_user_id
      FROM assignment_change_requests request
      JOIN events event ON event.id = request.event_id
      JOIN event_responsibilities responsibility
        ON responsibility.id = request.responsibility_id
      JOIN ministries ministry ON ministry.id = request.ministry_id
      WHERE request.id = $1
        AND request.status = 'accepted'
      LIMIT 1
    `,
    [substitutionRequestId],
  )
  const request = result.rows[0]
  if (!request) return { queued: 0 }
  const leaders = await getPool().query(
    `
      SELECT DISTINCT leader.id
      FROM users leader
      WHERE leader.status = 'active'
        AND (
          leader.global_role IN ('owner', 'super_admin')
          OR EXISTS (
            SELECT 1 FROM ministry_members membership
            WHERE membership.user_id = leader.id
              AND membership.ministry_id = $1
              AND membership.status = 'active'
              AND membership.level IN ('owner', 'admin')
          )
        )
    `,
    [request.ministry_id],
  )
  const when = formatAssignmentDate(request.duty_start_time)
  const recipients = new Map<string, any>()
  for (const [subjectUserId, assignmentId] of [
    [request.original_profile_user_id, request.assignment_id],
    [request.replacement_profile_user_id, request.replacement_assignment_id],
  ]) {
    for (const recipientUserId of await notificationRecipientsForProfile(subjectUserId)) {
      recipients.set(`${subjectUserId}:${recipientUserId}`, {
        subjectUserId,
        recipientUserId,
        assignmentId,
      })
    }
  }
  for (const leader of leaders.rows) {
    if (![...recipients.values()].some((recipient) => recipient.recipientUserId === leader.id)) {
      recipients.set(`leader:${leader.id}`, {
        subjectUserId: leader.id,
        recipientUserId: leader.id,
        assignmentId: request.replacement_assignment_id,
      })
    }
  }
  for (const recipient of recipients.values()) {
    await enqueueAlert({
      ...recipient,
      kind: "substitution_accepted",
      title: `Substitute assigned: ${request.event_title}`,
      message: `${request.responsibility_name} · ${when} · substitution filled`,
      eventId: request.event_id,
      ministryId: request.ministry_id,
      dedupeKey: `substitution-accepted:${request.id}:${recipient.recipientUserId}`,
      metadata: {
        notificationCategory: "schedule_changes",
        notificationUrl: `/${request.ministry_slug}?event=${request.event_id}`,
        privacySafeMessage: "A ministry substitution has been filled.",
        substitutionRequestId: request.id,
      },
      immediate: true,
    })
  }
  return { queued: recipients.size }
}

const newYorkWeek = () => {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    values.weekday,
  )
  const localDate = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  )
  const today = localDate.toISOString().slice(0, 10)
  const daysSinceMonday = (weekdayIndex + 6) % 7
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday)
  return {
    hour: Number(values.hour),
    weekdayIndex,
    today,
    weekStart: localDate.toISOString().slice(0, 10),
  }
}

const loadHouseholdScheduleSummaries = async (
  startDayOffset: number,
  endDayOffset: number,
) => {
  const result = await getPool().query(
    `
      WITH household_profiles AS (
        SELECT
          profile.id AS profile_user_id,
          profile.id AS recipient_user_id,
          profile.first_name,
          profile.last_name
        FROM users profile
        WHERE profile.status = 'active'
          AND NOT EXISTS (
            SELECT 1
            FROM managed_profiles managed
            WHERE managed.child_user_id = profile.id
              AND managed.status IN ('active', 'separation_pending')
          )
        UNION ALL
        SELECT
          child.id AS profile_user_id,
          managed.guardian_user_id AS recipient_user_id,
          child.first_name,
          child.last_name
        FROM managed_profiles managed
        JOIN users child ON child.id = managed.child_user_id
        JOIN users guardian ON guardian.id = managed.guardian_user_id
        WHERE managed.status IN ('active', 'separation_pending')
          AND child.status = 'active'
          AND guardian.status = 'active'
      )
      SELECT profile.*,
        (
          SELECT count(DISTINCT assignment.event_id)::INT
          FROM responsibility_assignments assignment
          JOIN events event ON event.id = assignment.event_id
          JOIN event_responsibilities responsibility
            ON responsibility.id = assignment.responsibility_id
          WHERE assignment.user_id = profile.profile_user_id
            AND assignment.status IN ('pending', 'assigned', 'confirmed', 'change_requested')
            AND event.status = 'published'
            AND ((event.start_time + COALESCE(responsibility.relative_start_minutes, 0)
              * INTERVAL '1 minute') AT TIME ZONE 'America/New_York')::DATE
              >= (now() AT TIME ZONE 'America/New_York')::DATE + $1::INT
            AND ((event.start_time + COALESCE(responsibility.relative_start_minutes, 0)
              * INTERVAL '1 minute') AT TIME ZONE 'America/New_York')::DATE
              < (now() AT TIME ZONE 'America/New_York')::DATE + $2::INT
        ) AS upcoming_events,
        (
          SELECT count(*)::INT
          FROM ministry_message_recipients message_recipient
          WHERE message_recipient.profile_user_id = profile.profile_user_id
            AND message_recipient.read_at IS NULL
        ) AS unread_messages,
        (
          SELECT count(*)::INT
          FROM assignment_change_requests request
          WHERE request.subject_user_id = profile.profile_user_id
            AND request.status = 'pending'
            AND request.request_type = 'change'
        ) AS pending_requests,
        (
          SELECT count(*)::INT
          FROM assignment_change_requests request
          WHERE request.subject_user_id = profile.profile_user_id
            AND request.status = 'pending'
            AND request.request_type = 'substitute'
            AND (request.expires_at IS NULL OR request.expires_at > now())
        ) AS unfilled_sub_requests
      FROM household_profiles profile
      ORDER BY profile.recipient_user_id, lower(profile.last_name), lower(profile.first_name)
    `,
    [startDayOffset, endDayOffset],
  )
  const byRecipient = new Map<string, any[]>()
  for (const row of result.rows) {
    const profile = {
      profileUserId: row.profile_user_id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Profile",
      upcomingEvents: Number(row.upcoming_events || 0),
      unreadMessages: Number(row.unread_messages || 0),
      pendingRequests: Number(row.pending_requests || 0),
      unfilledSubRequests: Number(row.unfilled_sub_requests || 0),
    }
    const profiles = byRecipient.get(row.recipient_user_id) || []
    profiles.push(profile)
    byRecipient.set(row.recipient_user_id, profiles)
  }
  return byRecipient
}

const plural = (count: number, singular: string, pluralLabel = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralLabel}`

const possessive = (name: string) => `${name}${name.endsWith("s") ? "’" : "’s"}`

const buildScheduleSummary = (profiles: any[], label: string) =>
  profiles
    .map((profile) => {
      const counts = [
        profile.upcomingEvents
          ? `- ${plural(profile.upcomingEvents, "upcoming event")}`
          : null,
        profile.unreadMessages
          ? `- ${plural(profile.unreadMessages, "unopened message")}`
          : null,
        profile.pendingRequests
          ? `- ${plural(profile.pendingRequests, "pending request")}`
          : null,
        profile.unfilledSubRequests
          ? `- ${plural(profile.unfilledSubRequests, "unfilled sub request")}`
          : null,
      ].filter(Boolean)
      return `${possessive(profile.name)} ${label}\n${counts.join("\n")}`
    })
    .join("\n\n")

export const queueWeeklyAssignmentReviews = async () => {
  const week = newYorkWeek()
  if (week.weekdayIndex !== 1 || week.hour < 9) return 0
  const byRecipient = await loadHouseholdScheduleSummaries(0, 7)
  let queued = 0
  for (const [recipientUserId, allProfiles] of byRecipient) {
    const profiles = allProfiles.filter(
      (profile) =>
        profile.upcomingEvents ||
        profile.unreadMessages ||
        profile.pendingRequests ||
        profile.unfilledSubRequests,
    )
    if (!profiles.length) continue
    await enqueueAlert({
      subjectUserId: recipientUserId,
      recipientUserId,
      kind: "weekly_schedule_summary",
      title: "Your Weekly Schedule",
      message: buildScheduleSummary(profiles, "Weekly Schedule"),
      dedupeKey: `weekly-schedule:${recipientUserId}:${week.weekStart}`,
      metadata: {
        notificationCategory: "reminders",
        notificationUrl: "/",
        privacySafeMessage: "Your weekly ministry schedule is ready. Open the app to review it.",
        summaryType: "weekly",
        weekStart: week.weekStart,
        profiles,
      },
      immediate: true,
    })
    queued += 1
  }
  return queued
}

export const queueTomorrowSchedules = async () => {
  const day = newYorkWeek()
  if (day.hour < 9) return 0
  const byRecipient = await loadHouseholdScheduleSummaries(1, 2)
  let queued = 0
  for (const [recipientUserId, allProfiles] of byRecipient) {
    const profiles = allProfiles
      .filter((profile) => profile.upcomingEvents > 0)
      .map((profile) => ({
        ...profile,
        unreadMessages: 0,
        pendingRequests: 0,
        unfilledSubRequests: 0,
      }))
    if (!profiles.length) continue
    await enqueueAlert({
      subjectUserId: recipientUserId,
      recipientUserId,
      kind: "tomorrow_schedule_summary",
      title: "Tomorrow Schedule",
      message: buildScheduleSummary(profiles, "Tomorrow Schedule"),
      dedupeKey: `tomorrow-schedule:${recipientUserId}:${day.today}`,
      metadata: {
        notificationCategory: "reminders",
        notificationUrl: "/",
        privacySafeMessage: "You have ministry service scheduled tomorrow. Open the app to review it.",
        summaryType: "tomorrow",
        profiles,
      },
      immediate: true,
    })
    queued += 1
  }
  return queued
}

export const processUrgentStaffingShortages = async () => {
  const result = await getPool().query(
    `
      SELECT event.id AS event_id, event.title AS event_title,
        event.start_time, event.updated_at AS event_updated_at,
        responsibility.id AS responsibility_id,
        responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        ministry.slug AS ministry_slug,
        responsibility.quantity_needed,
        COALESCE(sum(
          CASE
            WHEN assignment.status IN ('pending', 'assigned', 'confirmed', 'change_requested')
              THEN assignment.quantity
            ELSE 0
          END
        ), 0)::INT AS assigned_quantity,
        COALESCE(max(assignment.updated_at), event.updated_at) AS staffing_updated_at
      FROM events event
      JOIN event_responsibilities responsibility
        ON responsibility.event_id = event.id
       AND responsibility.status <> 'cancelled'
       AND responsibility.unlimited_capacity = false
      JOIN ministries ministry
        ON ministry.id = COALESCE(responsibility.ministry_id, event.ministry_id)
      LEFT JOIN responsibility_assignments assignment
        ON assignment.responsibility_id = responsibility.id
      WHERE event.status = 'published'
        AND event.start_time > now()
        AND event.start_time <= now() + INTERVAL '3 hours'
      GROUP BY event.id, event.title, event.start_time, event.updated_at,
        responsibility.id, responsibility.name, responsibility.quantity_needed,
        responsibility.ministry_id, event.ministry_id, ministry.slug
      HAVING COALESCE(sum(
        CASE
          WHEN assignment.status IN ('pending', 'assigned', 'confirmed', 'change_requested')
            THEN assignment.quantity
          ELSE 0
        END
      ), 0) < responsibility.quantity_needed
      ORDER BY event.start_time, ministry_id, responsibility.name
    `,
  )
  const shortages = new Map<string, any[]>()
  for (const row of result.rows) {
    const key = `${row.event_id}:${row.ministry_id}`
    const rows = shortages.get(key) || []
    rows.push(row)
    shortages.set(key, rows)
  }
  let queued = 0
  for (const rows of shortages.values()) {
    const first = rows[0]
    const minutesUntilEvent = Math.max(
      0,
      (new Date(first.start_time).getTime() - Date.now()) / 60_000,
    )
    const acknowledgmentMinutes = minutesUntilEvent <= 60 ? 5 : 15
    const acknowledgmentDeadline = new Date(
      Date.now() + acknowledgmentMinutes * 60_000,
    )
    const shortageFingerprint = crypto
      .createHash("sha256")
      .update(
        rows
          .map(
            (row) =>
              `${row.responsibility_id}:${row.assigned_quantity}:${row.quantity_needed}:${new Date(row.staffing_updated_at).toISOString()}`,
          )
          .sort()
          .join("|"),
      )
      .digest("hex")
    const acknowledgmentGroupKey = `urgent-shortage:${first.event_id}:${first.ministry_id}:${shortageFingerprint}`
    const leaders = await getPool().query(
      `
        SELECT DISTINCT leader.id
        FROM users leader
        WHERE leader.status = 'active'
          AND (
            leader.global_role IN ('owner', 'super_admin')
            OR EXISTS (
              SELECT 1
              FROM ministry_members membership
              WHERE membership.user_id = leader.id
                AND membership.ministry_id = $1
                AND membership.status = 'active'
                AND membership.level IN ('owner', 'admin')
            )
          )
      `,
      [first.ministry_id],
    )
    const shortageText = rows
      .map(
        (row) =>
          `${row.responsibility_name} (${Number(row.quantity_needed) - Number(row.assigned_quantity)} open)`,
      )
      .join(", ")
    for (const leader of leaders.rows) {
      await enqueueAlert({
        subjectUserId: leader.id,
        recipientUserId: leader.id,
        kind: "urgent_staffing_shortage",
        title: `Urgent staffing shortage: ${first.event_title}`,
        message: `${shortageText} · ${formatAssignmentDate(first.start_time)} · acknowledge within ${acknowledgmentMinutes} minutes`,
        eventId: first.event_id,
        ministryId: first.ministry_id,
        dedupeKey: `${acknowledgmentGroupKey}:${leader.id}`,
        metadata: {
          notificationCategory: "schedule_changes",
          notificationUrl: `/${first.ministry_slug}?event=${first.event_id}`,
          privacySafeMessage: "An urgent ministry staffing shortage requires acknowledgment.",
          acknowledgmentGroupKey,
        },
        immediate: true,
        acknowledgmentRequired: true,
        acknowledgmentDeadline,
      })
      queued += 1
    }
  }
  return queued
}

export const processUrgentAcknowledgmentEscalations = async () => {
  const due = await getPool().query(
    `
      SELECT alert.metadata->>'acknowledgmentGroupKey' AS group_key,
        min(alert.event_id::STRING) AS event_id,
        min(alert.ministry_id::STRING) AS ministry_id,
        min(event.title) AS event_title,
        min(event.start_time) AS start_time
      FROM ministry_alerts alert
      JOIN events event ON event.id = alert.event_id
      WHERE alert.acknowledgment_required = true
        AND alert.acknowledged_at IS NULL
        AND alert.escalation_sent_at IS NULL
        AND alert.acknowledgment_deadline_at <= now()
        AND event.start_time > now()
        AND alert.metadata->>'acknowledgmentGroupKey' IS NOT NULL
      GROUP BY alert.metadata->>'acknowledgmentGroupKey'
      LIMIT 50
    `,
  )
  let escalated = 0
  for (const group of due.rows) {
    const claimed = await getPool().query(
      `
        UPDATE ministry_alerts
        SET escalation_sent_at = now(), updated_at = now()
        WHERE metadata->>'acknowledgmentGroupKey' = $1
          AND acknowledged_at IS NULL
          AND escalation_sent_at IS NULL
        RETURNING id
      `,
      [group.group_key],
    )
    if (!claimed.rowCount) continue
    const leaders = await getPool().query(
      `
        SELECT DISTINCT leader.id
        FROM users leader
        WHERE leader.status = 'active'
          AND (
            leader.global_role IN ('owner', 'super_admin')
            OR EXISTS (
              SELECT 1
              FROM ministry_members membership
              WHERE membership.user_id = leader.id
                AND membership.ministry_id = $1
                AND membership.status = 'active'
                AND membership.level IN ('owner', 'admin')
            )
          )
      `,
      [group.ministry_id],
    )
    for (const leader of leaders.rows) {
      await enqueueAlert({
        subjectUserId: leader.id,
        recipientUserId: leader.id,
        kind: "urgent_acknowledgment_overdue",
        title: `Urgent acknowledgment overdue: ${group.event_title}`,
        message: `Nobody acknowledged the urgent update for ${formatAssignmentDate(group.start_time)}. Open the event now.`,
        eventId: group.event_id,
        ministryId: group.ministry_id,
        dedupeKey: `urgent-escalation:${group.group_key}:${leader.id}`,
        metadata: {
          notificationCategory: "schedule_changes",
          notificationUrl: "/?section=events",
          privacySafeMessage: "An urgent ministry update has not been acknowledged.",
        },
        immediate: true,
      })
      escalated += 1
    }
  }
  return escalated
}

export const sendAssignmentNotification = async (
  assignmentId: string,
  _requestOrigin: string,
) => {
  const result = await getPool().query(
    `
      SELECT assignment.id, assignment.user_id, assignment.updated_at,
        event.id AS event_id,
        event.title AS event_title, event.start_time,
        event.start_time + COALESCE(responsibility.relative_start_minutes, 0)
          * INTERVAL '1 minute' AS duty_start_time,
        event.location,
        responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        COALESCE(guardian.guardian_user_id, assignment.user_id) AS recipient_user_id,
        ministry.slug AS ministry_slug
      FROM responsibility_assignments assignment
      JOIN events event ON event.id = assignment.event_id
      JOIN event_responsibilities responsibility ON responsibility.id = assignment.responsibility_id
      JOIN ministries ministry
        ON ministry.id = COALESCE(responsibility.ministry_id, event.ministry_id)
      LEFT JOIN managed_profiles guardian
        ON guardian.child_user_id = assignment.user_id
       AND guardian.status IN ('active', 'separation_pending')
      WHERE assignment.id = $1
        AND event.status = 'published'
      LIMIT 1
    `,
    [assignmentId],
  )
  const assignment = result.rows[0]
  if (!assignment) return { queued: false }
  const when = formatAssignmentDate(assignment.duty_start_time)
  await enqueueAlert({
    subjectUserId: assignment.user_id,
    recipientUserId: assignment.recipient_user_id,
    kind: "assignment_created",
    title: `New assignment: ${assignment.event_title}`,
    message: `${assignment.responsibility_name} · ${when}${assignment.location ? ` · ${assignment.location}` : ""}`,
    assignmentId,
    eventId: assignment.event_id,
    ministryId: assignment.ministry_id,
    dedupeKey: `assignment-created:${assignmentId}:${new Date(assignment.updated_at).toISOString()}`,
    metadata: {
      notificationCategory: "schedule_changes",
      notificationUrl: `/${assignment.ministry_slug}?event=${assignment.event_id}`,
      privacySafeMessage: "A ministry assignment was added to your schedule.",
    },
    immediate: true,
  })
  return { queued: true }
}

export const sendAssignmentChangeRequestedNotification = async (
  assignmentId: string,
) => {
  const result = await getPool().query(
    `
      SELECT assignment.user_id, assignment.updated_at, event.id AS event_id,
        event.title AS event_title, event.start_time,
        event.start_time + COALESCE(responsibility.relative_start_minutes, 0)
          * INTERVAL '1 minute' AS duty_start_time,
        responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        subject.first_name, subject.last_name
      FROM responsibility_assignments assignment
      JOIN events event ON event.id = assignment.event_id
      JOIN event_responsibilities responsibility ON responsibility.id = assignment.responsibility_id
      JOIN users subject ON subject.id = assignment.user_id
      WHERE assignment.id = $1 AND assignment.status = 'change_requested'
      LIMIT 1
    `,
    [assignmentId],
  )
  const assignment = result.rows[0]
  if (!assignment) return { queued: 0 }
  const leaders = await getPool().query(
    `
      SELECT DISTINCT leader.id
      FROM users leader
      WHERE leader.status = 'active'
        AND leader.id <> $2
        AND (
          leader.global_role IN ('owner', 'super_admin')
          OR EXISTS (
            SELECT 1 FROM ministry_members membership
            WHERE membership.user_id = leader.id
              AND membership.ministry_id = $1
              AND membership.status = 'active'
              AND membership.level IN ('owner', 'admin')
          )
        )
    `,
    [assignment.ministry_id, assignment.user_id],
  )
  const volunteerName = [assignment.first_name, assignment.last_name]
    .filter(Boolean).join(" ") || "A volunteer"
  for (const leader of leaders.rows) {
    await enqueueAlert({
      subjectUserId: leader.id,
      recipientUserId: leader.id,
      kind: "assignment_change_requested",
      title: "Assignment change requested",
      message: `${volunteerName} requested a change to ${assignment.responsibility_name} for ${assignment.event_title} · ${formatAssignmentDate(assignment.duty_start_time)}`,
      assignmentId,
      eventId: assignment.event_id,
      ministryId: assignment.ministry_id,
      dedupeKey: `assignment-change:${assignmentId}:${leader.id}:${new Date(assignment.updated_at).toISOString()}`,
      metadata: {
        notificationCategory: "schedule_changes",
        notificationUrl: "/",
        privacySafeMessage: "A ministry schedule needs a leader's attention.",
      },
      immediate: true,
    })
  }
  return { queued: leaders.rowCount || 0 }
}

export const sendEventScheduleNotifications = async (
  eventId: string,
  changeKind:
    | "published"
    | "changed"
    | "cancelled"
    | "substituted",
  ministryId?: string | null,
) => {
  const result = await getPool().query(
    `
      SELECT DISTINCT ON (
        assignment.id,
        COALESCE(guardian.guardian_user_id, assignment.user_id)
      )
        assignment.id AS assignment_id,
        assignment.user_id AS subject_user_id,
        COALESCE(guardian.guardian_user_id, assignment.user_id) AS recipient_user_id,
        event.id AS event_id,
        event.title AS event_title,
        event.start_time,
        event.start_time + COALESCE(responsibility.relative_start_minutes, 0)
          * INTERVAL '1 minute' AS duty_start_time,
        event.location,
        GREATEST(
          event.updated_at,
          responsibility.updated_at,
          assignment.updated_at,
          COALESCE(event_ministry.updated_at, event.updated_at)
        ) AS schedule_updated_at,
        responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        ministry.slug AS ministry_slug
      FROM responsibility_assignments assignment
      JOIN events event ON event.id = assignment.event_id
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      JOIN ministries ministry
        ON ministry.id = COALESCE(responsibility.ministry_id, event.ministry_id)
      LEFT JOIN event_ministries event_ministry
        ON event_ministry.event_id = event.id
       AND event_ministry.ministry_id = COALESCE(
         responsibility.ministry_id,
         event.ministry_id
       )
      LEFT JOIN managed_profiles guardian
        ON guardian.child_user_id = assignment.user_id
       AND guardian.status IN ('active', 'separation_pending')
      WHERE assignment.event_id = $1
        AND assignment.user_id IS NOT NULL
        AND assignment.status <> 'declined'
        AND ($2::UUID IS NULL OR COALESCE(responsibility.ministry_id, event.ministry_id) = $2)
      ORDER BY assignment.id,
        COALESCE(guardian.guardian_user_id, assignment.user_id)
    `,
    [eventId, ministryId || null],
  )
  const copy = {
    published: {
      title: "Schedule published",
      verb: "was published",
      safe: "A ministry schedule containing your assignment was published.",
    },
    changed: {
      title: "Schedule changed",
      verb: "was changed",
      safe: "A ministry schedule containing your assignment changed.",
    },
    cancelled: {
      title: "Event cancelled",
      verb: "was cancelled",
      safe: "A ministry event on your schedule was cancelled.",
    },
    substituted: {
      title: "Assignment substitute updated",
      verb: "has a substitute update",
      safe: "A substitute changed one of your ministry assignments.",
    },
  }[changeKind]

  const eventStartsAt = result.rows[0]?.start_time
    ? new Date(result.rows[0].start_time)
    : null
  const minutesUntilEvent = eventStartsAt
    ? (eventStartsAt.getTime() - Date.now()) / 60_000
    : Number.POSITIVE_INFINITY
  const urgent = minutesUntilEvent > 0 && minutesUntilEvent <= 180
  const acknowledgmentMinutes = minutesUntilEvent <= 60 ? 5 : 15
  const acknowledgmentDeadline = urgent
    ? new Date(Date.now() + acknowledgmentMinutes * 60_000)
    : null
  const urgentGroups = new Map<string, any>()

  for (const assignment of result.rows) {
    const acknowledgmentGroupKey = urgent
      ? `urgent-event:${changeKind}:${assignment.event_id}:${assignment.ministry_id}:${new Date(assignment.schedule_updated_at).toISOString()}`
      : null
    await enqueueAlert({
      subjectUserId: assignment.subject_user_id,
      recipientUserId: assignment.recipient_user_id,
      kind: `event_${changeKind}`,
      title: `${copy.title}: ${assignment.event_title}`,
      message: `${assignment.responsibility_name} · ${formatAssignmentDate(assignment.duty_start_time)}${assignment.location ? ` · ${assignment.location}` : ""} · ${copy.verb}`,
      assignmentId: assignment.assignment_id,
      eventId: assignment.event_id,
      ministryId: assignment.ministry_id,
      dedupeKey: `event-${changeKind}:${assignment.assignment_id}:${assignment.recipient_user_id}:${new Date(assignment.schedule_updated_at).toISOString()}`,
      metadata: {
        notificationCategory: "schedule_changes",
        notificationUrl: `/${assignment.ministry_slug}?event=${assignment.event_id}`,
        privacySafeMessage: copy.safe,
        ...(acknowledgmentGroupKey ? { acknowledgmentGroupKey } : {}),
      },
      immediate: true,
      acknowledgmentRequired: urgent,
      acknowledgmentDeadline,
    })
    if (urgent && minutesUntilEvent <= 30 && acknowledgmentGroupKey) {
      urgentGroups.set(acknowledgmentGroupKey, assignment)
    }
  }

  for (const [acknowledgmentGroupKey, assignment] of urgentGroups) {
    const leaders = await getPool().query(
      `
        SELECT DISTINCT leader.id
        FROM users leader
        WHERE leader.status = 'active'
          AND (
            leader.global_role IN ('owner', 'super_admin')
            OR EXISTS (
              SELECT 1
              FROM ministry_members membership
              WHERE membership.user_id = leader.id
                AND membership.ministry_id = $1
                AND membership.status = 'active'
                AND membership.level IN ('owner', 'admin')
            )
          )
      `,
      [assignment.ministry_id],
    )
    for (const leader of leaders.rows) {
      await enqueueAlert({
        subjectUserId: leader.id,
        recipientUserId: leader.id,
        kind: `urgent_event_${changeKind}`,
        title: `Urgent ${copy.title.toLowerCase()}: ${assignment.event_title}`,
        message: `${formatAssignmentDate(assignment.start_time)} · acknowledgment required within ${acknowledgmentMinutes} minutes`,
        eventId: assignment.event_id,
        ministryId: assignment.ministry_id,
        dedupeKey: `${acknowledgmentGroupKey}:leader:${leader.id}`,
        metadata: {
          notificationCategory: "schedule_changes",
          notificationUrl: `/${assignment.ministry_slug}?event=${assignment.event_id}`,
          privacySafeMessage: "An urgent ministry schedule update requires acknowledgment.",
          acknowledgmentGroupKey,
        },
        immediate: true,
        acknowledgmentRequired: true,
        acknowledgmentDeadline,
      })
    }
  }
  return { queued: result.rowCount || 0 }
}

export const queueAssignmentReminderAlert = async (reminderId: string) => {
  const result = await getPool().query(
    `
      SELECT reminder.id, reminder.reminder_type, reminder.subject_user_id,
        reminder.recipient_user_id,
        reminder.scheduled_for,
        reminder.event_id, reminder.assignment_id, event.title AS event_title,
        event.start_time,
        event.start_time + COALESCE(responsibility.relative_start_minutes, 0)
          * INTERVAL '1 minute' AS duty_start_time,
        event.location, responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        ministry.slug AS ministry_slug,
        subject.first_name AS subject_first_name,
        subject.last_name AS subject_last_name,
        EXISTS (
          SELECT 1 FROM managed_profiles managed_profile
          WHERE managed_profile.child_user_id = reminder.subject_user_id
            AND managed_profile.status IN ('active', 'separation_pending')
        ) AS is_managed_profile
      FROM ministry_reminders reminder
      JOIN responsibility_assignments assignment ON assignment.id = reminder.assignment_id
      JOIN events event ON event.id = reminder.event_id
      JOIN event_responsibilities responsibility ON responsibility.id = assignment.responsibility_id
      JOIN users subject ON subject.id = reminder.subject_user_id
      JOIN ministries ministry
        ON ministry.id = COALESCE(responsibility.ministry_id, event.ministry_id)
      WHERE reminder.id = $1
        AND assignment.status IN ('pending', 'assigned', 'confirmed', 'change_requested')
        AND event.status = 'published'
        AND event.updated_at = reminder.event_updated_at
      LIMIT 1
    `,
    [reminderId],
  )
  const reminder = result.rows[0]
  if (!reminder) {
    await getPool().query(
      `UPDATE ministry_reminders SET status = 'cancelled', canceled_at = now(), claimed_at = NULL, updated_at = now() WHERE id = $1`,
      [reminderId],
    )
    return false
  }
  await enqueueAlert({
    subjectUserId: reminder.recipient_user_id,
    recipientUserId: reminder.recipient_user_id,
    kind: "final_schedule_reminder",
    title: "Upcoming Ministry Schedule",
    message: "A scheduled ministry duty begins soon. Open the app to review the details.",
    eventId: reminder.event_id,
    ministryId: reminder.ministry_id,
    dedupeKey: `final-schedule:${reminder.recipient_user_id}:${reminder.event_id}:${new Date(reminder.scheduled_for).toISOString()}`,
    metadata: {
      notificationCategory: "reminders",
      notificationUrl: `/?event=${reminder.event_id}`,
      privacySafeMessage: "A scheduled ministry duty begins soon. Open the app to review it.",
      reminderType: "event_offset",
    },
    immediate: true,
  })
  await getPool().query(
    `UPDATE ministry_reminders SET status = 'sent', sent_at = now(), claimed_at = NULL, last_error = NULL, updated_at = now() WHERE id = $1`,
    [reminderId],
  )
  return true
}

const claimDueAlerts = async () => {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(`
      UPDATE ministry_alerts
      SET delivery_status = 'retry', next_attempt_at = now(), claimed_at = NULL,
          updated_at = now()
      WHERE delivery_status = 'processing'
        AND claimed_at < now() - INTERVAL '10 minutes'
    `)
    const result = await client.query(`
      WITH due AS (
        SELECT id FROM ministry_alerts
        WHERE delivery_status IN ('pending', 'retry')
          AND digest_after <= now()
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        ORDER BY digest_after, created_at
        LIMIT 200
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ministry_alerts alert
      SET delivery_status = 'processing', claimed_at = now(),
          attempt_count = attempt_count + 1, updated_at = now()
      FROM due WHERE alert.id = due.id
      RETURNING alert.*
    `)
    await client.query("COMMIT")
    return result.rows
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

const buildDigest = (alerts: any[]) => {
  if (alerts.length === 1 && alerts[0].metadata?.summaryType) {
    return `${alerts[0].title}\n\n${alerts[0].message}`
  }
  const groups = new Map<string, { name: string; alerts: any[] }>()
  for (const alert of alerts) {
    const group = groups.get(alert.subject_user_id) || {
      name: [alert.subject_first_name, alert.subject_last_name].filter(Boolean).join(" ") || "Profile",
      alerts: [],
    }
    group.alerts.push(alert)
    groups.set(alert.subject_user_id, group)
  }
  const summary = [...groups.values()].map(
    (group) => `${group.name}: ${group.alerts.length} ${group.alerts.length === 1 ? "alert" : "alerts"}`,
  )
  const details = [...groups.values()].flatMap((group) => [
    "",
    group.name,
    ...group.alerts.map((alert) => `• ${alert.title}\n  ${alert.message}`),
  ])
  return ["Ministry alerts", "", ...summary, ...details].join("\n")
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

const buildDigestHtml = (alerts: any[], origin: string) => {
  const summaryAlert = alerts.length === 1 && alerts[0].metadata?.summaryType
    ? alerts[0]
    : null
  const profileCards = summaryAlert
    ? (summaryAlert.metadata.profiles || []).map((profile: any) => {
        const rows = [
          profile.upcomingEvents
            ? plural(profile.upcomingEvents, "upcoming event")
            : null,
          profile.unreadMessages
            ? plural(profile.unreadMessages, "unopened message")
            : null,
          profile.pendingRequests
            ? plural(profile.pendingRequests, "pending request")
            : null,
          profile.unfilledSubRequests
            ? plural(profile.unfilledSubRequests, "unfilled sub request")
            : null,
        ].filter(Boolean)
        return `<div style="margin:0 0 14px;padding:18px;border:1px solid #eadfd5;border-radius:12px;background:#fff"><h2 style="margin:0 0 10px;color:#6f4f34;font-size:19px">${escapeHtml(possessive(profile.name))} ${escapeHtml(summaryAlert.metadata.summaryType === "weekly" ? "Weekly Schedule" : "Tomorrow Schedule")}</h2>${rows.map((row) => `<div style="padding:4px 0;color:#374151">• ${escapeHtml(row)}</div>`).join("")}</div>`
      }).join("")
    : alerts.map((alert) => `<div style="margin:0 0 12px;padding:16px;border:1px solid #eadfd5;border-radius:12px;background:#fff"><strong style="color:#6f4f34">${escapeHtml(alert.title)}</strong><p style="margin:8px 0 0;color:#4b5563">${escapeHtml(alert.message)}</p></div>`).join("")
  return `<!doctype html><html><body style="margin:0;background:#f7f3ef;font-family:Arial,sans-serif;color:#1f2937"><div style="max-width:640px;margin:auto;padding:28px 18px"><h1 style="margin:0 0 18px;color:#6f4f34;font-size:26px">${escapeHtml(summaryAlert?.title || "Ministry Update")}</h1>${profileCards}<p style="margin:24px 0 0;text-align:center"><a href="${escapeHtml(origin)}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#f97316;color:#fff;font-weight:700;text-decoration:none">Open Ministry App</a></p><p style="margin:18px 0 0;color:#6b7280;font-size:12px;text-align:center">Open the app for dates, duties, messages, and request details.</p></div></body></html>`
}

export const processNotificationDigests = async () => {
  if (!deliveryAllowed()) return 0
  const claimed = await claimDueAlerts()
  if (!claimed.length) return 0
  const ids = claimed.map((alert: any) => alert.id)
  const hydrated = await getPool().query(
    `
      SELECT alert.*, subject.first_name AS subject_first_name,
        subject.last_name AS subject_last_name, recipient.email AS recipient_email,
        COALESCE(NULLIF(recipient.phone, ''), recipient.telephone) AS recipient_phone,
        recipient.notification_email_enabled, recipient.notification_telegram_enabled,
        recipient.notification_sms_enabled, recipient.notification_push_enabled,
        recipient.notification_reminders_enabled,
        recipient.notification_schedule_changes_enabled,
        recipient.notification_announcements_enabled,
        recipient.notification_volunteer_opportunities_enabled,
        recipient.sms_transactional_consent_at,
        telegram.chat_id
      FROM ministry_alerts alert
      JOIN users subject ON subject.id = alert.subject_user_id
      JOIN users recipient ON recipient.id = alert.recipient_user_id
      LEFT JOIN telegram_connections telegram
        ON telegram.account_user_id = recipient.id AND telegram.status = 'active'
      WHERE alert.id = ANY($1)
      ORDER BY alert.created_at
    `,
    [ids],
  )
  const byRecipient = new Map<string, any[]>()
  for (const alert of hydrated.rows) {
    const rows = byRecipient.get(alert.recipient_user_id) || []
    rows.push(alert)
    byRecipient.set(alert.recipient_user_id, rows)
  }
  const origin = (process.env.SITE_URL || "https://ministry.mylatinmass.com").replace(/\/$/, "")
  let processed = 0
  for (const alerts of byRecipient.values()) {
    const first = alerts[0]
    const alertIds = alerts.map((alert) => alert.id)
    const previous = await getPool().query(
      `
        SELECT DISTINCT alert_id, channel
        FROM ministry_alert_deliveries
        WHERE alert_id = ANY($1)
          AND status IN ('sent', 'accepted')
      `,
      [alertIds],
    )
    const successful = new Set(
      previous.rows.map((row) => `${row.alert_id}:${row.channel}`),
    )
    const outcomes = new Map<string, Map<string, "success" | "failed" | "skipped">>()
    const errors = new Map<string, string[]>()
    const categoryFor = (alert: any) =>
      alert.metadata?.notificationCategory ||
      (String(alert.kind).includes("reminder") ||
      String(alert.kind).startsWith("confirmation_")
        ? "reminders"
        : String(alert.kind).startsWith("announcement")
          ? "announcements"
          : String(alert.kind).startsWith("volunteer_")
            ? "volunteer_opportunities"
            : "schedule_changes")
    const categoryEnabled = (alert: any) => {
      const category = categoryFor(alert)
      if (category === "reminders") return first.notification_reminders_enabled
      if (category === "announcements") return first.notification_announcements_enabled
      if (category === "volunteer_opportunities") {
        return first.notification_volunteer_opportunities_enabled
      }
      return first.notification_schedule_changes_enabled
    }
    const setOutcome = (
      alert: any,
      channel: string,
      outcome: "success" | "failed" | "skipped",
      error?: string | null,
    ) => {
      const channelOutcomes = outcomes.get(alert.id) || new Map()
      channelOutcomes.set(channel, outcome)
      outcomes.set(alert.id, channelOutcomes)
      if (error) {
        const alertErrors = errors.get(alert.id) || []
        alertErrors.push(`${channel}: ${error}`)
        errors.set(alert.id, alertErrors)
      }
    }
    const recordAttempts = async (
      targetAlerts: any[],
      channel: "email" | "telegram" | "sms" | "push",
      attempts: Array<Record<string, any>>,
    ) => {
      const succeeded = attempts.some((attempt) =>
        ["sent", "accepted"].includes(attempt.status),
      )
      const skipped = !succeeded && attempts.every((attempt) => attempt.status === "skipped")
      const outcome = succeeded ? "success" : skipped ? "skipped" : "failed"
      const finalError = attempts
        .filter((attempt) => attempt.errorCode)
        .map((attempt) => attempt.errorCode)
        .join("; ")
      for (const alert of targetAlerts) {
        for (const attempt of attempts) {
          await getPool().query(
            `
              INSERT INTO ministry_alert_deliveries (
                alert_id, recipient_user_id, channel, provider, status,
                attempt_number, provider_status, provider_message_id, error_code
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
              alert.id,
              alert.recipient_user_id,
              channel,
              attempt.provider,
              attempt.status,
              Number(alert.attempt_count || 1),
              attempt.providerStatus || null,
              attempt.providerMessageId || null,
              String(attempt.errorCode || "").slice(0, 160) || null,
            ],
          )
        }
        setOutcome(alert, channel, outcome, finalError || null)
      }
    }
    const pendingFor = (channel: string, enabled: boolean) =>
      enabled
        ? alerts.filter(
            (alert) =>
              categoryEnabled(alert) &&
              !successful.has(`${alert.id}:${channel}`),
          )
        : []

    const emailAlerts = pendingFor("email", first.notification_email_enabled)
    if (emailAlerts.length) {
      const attempts = first.recipient_email
        ? await sendReliableEmail({
            to: first.recipient_email,
            subject:
              emailAlerts.length === 1
                ? emailAlerts[0].title
                : `${emailAlerts.length} ministry updates`,
            text: `${buildDigest(emailAlerts)}\n\nOpen the Ministry app: ${origin}`,
            html: buildDigestHtml(emailAlerts, origin),
          })
        : [{ provider: "email", status: "skipped", errorCode: "email_address_missing" }]
      await recordAttempts(emailAlerts, "email", attempts)
    }

    const telegramAlerts = pendingFor(
      "telegram",
      first.notification_telegram_enabled,
    )
    if (telegramAlerts.length) {
      if (!first.chat_id) {
        await recordAttempts(telegramAlerts, "telegram", [
          {
            provider: "telegram",
            status: "skipped",
            errorCode: "telegram_connection_required",
          },
        ])
      } else {
        try {
          await sendTelegramMessage(
            first.chat_id,
            buildDigest(telegramAlerts),
            origin,
          )
          await recordAttempts(telegramAlerts, "telegram", [
            { provider: "telegram", status: "sent" },
          ])
        } catch (error: any) {
          await recordAttempts(telegramAlerts, "telegram", [
            {
              provider: "telegram",
              status: Number(error?.status || 0) === 403 ? "skipped" : "failed",
              providerStatus: Number(error?.status || 0) || null,
              errorCode: error?.message || "telegram_failed",
            },
          ])
        }
      }
    }

    const pushAlerts = pendingFor("push", first.notification_push_enabled)
    if (pushAlerts.length) {
      const attempts = await sendAccountPush({
        accountUserId: first.recipient_user_id,
        title: pushAlerts.length === 1 ? pushAlerts[0].title : "Ministry updates",
        body:
          pushAlerts.length === 1
            ? pushAlerts[0].metadata?.privacySafeMessage ||
              "Open the Ministry app to review an update."
            : `You have ${pushAlerts.length} ministry updates to review.`,
        url: pushAlerts[0].metadata?.notificationUrl || "/",
        tag: `ministry-alert-${pushAlerts.map((alert) => alert.id).join("-")}`,
      })
      await recordAttempts(pushAlerts, "push", attempts)
    }

    const smsAlerts = pendingFor("sms", first.notification_sms_enabled)
    if (smsAlerts.length) {
      try {
        const digestId = crypto
          .createHash("sha256")
          .update(smsAlerts.map((alert) => alert.id).sort().join("|"))
          .digest("hex")
        const result = await sendKlaviyoAlertDue({
          id: digestId,
          kind:
            smsAlerts.length === 1 ? smsAlerts[0].kind : "notification_digest",
          notification_category:
            smsAlerts.length === 1 ? categoryFor(smsAlerts[0]) : "mixed",
          privacy_safe_message:
            smsAlerts.length === 1
              ? smsAlerts[0].metadata?.privacySafeMessage ||
                "Open the Ministry app to review an update."
              : `You have ${smsAlerts.length} ministry updates. Open the Ministry app to review them.`,
          notification_url:
            smsAlerts[0].metadata?.notificationUrl || origin,
          subject_user_id: smsAlerts[0].subject_user_id,
          recipient_user_id: first.recipient_user_id,
          recipient_phone: first.recipient_phone,
          sms_transactional_consent_at: first.sms_transactional_consent_at,
        })
        await recordAttempts(smsAlerts, "sms", [
          {
            provider: "klaviyo",
            status: "accepted",
            providerStatus: result.status,
          },
        ])
      } catch (error: any) {
        const nonRetryable = [
          "klaviyo_not_configured",
          "invalid_phone_number",
          "sms_consent_required",
        ].includes(error?.code)
        await recordAttempts(smsAlerts, "sms", [
          {
            provider: "klaviyo",
            status: nonRetryable ? "skipped" : "failed",
            providerStatus: Number(error?.status || 0) || null,
            errorCode: error?.code || error?.message || "klaviyo_failed",
          },
        ])
      }
    }

    for (const alert of alerts) {
      if (!categoryEnabled(alert)) {
        await getPool().query(
          `
            UPDATE ministry_alerts
            SET delivery_status = 'skipped', claimed_at = NULL,
                next_attempt_at = NULL, last_error = 'Notification category disabled',
                updated_at = now()
            WHERE id = $1
          `,
          [alert.id],
        )
        processed += 1
        continue
      }
      const enabledChannels = [
        first.notification_email_enabled && "email",
        first.notification_telegram_enabled && "telegram",
        first.notification_sms_enabled && "sms",
        first.notification_push_enabled && "push",
      ].filter(Boolean) as string[]
      const channelOutcomes = outcomes.get(alert.id) || new Map()
      const resolved = enabledChannels.map((channel) =>
        successful.has(`${alert.id}:${channel}`)
          ? "success"
          : channelOutcomes.get(channel) || "failed",
      )
      const hasSuccess = resolved.includes("success")
      const hasFailure = resolved.includes("failed")
      const hasOnlySkips = resolved.length === 0 || resolved.every((value) => value === "skipped")
      const canRetry = Number(alert.attempt_count || 0) < 5
      const status = hasFailure
        ? canRetry
          ? "retry"
          : "failed"
        : hasOnlySkips
          ? "skipped"
          : hasSuccess
            ? "sent"
            : "skipped"
      const retryMinutes = Math.min(
        60,
        2 ** Math.max(0, Number(alert.attempt_count || 1) - 1),
      )
      await getPool().query(
        `
          UPDATE ministry_alerts
          SET delivery_status = $2,
              sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END,
              claimed_at = NULL,
              next_attempt_at = CASE
                WHEN $2 = 'retry' THEN now() + ($3::INT * INTERVAL '1 minute')
                ELSE NULL
              END,
              last_error = $4,
              updated_at = now()
          WHERE id = $1
        `,
        [
          alert.id,
          status,
          retryMinutes,
          (errors.get(alert.id) || []).join("; ").slice(0, 500) || null,
        ],
      )
      processed += 1
    }
  }
  return processed
}
