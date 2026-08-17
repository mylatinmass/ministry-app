import pg from "pg"

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
  const result = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `,
    [["ministry_accounts", "users"]],
  )
  const visibleTables = new Set(result.rows.map((row) => row.table_name))
  if (visibleTables.has("users")) {
    throw new Error(
      "Isolation verification failed: the Ministry database role can see the parish users table.",
    )
  }
  if (!visibleTables.has("ministry_accounts")) {
    throw new Error(
      "Isolation verification failed: ministry_accounts is missing.",
    )
  }
  console.log(
    "Verified: the Ministry role can access ministry_accounts and cannot see the parish users table.",
  )
} finally {
  await client.end()
}
