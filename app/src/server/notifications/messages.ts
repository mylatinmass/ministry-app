import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  requireMinistryAccess,
  writeSchedulingAudit,
} from "../scheduling/authorization"
import { sendAccountPush, sendReliableEmail } from "./delivery"
import { sendKlaviyoAlertDue } from "./klaviyo"
import { sendTelegramMessage } from "./telegram"

const isGlobalManager = (user: Record<string, any>) =>
  ["owner", "super_admin"].includes(user.global_role)

const publicMessageType = (channel: unknown) =>
  String(channel || "").toLowerCase() === "email" ? "email" : "alert"

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
        JOIN ministry_accounts sender ON sender.id = message.created_by_profile_id
        WHERE recipient.profile_user_id = $1
          AND recipient.delivery_account_user_id = $2
        ORDER BY recipient.read_at IS NULL DESC, message.created_at DESC
        LIMIT 100
      `,
      [context.user.id, context.actor.id],
    ),
    client.query(
      `
        SELECT count(*)::INT AS unread_count
        FROM ministry_message_recipients
        WHERE profile_user_id = $1
          AND delivery_account_user_id = $2
          AND read_at IS NULL
      `,
      [context.user.id, context.actor.id],
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
        JOIN ministry_accounts sender ON sender.id = message.created_by_profile_id
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
    channel: publicMessageType(row.channel),
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
    channel: publicMessageType(row.channel),
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
  const messageType = String(body.messageType || body.channel || "").trim().toLowerCase()
  const channel = messageType === "alert" ? "telegram" : messageType
  const audience = String(body.audience || "").trim().toLowerCase()
  const ministryId = String(body.ministryId || "").trim() || null
  const subject = String(body.subject || "").trim()
  const messageBody = String(body.body || "").trim()
  const global = isGlobalManager(context.user)

  if (!['email', 'alert'].includes(messageType)) {
    return json({ message: "Choose Email or Alert" }, 400)
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
  if (messageType === "alert" && messageBody.length > 200) {
    return json({ message: "Alerts must be 200 characters or fewer" }, 400)
  }
  if (channel === "email" && !subject) {
    return json({ message: "Email messages require a subject" }, 400)
  }
  if (subject.length > 250) {
    return json({ message: "Email subjects must be 250 characters or fewer" }, 400)
  }

  let committed = false
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
          FROM ministry_accounts member
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
      const recipientResult = await client.query(
        `
          INSERT INTO ministry_message_recipients (
            message_id, profile_user_id, delivery_account_user_id,
            is_delivery_target, delivery_status, last_error
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (
            message_id, profile_user_id, delivery_account_user_id
          ) DO NOTHING
          RETURNING id
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
      const recipientId = recipientResult.rows[0]?.id
      if (recipient.is_delivery_target && recipientId) {
        const channels = messageType === "email"
          ? ["email"]
          : ["telegram", "sms", "push"]
        for (const deliveryChannel of channels) {
          await client.query(
            `INSERT INTO ministry_message_deliveries (recipient_id, channel)
             VALUES ($1,$2) ON CONFLICT (recipient_id, channel) DO NOTHING`,
            [recipientId, deliveryChannel],
          )
        }
      }
    }
    await writeSchedulingAudit(client, context, {
      action: "message.sent",
      entityType: "ministry_message",
      entityId: messageId,
      ministryId: audience === "ministry" ? ministryId : null,
      afterData: {
        audience,
        messageType,
        subject: messageType === "email" ? subject : null,
        recipientCount: recipients.rowCount || 0,
      },
    })
    await client.query("COMMIT")
    committed = true
    const processedDeliveryCount =
      await processMinistryMessageDeliveries(messageId)
    const deliverySummaryResult = await client.query(
      `
        SELECT
          count(*) FILTER (WHERE delivery.status = 'sent')::INT AS accepted_count,
          count(*) FILTER (WHERE delivery.status = 'skipped')::INT AS skipped_count,
          count(*) FILTER (WHERE delivery.status = 'failed')::INT AS failed_count,
          count(*) FILTER (
            WHERE delivery.status IN ('pending', 'processing', 'retry')
          )::INT AS pending_count
        FROM ministry_message_deliveries delivery
        JOIN ministry_message_recipients recipient
          ON recipient.id = delivery.recipient_id
        WHERE recipient.message_id = $1
      `,
      [messageId],
    )
    const deliverySummary = deliverySummaryResult.rows[0] || {}
    return json({
      message: processedDeliveryCount > 0 ? "Message processed" : "Message queued",
      id: messageId,
      recipientCount: recipients.rowCount || 0,
      processedDeliveryCount,
      deliverySummary: {
        acceptedCount: Number(deliverySummary.accepted_count || 0),
        skippedCount: Number(deliverySummary.skipped_count || 0),
        failedCount: Number(deliverySummary.failed_count || 0),
        pendingCount: Number(deliverySummary.pending_count || 0),
      },
    }, 201)
  } catch (error) {
    if (!committed) await client.query("ROLLBACK").catch(() => {})
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
          WHERE profile_user_id = $1
            AND delivery_account_user_id = $2
            AND read_at IS NULL
        `,
        [context.user.id, context.actor.id],
      )
    } else if (body.action === "mark_read" && body.messageId) {
      await client.query(
        `
          UPDATE ministry_message_recipients
          SET read_at = now(), updated_at = now()
          WHERE profile_user_id = $1
            AND message_id = $2
            AND delivery_account_user_id = $3
            AND read_at IS NULL
        `,
        [context.user.id, body.messageId, context.actor.id],
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
  process.env.MINISTRY_OUTBOUND_DELIVERY_ENABLED === "true" &&
  (process.env.VERCEL_ENV === "production" ||
    process.env.ALLOW_PREVIEW_DELIVERY === "true")

const ensureLegacyMessageDeliveries = async () => {
  await getPool().query(
    `INSERT INTO ministry_message_deliveries (
       recipient_id, channel, status, attempt_count, next_attempt_at,
       claimed_at, delivered_at, provider, provider_message_id, last_error,
       created_at, updated_at
     )
     SELECT recipient.id, message.channel, recipient.delivery_status,
       recipient.attempt_count, recipient.next_attempt_at, recipient.claimed_at,
       recipient.delivered_at, recipient.provider, recipient.provider_message_id,
       recipient.last_error, recipient.created_at, recipient.updated_at
     FROM ministry_message_recipients recipient
     JOIN ministry_messages message ON message.id=recipient.message_id
     WHERE recipient.is_delivery_target
       AND NOT EXISTS (
         SELECT 1 FROM ministry_message_deliveries delivery
         WHERE delivery.recipient_id=recipient.id
       )
     ON CONFLICT (recipient_id, channel) DO NOTHING`,
  )
}

const claimDueDeliveries = async (messageId: string | null = null) => {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(`
      UPDATE ministry_message_deliveries
      SET status = 'retry', next_attempt_at = now(),
          claimed_at = NULL, updated_at = now()
      WHERE status = 'processing'
        AND claimed_at < now() - INTERVAL '10 minutes'
    `)
    const result = await client.query(`
      WITH due AS (
        SELECT delivery.id
        FROM ministry_message_deliveries delivery
        WHERE delivery.status IN ('pending', 'retry')
          AND (
            delivery.next_attempt_at IS NULL
            OR delivery.next_attempt_at <= now()
          )
          AND (
            $1::UUID IS NULL
            OR EXISTS (
              SELECT 1
              FROM ministry_message_recipients recipient
              WHERE recipient.id = delivery.recipient_id
                AND recipient.message_id = $1
            )
          )
        ORDER BY delivery.created_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ministry_message_deliveries delivery
      SET status = 'processing', claimed_at = now(),
          attempt_count = attempt_count + 1, updated_at = now()
      FROM due
      WHERE delivery.id = due.id
      RETURNING delivery.*
    `, [messageId])
    await client.query("COMMIT")
    return result.rows
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

const refreshRecipientDeliveryStatus = async (recipientId: string) => {
  const summary = await getPool().query(
    `SELECT
       count(*) FILTER (WHERE status IN ('pending','processing','retry'))::INT AS pending_count,
       count(*) FILTER (WHERE status='sent')::INT AS sent_count,
       count(*) FILTER (WHERE status='failed')::INT AS failed_count,
       count(*) FILTER (WHERE status='skipped')::INT AS skipped_count,
       max(delivered_at) AS delivered_at,
       string_agg(last_error, '; ') FILTER (WHERE last_error IS NOT NULL) AS errors
     FROM ministry_message_deliveries WHERE recipient_id=$1`,
    [recipientId],
  )
  const counts = summary.rows[0] || {}
  const status = Number(counts.pending_count || 0) > 0
    ? "pending"
    : Number(counts.sent_count || 0) > 0
      ? "sent"
      : Number(counts.failed_count || 0) > 0
        ? "failed"
        : "skipped"
  await getPool().query(
    `UPDATE ministry_message_recipients
     SET delivery_status=$2, delivered_at=COALESCE($3, delivered_at),
       last_error=$4, claimed_at=NULL, next_attempt_at=NULL, updated_at=now()
     WHERE id=$1`,
    [recipientId, status, counts.delivered_at || null, counts.errors || null],
  )
}

const finishDelivery = async (
  delivery: any,
  status: "sent" | "skipped" | "failed" | "retry",
  provider: string,
  error: string | null = null,
  providerMessageId: string | null = null,
) => {
  const retryAt = status === "retry"
    ? new Date(Date.now() + Math.min(60, 2 ** delivery.attempt_count) * 60_000)
    : null
  await getPool().query(
    `
      UPDATE ministry_message_deliveries
      SET status = $2, provider = $3, provider_message_id = $4,
          last_error = $5, next_attempt_at = $6, claimed_at = NULL,
          delivered_at = CASE WHEN $2 = 'sent' THEN now() ELSE delivered_at END,
          updated_at = now()
      WHERE id = $1
    `,
    [delivery.id, status, provider, providerMessageId, error, retryAt],
  )
  await refreshRecipientDeliveryStatus(delivery.recipient_id)
}

const finishAttempts = async (delivery: any, attempts: Array<Record<string, any>>) => {
  const sent = attempts.find((attempt) => ["sent", "accepted"].includes(attempt.status))
  const skipped = !sent && attempts.length > 0 && attempts.every((attempt) => attempt.status === "skipped")
  const error = attempts.map((attempt) => attempt.errorCode).filter(Boolean).join("; ") || null
  await finishDelivery(
    delivery,
    sent ? "sent" : skipped ? "skipped" : delivery.attempt_count >= 5 ? "failed" : "retry",
    sent?.provider || attempts.at(-1)?.provider || delivery.channel,
    error,
    sent?.providerMessageId || null,
  )
}

export const processMinistryMessageDeliveries = async (
  messageId: string | null = null,
) => {
  if (!deliveryAllowed()) return 0
  await ensureLegacyMessageDeliveries()
  const claimed = await claimDueDeliveries(messageId)
  if (!claimed.length) return 0
  const ids = claimed.map((delivery: any) => delivery.id)
  const result = await getPool().query(
    `
      SELECT delivery.*, recipient.delivery_account_user_id,
        message.channel AS message_channel, message.subject, message.body,
        account.email, account.notification_email_enabled,
        account.notification_telegram_enabled,
        account.notification_sms_enabled,
        account.notification_push_enabled,
        account.notification_announcements_enabled,
        account.sms_transactional_consent_at,
        COALESCE(NULLIF(account.phone, ''), account.telephone) AS recipient_phone,
        telegram.chat_id
      FROM ministry_message_deliveries delivery
      JOIN ministry_message_recipients recipient ON recipient.id=delivery.recipient_id
      JOIN ministry_messages message ON message.id = recipient.message_id
      JOIN ministry_accounts account ON account.id = recipient.delivery_account_user_id
      LEFT JOIN telegram_connections telegram
        ON telegram.account_user_id = account.id
       AND telegram.status = 'active'
      WHERE delivery.id = ANY($1)
    `,
    [ids],
  )
  const origin = (process.env.SITE_URL || "https://ministry.mylatinmass.com")
    .replace(/\/$/, "")
  for (const delivery of result.rows) {
    const channelEnabled = delivery.channel === "email"
      ? delivery.notification_email_enabled
      : delivery.channel === "telegram"
        ? delivery.notification_telegram_enabled
        : delivery.channel === "sms"
          ? delivery.notification_sms_enabled
          : delivery.notification_push_enabled
    if (!delivery.notification_announcements_enabled || !channelEnabled) {
      await finishDelivery(
        delivery,
        "skipped",
        delivery.channel,
        "recipient_notifications_disabled",
      )
      continue
    }
    if (delivery.channel === "email") {
      if (!delivery.email) {
        await finishDelivery(delivery, "skipped", "email", "email_address_missing")
        continue
      }
      const attempts = await sendReliableEmail({
        to: delivery.email,
        subject: delivery.subject,
        text: `${delivery.body}\n\nOpen Messages: ${origin}/?section=messages`,
      })
      await finishAttempts(delivery, attempts)
      continue
    }
    if (delivery.channel === "telegram" && !delivery.chat_id) {
      await finishDelivery(
        delivery,
        "skipped",
        "telegram",
        "telegram_connection_required",
      )
      continue
    }
    if (delivery.channel === "telegram") {
      try {
        const response = await sendTelegramMessage(
          delivery.chat_id,
          delivery.body,
          `${origin}/?section=messages`,
        )
        await finishDelivery(
          delivery,
          "sent",
          "telegram",
          null,
          response?.message_id ? String(response.message_id) : null,
        )
      } catch (error: any) {
        const permanent = [400, 403].includes(Number(error?.status || 0))
        await finishDelivery(
          delivery,
          permanent ? "skipped" : delivery.attempt_count >= 5 ? "failed" : "retry",
          "telegram",
          error?.message || "telegram_failed",
        )
      }
      continue
    }
    if (delivery.channel === "push") {
      const attempts = await sendAccountPush({
        accountUserId: delivery.delivery_account_user_id,
        title: "Ministry Alert",
        body: delivery.body,
        url: "/?section=messages",
        tag: `ministry-message-${delivery.recipient_id}`,
      })
      await finishAttempts(delivery, attempts)
      continue
    }
    try {
      const response = await sendKlaviyoAlertDue({
        id: delivery.id,
        kind: "announcement_message",
        notification_category: "announcements",
        privacy_safe_message: delivery.body,
        notification_url: "/?section=messages",
        subject_user_id: delivery.delivery_account_user_id,
        recipient_user_id: delivery.delivery_account_user_id,
        recipient_phone: delivery.recipient_phone,
        sms_transactional_consent_at: delivery.sms_transactional_consent_at,
      })
      await finishDelivery(delivery, "sent", "klaviyo", null, String(response.status))
    } catch (error: any) {
      const permanent = [
        "klaviyo_not_configured",
        "invalid_phone_number",
        "sms_consent_required",
      ].includes(error?.code)
      await finishDelivery(
        delivery,
        permanent ? "skipped" : delivery.attempt_count >= 5 ? "failed" : "retry",
        "klaviyo",
        error?.code || error?.message || "klaviyo_failed",
      )
    }
  }
  return result.rowCount || 0
}
