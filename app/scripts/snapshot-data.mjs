import fs from "node:fs/promises"
import path from "node:path"
import { gzipSync } from "node:zlib"
import pg from "pg"

const { Client } = pg
const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
const outputPath = process.env.MINISTRY_SNAPSHOT_PATH

if (!connectionString) {
  throw new Error("COCKROACHDB_CONNECTION_STRING is required")
}
if (!outputPath || !path.isAbsolute(outputPath)) {
  throw new Error("MINISTRY_SNAPSHOT_PATH must be an absolute path")
}

const tables = [
  "users",
  "ministries",
  "ministry_members",
  "ministry_levels",
  "templates",
  "template_ministries",
  "template_responsibilities",
  "template_versions",
  "events",
  "event_ministries",
  "event_responsibilities",
  "responsibility_assignments",
  "member_availability",
  "availability_blocks",
  "assignment_change_requests",
  "managed_profiles",
  "managed_profile_membership_requests",
  "managed_profile_membership_request_recipients",
  "managed_profile_separations",
  "managed_profile_audit",
  "ministry_audit_log",
  "push_subscriptions",
  "ministry_reminders",
  "ministry_reminder_deliveries",
  "ministry_messages",
  "ministry_message_recipients",
]

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  const existingTablesResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `)
  const existingTables = new Set(
    existingTablesResult.rows.map((row) => row.table_name),
  )
  const snapshot = {
    format: "mylatinmass-ministry-json-v1",
    capturedAt: new Date().toISOString(),
    tables: {},
  }

  for (const table of tables) {
    if (!existingTables.has(table)) continue
    const result = await client.query(`SELECT * FROM ${table}`)
    snapshot.tables[table] = result.rows
  }

  const compressed = gzipSync(JSON.stringify(snapshot))
  await fs.writeFile(outputPath, compressed, { mode: 0o600 })

  console.log(
    JSON.stringify({
      capturedAt: snapshot.capturedAt,
      outputPath,
      counts: Object.fromEntries(
        Object.entries(snapshot.tables).map(([table, rows]) => [
          table,
          rows.length,
        ]),
      ),
    }),
  )
} finally {
  await client.end()
}
