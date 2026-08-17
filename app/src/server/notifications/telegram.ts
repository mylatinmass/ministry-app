import crypto from "node:crypto"
import { getPool } from "../database"
import { getAuthenticatedIdentity } from "../ministry-identity"
import { json } from "../request"
import { createEvents } from "../scheduling/events"

const tokenHash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex")

const botUsername = () =>
  (process.env.TELEGRAM_BOT_USERNAME || "").trim().replace(/^@/, "")

const botToken = () => (process.env.TELEGRAM_BOT_TOKEN || "").trim()

const deliveryAllowed = () =>
  process.env.VERCEL_ENV === "production" ||
  process.env.ALLOW_PREVIEW_DELIVERY === "true"

const webhookSecret = () => {
  const token = botToken()
  const jwtSecret = process.env.JWT_SECRET_KEY || ""
  if (!token || !jwtSecret) return ""
  return crypto
    .createHash("sha256")
    .update(`telegram-webhook|${token}|${jwtSecret}`)
    .digest("hex")
}

const safeEqual = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export const callTelegram = async (method: string, body: Record<string, any>) => {
  const token = botToken()
  if (!token) {
    throw Object.assign(new Error("Telegram is not configured"), { status: 503 })
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const result: any = await response.json().catch(() => ({}))
  if (!response.ok || result.ok !== true) {
    throw Object.assign(
      new Error(result.description || `Telegram ${method} failed`),
      { status: Number(result.error_code || response.status) },
    )
  }
  return result.result
}

export const sendTelegramMessage = (
  chatId: string,
  text: string,
  url?: string,
) =>
  callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(url
      ? {
          reply_markup: {
            inline_keyboard: [[{ text: "Open Ministry App", url }]],
          },
        }
      : {}),
  })

const authenticate = async (request: Request) => {
  try {
    return await getAuthenticatedIdentity(request)
  } catch {
    return null
  }
}

const requirePassword = (identity: any) =>
  identity?.authMethod === "password" && !identity?.isEmailLinkSession

const audit = (
  identity: any,
  action: string,
  metadata: Record<string, any> = {},
) =>
  getPool().query(
    `
      INSERT INTO ministry_audit_log (
        actor_user_id, active_profile_user_id, action,
        entity_type, entity_id, metadata
      )
      VALUES ($1, $2, $3, 'user', $1, $4::JSONB)
    `,
    [
      identity.actor.id,
      identity.user.id,
      action,
      JSON.stringify({ authMethod: identity.authMethod, ...metadata }),
    ],
  )

