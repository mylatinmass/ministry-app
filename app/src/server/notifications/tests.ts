import crypto from "node:crypto"
import { getPool } from "../database"
import { json } from "../request"
import { getIdentityContext } from "../scheduling/authorization"
import { sendReliableEmail } from "./delivery"
import { sendKlaviyoAlertDue } from "./klaviyo"

const deliveryAllowed = () =>
  process.env.MINISTRY_OUTBOUND_DELIVERY_ENABLED === "true" &&
  (process.env.VERCEL_ENV === "production" ||
    process.env.ALLOW_PREVIEW_DELIVERY === "true")

export const handleNotificationTest = async (request: Request) => {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405, { Allow: "POST" })
  }
  if (!deliveryAllowed()) {
    return json({ message: "Test delivery is available only when outbound delivery is enabled" }, 403)
  }

  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    if (context.isEmailLinkSession) {
      return json({ message: "Sign in with your password to send a test" }, 403)
    }
    const body = await request.json().catch(() => ({}))
    const channel = String(body.channel || "").toLowerCase()
    if (!["email", "sms"].includes(channel)) {
      return json({ message: "Choose Email or SMS" }, 400)
    }

    const contactResult = await client.query(
      `
        SELECT email, COALESCE(NULLIF(phone, ''), telephone) AS phone,
          sms_transactional_consent_at
        FROM ministry_accounts
        WHERE id = $1
        LIMIT 1
      `,
      [context.actor.id],
    )
    const contact = contactResult.rows[0]
    if (!contact) return json({ message: "Account contact information was not found" }, 404)

    const action = `notification.${channel}_test_sent`
    const recent = await client.query(
      `
        SELECT 1 FROM ministry_audit_log
        WHERE actor_user_id = $1 AND action = $2
          AND created_at > now() - INTERVAL '1 minute'
        LIMIT 1
      `,
      [context.actor.id, action],
    )
    if (recent.rowCount) {
      return json({ message: "Wait one minute before sending another test" }, 429)
    }

    let provider = channel
    if (channel === "email") {
      if (!contact.email) return json({ message: "Add an email address first" }, 400)
      const attempts = await sendReliableEmail({
        to: contact.email,
        subject: "My Latin Mass notification test",
        text: "This is a test from My Latin Mass Ministry. Email notifications are connected and working.",
      })
      const accepted = attempts.find((attempt) => attempt.status === "sent")
      if (!accepted) {
        const unavailable = attempts.every((attempt) => attempt.status === "skipped")
        return json(
          { message: unavailable ? "Email delivery is not configured" : "The test email could not be sent" },
          unavailable ? 503 : 502,
        )
      }
      provider = accepted.provider
    } else {
      if (!contact.phone) return json({ message: "Add a telephone number first" }, 400)
      if (!contact.sms_transactional_consent_at) {
        return json({ message: "Accept transactional SMS consent first" }, 400)
      }
      await sendKlaviyoAlertDue({
        id: crypto.randomUUID(),
        kind: "notification_test",
        notification_category: "test",
        privacy_safe_message:
          "Test notification from My Latin Mass Ministry. SMS notifications are connected and working.",
        notification_url: "/",
        subject_user_id: context.user.id,
        recipient_user_id: context.actor.id,
        recipient_phone: contact.phone,
        sms_transactional_consent_at: contact.sms_transactional_consent_at,
      })
      provider = "klaviyo"
    }

    if (channel === "email") {
      await client.query(
        `
          UPDATE ministry_accounts
          SET notification_email_connected_value = email,
            notification_email_connected_at = now(),
            updated_at = now()
          WHERE id = $1
        `,
        [context.actor.id],
      )
    } else {
      await client.query(
        `
          UPDATE ministry_accounts
          SET notification_sms_connected_value = COALESCE(NULLIF(phone, ''), telephone),
            notification_sms_connected_at = now(),
            updated_at = now()
          WHERE id = $1
        `,
        [context.actor.id],
      )
    }

    await client.query(
      `
        INSERT INTO ministry_audit_log (
          actor_user_id, active_profile_user_id, action,
          entity_type, entity_id, metadata
        ) VALUES ($1, $2, $3, 'user', $2, $4::JSONB)
      `,
      [context.actor.id, context.user.id, action, JSON.stringify({ provider })],
    )
    return json({
      message: channel === "email" ? "Test email sent" : "Test SMS queued",
      connected: true,
    })
  } catch (error: any) {
    const status = Number(error?.status) ||
      (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    return json({
      message: status === 401 ? "Session expired" : error?.message || "Unable to send test",
    }, status)
  } finally {
    client.release()
  }
}
