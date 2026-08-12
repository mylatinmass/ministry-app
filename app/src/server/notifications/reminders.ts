import crypto from "node:crypto"
import { getPool } from "../database"
import { json } from "../request"
import { verifySchedulerRequest } from "./scheduler-auth"
import { processKlaviyoProfileSyncs } from "./klaviyo-profiles"
import {
  processUrgentAcknowledgmentEscalations,
  processUrgentStaffingShortages,
  processNotificationDigests,
  queueAssignmentReminderAlert,
  queueWeeklyAssignmentReviews,
} from "./assignment-notifications"
import { processMinistryMessageDeliveries } from "./messages"

const ASSIGNMENT_STATUSES = [
  "pending",
  "assigned",
  "confirmed",
  "change_requested",
]
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
        ra.status AS assignment_status,
        ra.created_at AS assignment_created_at,
        ra.event_id,
        ra.user_id AS subject_user_id,
        COALESCE(mp.guardian_user_id, ra.user_id) AS recipient_user_id,
        e.start_time,
        e.published_at,
        e.confirmation_deadline_at,
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
      const eventStart = new Date(candidate.start_time)
      const publicationTime = new Date(
        candidate.published_at || candidate.event_updated_at,
      )
      const explicitDeadline = candidate.confirmation_deadline_at
        ? new Date(candidate.confirmation_deadline_at)
        : null
      const oneWeekBefore = new Date(eventStart.getTime() - 7 * 86_400_000)
      const publicationMidpoint = new Date(
        Math.min(
          eventStart.getTime() - 60_000,
          publicationTime.getTime() +
            Math.max(
              60_000,
              (eventStart.getTime() - publicationTime.getTime()) / 2,
            ),
        ),
      )
      const defaultDeadline =
        oneWeekBefore > publicationTime
          ? oneWeekBefore
          : publicationMidpoint
      const confirmationDeadline =
        explicitDeadline && explicitDeadline < eventStart
          ? explicitDeadline
          : defaultDeadline
      const schedules: Array<{ type: string; at: Date }> = [
        {
          type: "event_offset",
          at: new Date(
            eventStart.getTime() - Number(candidate.lead_minutes) * 60_000,
          ),
        },
      ]
      if (oneWeekBefore > publicationTime) {
        schedules.push({ type: "one_week", at: oneWeekBefore })
      }
      if (["pending", "assigned"].includes(candidate.assignment_status)) {
        const confirmationStart = new Date(
          Math.max(
            publicationTime.getTime(),
            new Date(candidate.assignment_created_at).getTime(),
          ),
        )
        const midpoint = new Date(
          confirmationStart.getTime() +
            (confirmationDeadline.getTime() - confirmationStart.getTime()) / 2,
        )
        if (midpoint > confirmationStart && midpoint < confirmationDeadline) {
          schedules.push({ type: "confirmation_midpoint", at: midpoint })
        }
        schedules.push(
          { type: "confirmation_deadline", at: confirmationDeadline },
          {
            type: "confirmation_overdue",
            at: new Date(confirmationDeadline.getTime() + 60 * 60_000),
          },
        )
      }

      for (const schedule of schedules) {
        const dedupeKey = reminderKey(
          candidate.assignment_id,
          candidate.event_id,
          candidate.recipient_user_id,
          schedule.type,
          new Date(candidate.event_updated_at).toISOString(),
          schedule.at.toISOString(),
        )
        await client.query(
          `
            INSERT INTO ministry_reminders (
              assignment_id, event_id, subject_user_id, recipient_user_id,
              scheduled_for, event_updated_at, reminder_type, dedupe_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
            schedule.at,
            candidate.event_updated_at,
            schedule.type,
            dedupeKey,
          ],
        )
        await client.query(
          `
            UPDATE ministry_reminders
            SET status = 'cancelled', canceled_at = now(), updated_at = now()
            WHERE assignment_id = $1
              AND reminder_type = $2
              AND dedupe_key <> $3
              AND status IN ('pending', 'retry', 'processing')
          `,
          [candidate.assignment_id, schedule.type, dedupeKey],
        )
      }
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

    await client.query(
      `
        UPDATE ministry_reminders reminder
        SET status = 'cancelled', canceled_at = now(), updated_at = now()
        WHERE reminder.status IN ('pending', 'retry', 'processing')
          AND reminder.reminder_type IN (
            'confirmation_midpoint',
            'confirmation_deadline',
            'confirmation_overdue'
          )
          AND EXISTS (
            SELECT 1
            FROM responsibility_assignments assignment
            WHERE assignment.id = reminder.assignment_id
              AND assignment.status NOT IN ('pending', 'assigned')
          )
      `,
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

export const handleReminderProcessing = async (request: Request) => {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405, { Allow: "POST" })
  }
  if (!(await verifySchedulerRequest(request))) {
    return json({ message: "Unauthorized" }, 401)
  }

  const klaviyoProfiles = await processKlaviyoProfileSyncs()
  const reconciled = await reconcileReminders()
  const reminders = await claimDueReminders()

  for (const reminder of reminders) {
    await queueAssignmentReminderAlert(reminder.id)
  }

  const weeklyReviews = await queueWeeklyAssignmentReviews()
  const urgentShortages = await processUrgentStaffingShortages()
  const urgentEscalations = await processUrgentAcknowledgmentEscalations()
  const processedAlerts = await processNotificationDigests()
  const processedMessages = await processMinistryMessageDeliveries()

  return json({
    klaviyoProfiles,
    reconciledAssignments: reconciled,
    processedReminders: reminders.length,
    weeklyReviews,
    urgentShortages,
    urgentEscalations,
    processedAlerts,
    processedMessages,
  })
}
