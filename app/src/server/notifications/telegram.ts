import crypto from "node:crypto"
import { getPool } from "../database"
import { getAuthenticatedIdentity } from "../ministry-identity"
import { json } from "../request"

const tokenHash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex")

const botUsername = () =>
  (process.env.TELEGRAM_BOT_USERNAME || "").trim().replace(/^@/, "")

const botToken = () => (process.env.TELEGRAM_BOT_TOKEN || "").trim()

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
        UPDATE users
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
  const message = update?.message
  const chatId = message?.chat?.id?.toString()
  const telegramUserId = message?.from?.id?.toString()
  const text = typeof message?.text === "string" ? message.text.trim() : ""
  const match = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,64})$/)
  if (!chatId || !telegramUserId || message?.chat?.type !== "private" || !match) {
    if (chatId) {
      await reply(
        chatId,
        "Open your Ministry profile and choose Connect Telegram to link this bot.",
      )
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
      allowed_updates: ["message"],
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
