import pg from "pg"
import { MASS_SCHEDULE_SOURCE } from "./lib/mass-schedule-sync.mjs"

const { Client } = pg
const connectionString = process.env.MINISTRY_DATABASE_URL
if (!connectionString) {
  throw new Error("MINISTRY_DATABASE_URL is required")
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

try {
  const [events, templates] = await Promise.all([
    client.query(
      `
        SELECT
          schedule_event_type,
          count(*)::INT AS event_count,
          min(schedule_source_start_time) AS first_event,
          max(schedule_source_start_time) AS last_event
        FROM events
        WHERE schedule_source = $1
        GROUP BY schedule_event_type
        ORDER BY schedule_event_type
      `,
      [MASS_SCHEDULE_SOURCE],
    ),
    client.query(
      `
        SELECT
          template.system_key,
          template.name,
          template.version,
          count(responsibility.id)::INT AS responsibility_count,
          array_agg(
            ministry.name || ': ' || responsibility.name
            ORDER BY responsibility.sort_order
          ) AS responsibilities
        FROM templates template
        LEFT JOIN template_responsibilities responsibility
          ON responsibility.template_id = template.id
         AND responsibility.status = 'active'
        LEFT JOIN template_ministries block
          ON block.id = responsibility.template_ministry_id
        LEFT JOIN ministries ministry
          ON ministry.id = block.ministry_id
        WHERE template.system_key IN (
          'mass-schedule.low-mass',
          'mass-schedule.high-mass'
        )
        GROUP BY template.id, template.system_key, template.name, template.version
        ORDER BY template.system_key
      `,
    ),
  ])
  console.log(
    JSON.stringify(
      {
        events: events.rows.map((row) => ({
          eventType: row.schedule_event_type,
          count: Number(row.event_count),
          firstEvent: row.first_event,
          lastEvent: row.last_event,
        })),
        templates: templates.rows.map((row) => ({
          systemKey: row.system_key,
          name: row.name,
          version: Number(row.version),
          responsibilityCount: Number(row.responsibility_count),
          responsibilities: row.responsibilities,
        })),
      },
      null,
      2,
    ),
  )
} finally {
  await client.end()
}
