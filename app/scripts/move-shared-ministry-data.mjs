import pg from "pg"

const { Client } = pg
const sourceUrl = process.env.PARISH_MIGRATION_SOURCE_URL
const destinationUrl = process.env.MINISTRY_DATABASE_URL

if (!sourceUrl || !destinationUrl) {
  throw new Error(
    "PARISH_MIGRATION_SOURCE_URL and MINISTRY_DATABASE_URL are required",
  )
}

const quote = (value) => `"${value.replaceAll('"', '""')}"`
const sourceDatabase = new URL(sourceUrl).pathname.replace(/^\//, "")
const destinationDatabase = new URL(destinationUrl).pathname.replace(/^\//, "")
if (sourceDatabase !== "parishioners" || destinationDatabase !== "ministry") {
  throw new Error(
    `Refusing transfer from ${sourceDatabase} to ${destinationDatabase}; expected parishioners to ministry`,
  )
}

const client = new Client({
  connectionString: destinationUrl,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const qualified = (database, table) =>
  `${quote(database)}.${quote("public")}.${quote(table)}`

try {
  const sourceTables = new Set(
    (
      await client.query(
        `SELECT table_name FROM ${quote(sourceDatabase)}.information_schema.tables WHERE table_schema = 'public'`,
      )
    ).rows.map((row) => row.table_name),
  )
  const destinationTables = new Set(
    (
      await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      )
    ).rows.map((row) => row.table_name),
  )
  if (!sourceTables.has("users") || destinationTables.has("users")) {
    throw new Error("Source/destination account-table isolation check failed")
  }
  if (!destinationTables.has("ministry_accounts")) {
    throw new Error("Destination Ministry schema is missing ministry_accounts")
  }

  const transferTables = [...destinationTables]
    .filter(
      (table) =>
        table !== "ministry_schema_migrations" &&
        table !== "ministry_accounts" &&
        sourceTables.has(table),
    )
    .sort()

  const fkRows = (
    await client.query(`
      SELECT DISTINCT tc.table_name AS child_table,
        kcu.column_name AS child_column,
        ccu.table_name AS parent_table,
        ccu.column_name AS parent_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
       AND kcu.constraint_schema = tc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `)
  ).rows

  const remaining = new Set(transferTables)
  const orderedTables = []
  while (remaining.size) {
    const ready = [...remaining].filter((table) =>
      fkRows
        .filter(
          (fk) => fk.child_table === table && fk.parent_table !== table,
        )
        .every(
          (fk) =>
            fk.parent_table === "ministry_accounts" ||
            !remaining.has(fk.parent_table),
        ),
    )
    if (!ready.length) {
      throw new Error(
        `Unable to determine foreign-key copy order for: ${[...remaining].join(", ")}`,
      )
    }
    ready.sort()
    for (const table of ready) {
      remaining.delete(table)
      orderedTables.push(table)
    }
  }

  await client.query("BEGIN")
  try {
    const truncateTables = ["ministry_accounts", ...transferTables]
      .map(quote)
      .join(", ")
    await client.query(`TRUNCATE TABLE ${truncateTables} CASCADE`)

    const destinationAccountColumns = (
      await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ministry_accounts' ORDER BY ordinal_position`,
      )
    ).rows.map((row) => row.column_name)
    const sourceAccountColumns = new Set(
      (
        await client.query(
          `SELECT column_name FROM ${quote(sourceDatabase)}.information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'`,
        )
      ).rows.map((row) => row.column_name),
    )
    const accountColumns = destinationAccountColumns.filter((column) =>
      sourceAccountColumns.has(column),
    )
    const outboundPreferenceColumns = new Set([
      "notification_email_enabled",
      "notification_telegram_enabled",
      "notification_sms_enabled",
      "notification_push_enabled",
      "notification_reminders_enabled",
      "notification_schedule_changes_enabled",
      "notification_announcements_enabled",
      "notification_volunteer_opportunities_enabled",
    ])
    const accountSelect = accountColumns
      .map((column) =>
        outboundPreferenceColumns.has(column)
          ? `false AS ${quote(column)}`
          : `source_account.${quote(column)}`,
      )
      .join(", ")

    const approvedAccounts = `
      SELECT user_id AS id FROM ${qualified(sourceDatabase, "ministry_members")}
      UNION SELECT guardian_user_id FROM ${qualified(sourceDatabase, "managed_profiles")}
      UNION SELECT child_user_id FROM ${qualified(sourceDatabase, "managed_profiles")}
      UNION SELECT user_id FROM ${qualified(sourceDatabase, "responsibility_assignments")} WHERE user_id IS NOT NULL
      UNION SELECT assigned_by FROM ${qualified(sourceDatabase, "responsibility_assignments")} WHERE assigned_by IS NOT NULL
      UNION SELECT requested_by FROM ${qualified(sourceDatabase, "ministry_invitations")}
      UNION SELECT invited_user_id FROM ${qualified(sourceDatabase, "ministry_invitations")} WHERE invited_user_id IS NOT NULL
      UNION SELECT created_by FROM ${qualified(sourceDatabase, "ministries")}
      UNION SELECT created_by FROM ${qualified(sourceDatabase, "templates")}
      UNION SELECT created_by FROM ${qualified(sourceDatabase, "events")}
      UNION SELECT id FROM ${qualified(sourceDatabase, "users")} account
        WHERE global_role IN ('owner', 'super_admin')
          AND (username IS NOT NULL OR EXISTS (
            SELECT 1 FROM ${qualified(sourceDatabase, "ministry_members")} membership
            WHERE membership.user_id = account.id
          ))
    `
    await client.query(`
      INSERT INTO ${qualified(destinationDatabase, "ministry_accounts")}
        (${accountColumns.map(quote).join(", ")})
      SELECT ${accountSelect}
      FROM ${qualified(sourceDatabase, "users")} source_account
      WHERE source_account.id IN (${approvedAccounts})
    `)

    const copied = {}
    for (const table of orderedTables) {
      const destinationColumns = (
        await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [table],
        )
      ).rows.map((row) => row.column_name)
      const sourceColumns = new Set(
        (
          await client.query(
            `SELECT column_name FROM ${quote(sourceDatabase)}.information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
            [table],
          )
        ).rows.map((row) => row.column_name),
      )
      const columns = destinationColumns.filter((column) =>
        sourceColumns.has(column),
      )
      const conditions = fkRows
        .filter(
          (fk) => fk.child_table === table && fk.parent_table !== table,
        )
        .map(
          (fk) =>
            `(source_row.${quote(fk.child_column)} IS NULL OR EXISTS (` +
            `SELECT 1 FROM ${qualified(destinationDatabase, fk.parent_table)} parent_row ` +
            `WHERE parent_row.${quote(fk.parent_column)} = source_row.${quote(fk.child_column)}` +
            `))`,
        )
      const result = await client.query(`
        INSERT INTO ${qualified(destinationDatabase, table)}
          (${columns.map(quote).join(", ")})
        SELECT ${columns.map((column) => `source_row.${quote(column)}`).join(", ")}
        FROM ${qualified(sourceDatabase, table)} source_row
        ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      `)
      copied[table] = result.rowCount
    }

    await client.query("COMMIT")
    const accountCount = await client.query(
      `SELECT count(*)::INT AS count FROM ministry_accounts`,
    )
    console.log(
      JSON.stringify(
        {
          approvedAccounts: accountCount.rows[0].count,
          copied,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
} finally {
  await client.end()
}
