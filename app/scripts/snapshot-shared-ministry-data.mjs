import fs from "node:fs/promises"
import path from "node:path"
import { gzipSync } from "node:zlib"
import pg from "pg"

const { Client } = pg
const connectionString = process.env.PARISH_MIGRATION_SOURCE_URL
const outputPath = process.env.MINISTRY_SNAPSHOT_PATH

if (!connectionString) throw new Error("PARISH_MIGRATION_SOURCE_URL is required")
if (!outputPath || !path.isAbsolute(outputPath)) {
  throw new Error("MINISTRY_SNAPSHOT_PATH must be an absolute path")
}

const ministryTables = [
  "assignment_change_requests",
  "assignment_response_tokens",
  "assignment_substitution_offers",
  "availability_blocks",
  "chapel_observances",
  "chapel_rooms",
  "chapel_settings",
  "event_ministries",
  "event_ordo_selections",
  "event_responsibilities",
  "event_room_reservations",
  "events",
  "klaviyo_profile_syncs",
  "managed_profile_audit",
  "managed_profile_link_invitations",
  "managed_profile_membership_request_recipients",
  "managed_profile_membership_requests",
  "managed_profile_separations",
  "managed_profiles",
  "member_availability",
  "ministries",
  "ministry_access_requests",
  "ministry_alert_deliveries",
  "ministry_alerts",
  "ministry_audit_log",
  "ministry_emergency_schedule_deliveries",
  "ministry_invitation_items",
  "ministry_invitations",
  "ministry_levels",
  "ministry_login_links",
  "ministry_members",
  "ministry_message_recipients",
  "ministry_messages",
  "ministry_profile_suppressions",
  "ministry_reminder_deliveries",
  "ministry_reminders",
  "ministry_schema_migrations",
  "ordo_days",
  "priest_appointment_details",
  "priory_allocation_cache",
  "priory_allocation_exceptions",
  "priory_allocation_requests",
  "priory_integration_settings",
  "priory_priest_catalog",
  "priory_priest_mappings",
  "priory_sync_runs",
  "push_subscriptions",
  "responsibility_assignments",
  "telegram_connection_tokens",
  "telegram_connections",
  "telegram_event_drafts",
  "template_ministries",
  "template_responsibilities",
  "template_versions",
  "templates",
  "volunteer_account_invitations",
]

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
try {
  const snapshot = {
    format: "mylatinmass-shared-ministry-json-v1",
    capturedAt: new Date().toISOString(),
    sourceDatabase: "parishioners",
    schemas: {},
    tables: {},
  }
  for (const table of ["users", ...ministryTables]) {
    const schema = await client.query(`SHOW CREATE TABLE ${quoteIdentifier(table)}`)
    const rows = await client.query(`SELECT * FROM ${quoteIdentifier(table)}`)
    snapshot.schemas[table] = schema.rows[0]?.create_statement || null
    snapshot.tables[table] = rows.rows
  }
  const compressed = gzipSync(JSON.stringify(snapshot), { level: 9 })
  await fs.writeFile(outputPath, compressed, { mode: 0o600 })
  console.log(
    JSON.stringify({
      capturedAt: snapshot.capturedAt,
      outputPath,
      counts: Object.fromEntries(
        Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length]),
      ),
    }),
  )
} finally {
  await client.end()
}