export const handleTelegramConnection = async (request: Request) => {
  const identity = await authenticate(request)
  if (!identity) return json({ message: "Session expired" }, 401)

  const configured = Boolean(botToken() && botUsername())
  const pool = getPool()

  if (request.method === "GET") {
    const result = await pool.query(
      `
        SELECT username, status, connected_at, last_success_at
        FROM telegram_connections
        WHERE account_user_id = $1
        LIMIT 1
      `,
      [identity.actor.id],
    )
    const connection = result.rows[0]
    return json({
      configured,
      botUsername: botUsername() || null,
      connection: connection
        ? {
            username: connection.username,
            status: connection.status,
            connectedAt: connection.connected_at,
            lastSuccessAt: connection.last_success_at,
          }
        : null,
    })
  }

  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405, { Allow: "GET, POST" })
  }
  if (!requirePassword(identity)) {
    return json(
      { message: "Sign in with your username and password to connect Telegram" },
      403,
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return json({ message: "Invalid request" }, 400)
  }

  if (body.action === "create_link") {
    if (!configured) return json({ message: "Telegram is not configured" }, 503)
    if (!deliveryAllowed()) {
      return json({ message: "Telegram linking is disabled outside production" }, 403)
    }
    const expectedWebhookUrl = `${new URL(request.url).origin}/api/telegram/webhook`
    try {
      const webhook = await callTelegram("getWebhookInfo", {})
      if (webhook.url && webhook.url !== expectedWebhookUrl) {
        return json(
          {
            message:
              "This Telegram bot is connected to another application. A Super Admin must review its webhook before members can connect.",
          },
          409,
        )
      }
      if (!webhook.url || webhook.url === expectedWebhookUrl) {
        await callTelegram("setWebhook", {
          url: expectedWebhookUrl,
          secret_token: webhookSecret(),
          allowed_updates: ["message", "callback_query"],
        })
        if (!webhook.url) {
          await audit(identity, "notification.telegram_webhook_configured", {
            automatic: true,
            url: expectedWebhookUrl,
          })
        }
      }
    } catch (error: any) {
      return json(
        { message: error?.message || "Unable to activate the Telegram bot" },
        502,
      )
    }
    const token = crypto.randomBytes(24).toString("base64url")
    await pool.query(
      `
        UPDATE telegram_connection_tokens
        SET used_at = now()
        WHERE account_user_id = $1 AND used_at IS NULL
      `,
      [identity.actor.id],
    )
    await pool.query(
      `
        INSERT INTO telegram_connection_tokens (
          account_user_id, token_hash, expires_at
        )
        VALUES ($1, $2, now() + INTERVAL '15 minutes')
      `,
      [identity.actor.id, tokenHash(token)],
    )
    await audit(identity, "notification.telegram_link_started")
    return json({
      url: `https://t.me/${botUsername()}?start=${token}`,
      expiresInMinutes: 15,
    })
  }

  if (body.action === "disconnect") {
    await pool.query(
      `
        UPDATE telegram_connections
        SET status = 'disconnected', disconnected_at = now(), updated_at = now()
        WHERE account_user_id = $1
      `,
      [identity.actor.id],
    )
    await pool.query(
      `
        UPDATE ministry_accounts
        SET notification_telegram_enabled = false, updated_at = now()
        WHERE id = $1
      `,
      [identity.actor.id],
    )
    await audit(identity, "notification.telegram_disconnected")
    return json({ message: "Telegram disconnected" })
  }

  if (body.action === "test") {
    if (!configured) return json({ message: "Telegram is not configured" }, 503)
    if (!deliveryAllowed()) {
      return json({ message: "Telegram delivery is disabled outside production" }, 403)
    }
    const connectionResult = await pool.query(
      `
        SELECT chat_id
        FROM telegram_connections
        WHERE account_user_id = $1
          AND status = 'active'
        LIMIT 1
      `,
      [identity.actor.id],
    )
    const connection = connectionResult.rows[0]
    if (!connection) {
      return json({ message: "Connect Telegram before sending a test" }, 400)
    }

    try {
      await sendTelegramMessage(
        connection.chat_id,
        "Test notification from My Latin Mass Ministry. Telegram DMs are connected and working.",
      )
      await pool.query(
        `
          UPDATE telegram_connections
          SET last_success_at = now(), last_error = NULL, updated_at = now()
          WHERE account_user_id = $1
        `,
        [identity.actor.id],
      )
      await audit(identity, "notification.telegram_test_sent")
      return json({ message: "Test Telegram DM sent" })
    } catch (error: any) {
      if (Number(error?.status) === 403) {
        await pool.query(
          `
            UPDATE telegram_connections
            SET status = 'blocked', last_error = $2, updated_at = now()
            WHERE account_user_id = $1
          `,
          [identity.actor.id, error?.message || "Telegram delivery failed"],
        )
      }
      return json({ message: error?.message || "Unable to send Telegram DM" }, 502)
    }
  }

  return json({ message: "Unknown Telegram action" }, 400)
}

const reply = async (chatId: string, text: string) => {
  try {
    await sendTelegramMessage(chatId, text)
  } catch {
    // Telegram will retry the webhook if we return an error, so acknowledge it.
  }
}

const transcribeTelegramVoice = async (fileId: string) => {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim()
  if (!apiKey) throw new Error("Voice scheduling is not configured")
  const file = await callTelegram("getFile", { file_id: fileId })
  const audioResponse = await fetch(
    `https://api.telegram.org/file/bot${botToken()}/${file.file_path}`,
  )
  if (!audioResponse.ok) throw new Error("Unable to download the voice message")
  const form = new FormData()
  form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe")
  form.append("file", new Blob([await audioResponse.arrayBuffer()]), "telegram.ogg")
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  const result: any = await response.json().catch(() => ({}))
  if (!response.ok || !result.text) throw new Error("Unable to transcribe the voice message")
  return String(result.text)
}

