import { getPool } from "../database"
import { json } from "../request"
import { getIdentityContext } from "../scheduling/authorization"

export const handleAlerts = async (request: Request) => {
  if (!["GET", "PATCH"].includes(request.method)) {
    return json({ message: "Method not allowed" }, 405, { Allow: "GET, PATCH" })
  }
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    if (request.method === "PATCH") {
      const body = await request.json().catch(() => ({}))
      if (body.action === "mark_all_read") {
        await client.query(
          `
            UPDATE ministry_alerts
            SET read_at = now(), updated_at = now()
            WHERE subject_user_id = $1 AND read_at IS NULL
          `,
          [context.user.id],
        )
      } else if (body.action === "acknowledge" && body.alertId) {
        const alertResult = await client.query(
          `
            SELECT id, event_id, ministry_id,
              metadata->>'acknowledgmentGroupKey' AS acknowledgment_group_key
            FROM ministry_alerts
            WHERE id = $1
              AND subject_user_id = $2
              AND acknowledgment_required = true
              AND acknowledged_at IS NULL
            LIMIT 1
          `,
          [String(body.alertId), context.user.id],
        )
        const alert = alertResult.rows[0]
        if (!alert) {
          return json({ message: "This alert is already acknowledged or unavailable" }, 409)
        }
        await client.query("BEGIN")
        try {
          if (alert.acknowledgment_group_key) {
            await client.query(
              `
                UPDATE ministry_alerts
                SET acknowledged_at = now(), acknowledged_by_user_id = $2,
                    updated_at = now()
                WHERE metadata->>'acknowledgmentGroupKey' = $1
                  AND acknowledged_at IS NULL
              `,
              [alert.acknowledgment_group_key, context.actor.id],
            )
          } else {
            await client.query(
              `
                UPDATE ministry_alerts
                SET acknowledged_at = now(), acknowledged_by_user_id = $2,
                    updated_at = now()
                WHERE id = $1 AND acknowledged_at IS NULL
              `,
              [alert.id, context.actor.id],
            )
          }
          await client.query(
            `UPDATE ministry_alerts SET read_at = COALESCE(read_at, now()), updated_at = now() WHERE id = $1`,
            [alert.id],
          )
          await client.query(
            `
              INSERT INTO ministry_audit_log (
                actor_user_id, active_profile_user_id, action,
                entity_type, entity_id, ministry_id, metadata
              ) VALUES ($1, $2, 'notification.acknowledged',
                'ministry_alert', $3, $4, $5::JSONB)
            `,
            [
              context.actor.id,
              context.user.id,
              alert.id,
              alert.ministry_id,
              JSON.stringify({
                eventId: alert.event_id,
                acknowledgmentGroupKey: alert.acknowledgment_group_key,
              }),
            ],
          )
          await client.query("COMMIT")
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {})
          throw error
        }
      } else {
        return json({ message: "Unknown alert action" }, 400)
      }
    }
    const result = await client.query(
      `
        SELECT id, kind, title, message, assignment_id, event_id,
          ministry_id, read_at, delivery_status, attempt_count,
          next_attempt_at, sent_at, last_error, created_at,
          acknowledgment_required, acknowledgment_deadline_at,
          acknowledged_at, escalation_sent_at
        FROM ministry_alerts
        WHERE subject_user_id = $1
        ORDER BY (read_at IS NULL) DESC, created_at DESC
        LIMIT 50
      `,
      [context.user.id],
    )
    const alertIds = result.rows.map((alert) => alert.id)
    const deliveryResult = alertIds.length
      ? await client.query(
          `
            SELECT DISTINCT ON (delivery.alert_id, delivery.channel)
              delivery.alert_id, delivery.channel, delivery.provider,
              delivery.status, delivery.provider_status,
              delivery.provider_message_id, delivery.error_code,
              delivery.attempted_at
            FROM ministry_alert_deliveries delivery
            WHERE delivery.alert_id = ANY($1)
            ORDER BY delivery.alert_id, delivery.channel, delivery.attempted_at DESC
          `,
          [alertIds],
        )
      : { rows: [] }
    const deliveriesByAlert = new Map<string, any[]>()
    for (const delivery of deliveryResult.rows) {
      const rows = deliveriesByAlert.get(delivery.alert_id) || []
      rows.push({
        channel: delivery.channel,
        provider: delivery.provider,
        status: delivery.status,
        providerStatus: delivery.provider_status,
        messageId: delivery.provider_message_id,
        errorCode: delivery.error_code,
        attemptedAt: delivery.attempted_at,
      })
      deliveriesByAlert.set(delivery.alert_id, rows)
    }
    return json({
      unreadCount: result.rows.filter((alert) => !alert.read_at).length,
      alerts: result.rows.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        title: alert.title,
        message: alert.message,
        assignmentId: alert.assignment_id,
        eventId: alert.event_id,
        ministryId: alert.ministry_id,
        read: Boolean(alert.read_at),
        deliveryStatus: alert.delivery_status,
        deliveryAttempts: Number(alert.attempt_count || 0),
        nextAttemptAt: alert.next_attempt_at,
        sentAt: alert.sent_at,
        deliveryError: alert.last_error,
        acknowledgmentRequired: Boolean(alert.acknowledgment_required),
        acknowledgmentDeadlineAt: alert.acknowledgment_deadline_at,
        acknowledgedAt: alert.acknowledged_at,
        escalatedAt: alert.escalation_sent_at,
        deliveries: deliveriesByAlert.get(alert.id) || [],
        createdAt: alert.created_at,
      })),
    })
  } catch (error: any) {
    const status = /session|token|inactive/i.test(error?.message) ? 401 : 500
    if (status === 500) console.error("Unable to load ministry alerts:", error)
    return json({ message: status === 401 ? "Session expired" : "Unable to load alerts" }, status)
  } finally {
    client.release()
  }
}
