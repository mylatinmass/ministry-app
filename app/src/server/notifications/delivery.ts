import nodemailer from "nodemailer"
import webpush from "web-push"
import { getPool } from "../database"

export type ChannelAttempt = {
  provider: string
  status: "sent" | "failed" | "skipped"
  providerStatus?: number | null
  providerMessageId?: string | null
  errorCode?: string | null
}

const configuredGmailTransport = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return null
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  })
}

const configuredFallbackTransport = () => {
  if (
    !process.env.MINISTRY_FALLBACK_SMTP_HOST ||
    !process.env.MINISTRY_FALLBACK_SMTP_USER ||
    !process.env.MINISTRY_FALLBACK_SMTP_PASS
  ) {
    return null
  }
  const port = Number.parseInt(
    process.env.MINISTRY_FALLBACK_SMTP_PORT || "587",
    10,
  )
  return nodemailer.createTransport({
    host: process.env.MINISTRY_FALLBACK_SMTP_HOST,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.MINISTRY_FALLBACK_SMTP_SECURE === "true",
    auth: {
      user: process.env.MINISTRY_FALLBACK_SMTP_USER,
      pass: process.env.MINISTRY_FALLBACK_SMTP_PASS,
    },
  })
}

export const sendReliableEmail = async ({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<ChannelAttempt[]> => {
  const providers = [
    {
      name: "gmail",
      transport: configuredGmailTransport(),
      from:
        process.env.MINISTRY_EMAIL_FROM ||
        (process.env.GMAIL_USER
          ? `"My Latin Mass" <${process.env.GMAIL_USER}>`
          : ""),
    },
    {
      name: "fallback_smtp",
      transport: configuredFallbackTransport(),
      from:
        process.env.MINISTRY_FALLBACK_SMTP_FROM ||
        process.env.MINISTRY_EMAIL_FROM ||
        process.env.GMAIL_USER ||
        "",
    },
  ].filter((provider) => provider.transport && provider.from)

  if (!providers.length) {
    return [
      {
        provider: "email",
        status: "skipped",
        errorCode: "email_not_configured",
      },
    ]
  }

  const attempts: ChannelAttempt[] = []
  for (const provider of providers) {
    try {
      const result = await provider.transport!.sendMail({
        from: provider.from,
        replyTo: process.env.MINISTRY_EMAIL_REPLY_TO || process.env.GMAIL_USER,
        to,
        subject,
        text,
        html,
      })
      attempts.push({
        provider: provider.name,
        status: "sent",
        providerMessageId: result.messageId || null,
      })
      return attempts
    } catch (error: any) {
      attempts.push({
        provider: provider.name,
        status: "failed",
        providerStatus: Number(error?.responseCode || 0) || null,
        errorCode: error?.code || error?.message || "email_failed",
      })
    }
  }
  return attempts
}

export const sendAccountPush = async ({
  accountUserId,
  title,
  body,
  url,
  tag,
}: {
  accountUserId: string
  title: string
  body: string
  url: string
  tag: string
}): Promise<ChannelAttempt[]> => {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return [
      {
        provider: "web_push",
        status: "skipped",
        errorCode: "push_not_configured",
      },
    ]
  }
  const subscriptions = await getPool().query(
    `
      SELECT id, endpoint, p256dh_key, auth_key
      FROM push_subscriptions
      WHERE account_user_id = $1 AND status = 'active'
    `,
    [accountUserId],
  )
  if (!subscriptions.rowCount) {
    return [
      {
        provider: "web_push",
        status: "skipped",
        errorCode: "push_subscription_missing",
      },
    ]
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:mylatinmass@gmail.com",
    publicKey,
    privateKey,
  )
  const payload = JSON.stringify({ title, body, url, tag })
  const attempts: ChannelAttempt[] = []
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
      attempts.push({
        provider: "web_push",
        status: "sent",
        providerStatus: response.statusCode,
      })
      await getPool().query(
        `UPDATE push_subscriptions SET last_success_at = now(), updated_at = now() WHERE id = $1`,
        [subscription.id],
      )
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || 0) || null
      attempts.push({
        provider: "web_push",
        status: "failed",
        providerStatus: statusCode,
        errorCode: error?.code || error?.message || "push_failed",
      })
      if ([404, 410].includes(statusCode || 0)) {
        await getPool().query(
          `UPDATE push_subscriptions SET status = 'expired', updated_at = now() WHERE id = $1`,
          [subscription.id],
        )
      }
    }
  }
  return attempts
}