const parseSchedulingRequest = async (input: string) => {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim()
  if (!apiKey) throw new Error("Telegram event creation is not configured")
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EVENT_PARSER_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "priest_event_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              eventType: { type: "string", enum: ["Mass", "Confession", "Sick Call", "Private Appointment", "Traveling"] },
              title: { type: "string" },
              date: { type: "string" },
              startTime: { type: "string" },
              durationMinutes: { type: "integer" },
              assignedPriestName: { type: "string" },
              needsClarification: { type: "boolean" },
              clarification: { type: "string" },
            },
            required: ["eventType", "title", "date", "startTime", "durationMinutes", "assignedPriestName", "needsClarification", "clarification"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `Convert a Priest Ministry scheduling request into JSON. Today is ${new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}. Use America/New_York. Date must be YYYY-MM-DD and time HH:mm (24-hour). Never copy a person's name, phone, street address, health detail, destination, or pastoral note into title. If those private details appear, omit them and set clarification to tell the administrator to add them securely in the Ministry App.`,
        },
        { role: "user", content: input.slice(0, 2000) },
      ],
    }),
  })
  const result: any = await response.json().catch(() => ({}))
  const content = result?.choices?.[0]?.message?.content
  if (!response.ok || !content) throw new Error("Unable to understand the scheduling request")
  return JSON.parse(content)
}

const formatDraftPreview = (draft: any) =>
  [
    "Review this event draft:",
    `${draft.eventType}: ${draft.title}`,
    `${draft.date} at ${draft.startTime} (${draft.durationMinutes} minutes)`,
    draft.assignedPriestName ? `Priest: ${draft.assignedPriestName}` : "Priest: not selected",
    draft.clarification || "Private names, addresses, telephone numbers, and notes must be added securely in the app.",
  ].join("\n")

const createTelegramDraft = async (message: any, accountUserId: string, sourceType: "text" | "voice", input: string) => {
  const parsed = await parseSchedulingRequest(input)
  if (parsed.needsClarification && (!parsed.date || !parsed.startTime)) {
    await reply(message.chat.id.toString(), parsed.clarification || "Please include the date and time.")
    return
  }
  const client = await getPool().connect()
  try {
    const ministryResult = await client.query(`SELECT id FROM ministries WHERE slug = 'priests' LIMIT 1`)
    const ministryId = ministryResult.rows[0]?.id
    if (!ministryId) throw new Error("The Priest Ministry is not configured")
    const access = await client.query(
      `SELECT 1 FROM ministry_members WHERE ministry_id = $1 AND user_id = $2 AND status = 'active' AND level IN ('owner', 'admin') LIMIT 1`,
      [ministryId, accountUserId],
    )
    const global = await client.query(`SELECT global_role FROM ministry_accounts WHERE id = $1 LIMIT 1`, [accountUserId])
    if (!access.rowCount && !["owner", "super_admin"].includes(global.rows[0]?.global_role)) {
      throw Object.assign(new Error("Only a Priest Ministry administrator can create events with Telegram"), { status: 403 })
    }
    const template = await client.query(
      `SELECT id FROM templates WHERE ministry_id = $1 AND lower(name) = lower($2) AND status = 'active' ORDER BY version DESC LIMIT 1`,
      [ministryId, parsed.eventType],
    )
    if (!template.rowCount) throw new Error(`The ${parsed.eventType} template is not available`)
    const inserted = await client.query(
      `INSERT INTO telegram_event_drafts (account_user_id, ministry_id, template_id, chat_id, source_type, parsed_data) VALUES ($1, $2, $3, $4, $5, $6::JSONB) RETURNING id`,
      [accountUserId, ministryId, template.rows[0].id, message.chat.id.toString(), sourceType, JSON.stringify(parsed)],
    )
    await callTelegram("sendMessage", {
      chat_id: message.chat.id,
      text: formatDraftPreview(parsed),
      reply_markup: {
        inline_keyboard: [[
          { text: "Confirm", callback_data: `eventdraft:confirm:${inserted.rows[0].id}` },
          { text: "Cancel", callback_data: `eventdraft:cancel:${inserted.rows[0].id}` },
        ]],
      },
    })
  } finally {
    client.release()
  }
}

