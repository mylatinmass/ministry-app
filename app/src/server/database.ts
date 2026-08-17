import pg from "pg"

const { Pool } = pg

declare global {
  // eslint-disable-next-line no-var
  var ministryDatabasePool: pg.Pool | undefined
}

let isolationCheck: Promise<void> | undefined

export const getPool = () => {
  const connectionString = process.env.MINISTRY_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "MINISTRY_DATABASE_URL is not configured. The Ministry app will not fall back to the parish database.",
    )
  }

  if (!globalThis.ministryDatabasePool) {
    globalThis.ministryDatabasePool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }

  return globalThis.ministryDatabasePool
}

export const assertMinistryDatabaseIsolation = async () => {
  if (!isolationCheck) {
    isolationCheck = (async () => {
      const result = await getPool().query(
        `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ANY($1)
        `,
        [["ministry_accounts", "users"]],
      )
      const visibleTables = new Set(
        result.rows.map((row: { table_name: string }) => row.table_name),
      )
      if (visibleTables.has("users")) {
        throw new Error(
          "Database isolation check failed: the Ministry database role can see the parish users table.",
        )
      }
      if (!visibleTables.has("ministry_accounts")) {
        throw new Error(
          "Database isolation check failed: ministry_accounts is missing. Run Ministry migrations against the dedicated database.",
        )
      }
    })().catch((error) => {
      isolationCheck = undefined
      throw error
    })
  }
  return isolationCheck
}
