import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import pg from "pg"

const { Client } = pg
const connectionString = process.env.MINISTRY_DATABASE_URL

if (!connectionString) {
  throw new Error("MINISTRY_DATABASE_URL is required")
}

const migrationsDirectory = path.resolve("migrations")
const availableFiles = (await fs.readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort()
const requestedFilename = process.argv[2] || ""
if (
  requestedFilename &&
  (!/^[0-9]{8}_[0-9]{2}_[a-z0-9_]+\.sql$/.test(requestedFilename) ||
    !availableFiles.includes(requestedFilename))
) {
  throw new Error(`Unknown migration: ${requestedFilename}`)
}
const files = requestedFilename ? [requestedFilename] : availableFiles

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  const isolationResult = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    ["users"],
  )
  if (isolationResult.rowCount) {
    throw new Error(
      "Migration refused: MINISTRY_DATABASE_URL exposes the parish users table. Use a dedicated Ministry database and role.",
    )
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS ministry_schema_migrations (
      filename STRING PRIMARY KEY,
      sha256 STRING NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  for (const filename of files) {
    const sql = await fs.readFile(path.join(migrationsDirectory, filename), "utf8")
    const sha256 = crypto.createHash("sha256").update(sql).digest("hex")
    const existing = await client.query(
      `SELECT sha256 FROM ministry_schema_migrations WHERE filename = $1`,
      [filename],
    )

    if (existing.rowCount) {
      if (existing.rows[0].sha256 !== sha256) {
        throw new Error(`Applied migration was modified: ${filename}`)
      }
      console.log(`already applied ${filename}`)
      continue
    }

    await client.query("BEGIN")
    try {
      await client.query(sql)
      await client.query(
        `INSERT INTO ministry_schema_migrations (filename, sha256) VALUES ($1, $2)`,
        [filename, sha256],
      )
      await client.query("COMMIT")
      console.log(`applied ${filename}`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  }
} finally {
  await client.end()
}