const handleEventDraftCallback = async (callback: any) => {
  const match = String(callback.data || "").match(/^eventdraft:(confirm|cancel):([0-9a-f-]{36})$/i)
  if (!match) return
  const chatId = callback.message?.chat?.id?.toString()
  const telegramUserId = callback.from?.id?.toString()
  if (!chatId || !telegramUserId) return
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    const result = await client.query(
      `SELECT draft.*, member.id AS actor_id, member.global_role FROM telegram_event_drafts draft JOIN telegram_connections connection ON connection.account_user_id = draft.account_user_id JOIN ministry_accounts member ON member.id = draft.account_user_id WHERE draft.id = $1 AND draft.chat_id = $2 AND connection.telegram_user_id = $3 AND draft.status = 'pending' AND draft.expires_at > now() LIMIT 1 FOR UPDATE`,
      [match[2], chatId, telegramUserId],
    )
    const draft = result.rows[0]
    if (!draft) throw new Error("This draft expired or was already handled")
    if (match[1] === "cancel") {
      await client.query(`UPDATE telegram_event_drafts SET status = 'cancelled', updated_at = now() WHERE id = $1`, [draft.id])
      await client.query("COMMIT")
      await reply(chatId, "Event draft cancelled.")
      return
    }
    const parsed = draft.parsed_data
    const wallClock = new Date(`${parsed.date}T${parsed.startTime}:00Z`)
    let start = new Date(wallClock)
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    })
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(start).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]))
      const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
      start = new Date(start.getTime() + (wallClock.getTime() - observed))
    }
    if (Number.isNaN(start.getTime())) throw new Error("The draft date or time is invalid")
    const end = new Date(start.getTime() + Math.max(15, Number(parsed.durationMinutes || 60)) * 60_000)
    const context = {
      actor: { id: draft.actor_id, global_role: draft.global_role },
      user: { id: draft.actor_id, global_role: draft.global_role },
      isManagedProfile: false,
      authMethod: "password",
      isEmailLinkSession: false,
    }
    const creation = await createEvents(client, context, {
      templateId: draft.template_id,
      title: parsed.title || parsed.eventType,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: "draft",
      participationType: "members",
      visibility: ["Sick Call", "Private Appointment", "Traveling"].includes(parsed.eventType) ? "private" : "ministry",
      recurrence: { frequency: "none" },
    })
    await client.query(`UPDATE telegram_event_drafts SET status = 'confirmed', event_id = $2, updated_at = now() WHERE id = $1`, [draft.id, creation.eventIds[0]])
    await client.query("COMMIT")
    const appUrl = (process.env.PUBLIC_MINISTRY_APP_URL || "https://ministry.mylatinmass.com").replace(/\/$/, "")
    await sendTelegramMessage(chatId, "Draft event created. Open the secure event view to assign the priest and add any private details.", `${appUrl}/priests?event=${creation.eventIds[0]}&private=1`)
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {})
    await reply(chatId, error?.message || "Unable to create the event draft")
  } finally {
    client.release()
    await callTelegram("answerCallbackQuery", { callback_query_id: callback.id }).catch(() => {})
  }
}

