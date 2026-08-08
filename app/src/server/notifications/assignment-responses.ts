import crypto from "node:crypto"
import nodemailer from "nodemailer"
import { getPool } from "../database"
import { json } from "../request"
import { callTelegram } from "./telegram"

const tokenHash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex")

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;")

const deliveryAllowed = () =>
  process.env.VERCEL_ENV === "production" ||
  process.env.ALLOW_PREVIEW_DELIVERY === "true"

const formatAssignmentDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value))

const loadAssignmentNotice = async (assignmentId: string) => {
  const result = await getPool().query(
    `
      SELECT
        assignment.id AS assignment_id,
        assignment.status AS assignment_status,
        assignment.notify_email,
        event.id AS event_id,
        event.title AS event_title,
        event.start_time,
        event.end_time,
        event.location,
        responsibility.name AS responsibility_name,
        ministry.name AS ministry_name,
        ministry.slug AS ministry_slug,
        subject.first_name AS subject_first_name,
        COALESCE(guardian.guardian_user_id, assignment.user_id) AS recipient_user_id,
        recipient.email AS recipient_email,
        recipient.notification_email_enabled,
        recipient.notification_telegram_enabled,
        telegram.chat_id AS telegram_chat_id
      FROM responsibility_assignments assignment
      JOIN events event ON event.id = assignment.event_id
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      JOIN ministries ministry
        ON ministry.id = COALESCE(responsibility.ministry_id, event.ministry_id)
      JOIN users subject ON subject.id = assignment.user_id
      LEFT JOIN managed_profiles guardian
        ON guardian.child_user_id = assignment.user_id
       AND guardian.status IN ('active', 'separation_pending')
      JOIN users recipient
        ON recipient.id = COALESCE(guardian.guardian_user_id, assignment.user_id)
      LEFT JOIN telegram_connections telegram
        ON telegram.account_user_id = recipient.id
       AND telegram.status = 'active'
      WHERE assignment.id = $1
      LIMIT 1
    `,
    [assignmentId],
  )
  return result.rows[0] || null
}

const sendAssignmentEmail = async (notice: any, origin: string, token: string) => {
  if (
    !notice.notify_email ||
    !notice.notification_email_enabled ||
    !notice.recipient_email ||
    !process.env.GMAIL_USER ||
    !process.env.GMAIL_PASS
  ) return false

  const responseUrl = `${origin}/assignment-response?${new URLSearchParams({ token })}`
  const when = formatAssignmentDate(notice.start_time)
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
  await transporter.sendMail({
    from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
    replyTo: process.env.GMAIL_USER,
    to: notice.recipient_email,
    subject: `New ministry assignment: ${notice.event_title}`,
    text: [
      `Hello ${notice.subject_first_name || "Volunteer"},`, "",
      `You were assigned to ${notice.responsibility_name} for ${notice.event_title}.`,
      `${when}${notice.location ? ` at ${notice.location}` : ""}.`, "",
      "Confirm or decline this assignment:", responseUrl, "",
      "This private response link can be used only once.",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:28px;border:1px solid #e5e7eb"><h1 style="color:#6f4f34">New ministry assignment</h1><p>Hello ${escapeHtml(notice.subject_first_name || "Volunteer")},</p><p>You were assigned to <strong>${escapeHtml(notice.responsibility_name)}</strong> for <strong>${escapeHtml(notice.event_title)}</strong>.</p><p>${escapeHtml(when)}${notice.location ? ` at ${escapeHtml(notice.location)}` : ""}.</p><p style="margin:28px 0;text-align:center"><a href="${escapeHtml(responseUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#896542;color:white;font-weight:700;text-decoration:none">Confirm or decline</a></p><p style="color:#6b7280;font-size:14px">This private response link can be used only once.</p></div>`,
  })
  return true
}

const sendAssignmentTelegram = async (notice: any, origin: string, token: string) => {
  if (!notice.notification_telegram_enabled || !notice.telegram_chat_id) return false
  const when = formatAssignmentDate(notice.start_time)
  await callTelegram("sendMessage", {
    chat_id: notice.telegram_chat_id,
    text: [
      "New ministry assignment",
      `${notice.responsibility_name} — ${notice.event_title}`,
      `${when}${notice.location ? ` at ${notice.location}` : ""}`,
    ].join("\n"),
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Confirm", callback_data: `assignment:confirm:${token}` },
          { text: "Decline", callback_data: `assignment:decline:${token}` },
        ],
        [{
          text: "Open Ministry App",
          url: `${origin}/${notice.ministry_slug}?event=${notice.event_id}`,
        }],
      ],
    },
  })
  return true
}

