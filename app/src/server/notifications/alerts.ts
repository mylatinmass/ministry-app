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
      if (body.action !== "mark_all_read") {
        return json({ message: "Unknown alert action" }, 400)
      }
      await client.query(
        `
          UPDATE ministry_alerts
          SET read_at = now(), updated_at = now()
          WHERE subject_user_id = $1 AND read_at IS NULL
        `,
        [context.user.id],
      )
    }
    const result = await client.query(
      `
        SELECT id, kind, title, message, assignment_id, event_id,
          ministry_id, read_at, created_at
        FROM ministry_alerts
        WHERE subject_user_id = $1
        ORDER BY (read_at IS NULL) DESC, created_at DESC
        LIMIT 50
      `,
      [context.user.id],
    )
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
