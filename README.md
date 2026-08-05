# Chapel Scheduler

Chapel Scheduler is a proposed privacy-first web application for coordinating chapel services, ministry assignments, volunteer opportunities, notifications, and permission-based calendars at Our Lady of Victory Chapel.

The project is currently in design and stakeholder-validation. The browser proof of concept is disposable demonstration software, not a production scheduling system.

## Current materials

- [`docs/design/chapel-scheduler-architecture.md`](docs/design/chapel-scheduler-architecture.md) — consolidated product and architecture design
- [`docs/design/early-september-alpha-plan.md`](docs/design/early-september-alpha-plan.md) — proposed private sacristan-alpha milestones
- [`docs/design/webmaster-alpha-brief.md`](docs/design/webmaster-alpha-brief.md) — technical coordination request
- [`docs/design/stakeholder-and-webmaster-questions.md`](docs/design/stakeholder-and-webmaster-questions.md) — validation questions
- [`docs/project-documentation-framework.md`](docs/project-documentation-framework.md) — authoritative documentation process and structure
- [`docs/requirements-rationale-and-design-considerations.md`](docs/requirements-rationale-and-design-considerations.md) — operational rationale, assumptions, alternatives, dependencies, and technical-review questions behind the requirements
- [`docs/reviews/README.md`](docs/reviews/README.md) — lightweight Technical Steward review, requirements change-control, and GitHub collaboration process
- [`docs/specification/workflows/`](docs/specification/workflows/) — approved workflow specifications
- [`docs/presentations/chapel-scheduler-august-8-2026.pptx`](docs/presentations/chapel-scheduler-august-8-2026.pptx) — editable stakeholder presentation
- [`poc/`](poc/) — browser-only stakeholder demonstration
- [`alpha/`](alpha/) — database-backed functional alpha with public-source imports and working sacristan workflows

## Run the proof of concept

From the repository root:

```sh
python3 -m http.server 8080 --directory poc
```

Then open `http://localhost:8080`.

The POC uses fictional data and does not provide real authentication, notifications, Telegram, Klaviyo, scheduling, privacy enforcement, or persistent server storage.

## Run the functional alpha

```sh
python3 alpha/server.py --reset
```

Then open `http://127.0.0.1:8081`. The alpha uses a local SQLite database and enforces its demonstration permissions on the server. See [`alpha/README.md`](alpha/README.md) for the five-minute walkthrough and current boundaries.

## Standalone application and integration contract

Chapel Scheduler is a standalone application. Its user interface, authorization,
scheduling rules, and private operational data do not depend on the public chapel
website. It may be linked from, embedded behind, or connected to other approved
websites and services through documented interfaces without coupling those systems
to its internal database schema.

This section is the canonical integration inventory. Every integration change must
update this table, `app/.env.example`, and the relevant migration or interface
documentation in the same reviewed change. The table describes capabilities and
configuration names only; secrets and production data must never be committed.

