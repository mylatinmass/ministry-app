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

const enqueueAlert = async ({
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
}: Record<string, any>) => {
  const digestAfter = immediate
    ? new Date()
    : new Date(Date.now() + digestDelayMinutes() * 60_000)
  await getPool().query(
    `
      INSERT INTO ministry_alerts (
        subject_user_id, recipient_user_id, kind, title, message,
        assignment_id, event_id, ministry_id, dedupe_key, metadata,
        digest_after
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::JSONB, $11)
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
    ],
  )
}

export const sendAssignmentNotification = async (
  assignmentId: string,
  _requestOrigin: string,
) => {
  const result = await getPool().query(
    `
      SELECT assignment.id, assignment.user_id, assignment.updated_at,
        event.id AS event_id,
        event.title AS event_title, event.start_time, event.location,
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
  const when = formatAssignmentDate(assignment.start_time)
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
      message: `${volunteerName} requested a change to ${assignment.responsibility_name} for ${assignment.event_title} · ${formatAssignmentDate(assignment.start_time)}`,
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
      SELECT DISTINCT ON (assignment.id)
        assignment.id AS assignment_id,
        assignment.user_id AS subject_user_id,
        COALESCE(guardian.guardian_user_id, assignment.user_id) AS recipient_user_id,
        event.id AS event_id,
        event.title AS event_title,
        event.start_time,
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
      ORDER BY assignment.id
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

  for (const assignment of result.rows) {
    await enqueueAlert({
      subjectUserId: assignment.subject_user_id,
      recipientUserId: assignment.recipient_user_id,
      kind: `event_${changeKind}`,
      title: `${copy.title}: ${assignment.event_title}`,
      message: `${assignment.responsibility_name} · ${formatAssignmentDate(assignment.start_time)}${assignment.location ? ` · ${assignment.location}` : ""} · ${copy.verb}`,
      assignmentId: assignment.assignment_id,
      eventId: assignment.event_id,
      ministryId: assignment.ministry_id,
      dedupeKey: `event-${changeKind}:${assignment.assignment_id}:${new Date(assignment.schedule_updated_at).toISOString()}`,
      metadata: {
        notificationCategory: "schedule_changes",
        notificationUrl: `/${assignment.ministry_slug}?event=${assignment.event_id}`,
        privacySafeMessage: copy.safe,
      },
      immediate: true,
    })
  }
  return { queued: result.rowCount || 0 }
}

export const queueAssignmentReminderAlert = async (reminderId: string) => {
  const result = await getPool().query(
    `
      SELECT reminder.id, reminder.reminder_type, reminder.subject_user_id,
        reminder.recipient_user_id,
        reminder.event_id, reminder.assignment_id, event.title AS event_title,
        event.start_time, event.location, responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        ministry.slug AS ministry_slug
      FROM ministry_reminders reminder
      JOIN responsibility_assignments assignment ON assignment.id = reminder.assignment_id
      JOIN events event ON event.id = reminder.event_id
      JOIN event_responsibilities responsibility ON responsibility.id = assignment.responsibility_id
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
  const reminderCopy: Record<string, { kind: string; title: string; prefix: string; safe: string }> = {
    confirmation_midpoint: {
      kind: "confirmation_midpoint",
      title: `Please confirm: ${reminder.event_title}`,
      prefix: "Confirmation reminder",
      safe: "Please review and confirm an upcoming ministry assignment.",
    },
    confirmation_deadline: {
      kind: "confirmation_deadline",
      title: `Confirmation due: ${reminder.event_title}`,
      prefix: "Confirmation is due",
      safe: "Confirmation is due for an upcoming ministry assignment.",
    },
    confirmation_overdue: {
      kind: "confirmation_overdue",
      title: `Confirmation overdue: ${reminder.event_title}`,
      prefix: "Confirmation is overdue",
      safe: "Confirmation is overdue for an upcoming ministry assignment.",
    },
    one_week: {
      kind: "assignment_one_week_reminder",
      title: `Assignment next week: ${reminder.event_title}`,
      prefix: "One-week reminder",
      safe: "You have a ministry assignment in one week.",
    },
    event_offset: {
      kind: "assignment_reminder",
      title: `Upcoming assignment: ${reminder.event_title}`,
      prefix: "Upcoming assignment",
      safe: "You have an upcoming ministry assignment.",
    },
  }
  const copy = reminderCopy[reminder.reminder_type] || reminderCopy.event_offset
  await enqueueAlert({
    subjectUserId: reminder.subject_user_id,
    recipientUserId: reminder.recipient_user_id,
    kind: copy.kind,
    title: copy.title,
    message: `${copy.prefix}: ${reminder.responsibility_name} · ${formatAssignmentDate(reminder.start_time)}${reminder.location ? ` · ${reminder.location}` : ""}`,
    assignmentId: reminder.assignment_id,
    eventId: reminder.event_id,
    ministryId: reminder.ministry_id,
    dedupeKey: `assignment-reminder:${reminderId}`,
    metadata: {
      notificationCategory: "reminders",
      notificationUrl: `/${reminder.ministry_slug}?event=${reminder.event_id}`,
      privacySafeMessage: copy.safe,
      reminderType: reminder.reminder_type,
    },
    immediate: reminder.reminder_type === "confirmation_overdue",
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
            subject: `${emailAlerts.length} new ministry ${emailAlerts.length === 1 ? "alert" : "alerts"}`,
            text: `${buildDigest(emailAlerts)}\n\nOpen the Ministry app: ${origin}`,
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
        title: pushAlerts.length === 1 ? "Ministry update" : "Ministry updates",
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