export const handleTelegramWebhook = async (request: Request) => {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405, { Allow: "POST" })
  }
  const expectedSecret = webhookSecret()
  const actualSecret =
    request.headers.get("x-telegram-bot-api-secret-token") || ""
  if (!expectedSecret || !safeEqual(actualSecret, expectedSecret)) {
    return json({ message: "Unauthorized" }, 401)
  }

  let update: any
  try {
    update = await request.json()
  } catch {
    return json({ ok: true })
  }
  if (update?.callback_query) {
    await handleEventDraftCallback(update.callback_query)
    return json({ ok: true })
  }
  const message = update?.message
  const chatId = message?.chat?.id?.toString()
  const telegramUserId = message?.from?.id?.toString()
  const text = typeof message?.text === "string" ? message.text.trim() : ""
  const match = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,64})$/)
  if (!chatId || !telegramUserId || message?.chat?.type !== "private") {
    return json({ ok: true })
  }
  if (!match) {
    const connection = await getPool().query(
      `SELECT account_user_id FROM telegram_connections WHERE telegram_user_id = $1 AND chat_id = $2 AND status = 'active' LIMIT 1`,
      [telegramUserId, chatId],
    )
    if (!connection.rowCount) {
      await reply(chatId, "Open your Ministry profile and choose Connect Telegram to link this bot.")
      return json({ ok: true })
    }
    if (!text && !message?.voice?.file_id) {
      await reply(chatId, "Send a text or voice scheduling request. Do not include names, addresses, telephone numbers, health details, or private pastoral notes.")
      return json({ ok: true })
    }
    try {
      const input = text || await transcribeTelegramVoice(message.voice.file_id)
      await createTelegramDraft(message, connection.rows[0].account_user_id, text ? "text" : "voice", input)
    } catch (error: any) {
      await reply(chatId, error?.message || "Unable to prepare the event draft")
    }
    return json({ ok: true })
  }

  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    const tokenResult = await client.query(
      `
        SELECT id, account_user_id
        FROM telegram_connection_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        LIMIT 1
        FOR UPDATE
      `,
      [tokenHash(match[1])],
    )
    const connectionToken = tokenResult.rows[0]
    if (!connectionToken) {
      await client.query("ROLLBACK")
      await reply(
        chatId,
        "This connection link expired. Return to your Ministry profile and create a new one.",
      )
      return json({ ok: true })
    }

    await client.query(
      `
        INSERT INTO telegram_connections (
          account_user_id, telegram_user_id, chat_id, username,
          first_name, last_name, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        ON CONFLICT (account_user_id) DO UPDATE SET
          telegram_user_id = excluded.telegram_user_id,
          chat_id = excluded.chat_id,
          username = excluded.username,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          status = 'active',
          connected_at = now(),
          disconnected_at = NULL,
          last_error = NULL,
          updated_at = now()
      `,
      [
        connectionToken.account_user_id,
        telegramUserId,
        chatId,
        message.from.username || null,
        message.from.first_name || null,
        message.from.last_name || null,
      ],
    )
    await client.query(
      `UPDATE telegram_connection_tokens SET used_at = now() WHERE id = $1`,
      [connectionToken.id],
    )
    await client.query(
      `
        INSERT INTO ministry_audit_log (
          actor_user_id, active_profile_user_id, action,
          entity_type, entity_id, metadata
        )
        VALUES ($1, $1, 'notification.telegram_connected', 'user', $1, $2::JSONB)
      `,
      [
        connectionToken.account_user_id,
        JSON.stringify({ telegramUserId, username: message.from.username || null }),
      ],
    )
    await client.query("COMMIT")
    await reply(
      chatId,
      "Telegram notifications are now connected to your My Latin Mass Ministry account.",
    )
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {})
    if (error?.code === "23505") {
      await reply(
        chatId,
        "This Telegram account is already connected to another Ministry account.",
      )
    }
  } finally {
    client.release()
  }
  return json({ ok: true })
}

const requireTelegramAdmin = (identity: any) =>
  requirePassword(identity) &&
  ["owner", "super_admin"].includes(identity.actor.global_role)

export const handleTelegramSetup = async (request: Request) => {
  const identity = await authenticate(request)
  if (!identity) return json({ message: "Session expired" }, 401)
  if (!requireTelegramAdmin(identity)) {
    return json({ message: "Super Admin access is required" }, 403)
  }
  if (!botToken() || !botUsername()) {
    return json({ message: "Telegram is not configured" }, 503)
  }
  if (request.method === "POST" && !deliveryAllowed()) {
    return json({ message: "Telegram setup is disabled outside production" }, 403)
  }

  const expectedUrl = `${new URL(request.url).origin}/api/telegram/webhook`
  let bot
  let webhook
  try {
    ;[bot, webhook] = await Promise.all([
      callTelegram("getMe", {}),
      callTelegram("getWebhookInfo", {}),
    ])
  } catch (error: any) {
    return json(
      { message: error?.message || "Unable to check the Telegram bot" },
      502,
    )
  }

  if (request.method === "GET") {
    return json({
      bot: { id: bot.id?.toString(), username: bot.username },
      webhook: {
        url: webhook.url || "",
        expectedUrl,
        active: webhook.url === expectedUrl,
        pendingUpdateCount: Number(webhook.pending_update_count || 0),
        lastErrorMessage: webhook.last_error_message || null,
      },
    })
  }
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405, { Allow: "GET, POST" })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  if (webhook.url && webhook.url !== expectedUrl && body.replaceExisting !== true) {
    return json(
      {
        message: "This bot already has a different webhook",
        existingWebhookUrl: webhook.url,
        expectedUrl,
      },
      409,
    )
  }

  try {
    await callTelegram("setWebhook", {
      url: expectedUrl,
      secret_token: webhookSecret(),
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    })
  } catch (error: any) {
    return json(
      { message: error?.message || "Unable to activate the Telegram webhook" },
      502,
    )
  }
  await audit(identity, "notification.telegram_webhook_configured", {
    replacedExisting: Boolean(webhook.url && webhook.url !== expectedUrl),
  })
  return json({ message: "Telegram webhook activated", url: expectedUrl })
}
