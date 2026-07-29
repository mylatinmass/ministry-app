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
  "templates",
  "events",
  "event_responsibilities",
  "responsibility_assignments",
  "managed_profiles",
  "managed_profile_membership_requests",
  "managed_profile_membership_request_recipients",
  "managed_profile_separations",
  "managed_profile_audit",
]

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  const snapshot = {
    format: "mylatinmass-ministry-json-v1",
    capturedAt: new Date().toISOString(),
    tables: {},
  }

  for (const table of tables) {
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
