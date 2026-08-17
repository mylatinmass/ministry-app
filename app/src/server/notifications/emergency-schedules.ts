import { getPool } from "../database"
import { sendReliableEmail } from "./delivery"

const chapelParts = (date = new Date()) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )

const formatEvent = (event: any) => {
  const start = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.start_time))
  const title = event.visibility === "private" ? event.template_name || "Private appointment" : event.title
  return `${start} — ${title} — ${event.filled_count}/${event.required_count} positions filled`
}

export const processWeeklyEmergencySchedules = async () => {
  if (
    process.env.VERCEL_ENV !== "production" &&
    process.env.ALLOW_PREVIEW_DELIVERY !== "true"
  ) return 0
  const parts = chapelParts()
  if (parts.weekday !== "Mon" || Number(parts.hour) < 6) return 0
  const pool = getPool()
  const recipients = await pool.query(
    `
      SELECT ministry.id AS ministry_id, ministry.name AS ministry_name,
        member.id AS user_id, member.email
      FROM ministries ministry
      JOIN ministry_members membership
        ON membership.ministry_id = ministry.id
       AND membership.status = 'active'
       AND membership.level IN ('owner', 'admin')
      JOIN ministry_accounts member ON member.id = membership.user_id
      WHERE ministry.status = 'active'
        AND member.status = 'active'
        AND member.email IS NOT NULL
      UNION
      SELECT ministry.id, ministry.name, member.id, member.email
      FROM ministries ministry
      JOIN ministry_accounts member ON member.global_role IN ('owner', 'super_admin')
      WHERE ministry.status = 'active'
        AND member.status = 'active'
        AND member.email IS NOT NULL
    `,
  )
  let sent = 0
  for (const recipient of recipients.rows) {
    const events = await pool.query(
      `
        SELECT event.id, event.title, event.start_time,
          COALESCE(event.visibility, 'public') AS visibility,
          template.name AS template_name,
          count(DISTINCT responsibility.id)::INT AS required_count,
          count(DISTINCT assignment.id)::INT AS filled_count
        FROM events event
        LEFT JOIN event_ministries participant ON participant.event_id = event.id
        LEFT JOIN templates template ON template.id = event.template_id
        LEFT JOIN event_responsibilities responsibility
          ON responsibility.event_id = event.id AND responsibility.status <> 'cancelled'
        LEFT JOIN responsibility_assignments assignment
          ON assignment.responsibility_id = responsibility.id
         AND assignment.status NOT IN ('declined', 'cancelled')
        WHERE (event.ministry_id = $1 OR participant.ministry_id = $1)
          AND event.status = 'published'
          AND event.start_time >= date_trunc('day', now())
          AND event.start_time < date_trunc('day', now()) + INTERVAL '7 days'
        GROUP BY event.id, template.name
        ORDER BY event.start_time
      `,
      [recipient.ministry_id],
    )
    const weekStart = `${parts.year}-${parts.month}-${parts.day}`
    const claimed = await pool.query(
      `
        INSERT INTO ministry_emergency_schedule_deliveries (
          ministry_id, recipient_user_id, week_start, status
        )
        VALUES ($1, $2, $3, 'processing')
        ON CONFLICT (ministry_id, recipient_user_id, week_start) DO NOTHING
        RETURNING id
      `,
      [recipient.ministry_id, recipient.user_id, weekStart],
    )
    if (!claimed.rowCount) continue
    const lines = events.rows.length
      ? events.rows.map(formatEvent)
      : ["No published events are scheduled for the next seven days."]
    const attempts = await sendReliableEmail({
      to: recipient.email,
      subject: `${recipient.ministry_name} weekly emergency schedule`,
      text: [
        `${recipient.ministry_name.toUpperCase()}`,
        `Emergency schedule beginning ${weekStart}`,
        "",
        ...lines,
        "",
        "This privacy-safe copy intentionally excludes private names, addresses, telephone numbers, and pastoral notes.",
        "Open the Ministry App for current details before acting.",
      ].join("\n"),
    })
    const delivered = attempts.some((attempt) => attempt.status === "sent")
    await pool.query(
      `UPDATE ministry_emergency_schedule_deliveries SET status = $2, provider_results = $3::JSONB, sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END WHERE id = $1`,
      [claimed.rows[0].id, delivered ? "sent" : "failed", JSON.stringify(attempts)],
    )
    if (delivered) sent += 1
  }
  return sent
}
