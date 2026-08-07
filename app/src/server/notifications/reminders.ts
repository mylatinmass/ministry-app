import crypto from "node:crypto"
import nodemailer from "nodemailer"
import webpush from "web-push"
import { getPool } from "../database"
import { json } from "../request"
import { verifySchedulerRequest } from "./scheduler-auth"

const ASSIGNMENT_STATUSES = [
  "pending",
  "assigned",
  "confirmed",
  "change_requested",
]
const MAX_ATTEMPTS = 5

const deliveryAllowed = () =>
  process.env.VERCEL_ENV === "production" ||
  process.env.ALLOW_PREVIEW_DELIVERY === "true"

const reminderKey = (...parts: unknown[]) =>
  crypto
    .createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("|"))
    .digest("hex")

const reconcileReminders = async () => {
  const pool = getPool()
  const candidates = await pool.query(
    `
      SELECT
        ra.id AS assignment_id,
        ra.event_id,
        ra.user_id AS subject_user_id,
        COALESCE(mp.guardian_user_id, ra.user_id) AS recipient_user_id,
        e.start_time,
        e.updated_at AS event_updated_at,
        COALESCE(recipient.notification_lead_minutes, 60) AS lead_minutes
      FROM responsibility_assignments ra
      JOIN events e ON e.id = ra.event_id
      LEFT JOIN managed_profiles mp
        ON mp.child_user_id = ra.user_id
       AND mp.status IN ('active', 'separation_pending')
      JOIN users recipient
        ON recipient.id = COALESCE(mp.guardian_user_id, ra.user_id)
      WHERE ra.user_id IS NOT NULL
        AND ra.status = ANY($1)
        AND e.status = 'published'
        AND e.start_time > now() - INTERVAL '4 hours'
        AND e.start_time < now() + INTERVAL '31 days'
        AND recipient.status = 'active'
    `,
    [ASSIGNMENT_STATUSES],
  )

  const currentAssignmentIds = candidates.rows.map(
    (row: { assignment_id: string }) => row.assignment_id,
  )
  const client = await pool.connect()

  try {
    await client.query("BEGIN")
    for (const candidate of candidates.rows) {
      const scheduledFor = new Date(
        new Date(candidate.start_time).getTime() -
          Number(candidate.lead_minutes) * 60_000,
      )
      const dedupeKey = reminderKey(
        candidate.assignment_id,
        candidate.event_id,
        candidate.recipient_user_id,
        new Date(candidate.event_updated_at).toISOString(),
        scheduledFor.toISOString(),
      )

      await client.query(
        `
          INSERT INTO ministry_reminders (
            assignment_id, event_id, subject_user_id, recipient_user_id,
            scheduled_for, event_updated_at, dedupe_key
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (dedupe_key) DO UPDATE SET
            status = 'pending',
            attempt_count = 0,
            next_attempt_at = NULL,
            claimed_at = NULL,
            sent_at = NULL,
            canceled_at = NULL,
            last_error = NULL,
            updated_at = now()
          WHERE ministry_reminders.status IN ('cancelled', 'failed')
            AND ministry_reminders.scheduled_for > now()
        `,
        [
          candidate.assignment_id,
          candidate.event_id,
          candidate.subject_user_id,
          candidate.recipient_user_id,
          scheduledFor,
          candidate.event_updated_at,
          dedupeKey,
        ],
      )

      await client.query(
        `
          UPDATE ministry_reminders
          SET status = 'cancelled', canceled_at = now(), updated_at = now()
          WHERE assignment_id = $1
            AND dedupe_key <> $2
            AND status IN ('pending', 'retry', 'processing')
        `,
        [candidate.assignment_id, dedupeKey],
      )
    }

    await client.query(
      `
        UPDATE ministry_reminders reminder
        SET status = 'cancelled', canceled_at = now(), updated_at = now()
        WHERE reminder.status IN ('pending', 'retry', 'processing')
          AND NOT EXISTS (
            SELECT 1
            FROM responsibility_assignments assignment
            JOIN events event ON event.id = assignment.event_id
            WHERE assignment.id = reminder.assignment_id
              AND assignment.status = ANY($1)
              AND event.status = 'published'
          )
      `,
      [ASSIGNMENT_STATUSES],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }

  return currentAssignmentIds.length
}

const claimDueReminders = async () => {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(`
      UPDATE ministry_reminders
      SET status = 'retry',
          next_attempt_at = now(),
          claimed_at = NULL,
          updated_at = now()
      WHERE status = 'processing'
        AND claimed_at < now() - INTERVAL '10 minutes'
    `)
    const result = await client.query(`
      WITH due AS (
        SELECT id
        FROM ministry_reminders
        WHERE status IN ('pending', 'retry')
          AND scheduled_for <= now()
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        ORDER BY scheduled_for, created_at
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ministry_reminders reminder
      SET status = 'processing',
          claimed_at = now(),
          attempt_count = attempt_count + 1,
          updated_at = now()
      FROM due
      WHERE reminder.id = due.id
      RETURNING reminder.*
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

const loadReminderContext = async (reminderId: string) => {
  const result = await getPool().query(
    `
      SELECT
        reminder.*,
        assignment.status AS assignment_status,
        event.status AS event_status,
        event.start_time,
        event.updated_at AS current_event_updated_at,
        event.title,
        ministry.slug AS ministry_slug,
        recipient.email AS recipient_email,
        recipient.notification_email_enabled,
        recipient.notification_telegram_enabled,
        recipient.notification_sms_enabled,
        recipient.notification_push_enabled
      FROM ministry_reminders reminder
      JOIN responsibility_assignments assignment
        ON assignment.id = reminder.assignment_id
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      JOIN events event ON event.id = reminder.event_id
      JOIN ministries ministry
        ON ministry.id = COALESCE(responsibility.ministry_id, event.ministry_id)
      JOIN users recipient ON recipient.id = reminder.recipient_user_id
      WHERE reminder.id = $1
      LIMIT 1
    `,
    [reminderId],
  )
  return result.rows[0] || null
}

const recordDelivery = (
  reminderId: string,
  subscriptionId: string | null,
  channel: "push" | "email" | "telegram" | "sms",
  status: "sent" | "failed" | "skipped",
  providerStatus?: number | null,
  errorCode?: string | null,
) =>
  getPool().query(
    `
      INSERT INTO ministry_reminder_deliveries (
        reminder_id, subscription_id, channel, status,
        provider_status, error_code
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      reminderId,
      subscriptionId,
      channel,
      status,
      providerStatus || null,
      errorCode?.slice(0, 120) || null,
    ],
  )

const sendEmailFallback = async (context: any) => {
  if (
    !context.recipient_email ||
    !process.env.GMAIL_USER ||
    !process.env.GMAIL_PASS
  ) {
    await recordDelivery(
      context.id,
      null,
      "email",
      "skipped",
      null,
      "email_not_configured",
    )
    return false
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  })
  await transporter.sendMail({
    from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
    to: context.recipient_email,
    subject: "Upcoming ministry assignment",
    text: `You have an upcoming ministry assignment at ${new Date(
      context.start_time,
    ).toLocaleString("en-US", { timeZone: "America/New_York" })}. Open https://ministry.mylatinmass.com/${context.ministry_slug} for details.`,
  })
  await recordDelivery(context.id, null, "email", "sent")
  return true
}

const deliverReminder = async (reminder: any) => {
  const context = await loadReminderContext(reminder.id)
  if (!context) return

  if (
    context.event_status !== "published" ||
    !ASSIGNMENT_STATUSES.includes(context.assignment_status) ||
    new Date(context.current_event_updated_at).getTime() !==
      new Date(context.event_updated_at).getTime()
  ) {
    await getPool().query(
      `
        UPDATE ministry_reminders
        SET status = 'cancelled', canceled_at = now(), updated_at = now()
        WHERE id = $1
      `,
      [context.id],
    )
    return
  }

  if (!deliveryAllowed()) {
    await getPool().query(
      `
        UPDATE ministry_reminders
        SET status = 'pending', claimed_at = NULL, updated_at = now()
        WHERE id = $1
      `,
      [context.id],
    )
    return
  }

  let delivered = false
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || "mailto:notifications@mylatinmass.com"

  if (context.notification_push_enabled) {
    const subscriptions = await getPool().query(
      `
        SELECT id, endpoint, p256dh_key, auth_key
        FROM push_subscriptions
        WHERE account_user_id = $1 AND status = 'active'
      `,
      [context.recipient_user_id],
    )

    if (!subscriptions.rowCount) {
      await recordDelivery(
        context.id,
        null,
        "push",
        "skipped",
        null,
        "push_subscription_missing",
      )
    } else if (!publicKey || !privateKey) {
      await recordDelivery(
        context.id,
        null,
        "push",
        "skipped",
        null,
        "push_not_configured",
      )
    } else {
      webpush.setVapidDetails(subject, publicKey, privateKey)
      const payload = JSON.stringify({
        title: "Upcoming ministry assignment",
        body: `Your assignment begins ${new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        }).format(new Date(context.start_time))}.`,
        url: `/${context.ministry_slug}?event=${context.event_id}`,
        tag: `ministry-reminder-${context.assignment_id}`,
      })

      for (const subscription of subscriptions.rows) {
        try {
          const response = await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh_key,
                auth: subscription.auth_key,
              },
            },
            payload,
            { TTL: 3600, urgency: "high" },
          )
          delivered = true
          await recordDelivery(
            context.id,
            subscription.id,
            "push",
            "sent",
            response.statusCode,
          )
          await getPool().query(
            `
              UPDATE push_subscriptions
              SET last_success_at = now(), updated_at = now()
              WHERE id = $1
            `,
            [subscription.id],
          )
        } catch (error: any) {
          const statusCode = Number(error?.statusCode || 0) || null
          await recordDelivery(
            context.id,
            subscription.id,
            "push",
            "failed",
            statusCode,
            error?.code || error?.message,
          )
          if ([404, 410].includes(statusCode || 0)) {
            await getPool().query(
              `
                UPDATE push_subscriptions
                SET status = 'expired', updated_at = now()
                WHERE id = $1
              `,
              [subscription.id],
            )
          }
        }
      }
    }
  }

  if (context.notification_email_enabled) {
    try {
      delivered = (await sendEmailFallback(context)) || delivered
    } catch (error: any) {
      await recordDelivery(
        context.id,
        null,
        "email",
        "failed",
        null,
        error?.code || error?.message,
      )
    }
  }

  if (context.notification_telegram_enabled) {
    await recordDelivery(
      context.id,
      null,
      "telegram",
      "skipped",
      null,
      "telegram_connection_required",
    )
  }

  if (context.notification_sms_enabled) {
    await recordDelivery(
      context.id,
      null,
      "sms",
      "skipped",
      null,
      "sms_provider_not_configured",
    )
  }

  if (delivered) {
    await getPool().query(
      `
        UPDATE ministry_reminders
        SET status = 'sent', sent_at = now(), claimed_at = NULL,
            last_error = NULL, updated_at = now()
        WHERE id = $1
      `,
      [context.id],
    )
    return
  }

  const retry = context.attempt_count < MAX_ATTEMPTS
  const retryMinutes = Math.min(60, 2 ** Math.max(0, context.attempt_count - 1))
  await getPool().query(
    `
      UPDATE ministry_reminders
      SET status = $2,
          next_attempt_at = CASE
            WHEN $2 = 'retry' THEN now() + ($3 * INTERVAL '1 minute')
            ELSE NULL
          END,
          claimed_at = NULL,
          last_error = 'No notification channel succeeded',
          updated_at = now()
      WHERE id = $1
    `,
    [context.id, retry ? "retry" : "failed", retryMinutes],
  )
}

export const handleReminderProcessing = async (request: Request) => {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405, { Allow: "POST" })
  }
  if (!(await verifySchedulerRequest(request))) {
    return json({ message: "Unauthorized" }, 401)
  }

  const reconciled = await reconcileReminders()
  const reminders = await claimDueReminders()

  for (const reminder of reminders) {
    await deliverReminder(reminder)
  }

  return json({
    reconciledAssignments: reconciled,
    processedReminders: reminders.length,
  })
}