export const sendAssignmentNotification = async (
  assignmentId: string,
  requestOrigin: string,
) => {
  if (!deliveryAllowed()) return { email: false, telegram: false }
  const notice = await loadAssignmentNotice(assignmentId)
  if (!notice || !["pending", "assigned"].includes(notice.assignment_status)) {
    return { email: false, telegram: false }
  }
  const wantsEmail = Boolean(
    notice.notify_email && notice.notification_email_enabled && notice.recipient_email,
  )
  const wantsTelegram = Boolean(
    notice.notification_telegram_enabled && notice.telegram_chat_id,
  )
  if (!wantsEmail && !wantsTelegram) return { email: false, telegram: false }

  const token = crypto.randomBytes(32).toString("base64url")
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `
        UPDATE assignment_response_tokens
        SET used_at = now()
        WHERE assignment_id = $1 AND used_at IS NULL
      `,
      [notice.assignment_id],
    )
    await client.query(
      `
        INSERT INTO assignment_response_tokens (
          assignment_id, recipient_user_id, token_hash, expires_at
        )
        VALUES ($1, $2, $3, GREATEST(now() + INTERVAL '24 hours', $4::TIMESTAMPTZ + INTERVAL '1 day'))
      `,
      [notice.assignment_id, notice.recipient_user_id, tokenHash(token), notice.end_time],
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
  const origin = (process.env.SITE_URL || requestOrigin).replace(/\/$/, "")
  const result = { email: false, telegram: false }
  if (wantsEmail) {
    try {
      result.email = await sendAssignmentEmail(notice, origin, token)
    } catch (error) {
      console.error("Unable to send assignment email:", error)
    }
  }
  if (wantsTelegram) {
    try {
      result.telegram = await sendAssignmentTelegram(notice, origin, token)
    } catch (error) {
      console.error("Unable to send assignment Telegram message:", error)
    }
  }
  return result
}

