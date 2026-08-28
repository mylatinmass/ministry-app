import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  writeSchedulingAudit,
} from "../scheduling/authorization"
import { sendAccountPush, sendReliableEmail } from "./delivery"
import { sendKlaviyoAlertDue } from "./klaviyo"
import { sendTelegramMessage } from "./telegram"
import { getNotificationTestMode } from "./test-mode"

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
      SELECT ministry.id, ministry.name,
        COALESCE(json_agg(json_build_object(
          'id', ministry_group.id,
          'name', ministry_group.name,
          'automaticMembership', ministry_group.automatic_membership
        ) ORDER BY ministry_group.sort_order, ministry_group.name)
          FILTER (WHERE ministry_group.id IS NOT NULL), '[]'::JSON) AS groups
      FROM ministries ministry
      LEFT JOIN ministry_groups ministry_group
        ON ministry_group.ministry_id = ministry.id
       AND ministry_group.status = 'active'
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
      GROUP BY ministry.id, ministry.name
      ORDER BY ministry.name
    `,
    [user.id, global],
  )
  return result.rows
}

const manageableMembers = async (
  client: any,
  ministries: Record<string, any>[],
) => {
  const ministryIds = ministries.map((ministry) => ministry.id)
  if (!ministryIds.length) return []
  const result = await client.query(
    `
      SELECT member.id, member.first_name, member.last_name,
        array_agg(DISTINCT ministry.id) AS ministry_ids,
        array_agg(DISTINCT ministry.name) AS ministry_names
      FROM ministry_accounts member
      JOIN ministry_members membership ON membership.user_id = member.id
      JOIN ministries ministry ON ministry.id = membership.ministry_id
      WHERE member.status = 'active'
        AND membership.status = 'active'
        AND membership.ministry_id = ANY($1::UUID[])
      GROUP BY member.id, member.first_name, member.last_name
      ORDER BY lower(member.last_name), lower(member.first_name)
    `,
    [ministryIds],
  )
  return result.rows.map((member: any) => ({
    id: member.id,
    firstName: member.first_name,
    lastName: member.last_name,
    ministryIds: [...(member.ministry_ids || [])].sort(),
    ministryNames: [...(member.ministry_names || [])].sort((left, right) =>
      left.localeCompare(right),
    ),
  }))
}

const listMessages = async (client: any, context: any) => {
  const global = isGlobalManager(context.user)
  const ministries = await manageableMinistries(client, context.user)
  const [members, inboxResult, unreadResult, sentResult] = await Promise.all([
    manageableMembers(client, ministries),
    client.query(
      `
        SELECT *
        FROM (
          SELECT DISTINCT ON (message.id)
            recipient.id AS recipient_id,
            CASE WHEN EXISTS (
              SELECT 1
              FROM ministry_message_recipients unread_recipient
              WHERE unread_recipient.message_id = message.id
                AND unread_recipient.delivery_account_user_id = $1
                AND unread_recipient.read_at IS NULL
            ) THEN NULL ELSE recipient.read_at END AS read_at,
            recipient.delivery_status, recipient.delivered_at,
            message.id, message.audience_scope, message.channel,
            message.subject, message.body, message.created_at, message.event_id,
            ministry.id AS ministry_id, ministry.name AS ministry_name,
            event.title AS event_title,
            sender.first_name AS sender_first_name,
            sender.last_name AS sender_last_name,
            sender.username AS sender_username
          FROM ministry_message_recipients recipient
          JOIN ministry_messages message ON message.id = recipient.message_id
          LEFT JOIN ministries ministry ON ministry.id = message.ministry_id
          LEFT JOIN events event ON event.id = message.event_id
          JOIN ministry_accounts sender ON sender.id = message.created_by_profile_id
          WHERE recipient.delivery_account_user_id = $1
          ORDER BY message.id, recipient.is_delivery_target DESC,
            recipient.created_at
        ) account_inbox
        ORDER BY read_at IS NULL DESC, created_at DESC
        LIMIT 100
      `,
      [context.actor.id],
    ),
    client.query(
      `
        SELECT count(DISTINCT message_id)::INT AS unread_count
        FROM ministry_message_recipients
        WHERE delivery_account_user_id = $1
          AND read_at IS NULL
      `,
      [context.actor.id],
    ),
    client.query(
      `
        SELECT message.id, message.audience_scope, message.channel,
          message.subject, message.body, message.created_at, message.event_id,
          ministry.id AS ministry_id, ministry.name AS ministry_name,
          event.title AS event_title,
          ARRAY(
            SELECT selected_ministry.name
            FROM ministry_message_ministries message_ministry
            JOIN ministries selected_ministry ON selected_ministry.id = message_ministry.ministry_id
            WHERE message_ministry.message_id = message.id
          ) AS target_ministry_names,
          (SELECT count(*)::INT FROM ministry_message_selected_members selected_member
            WHERE selected_member.message_id = message.id) AS selected_member_count,
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
        LEFT JOIN events event ON event.id = message.event_id
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
            OR message.created_by_profile_id = $1
            OR EXISTS (
              SELECT 1
              FROM ministry_message_ministries message_ministry
              JOIN ministry_members membership
                ON membership.ministry_id = message_ministry.ministry_id
              WHERE message_ministry.message_id = message.id
                AND membership.user_id = $1
                AND membership.status = 'active'
                AND membership.level IN ('owner', 'admin')
            )
          )
        GROUP BY message.id, message.audience_scope, message.channel,
          message.subject, message.body, message.created_at,
          ministry.id, ministry.name, event.id, event.title, sender.first_name,
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
    eventId: row.event_id,
    eventTitle: row.event_title,
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
    eventId: row.event_id,
    targetLabel:
      row.audience_scope === "all_members"
        ? "All members"
        : row.audience_scope === "event_participants"
          ? `Participants · ${row.event_title || "Event"}`
          : row.audience_scope === "members"
            ? `${Number(row.selected_member_count || 0)} selected member${Number(row.selected_member_count || 0) === 1 ? "" : "s"}`
            : row.target_ministry_names?.length
              ? [...row.target_ministry_names]
                  .sort((left, right) => left.localeCompare(right))
                  .join(", ")
              : row.ministry_name || "Selected members",
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
    manageableMembers: members,
    received,
    sent,
  }
}

