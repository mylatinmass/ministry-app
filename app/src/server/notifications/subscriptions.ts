import crypto from "node:crypto"
import webpush from "web-push"
import { getPool } from "../database"
import { getAuthenticatedIdentity } from "../ministry-identity"
import { json } from "../request"

const endpointHash = (endpoint: string) =>
  crypto.createHash("sha256").update(endpoint).digest("hex")

const deliveryAllowed = () =>
  process.env.VERCEL_ENV === "production" ||
  process.env.ALLOW_PREVIEW_DELIVERY === "true"

export const handleVapidPublicKey = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (!publicKey) return json({ message: "Push notifications are not configured" }, 503)
  return json({ publicKey })
}

export const handleSubscriptions = async (request: Request) => {
  let identity
  try {
    identity = await getAuthenticatedIdentity(request)
  } catch {
    return json({ message: "Session expired" }, 401)
  }

  const accountUserId = identity.actor.id
  const pool = getPool()

  if (request.method === "GET") {
    const result = await pool.query(
      `
        SELECT id, status, user_agent, last_success_at, created_at, updated_at
        FROM push_subscriptions
        WHERE account_user_id = $1
        ORDER BY updated_at DESC
      `,
      [accountUserId],
    )
    return json({
      subscriptions: result.rows.map((row: Record<string, any>) => ({
        id: row.id,
        status: row.status,
        userAgent: row.user_agent,
        lastSuccessAt: row.last_success_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    })
  }

  if (request.method === "POST") {
    let body: any
    try {
      body = await request.json()
    } catch {
      return json({ message: "Invalid subscription" }, 400)
    }

    const endpoint = body?.endpoint?.toString().trim()
    const p256dh = body?.keys?.p256dh?.toString().trim()
    const auth = body?.keys?.auth?.toString().trim()
    if (!endpoint || !p256dh || !auth || !endpoint.startsWith("https://")) {
      return json({ message: "Invalid push subscription" }, 400)
    }

    const result = await pool.query(
      `
        INSERT INTO push_subscriptions (
          account_user_id, endpoint, endpoint_hash, p256dh_key, auth_key,
          user_agent, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        ON CONFLICT (endpoint_hash)
        DO UPDATE SET
          account_user_id = excluded.account_user_id,
          endpoint = excluded.endpoint,
          p256dh_key = excluded.p256dh_key,
          auth_key = excluded.auth_key,
          user_agent = excluded.user_agent,
          status = 'active',
          updated_at = now()
        RETURNING id, status
      `,
      [
        accountUserId,
        endpoint,
        endpointHash(endpoint),
        p256dh,
        auth,
        request.headers.get("user-agent"),
      ],
    )

    return json({ subscription: result.rows[0] }, 201)
  }

  if (request.method === "DELETE") {
    let subscriptionId = new URL(request.url).searchParams.get("id")
    if (!subscriptionId) {
      try {
        const body: any = await request.json()
        subscriptionId = body?.id || null
      } catch {
        subscriptionId = null
      }
    }
    if (!subscriptionId) return json({ message: "Subscription ID is required" }, 400)

    const result = await pool.query(
      `
        UPDATE push_subscriptions
        SET status = 'revoked', updated_at = now()
        WHERE id = $1 AND account_user_id = $2
        RETURNING id
      `,
      [subscriptionId, accountUserId],
    )
    if (!result.rowCount) return json({ message: "Subscription not found" }, 404)
    return json({ message: "Notifications disabled on this device" })
  }

  return json({ message: "Method not allowed" }, 405, { Allow: "GET, POST, DELETE" })
}

export const handleTestPush = async (request: Request) => {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405, { Allow: "POST" })
  }
  if (!deliveryAllowed()) {
    return json({ message: "Test delivery is available only in production" }, 403)
  }

  let identity
  try {
    identity = await getAuthenticatedIdentity(request)
  } catch {
    return json({ message: "Session expired" }, 401)
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return json({ message: "Push notifications are not configured" }, 503)
  }

  const accountUserId = identity.actor.id
  const pool = getPool()
  const recent = await pool.query(
    `
      SELECT 1
      FROM push_subscriptions
      WHERE account_user_id = $1
        AND last_test_at > now() - INTERVAL '1 minute'
      LIMIT 1
    `,
    [accountUserId],
  )
  if (recent.rowCount) {
    return json({ message: "Wait one minute before sending another test" }, 429)
  }

  const subscriptions = await pool.query(
    `
      UPDATE push_subscriptions
      SET last_test_at = now(), updated_at = now()
      WHERE account_user_id = $1 AND status = 'active'
      RETURNING id, endpoint, p256dh_key, auth_key
    `,
    [accountUserId],
  )
  if (!subscriptions.rowCount) {
    return json({ message: "Enable notifications on this device first" }, 409)
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:mylatinmass@gmail.com",
    publicKey,
    privateKey,
  )
  const payload = JSON.stringify({
    title: "My Latin Mass notifications",
    body: "Push notifications are working on this device.",
    url: "/",
    tag: `ministry-push-test-${accountUserId}`,
  })
  let sent = 0
  let failed = 0

  for (const subscription of subscriptions.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        },
        payload,
        { TTL: 60, urgency: "high" },
      )
      sent += 1
      await pool.query(
        `
          UPDATE push_subscriptions
          SET last_success_at = now(), updated_at = now()
          WHERE id = $1
        `,
        [subscription.id],
      )
    } catch (error: any) {
      failed += 1
      const statusCode = Number(error?.statusCode || 0)
      if ([404, 410].includes(statusCode)) {
        await pool.query(
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

  await pool.query(
    `
      INSERT INTO ministry_audit_log (
        actor_user_id,
        active_profile_user_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      VALUES ($1, $2, 'notification.push_test_sent', 'user', $1, $3::JSONB)
    `,
    [
      identity.actor.id,
      identity.user.id,
      JSON.stringify({ sent, failed, attempted: subscriptions.rowCount }),
    ],
  )

  if (!sent) {
    return json(
      { message: "The test could not reach an active device", sent, failed },
      502,
    )
  }
  return json({ message: "Test notification sent", sent, failed })
}