export const sendAssignmentDeclinedNotification = async (
  assignmentId: string,
) => {
  if (!deliveryAllowed()) return { email: 0, telegram: 0 }
  const assignmentResult = await getPool().query(
    `
      SELECT
        assignment.user_id,
        event.title AS event_title,
        event.start_time,
        responsibility.name AS responsibility_name,
        COALESCE(responsibility.ministry_id, event.ministry_id) AS ministry_id,
        ministry.name AS ministry_name,
        subject.first_name,
        subject.last_name
      FROM responsibility_assignments assignment
      JOIN events event ON event.id = assignment.event_id
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      JOIN ministries ministry
        ON ministry.id = COALESCE(responsibility.ministry_id, event.ministry_id)
      JOIN users subject ON subject.id = assignment.user_id
      WHERE assignment.id = $1 AND assignment.status = 'declined'
      LIMIT 1
    `,
    [assignmentId],
  )
  const assignment = assignmentResult.rows[0]
  if (!assignment) return { email: 0, telegram: 0 }

  const recipientResult = await getPool().query(
    `
      SELECT DISTINCT
        leader.id,
        leader.email,
        leader.notification_email_enabled,
        leader.notification_telegram_enabled,
        telegram.chat_id
      FROM users leader
      LEFT JOIN telegram_connections telegram
        ON telegram.account_user_id = leader.id
       AND telegram.status = 'active'
      WHERE leader.status = 'active'
        AND leader.id <> $2
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
    [assignment.ministry_id, assignment.user_id],
  )
  const volunteerName = [assignment.first_name, assignment.last_name]
    .filter(Boolean).join(" ") || "A volunteer"
  const when = formatAssignmentDate(assignment.start_time)
  const text = [
    "Assignment declined",
    `${volunteerName} declined ${assignment.responsibility_name} for ${assignment.event_title}.`,
    `${when} · ${assignment.ministry_name}`,
  ].join("\n")
  let email = 0
  let telegram = 0
  const mailer = process.env.GMAIL_USER && process.env.GMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
      })
    : null

  for (const recipient of recipientResult.rows) {
    if (recipient.notification_email_enabled && recipient.email && mailer) {
      try {
        await mailer.sendMail({
          from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
          replyTo: process.env.GMAIL_USER,
          to: recipient.email,
          subject: `Assignment declined: ${assignment.event_title}`,
          text,
        })
        email += 1
      } catch (error) {
        console.error("Unable to email an assignment-decline alert:", error)
      }
    }
    if (recipient.notification_telegram_enabled && recipient.chat_id) {
      try {
        await callTelegram("sendMessage", {
          chat_id: recipient.chat_id,
          text,
          disable_web_page_preview: true,
        })
        telegram += 1
      } catch (error) {
        console.error("Unable to send a Telegram assignment-decline alert:", error)
      }
    }
  }
  return { email, telegram }
}

export const getAssignmentResponse = async (token: string) => {
  const result = await getPool().query(
    `
      SELECT
        response_token.used_at,
        response_token.expires_at,
        assignment.status,
        event.title AS event_title,
        event.start_time,
        event.location,
        responsibility.name AS responsibility_name
      FROM assignment_response_tokens response_token
      JOIN responsibility_assignments assignment
        ON assignment.id = response_token.assignment_id
      JOIN events event ON event.id = assignment.event_id
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      WHERE response_token.token_hash = $1
      LIMIT 1
    `,
    [tokenHash(token)],
  )
  const response = result.rows[0]
  if (!response || response.used_at || new Date(response.expires_at) <= new Date()) {
    throw Object.assign(new Error("This response link is invalid or has expired"), { status: 410 })
  }
  return {
    eventTitle: response.event_title,
    responsibilityName: response.responsibility_name,
    startTime: response.start_time,
    location: response.location,
    status: response.status,
  }
}

export const respondToAssignment = async (
  token: string,
  action: "confirm" | "decline",
  channel: "email" | "telegram",
  telegramUserId?: string,
) => {
  const nextStatus = action === "confirm" ? "confirmed" : "declined"
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    const result = await client.query(
      `
        SELECT
          response_token.*,
          assignment.status AS assignment_status,
          assignment.user_id AS subject_user_id,
          assignment.responsibility_id,
          assignment.event_id,
          responsibility.ministry_id
        FROM assignment_response_tokens response_token
        JOIN responsibility_assignments assignment
          ON assignment.id = response_token.assignment_id
        JOIN event_responsibilities responsibility
          ON responsibility.id = assignment.responsibility_id
        WHERE response_token.token_hash = $1
        LIMIT 1
        FOR UPDATE
      `,
      [tokenHash(token)],
    )
    const record = result.rows[0]
    if (!record || record.used_at || new Date(record.expires_at) <= new Date()) {
      throw Object.assign(new Error("This response link is invalid or has expired"), { status: 410 })
    }
    if (channel === "telegram") {
      const connection = await client.query(
        `
          SELECT 1
          FROM telegram_connections
          WHERE account_user_id = $1
            AND telegram_user_id = $2
            AND status = 'active'
          LIMIT 1
        `,
        [record.recipient_user_id, telegramUserId || ""],
      )
      if (!connection.rowCount) {
        throw Object.assign(new Error("This Telegram account cannot respond to that assignment"), { status: 403 })
      }
    }
    if (!["pending", "assigned"].includes(record.assignment_status)) {
      throw Object.assign(new Error(`This assignment is already ${record.assignment_status}`), { status: 409 })
    }
    await client.query(
      `
        UPDATE responsibility_assignments
        SET status = $2,
            confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE NULL END,
            updated_at = now()
        WHERE id = $1
      `,
      [record.assignment_id, nextStatus],
    )
    await client.query(
      `
        UPDATE event_responsibilities responsibility
        SET status = CASE
              WHEN responsibility.unlimited_capacity THEN 'open'
              WHEN (
                SELECT COALESCE(sum(quantity), 0)
                FROM responsibility_assignments assignment
                WHERE assignment.responsibility_id = responsibility.id
                  AND assignment.status NOT IN ('declined', 'cancelled')
              ) >= responsibility.quantity_needed THEN 'filled'
              ELSE 'open'
            END,
            updated_at = now()
        WHERE responsibility.id = $1
      `,
      [record.responsibility_id],
    )
    await client.query(
      `
        UPDATE assignment_response_tokens
        SET used_at = now(), response = $2, response_channel = $3
        WHERE assignment_id = $1 AND used_at IS NULL
      `,
      [record.assignment_id, nextStatus, channel],
    )
    await client.query(
      `
        INSERT INTO ministry_audit_log (
          actor_user_id, active_profile_user_id, action,
          entity_type, entity_id, ministry_id, before_data, after_data, metadata
        )
        VALUES ($1, $2, $3, 'responsibility_assignment', $4, $5, $6::JSONB, $7::JSONB, $8::JSONB)
      `,
      [
        record.recipient_user_id,
        record.subject_user_id,
        `responsibility_assignment.${nextStatus}_by_notification`,
        record.assignment_id,
        record.ministry_id,
        JSON.stringify({ status: record.assignment_status }),
        JSON.stringify({ status: nextStatus }),
        JSON.stringify({ eventId: record.event_id, channel }),
      ],
    )
    await client.query("COMMIT")
    if (nextStatus === "declined") {
      await sendAssignmentDeclinedNotification(record.assignment_id).catch(
        (error) => {
          console.error("Unable to notify leaders about a declined assignment:", error)
        },
      )
    }
    return { status: nextStatus, message: `Assignment ${nextStatus}` }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export const handleAssignmentResponse = async (request: Request) => {
  try {
    if (request.method === "GET") {
      const token = new URL(request.url).searchParams.get("token") || ""
      if (!token) return json({ message: "Response token is required" }, 400)
      return json(await getAssignmentResponse(token))
    }
    if (request.method === "POST") {
      const body: any = await request.json().catch(() => ({}))
      if (!body.token || !["confirm", "decline"].includes(body.action)) {
        return json({ message: "Choose confirm or decline" }, 400)
      }
      return json(await respondToAssignment(body.token, body.action, "email"))
    }
    return json({ message: "Method not allowed" }, 405, { Allow: "GET, POST" })
  } catch (error: any) {
    return json(
      { message: error?.message || "Unable to respond to assignment" },
      error?.status || 500,
    )
  }
}
