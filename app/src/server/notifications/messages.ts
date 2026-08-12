import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  requireMinistryAccess,
  writeSchedulingAudit,
} from "../scheduling/authorization"
import { sendReliableEmail } from "./delivery"
import { sendTelegramMessage } from "./telegram"

const isGlobalManager = (user: Record<string, any>) =>
  ["owner", "super_admin"].includes(user.global_role)

const displayName = (row: Record<string, any>, prefix: string) =>
  [row[`${prefix}_first_name`], row[`${prefix}_last_name`]]
    .filter(Boolean)
    .join(" ") || row[`${prefix}_username`] || "Member"

const manageableMinistries = async (
  client: any,
  user: Record<string, any>,
) => {
  const global = isGlobalManager(user)
  const result = await client.query(
    `
      SELECT ministry.id, ministry.name
      FROM ministries ministry
      WHERE ministry.status = 'active'
        AND (
          $2::BOOL
          OR EXISTS (
            SELECT 1
            FROM ministry_members membership
            WHERE membership.ministry_id = ministry.id
              AND membership.user_id = $1
              AND membership.status = 'active'
              AND membership.level IN ('owner', 'admin')
          )
        )
      ORDER BY ministry.name
    `,
    [user.id, global],
  )
  return result.rows
}

const listMessages = async (client: any, context: any) => {
  const global = isGlobalManager(context.user)
  const [ministries, inboxResult, unreadResult, sentResult] = await Promise.all([
    manageableMinistries(client, context.user),
    client.query(
      `
        SELECT recipient.id AS recipient_id, recipient.read_at,
          recipient.delivery_status, recipient.delivered_at,
          message.id, message.audience_scope, message.channel,
          message.subject, message.body, message.created_at,
          ministry.id AS ministry_id, ministry.name AS ministry_name,
          sender.first_name AS sender_first_name,
          sender.last_name AS sender_last_name,
          sender.username AS sender_username
        FROM ministry_message_recipients recipient
        JOIN ministry_messages message ON message.id = recipient.message_id
        LEFT JOIN ministries ministry ON ministry.id = message.ministry_id
        JOIN users sender ON sender.id = message.created_by_profile_id
        WHERE recipient.profile_user_id = $1
        ORDER BY recipient.read_at IS NULL DESC, message.created_at DESC
        LIMIT 100
      `,
      [context.user.id],
    ),
    client.query(
      `
        SELECT count(*)::INT AS unread_count
        FROM ministry_message_recipients
        WHERE profile_user_id = $1 AND read_at IS NULL
      `,
      [context.user.id],
    ),
    client.query(
      `
        SELECT message.id, message.audience_scope, message.channel,
          message.subject, message.body, message.created_at,
          ministry.id AS ministry_id, ministry.name AS ministry_name,
          sender.first_name AS sender_first_name,
          sender.last_name AS sender_last_name,
          sender.username AS sender_username,
          count(recipient.id)::INT AS recipient_count,
          count(recipient.id) FILTER (
            WHERE recipient.is_delivery_target
              AND recipient.delivery_status = 'sent'
          )::INT AS sent_count,
          count(recipient.id) FILTER (
            WHERE recipient.is_delivery_target
              AND recipient.delivery_status = 'failed'
          )::INT AS failed_count,
          count(recipient.id) FILTER (
            WHERE recipient.is_delivery_target
              AND recipient.delivery_status = 'skipped'
          )::INT AS skipped_count,
          count(recipient.id) FILTER (
            WHERE recipient.is_delivery_target
              AND recipient.delivery_status IN ('pending', 'processing', 'retry')
          )::INT AS pending_count
        FROM ministry_messages message
        LEFT JOIN ministries ministry ON ministry.id = message.ministry_id
        JOIN users sender ON sender.id = message.created_by_profile_id
        LEFT JOIN ministry_message_recipients recipient
          ON recipient.message_id = message.id
        WHERE $2::BOOL
          OR (
            message.ministry_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM ministry_members membership
              WHERE membership.ministry_id = message.ministry_id
                AND membership.user_id = $1
                AND membership.status = 'active'
                AND membership.level IN ('owner', 'admin')
            )
          )
        GROUP BY message.id, message.audience_scope, message.channel,
          message.subject, message.body, message.created_at,
          ministry.id, ministry.name, sender.first_name,
          sender.last_name, sender.username
        ORDER BY message.created_at DESC
        LIMIT 100
      `,
      [context.user.id, global],
    ),
  ])

  const received = inboxResult.rows.map((row: any) => ({
    id: row.id,
    recipientId: row.recipient_id,
    audience: row.audience_scope,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    ministryId: row.ministry_id,
    ministryName: row.ministry_name,
    senderName: displayName(row, "sender"),
    read: Boolean(row.read_at),
    deliveryStatus: row.delivery_status,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
  }))
  const sent = sentResult.rows.map((row: any) => ({
    id: row.id,
    audience: row.audience_scope,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    ministryId: row.ministry_id,
    ministryName: row.ministry_name,
    senderName: displayName(row, "sender"),
    recipientCount: Number(row.recipient_count || 0),
    sentCount: Number(row.sent_count || 0),
    failedCount: Number(row.failed_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    pendingCount: Number(row.pending_count || 0),
    createdAt: row.created_at,
  }))
  return {
    unreadCount: Number(unreadResult.rows[0]?.unread_count || 0),
    canCompose: global || ministries.length > 0,
    canMessageAll: global,
    manageableMinistries: ministries,
    received,
    sent,
  }
}

const createMessage = async (client: any, context: any, body: any) => {
  const channel = String(body.channel || "").trim().toLowerCase()
  const audience = String(body.audience || "").trim().toLowerCase()
  const ministryId = String(body.ministryId || "").trim() || null
  const subject = String(body.subject || "").trim()
  const messageBody = String(body.body || "").trim()
  const global = isGlobalManager(context.user)

  if (!['email', 'telegram'].includes(channel)) {
    return json({ message: "Choose Email or Telegram" }, 400)
  }
  if (!['ministry', 'all_members'].includes(audience)) {
    return json({ message: "Choose a message audience" }, 400)
  }
  if (audience === "all_members" && !global) {
    return json({ message: "Only a Super Admin can message all members" }, 403)
  }
  if (audience === "ministry") {
    if (!ministryId) return json({ message: "Choose a ministry" }, 400)
    await requireMinistryAccess(client, context.user, ministryId, true)
  }
  if (!messageBody) return json({ message: "Enter a message" }, 400)
  if (channel === "telegram" && messageBody.length > 250) {
    return json({ message: "Telegram messages must be 250 characters or fewer" }, 400)
  }
  if (channel === "email" && !subject) {
    return json({ message: "Email messages require a subject" }, 400)
  }
  if (subject.length > 250) {
    return json({ message: "Email subjects must be 250 characters or fewer" }, 400)
  }

  await client.query("BEGIN")
  try {
    const messageResult = await client.query(
      `
        INSERT INTO ministry_messages (
          ministry_id, audience_scope, channel, subject, body,
          created_by_actor_id, created_by_profile_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        audience === "ministry" ? ministryId : null,
        audience,
        channel,
        channel === "email" ? subject : null,
        messageBody,
        context.actor.id,
        context.user.id,
      ],
    )
    const messageId = messageResult.rows[0].id
    const recipients = await client.query(
      `
        SELECT eligible.profile_user_id, eligible.delivery_account_user_id,
          row_number() OVER (
            PARTITION BY eligible.delivery_account_user_id
            ORDER BY eligible.is_managed_profile, eligible.profile_user_id
          ) = 1 AS is_delivery_target
        FROM (
          SELECT DISTINCT member.id AS profile_user_id,
            COALESCE(managed.guardian_user_id, member.id) AS delivery_account_user_id,
            managed.guardian_user_id IS NOT NULL AS is_managed_profile
          FROM users member
          LEFT JOIN managed_profiles managed
            ON managed.child_user_id = member.id
           AND managed.status IN ('active', 'separation_pending')
          WHERE member.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM ministry_members membership
              WHERE membership.user_id = member.id
                AND membership.status = 'active'
                AND ($1 = 'all_members' OR membership.ministry_id = $2)
            )
        ) eligible
      `,
      [audience, audience === "ministry" ? ministryId : null],
    )
    for (const recipient of recipients.rows) {
      await client.query(
        `
          INSERT INTO ministry_message_recipients (
            message_id, profile_user_id, delivery_account_user_id,
            is_delivery_target, delivery_status, last_error
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (message_id, profile_user_id) DO NOTHING
        `,
        [
          messageId,
          recipient.profile_user_id,
          recipient.delivery_account_user_id,
          recipient.is_delivery_target,
          recipient.is_delivery_target ? "pending" : "skipped",
          recipient.is_delivery_target ? null : "delivery_grouped_with_account",
        ],
      )
    }
    await writeSchedulingAudit(client, context, {
      action: "message.sent",
      entityType: "ministry_message",
      entityId: messageId,
      ministryId: audience === "ministry" ? ministryId : null,
      afterData: {
        audience,
        channel,
        subject: channel === "email" ? subject : null,
        recipientCount: recipients.rowCount || 0,
      },
    })
    await client.query("COMMIT")
    return json({
      message: "Message queued",
      id: messageId,
      recipientCount: recipients.rowCount || 0,
    }, 201)
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }
}

export const handleMessages = async (request: Request) => {
  if (!["GET", "POST", "PATCH"].includes(request.method)) {
    return json(
      { message: "Method not allowed" },
      405,
      { Allow: "GET, POST, PATCH" },
    )
  }
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    if (request.method === "GET") {
      return json(await listMessages(client, context))
    }
    const body = await request.json().catch(() => ({}))
    if (request.method === "POST") {
      return await createMessage(client, context, body)
    }
    if (body.action === "mark_all_read") {
      await client.query(
        `
          UPDATE ministry_message_recipients
          SET read_at = now(), updated_at = now()
          WHERE profile_user_id = $1 AND read_at IS NULL
        `,
        [context.user.id],
      )
    } else if (body.action === "mark_read" && body.messageId) {
      await client.query(
        `
          UPDATE ministry_message_recipients
          SET read_at = now(), updated_at = now()
          WHERE profile_user_id = $1
            AND message_id = $2
            AND read_at IS NULL
        `,
        [context.user.id, body.messageId],
      )
    } else {
      return json({ message: "Unknown message action" }, 400)
    }
    return json(await listMessages(client, context))
  } catch (error: any) {
    const status = Number(error?.status) ||
      (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    if (status >= 500) console.error("Unable to process ministry messages:", error)
    return json({
      message: status === 401
        ? "Session expired"
        : error?.message || "Unable to process messages",
    }, status)
  } finally {
    client.release()
  }
}

const deliveryAllowed = () =>
  process.env.VERCEL_ENV === "production" ||
  process.env.ALLOW_PREVIEW_DELIVERY === "true"

const claimDueRecipients = async () => {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(`
      UPDATE ministry_message_recipients
      SET delivery_status = 'retry', next_attempt_at = now(),
          claimed_at = NULL, updated_at = now()
      WHERE delivery_status = 'processing'
        AND claimed_at < now() - INTERVAL '10 minutes'
    `)
    const result = await client.query(`
      WITH due AS (
        SELECT id
        FROM ministry_message_recipients
        WHERE is_delivery_target
          AND delivery_status IN ('pending', 'retry')
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        ORDER BY created_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ministry_message_recipients recipient
      SET delivery_status = 'processing', claimed_at = now(),
          attempt_count = attempt_count + 1, updated_at = now()
      FROM due
      WHERE recipient.id = due.id
      RETURNING recipient.*
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

const finishDelivery = async (
  recipient: any,
  status: "sent" | "skipped" | "failed" | "retry",
  provider: string,
  error: string | null = null,
  providerMessageId: string | null = null,
) => {
  const retryAt = status === "retry"
    ? new Date(Date.now() + Math.min(60, 2 ** recipient.attempt_count) * 60_000)
    : null
  await getPool().query(
    `
      UPDATE ministry_message_recipients
      SET delivery_status = $2, provider = $3, provider_message_id = $4,
          last_error = $5, next_attempt_at = $6, claimed_at = NULL,
          delivered_at = CASE WHEN $2 = 'sent' THEN now() ELSE delivered_at END,
          updated_at = now()
      WHERE id = $1
    `,
    [recipient.id, status, provider, providerMessageId, error, retryAt],
  )
}

export const processMinistryMessageDeliveries = async () => {
  if (!deliveryAllowed()) return 0
  const claimed = await claimDueRecipients()
  if (!claimed.length) return 0
  const ids = claimed.map((recipient: any) => recipient.id)
  const result = await getPool().query(
    `
      SELECT recipient.*, message.channel, message.subject, message.body,
        account.email, account.notification_email_enabled,
        account.notification_telegram_enabled,
        account.notification_announcements_enabled,
        telegram.chat_id
      FROM ministry_message_recipients recipient
      JOIN ministry_messages message ON message.id = recipient.message_id
      JOIN users account ON account.id = recipient.delivery_account_user_id
      LEFT JOIN telegram_connections telegram
        ON telegram.account_user_id = account.id
       AND telegram.status = 'active'
      WHERE recipient.id = ANY($1)
    `,
    [ids],
  )
  const origin = (process.env.SITE_URL || "https://ministry.mylatinmass.com")
    .replace(/\/$/, "")
  for (const recipient of result.rows) {
    const channelEnabled = recipient.channel === "email"
      ? recipient.notification_email_enabled
      : recipient.notification_telegram_enabled
    if (!recipient.notification_announcements_enabled || !channelEnabled) {
      await finishDelivery(
        recipient,
        "skipped",
        recipient.channel,
        "recipient_notifications_disabled",
      )
      continue
    }
    if (recipient.channel === "email") {
      if (!recipient.email) {
        await finishDelivery(recipient, "skipped", "email", "email_address_missing")
        continue
      }
      const attempts = await sendReliableEmail({
        to: recipient.email,
        subject: recipient.subject,
        text: `${recipient.body}\n\nOpen Messages: ${origin}/?section=messages`,
      })
      const sent = attempts.find((attempt) => attempt.status === "sent")
      const skipped = attempts.every((attempt) => attempt.status === "skipped")
      const error = attempts
        .map((attempt) => attempt.errorCode)
        .filter(Boolean)
        .join("; ") || null
      await finishDelivery(
        recipient,
        sent ? "sent" : skipped ? "skipped" : recipient.attempt_count >= 5 ? "failed" : "retry",
        sent?.provider || attempts.at(-1)?.provider || "email",
        error,
        sent?.providerMessageId || null,
      )
      continue
    }
    if (!recipient.chat_id) {
      await finishDelivery(
        recipient,
        "skipped",
        "telegram",
        "telegram_connection_required",
      )
      continue
    }
    try {
      const response = await sendTelegramMessage(
        recipient.chat_id,
        recipient.body,
        `${origin}/?section=messages`,
      )
      await finishDelivery(
        recipient,
        "sent",
        "telegram",
        null,
        response?.message_id ? String(response.message_id) : null,
      )
    } catch (error: any) {
      const permanent = [400, 403].includes(Number(error?.status || 0))
      await finishDelivery(
        recipient,
        permanent ? "skipped" : recipient.attempt_count >= 5 ? "failed" : "retry",
        "telegram",
        error?.message || "telegram_failed",
      )
    }
  }
  return result.rowCount || 0
}
