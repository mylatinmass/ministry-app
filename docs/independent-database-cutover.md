# Independent Ministry database cutover

The Ministry application owns its identities. It must not share the parish
profile database or its credentials.

## Safety boundary

1. Create a dedicated CockroachDB database and a dedicated application role.
2. Grant that role privileges only within the Ministry database.
3. Do not grant the role privileges on the parish database or its `users`
   table.
4. Configure `MINISTRY_DATABASE_URL` with the dedicated role. The application
   intentionally ignores `COCKROACHDB_CONNECTION_STRING`.
5. Keep `MINISTRY_OUTBOUND_DELIVERY_ENABLED=false` throughout cutover.

The application refuses API requests when its role can see a `users` table or
when `ministry_accounts` has not been created.

## Build the isolated schema

From `app/`, with only the dedicated database configured:

```sh
npm run migrate
npm run verify:database-isolation
```

The migrations create `ministry_accounts` and make every Ministry foreign key
reference that table. Notification channels and categories default to off.

## Move approved Ministry data

Do not copy the parish account table. Copy only explicitly approved Ministry
accounts and Ministry-owned records. Account IDs may be preserved so existing
Ministry foreign keys continue to work, but each copied account must correspond
to a confirmed Ministry member, guardian of a confirmed managed member, or an
explicitly authorized Ministry administrator.

Before importing any account, produce and approve an allowlist containing its
ID and Ministry role. Then import in dependency order:

1. Approved accounts into `ministry_accounts`.
2. Ministries and membership records.
3. Managed-profile relationships and invitations.
4. Templates, events, responsibilities, and assignments.
5. Availability, messages, alerts, and other Ministry-owned operational data.

Never configure the deployed application with migration-source credentials.
Any one-time export process must use separate, short-lived credentials that are
removed after the allowlisted records are copied.

## Enable delivery

After authentication and membership checks pass in the isolated database:

1. Confirm the expected active-member and opted-in recipient counts.
2. Set `MINISTRY_MAX_NOTIFICATION_RECIPIENTS` to a reviewed ceiling.
3. Send a single-recipient delivery test.
4. Set `MINISTRY_OUTBOUND_DELIVERY_ENABLED=true` only after approval.

The scheduler aborts any due batch whose distinct recipient count exceeds the
configured ceiling.