| Integration | Status | Purpose and data boundary | Required configuration / interface |
| --- | --- | --- | --- |
| CockroachDB | Current | System of record for accounts, ministries, memberships, profiles, templates, events, responsibilities, assignments, availability, audit history, cached Ordo references, and future delivery records. Private operational data remains here and is accessed only through server-side application APIs. | `COCKROACHDB_CONNECTION_STRING`; reviewed SQL migrations in `app/migrations/`; least-privilege production credentials; backup and restore ownership still required. |
| Astro application API | Current | Stable boundary used by the standalone web client. Other websites must use an approved API or feed rather than read application tables directly. Private endpoints require Ministry authentication and return only role-authorized data. | Routes under `https://ministry.mylatinmass.com/api/`; request/response contract must be documented before third-party use. |
| Vercel | Current deployment target | Hosts the standalone Astro Ministry application at `ministry.mylatinmass.com`, including its API routes, static assets, PWA manifest, and Ministry-only service worker. The project is connected to `mylatinmass/ministry-app`; pushes to `main` create production deployments. A Netlify scheduled function triggers the private Vercel deploy hook daily at 04:50 UTC, ten minutes before the public site's 05:00 UTC rebuild. | Chapel-owned `ministry-app` Vercel project; production branch `main`; root directory `app`; subdomain DNS; environment variables; monitoring; rollback ownership; private `VERCEL_DEPLOY_HOOK_URL` stored only in Netlify environment variables. |
| 1962ordo.today | Current read-only reference | Supplies public liturgical reference data. The application normalizes and caches it; the source never receives ministry rosters, assignments, contact data, or private notes. | Outbound HTTPS; cache/refresh behavior in the Ordo service; source-failure monitoring and terms review remain required. |
| MyLatinMass/public websites | Current link boundary; future data integration | The Netlify-hosted public website redirects its legacy `/ministry` URLs to the standalone Vercel app and may later consume an explicitly public, privacy-filtered calendar feed. Public sites must not receive volunteer names, staffing details, private notes, eligibility, family data, or private events. | `ministry.mylatinmass.com` link/redirect contract now; approved public API/feed contract, origin policy, cache policy, webmaster coordination, and publication-permission rules before data sharing. |
| Klaviyo | Future preferred communications platform | Intended provider for permission-based email and SMS, including assignment messages, reminders, schedule changes, cancellations, volunteer opportunities, and chapel subscriptions. CockroachDB remains the operational source of truth; Klaviyo receives only the minimum approved profile, consent, subscription, and event data needed for delivery. | Klaviyo account ownership; private API key/credential; list and segment design; event schema; consent and unsubscribe mapping; sender/domain authentication; webhook handling; retry, deduplication, delivery-status, retention, and deletion rules. |
| SMTP/Nodemailer | Transitional, limited | Existing account invitation, one-time member sign-in, managed-profile review, and authenticated Support contact flows can send transactional email. Sign-in links are single-use, expire after 15 minutes, are unavailable to Owner/Super Admin accounts, and create restricted sessions that cannot change account or member access. The Support recipient list stays server-side and may contain the webmaster and other designated people; it falls back to `GMAIL_USER` until a dedicated list is configured. This is not the completed Ministry notification system and should be replaced or deliberately retained when Klaviyo is integrated. | `GMAIL_USER`, `GMAIL_PASS`, comma-separated `SUPPORT_RECIPIENTS`, `SITE_URL`, `MINISTRY_LOGIN_LINK_TTL_MINUTES`, delivery-safety controls, and an approved migration plan to Klaviyo. |
| Browser push | Designed, not operationally accepted | The codebase contains a subscription and reminder-delivery foundation, but notifications are still considered Pending until production configuration, scheduling, consent, delivery testing, and stakeholder acceptance are complete. | VAPID keys, `VAPID_SUBJECT`, scheduler identity, delivery monitoring, retry policy, and user-facing consent. |
| Telegram | Future optional channel | May provide direct volunteer interactions and privacy-safe opening summaries. It must never be the only participation method or expose sensitive records. | Chapel-owned bot, account-linking and authorization design, webhook secret, privacy review, delivery fallback, and acceptance testing. |
| Google Calendar / Apple Calendar | Future | May import approved future events and provide private revocable personal calendar subscriptions. External calendars must receive only the view authorized for that subscriber. | Import contract, duplicate/conflict rules, revocable feed tokens, visibility filtering, and transition/archive plan. |
| Priory priest-assignment Google Sheet or CSV | Future optional input | May provide celebrant assignments as helpful scheduling input. Missing or conflicting data must warn rather than cancel a service, and no private Ministry data is written back without separate approval. | Approved file ownership/access, column schema, validation, refresh cadence, source audit, and conflict handling. |
| fsspx.today | Future optional input | May provide public chapel service information if permission, reliability, and source terms are acceptable. Imported information is treated as untrusted input and must not overwrite approved local data silently. | Source/terms approval, adapter contract, caching, structural-change detection, validation, and manual correction path. |

### Integration maintenance rules

- CockroachDB is the authoritative operational datastore unless an approved
  architecture change says otherwise. Klaviyo and other delivery systems are
  downstream processors, not the authoritative assignment or consent record.
- External websites and services integrate through documented APIs, feeds, imports,
  webhooks, or delivery adapters. They do not query production tables directly.
- Each integration must name a chapel owner, technical backup, data sent, data
  received, authentication method, consent basis, retention/deletion behavior,
  retry/failure behavior, and manual fallback before production approval.
- Notification channels remain Pending until their complete delivery workflow is
  configured, tested, monitored, and accepted. Code or database scaffolding alone
  does not make a notification integration complete.
- Adding a provider requires an updated `.env.example` with blank placeholders,
  documented setup steps, and secrets stored only in the approved hosting secret
  manager.

## Ministry authentication and audit controls

- Username-and-password sessions retain the permissions assigned to the account.
- Active non-privileged members may request a single-use email sign-in link. The
  response is deliberately identical for eligible, unknown, duplicated, and
  privileged email addresses to prevent account discovery.
- Owner and Super Admin accounts can never request or redeem email sign-in links.
- An unregistered person may submit a public access request with their name,
  email, optional phone number, and optional message. The form deliberately does
  not ask for a chapel or ministry and does not create an account or membership.
  Only a password-authenticated Owner or Super Admin can review the neutral queue,
  assign the request to a ministry, and send the standard private invitation.
- Email-link sessions may use operational Ministry features, but changing account
  details, family profiles, membership approvals, invitations, roles, serving
  eligibility, or member access requires a fresh password-authenticated session.
- `ministry_audit_log` is the authoritative “who changed what” record. It stores
  the actor, active profile, action, entity, ministry, timestamp, before/after
  JSON where supplied, metadata, and now the authentication method. These records
  support investigation and a reviewed/manual reversal; they are not an automatic
  one-click undo mechanism.

## Privacy and repository rules

- This source repository may be public. Public source code is separate from private chapel and production data.
- Do not commit real volunteer rosters, minor information, APR records, private appointments, mailing lists, API keys, passwords, or production exports.
- Store production secrets only in an approved secret-management system.
- Use fictional or explicitly approved test data in development.
- Review documents, screenshots, sample files, and commit history before publication; remove personal information and internal details that are not intentionally public.
- Chapel-owned production accounts and source repositories must have at least two approved technical custodians.

See [`docs/repository-publication-policy.md`](docs/repository-publication-policy.md) for the required data boundary and publication checklist.

## Ownership and status

The design is intended for chapel ownership and continuity rather than dependence on one individual. Technology selection, hosting, operations, and production authorization remain subject to stakeholder and webmaster review.
