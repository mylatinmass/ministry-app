import pg from "pg"

const { Pool } = pg

declare global {
  // eslint-disable-next-line no-var
  var ministryDatabasePool: pg.Pool | undefined
}

export const getPool = () => {
  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  if (!connectionString) {
    throw new Error("COCKROACHDB_CONNECTION_STRING is not configured")
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
