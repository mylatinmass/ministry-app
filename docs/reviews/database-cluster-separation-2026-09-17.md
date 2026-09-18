# Ministry and parishioners database separation — September 17–18, 2026

## Completed state

The applications use separate databases on the existing CockroachDB cluster with the existing shared SQL login, as requested. Ministry uses `ministry` and its `ministry_accounts` table. MyLatinMass uses `parishioners` and its `users` table; website administration authenticates against the separate parish `managers` table.

- Removed 62 legacy Ministry tables from parishioners, retaining 15 parish tables and two views.
- Removed 26 obsolete Ministry columns from parishioners.users, retaining 51 parish fields.
- Completed the user's separately approved parish record cleanup. Parish users contained 458 records after the final September 18 operation.
- The active Ministry database retains 68 tables. Full data and schema comparisons verified that the parish cleanup did not change Ministry data. Two accounts specifically identified for parish-only removal were explicitly confirmed still present in Ministry.
- No new cluster, SQL login, credential changes, or runtime deployment changes were needed. The database cleanup is already live.

## Isolation checks

The inspected Ministry server code connects through `MINISTRY_DATABASE_URL`, without a runtime fallback to the parish connection. All 171 inspected Ministry foreign keys reference `ministry.public`. The existing database-isolation guard rejects a database containing the parish `users` table instead of `ministry_accounts`.

During the September 17 review, the live Vercel deployment matched local application commit `9f3fab304584be5651d5c8c682348d0bea21ac49`. The production environment listed `MINISTRY_DATABASE_URL`; its secret value was not exposed. Public API authentication responses showed that the deployed isolation guard passed. The exact deployed connection string was not independently inspected.

Sharing infrastructure and the SQL login is intentional. Branding, email assets, and public schedule integrations may still reference MyLatinMass; this cleanup concerns independent database storage.

## Verification

September 17 application checks passed: `npm run verify`, `npm run check` (zero errors/warnings), nine availability tests, household calendar tests, Mass schedule tests, and direct Astro build. The npm prebuild was not run because it synchronizes live Mass events.

After schema cleanup, website insert/update queries using the actual parish field mapping passed in a rolled-back transaction. Public website pages, calendar, Ministry homepage, and expected unauthenticated API responses passed. Both parish views compile successfully.

Each approved data cleanup used fresh checksum-verified backups, exact record IDs, linked-record inspection, serializable transactions, and before/after comparisons. Historical signups attached to approved deleted records were backed up and removed through existing foreign keys; unrelated parish data and Ministry data were preserved.

These checks do not claim a complete authenticated walkthrough or message-delivery test. Such verification should use a normal user sign-in. An unrelated pending attendance-reset migration was left unapplied.

## Private recovery evidence

Logical exports, exact mutation scripts, record-level results, and review lists remain in the Git-ignored `backups/` directory with private permissions. They contain personal information and must not be published. Snapshot checksums were verified; restoration was not rehearsed against a live database.

The separate MyLatinMass repository contains the non-personal audit reports:

- `audits/2026-09-17-parishioners-ministry-cleanup.md`
- `audits/2026-09-17-users-column-cleanup.md`
- `audits/2026-09-18-parishioners-record-cleanup.md`
