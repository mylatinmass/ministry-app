import nodemailer from "nodemailer"
import { getPool } from "../database"
import { sendTelegramMessage } from "./telegram"

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
}: Record<string, any>) => {
  const digestAfter = new Date(Date.now() + digestDelayMinutes() * 60_000)
  await getPool().query(
    `
      INSERT INTO ministry_alerts (
        subject_user_id, recipient_user_id, kind, title, message,
        assignment_id, event_id, ministry_id, dedupe_key, digest_after
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      SELECT assignment.id, assignment.user_id, event.id AS event_id,
        event.title AS event_title, event.start_time, event.location,
        responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        COALESCE(guardian.guardian_user_id, assignment.user_id) AS recipient_user_id
      FROM responsibility_assignments assignment
      JOIN events event ON event.id = assignment.event_id
      JOIN event_responsibilities responsibility ON responsibility.id = assignment.responsibility_id
      LEFT JOIN managed_profiles guardian
        ON guardian.child_user_id = assignment.user_id
       AND guardian.status IN ('active', 'separation_pending')
      WHERE assignment.id = $1
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
    dedupeKey: `assignment-created:${assignmentId}`,
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
    })
  }
  return { queued: leaders.rowCount || 0 }
}

export const queueAssignmentReminderAlert = async (reminderId: string) => {
  const result = await getPool().query(
    `
      SELECT reminder.id, reminder.subject_user_id, reminder.recipient_user_id,
        reminder.event_id, reminder.assignment_id, event.title AS event_title,
        event.start_time, event.location, responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id
      FROM ministry_reminders reminder
      JOIN responsibility_assignments assignment ON assignment.id = reminder.assignment_id
      JOIN events event ON event.id = reminder.event_id
      JOIN event_responsibilities responsibility ON responsibility.id = assignment.responsibility_id
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
    subjectUserId: reminder.subject_user_id,
    recipientUserId: reminder.recipient_user_id,
    kind: "assignment_reminder",
    title: `Upcoming assignment: ${reminder.event_title}`,
    message: `${reminder.responsibility_name} · ${formatAssignmentDate(reminder.start_time)}${reminder.location ? ` · ${reminder.location}` : ""}`,
    assignmentId: reminder.assignment_id,
    eventId: reminder.event_id,
    ministryId: reminder.ministry_id,
    dedupeKey: `assignment-reminder:${reminderId}`,
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
        recipient.notification_email_enabled, recipient.notification_telegram_enabled,
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
    const text = `${buildDigest(alerts)}\n\nOpen the Ministry app: ${origin}`
    let delivered = false
    let attempted = false
    const errors: string[] = []
    if (first.notification_email_enabled && first.recipient_email) {
      attempted = true
      try {
        if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) throw new Error("Email is not configured")
        const mailer = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
        })
        await mailer.sendMail({
          from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
          replyTo: process.env.GMAIL_USER,
          to: first.recipient_email,
          subject: `${alerts.length} new ministry ${alerts.length === 1 ? "alert" : "alerts"}`,
          text,
        })
        delivered = true
      } catch (error: any) {
        errors.push(`email: ${error?.message || "failed"}`)
      }
    }
    if (first.notification_telegram_enabled && first.chat_id) {
      attempted = true
      try {
        await sendTelegramMessage(first.chat_id, buildDigest(alerts), origin)
        delivered = true
      } catch (error: any) {
        errors.push(`telegram: ${error?.message || "failed"}`)
      }
    }
    const complete = delivered || !attempted
    const maxAttempts = Math.max(...alerts.map((alert) => Number(alert.attempt_count || 0)))
    const retry = !complete && maxAttempts < 5
    await getPool().query(
      `
        UPDATE ministry_alerts
        SET delivery_status = $2,
            sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END,
            claimed_at = NULL,
            next_attempt_at = CASE WHEN $2 = 'retry' THEN now() + INTERVAL '10 minutes' ELSE NULL END,
            last_error = $3,
            updated_at = now()
        WHERE id = ANY($1)
      `,
      [alerts.map((alert) => alert.id), complete ? "sent" : retry ? "retry" : "failed", errors.join("; ").slice(0, 500) || null],
    )
    processed += alerts.length
  }
  return processed
}
