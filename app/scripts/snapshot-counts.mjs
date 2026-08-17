import pg from "pg"

const { Client } = pg
const connectionString = process.env.MINISTRY_DATABASE_URL

if (!connectionString) {
  throw new Error("MINISTRY_DATABASE_URL is required")
}

const tables = [
  "ministry_accounts",
  "ministries",
  "ministry_members",
  "templates",
  "events",
  "event_responsibilities",
  "responsibility_assignments",
  "member_availability",
  "availability_blocks",
  "assignment_change_requests",
  "managed_profiles",
  "managed_profile_audit",
  "push_subscriptions",
  "ministry_reminders",
  "ministry_reminder_deliveries",
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
  const counts = {}
  for (const table of tables) {
    if (!existingTables.has(table)) continue
    const result = await client.query(`SELECT count(*)::INT AS count FROM ${table}`)
    counts[table] = result.rows[0].count
  }
  console.log(JSON.stringify({ capturedAt: new Date().toISOString(), counts }, null, 2))
} finally {
  await client.end()
}