const createMessage = async (client: any, context: any, body: any) => {
  const messageType = String(body.messageType || body.channel || "").trim().toLowerCase()
  const channel = messageType === "alert" ? "telegram" : messageType
  const requestedAudience = String(body.audience || "").trim().toLowerCase()
  const ministryId = String(body.ministryId || "").trim() || null
  let ministryIds = Array.isArray(body.ministryIds)
    ? [...new Set(body.ministryIds.map((value: unknown) => String(value).trim()).filter(Boolean))]
    : ministryId ? [ministryId] : []
  const memberIds = Array.isArray(body.memberIds)
    ? [...new Set(body.memberIds.map((value: unknown) => String(value).trim()).filter(Boolean))]
    : []
  const eventId = String(body.eventId || "").trim() || null
  const groupIds = Array.isArray(body.groupIds)
    ? [...new Set(body.groupIds.map((value: unknown) => String(value).trim()).filter(Boolean))]
    : []
  const subject = String(body.subject || "").trim()
  const messageBody = String(body.body || "").trim()
  const global = isGlobalManager(context.user)
  const allowedMinistries = await manageableMinistries(client, context.user)
  if (!global && !allowedMinistries.length) {
    return json({ message: "Only ministry administrators can send messages" }, 403)
  }
  const allowedMinistryIds = new Set(allowedMinistries.map((ministry: any) => ministry.id))
  let audience = requestedAudience
  if (audience === "all_authorized") {
    audience = global ? "all_members" : "ministries"
    ministryIds = global ? [] : [...allowedMinistryIds]
  }
  if (audience === "ministry") ministryIds = ministryId ? [ministryId] : ministryIds
  let eventRecord: any = null

  if (!['email', 'alert'].includes(messageType)) {
    return json({ message: "Choose Email or Alert" }, 400)
  }
  if (!['ministry', 'ministries', 'groups', 'members', 'event_participants', 'all_members'].includes(audience)) {
    return json({ message: "Choose a message audience" }, 400)
  }
  if (audience === "all_members" && !global) {
    return json({ message: "Only a Super Admin can message all members" }, 403)
  }
  if (audience === "ministry" || audience === "ministries" || audience === "groups") {
    if (!ministryIds.length) return json({ message: "Choose at least one ministry" }, 400)
    if (ministryIds.some((id) => !allowedMinistryIds.has(id))) {
      return json({ message: "You can message only ministries you administer" }, 403)
    }
    if (audience === "groups") {
      if (ministryIds.length !== 1) return json({ message: "Groups must belong to one ministry" }, 400)
      if (!groupIds.length) return json({ message: "Choose at least one group" }, 400)
      const groupsResult = await client.query(
        `SELECT id FROM ministry_groups WHERE ministry_id = $1 AND status = 'active' AND id = ANY($2::UUID[])`,
        [ministryIds[0], groupIds],
      )
      if (groupsResult.rowCount !== groupIds.length) {
        return json({ message: "Choose active groups from this ministry" }, 400)
      }
    }
  }
  if (audience === "members") {
    if (!memberIds.length) return json({ message: "Choose at least one member" }, 400)
    const allowedMembers = await manageableMembers(client, allowedMinistries)
    const allowedMemberIds = new Set(allowedMembers.map((member: any) => member.id))
    if (memberIds.some((id) => !allowedMemberIds.has(id))) {
      return json({ message: "You can message only members of ministries you administer" }, 403)
    }
  }
  if (audience === "event_participants") {
    if (!eventId) return json({ message: "Choose an event" }, 400)
    const eventResult = await client.query(
      `
        SELECT event.id, event.ministry_id, event.title
        FROM events event
        WHERE event.id = $1
          AND (
            $3::BOOL
            OR event.ministry_id = ANY($2::UUID[])
          )
        LIMIT 1
      `,
      [eventId, [...allowedMinistryIds], global],
    )
    eventRecord = eventResult.rows[0]
    if (!eventRecord) return json({ message: "You cannot message participants for this event" }, 403)
    const eventMinistries = await client.query(
      `
        SELECT DISTINCT ministry_id FROM (
          SELECT ministry_id FROM events WHERE id = $1
          UNION ALL SELECT ministry_id FROM event_ministries WHERE event_id = $1
          UNION ALL SELECT ministry_id FROM event_responsibilities
            WHERE event_id = $1 AND ministry_id IS NOT NULL
        ) scoped
      `,
      [eventId],
    )
    ministryIds = eventMinistries.rows
      .map((row: any) => row.ministry_id)
      .filter(Boolean)
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

  const primaryMinistryId = audience === "all_members"
    ? null
    : eventRecord?.ministry_id || (ministryIds.length === 1 ? ministryIds[0] : null)
  let recipientCondition = "FALSE"
  let recipientParameters: any[] = []
  if (audience === "all_members") {
    recipientCondition = `EXISTS (
      SELECT 1 FROM ministry_members membership
      WHERE membership.user_id = member.id AND membership.status = 'active'
    )`
  } else if (audience === "members") {
    recipientCondition = "member.id = ANY($1::UUID[])"
    recipientParameters = [memberIds]
  } else if (audience === "event_participants") {
    recipientCondition = `EXISTS (
      SELECT 1 FROM responsibility_assignments assignment
      WHERE assignment.event_id = $1
        AND assignment.user_id = member.id
        AND assignment.status IN (
          'interested', 'pending', 'assigned', 'confirmed',
          'change_requested', 'completed'
        )
    )`
    recipientParameters = [eventId]
  } else if (audience === "groups") {
    recipientCondition = `EXISTS (
      SELECT 1 FROM ministry_members membership
      JOIN ministry_group_members group_member
        ON group_member.ministry_member_id = membership.id
      WHERE membership.user_id = member.id
        AND membership.status = 'active'
        AND membership.ministry_id = $1
        AND group_member.group_id = ANY($2::UUID[])
    )`
    recipientParameters = [ministryIds[0], groupIds]
  } else {
    recipientCondition = `EXISTS (
      SELECT 1 FROM ministry_members membership
      WHERE membership.user_id = member.id
        AND membership.status = 'active'
        AND membership.ministry_id = ANY($1::UUID[])
    )`
    recipientParameters = [ministryIds]
  }

  let committed = false
  await client.query("BEGIN")
  try {
    const messageResult = await client.query(
      `
        INSERT INTO ministry_messages (
          ministry_id, event_id, audience_scope, channel, subject, body,
          created_by_actor_id, created_by_profile_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        primaryMinistryId,
        audience === "event_participants" ? eventId : null,
        audience,
        channel,
        channel === "email" ? subject : null,
        messageBody,
        context.actor.id,
        context.user.id,
      ],
    )
    const messageId = messageResult.rows[0].id
    for (const selectedMinistryId of ministryIds) {
      await client.query(
        `INSERT INTO ministry_message_ministries (message_id, ministry_id)
         VALUES ($1, $2) ON CONFLICT (message_id, ministry_id) DO NOTHING`,
        [messageId, selectedMinistryId],
      )
    }
    for (const selectedMemberId of memberIds) {
      await client.query(
        `INSERT INTO ministry_message_selected_members (message_id, profile_user_id)
         VALUES ($1, $2) ON CONFLICT (message_id, profile_user_id) DO NOTHING`,
        [messageId, selectedMemberId],
      )
    }
    for (const groupId of groupIds) {
      await client.query(
        `INSERT INTO ministry_message_groups (message_id, group_id) VALUES ($1, $2)`,
        [messageId, groupId],
      )
    }
    const linkedRecipients = await client.query(
      `
        SELECT eligible.profile_user_id, eligible.delivery_account_user_id,
          row_number() OVER (
            PARTITION BY eligible.delivery_account_user_id
            ORDER BY eligible.is_managed_profile, eligible.profile_user_id
          ) = 1 AS is_delivery_target,
          NULL::STRING AS external_name,
          NULL::STRING AS external_email,
          NULL::STRING AS external_phone,
          false AS external_email_enabled,
          NULL::TIMESTAMPTZ AS external_sms_consent_at
        FROM (
          SELECT DISTINCT member.id AS profile_user_id,
            COALESCE(managed.guardian_user_id, member.id) AS delivery_account_user_id,
            managed.guardian_user_id IS NOT NULL AS is_managed_profile
          FROM ministry_accounts member
          LEFT JOIN managed_profiles managed
            ON managed.child_user_id = member.id
           AND managed.status IN ('active', 'separation_pending')
          WHERE member.status = 'active'
            AND ${recipientCondition}
        ) eligible
      `,
      recipientParameters,
    )
    const externalRecipients = audience === "event_participants"
      ? await client.query(
          `
            SELECT NULL::UUID AS profile_user_id,
              NULL::UUID AS delivery_account_user_id,
              true AS is_delivery_target,
              max(NULLIF(btrim(assignment.volunteer_name), '')) AS external_name,
              max(NULLIF(btrim(assignment.volunteer_email), '')) AS external_email,
              max(NULLIF(btrim(assignment.volunteer_phone), '')) AS external_phone,
              bool_or(
                assignment.notify_email
                OR assignment.volunteer_email_consent_at IS NOT NULL
              ) AS external_email_enabled,
              max(assignment.volunteer_sms_consent_at) AS external_sms_consent_at
            FROM responsibility_assignments assignment
            WHERE assignment.event_id = $1
              AND assignment.user_id IS NULL
              AND assignment.status IN (
                'interested', 'pending', 'assigned', 'confirmed',
                'change_requested', 'completed'
              )
              AND (
                NULLIF(btrim(assignment.volunteer_email), '') IS NOT NULL
                OR NULLIF(btrim(assignment.volunteer_phone), '') IS NOT NULL
              )
            GROUP BY lower(COALESCE(
              NULLIF(btrim(assignment.volunteer_email), ''),
              NULLIF(btrim(assignment.volunteer_phone), '')
            ))
          `,
          [eventId],
        )
      : { rows: [], rowCount: 0 }
    let recipients = {
      rows: [...linkedRecipients.rows, ...externalRecipients.rows],
      rowCount:
        Number(linkedRecipients.rowCount || 0) +
        Number(externalRecipients.rowCount || 0),
    }
    if (!recipients.rowCount) {
      throw Object.assign(new Error("The selected audience has no active recipients"), {
        status: 400,
      })
    }
    const notificationTestMode = await getNotificationTestMode(client)
    if (notificationTestMode.enabled) {
      recipients = {
        rows: [
          {
            profile_user_id: notificationTestMode.targetUserId,
            delivery_account_user_id: notificationTestMode.targetUserId,
            is_delivery_target: true,
            external_name: null,
            external_email: null,
            external_phone: null,
            external_email_enabled: false,
            external_sms_consent_at: null,
          },
        ],
        rowCount: 1,
      }
    }
    for (const recipient of recipients.rows) {
      const recipientResult = await client.query(
        `
          INSERT INTO ministry_message_recipients (
            message_id, profile_user_id, delivery_account_user_id,
            is_delivery_target, delivery_status, last_error,
            external_name, external_email, external_phone,
            external_email_enabled, external_sms_consent_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
          recipient.external_name,
          recipient.external_email,
          recipient.external_phone,
          Boolean(recipient.external_email_enabled),
          recipient.external_sms_consent_at,
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
      ministryId: primaryMinistryId,
      afterData: {
        audience,
        ministryIds,
        memberIds,
        eventId,
        groupIds,
        messageType,
        subject: messageType === "email" ? subject : null,
        recipientCount: recipients.rowCount || 0,
        notificationTestMode: notificationTestMode.enabled,
        notificationTestAccountUserId:
          notificationTestMode.targetUserId || null,
      },
    })
    await client.query("COMMIT")
    committed = true
    let processedDeliveryCount = 0
    let deliveryProcessingDeferred = false
    try {
      processedDeliveryCount = await processMinistryMessageDeliveries(messageId)
    } catch (error) {
      deliveryProcessingDeferred = true
      console.error("Immediate Ministry message delivery was deferred:", error)
    }
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
      deliveryProcessingDeferred,
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
          WHERE delivery_account_user_id = $1
            AND read_at IS NULL
        `,
        [context.actor.id],
      )
    } else if (body.action === "mark_read" && body.messageId) {
      await client.query(
        `
          UPDATE ministry_message_recipients
          SET read_at = now(), updated_at = now()
          WHERE delivery_account_user_id = $1
            AND message_id = $2
            AND read_at IS NULL
        `,
        [context.actor.id, body.messageId],
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
        WHERE (
            (
              delivery.status IN ('pending', 'retry')
              AND (
                delivery.next_attempt_at IS NULL
                OR delivery.next_attempt_at <= now()
              )
            )
            OR (
              delivery.status = 'failed'
              AND delivery.updated_at <= now() - INTERVAL '24 hours'
            )
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
          attempt_count = CASE
            WHEN delivery.status = 'failed' THEN 1
            ELSE attempt_count + 1
          END,
          next_attempt_at = NULL,
          updated_at = now()
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
  const notificationTestMode = await getNotificationTestMode()
  const ids = claimed.map((delivery: any) => delivery.id)
  const result = await getPool().query(
    `
      SELECT delivery.*,
        COALESCE($2::UUID, recipient.delivery_account_user_id)
          AS delivery_account_user_id,
        recipient.external_email, recipient.external_phone,
        recipient.external_email_enabled, recipient.external_sms_consent_at,
        message.channel AS message_channel, message.subject, message.body,
        COALESCE(account.email, recipient.external_email) AS email,
        account.notification_email_enabled,
        account.notification_telegram_enabled,
        account.notification_sms_enabled,
        account.notification_push_enabled,
        account.notification_announcements_enabled,
        account.sms_transactional_consent_at,
        COALESCE(
          NULLIF(account.phone, ''), account.telephone,
          recipient.external_phone
        ) AS recipient_phone,
        telegram.chat_id
      FROM ministry_message_deliveries delivery
      JOIN ministry_message_recipients recipient ON recipient.id=delivery.recipient_id
      JOIN ministry_messages message ON message.id = recipient.message_id
      LEFT JOIN ministry_accounts account
        ON account.id = COALESCE(
          $2::UUID,
          recipient.delivery_account_user_id
        )
      LEFT JOIN telegram_connections telegram
        ON telegram.account_user_id = account.id
       AND telegram.status = 'active'
      WHERE delivery.id = ANY($1)
    `,
    [ids, notificationTestMode.targetUserId],
  )
  const origin = (process.env.SITE_URL || "https://ministry.mylatinmass.com")
    .replace(/\/$/, "")
  for (const delivery of result.rows) {
    const externalRecipient = !delivery.delivery_account_user_id
    const channelEnabled = externalRecipient
      ? delivery.channel === "email"
        ? delivery.external_email_enabled && Boolean(delivery.email)
        : delivery.channel === "sms"
          ? Boolean(delivery.external_sms_consent_at && delivery.recipient_phone)
          : false
      : delivery.channel === "email"
        ? delivery.notification_email_enabled
        : delivery.channel === "telegram"
          ? delivery.notification_telegram_enabled
          : delivery.channel === "sms"
            ? delivery.notification_sms_enabled
            : delivery.notification_push_enabled
    if (
      (!externalRecipient && !delivery.notification_announcements_enabled) ||
      !channelEnabled
    ) {
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
        subject_user_id:
          delivery.delivery_account_user_id || `external:${delivery.recipient_id}`,
        recipient_user_id:
          delivery.delivery_account_user_id || `external:${delivery.recipient_id}`,
        recipient_phone: delivery.recipient_phone,
        sms_transactional_consent_at:
          delivery.sms_transactional_consent_at ||
          delivery.external_sms_consent_at,
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
