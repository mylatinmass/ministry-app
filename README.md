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
| MyLatinMass/public websites | Current schedule input and link boundary | Each Ministry App build reads the same public Mass Schedule and liturgical-days feeds used by MyLatinMass and idempotently creates or refreshes Mass events in CockroachDB. The liturgical-day name becomes the event name while Low Mass or High Mass remains the scheduling template. Only rows whose descriptions contain Mass are imported; Confession, Rosary, Holy Hour, Adoration, Benediction, and similar rows remain public schedule context and do not become Ministry App events. The public website still must not receive volunteer names, staffing details, private notes, eligibility, family data, or private events. | `MASS_SCHEDULE_URL`, `MASS_SCHEDULE_LITURGICAL_DAYS_URL`, location/time-zone settings, ministry slug mappings, `COCKROACHDB_CONNECTION_STRING`, and migration `20260806_04_add_mass_schedule_sync.sql`. |
| Klaviyo | Future preferred communications platform | Intended provider for permission-based email and SMS, including assignment messages, reminders, schedule changes, cancellations, volunteer opportunities, and chapel subscriptions. CockroachDB remains the operational source of truth; Klaviyo receives only the minimum approved profile, consent, subscription, and event data needed for delivery. | Klaviyo account ownership; private API key/credential; list and segment design; event schema; consent and unsubscribe mapping; sender/domain authentication; webhook handling; retry, deduplication, delivery-status, retention, and deletion rules. |
| SMTP/Nodemailer | Transitional, limited | Existing account invitation, one-time member sign-in, managed-profile review, authenticated Support contact, and grouped Ministry alert digests can send transactional email. Alert records remain attached to the affected profile while a managed child's digest is delivered to the parent/contact. Sign-in links are single-use, expire after 15 minutes, are unavailable to Owner/Super Admin accounts, and create restricted sessions that cannot change account or member access. The Support recipient list stays server-side and may contain the webmaster and other designated people; it falls back to `GMAIL_USER` until a dedicated list is configured. This should be replaced or deliberately retained when Klaviyo is integrated. | `GMAIL_USER`, `GMAIL_PASS`, comma-separated `SUPPORT_RECIPIENTS`, `SITE_URL`, `MINISTRY_LOGIN_LINK_TTL_MINUTES`, optional `MINISTRY_NOTIFICATION_DIGEST_MINUTES` (default 5), delivery-safety controls, and an approved migration plan to Klaviyo. |
| Browser push | Designed, not operationally accepted | The codebase contains a subscription and reminder-delivery foundation, but notifications are still considered Pending until production configuration, scheduling, consent, delivery testing, and stakeholder acceptance are complete. | VAPID keys, `VAPID_SUBJECT`, scheduler identity, delivery monitoring, retry policy, and user-facing consent. |
| Telegram | Implemented, pending operational acceptance | Linked contacts can receive the same grouped Ministry alert digest as email. Managed-child alerts are grouped by child name and delivered only to the parent/contact's linked Telegram account. Telegram is optional and is never the only way to view an alert. | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, account linking, scheduler invocation of `/api/reminders/process`, optional `MINISTRY_NOTIFICATION_DIGEST_MINUTES` (default 5), privacy review, monitoring, and acceptance testing. |
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

## Automatic Mass Schedule base calendar

`npm run build` runs the Mass Schedule synchronizer before Astro builds. When the
database connection is available, the synchronizer reads `MASS_SCHEDULE_URL`,
keeps only Mass rows, and stores them as published Ministry App events. The source
date and local time form a stable import key, so another build refreshes the same
event instead of creating a duplicate. If a source time changes and it is the only
unmatched Mass of that type on the date, the importer remaps the existing event.

The synchronizer creates and maintains two source-managed templates:

- **Low Mass:** Sacristans — Sacristan; Altar Servers — Acolyte 1 and Acolyte 2;
  Ushers — one required Usher.
- **High Mass:** Sacristans — Sacristan; Altar Servers — Acolyte 1, Acolyte 2,
  Master of Ceremonies, Thurifer, Boat Bearer, Cross Bearer, and Torchbearers
  1–4; Ushers — one required Usher.

Sacristan, server, and usher responsibilities therefore remain owned and visible
through their respective ministries even though they belong to the same Mass
event. Confession and Rosary entries are deliberately ignored; the following Mass
is the event. Authorized users may continue to create any other chapel event
manually.

Imported source values refresh only fields that still equal the last imported
value. If an administrator has changed an event title, time, or location, a later
build preserves that local override while retaining the newest source value for
comparison. Existing assignments are never deleted automatically. A source change
from Low to High Mass (or the reverse) replaces the generated responsibilities
only when none of those responsibilities has active assignments; otherwise the
change is reported for manual review.

Apply migrations before enabling the production build sync:

```sh
npm run migrate
npm run sync:mass-schedule
```

Builds continue with the last successfully imported schedule when the public feed
is temporarily unavailable. Set `MASS_SCHEDULE_SYNC_REQUIRED=true` only if a
deployment should fail instead. Running `npm run sync:mass-schedule` manually is
always strict and returns an error when the feed or database is unavailable.

## Ministry authentication and audit controls

- Username-and-password sessions retain the permissions assigned to the account.
- Active non-privileged members may request a single-use email sign-in link. The
  response is deliberately identical for eligible, unknown, duplicated, and
  privileged email addresses to prevent account discovery.
- Owner and Super Admin accounts can never request or redeem email sign-in links.
- Password-authenticated Owners and Super Admins have a global **Members** menu.
  It lists only active Ministry app members with an active ministry membership;
  unrelated website accounts are excluded. It shows each person's ministry
  memberships and permits audited ministry additions, removals, Leader or Member
  access changes, ministry-level assignments, and audited Super Admin access
  changes. The Global Owner and the signed-in administrator's own global access
  cannot be changed from this screen. New people are added through the existing
  private email invitation flow and may be promoted after accepting.
- Global administrators can suppress a Ministry member profile without deleting
  the shared account or any historical assignments, memberships, or audit data.
  Suppression is recorded in `ministry_profile_suppressions`, deactivates all
  Ministry memberships, removes global Ministry privileges, revokes outstanding
  Ministry login links, and hides the profile from active rosters. If the same
  email later accepts a new private invitation, the existing profile is
  reactivated for the invited ministries and its prior history remains attached.
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

## Current scheduling, attendance, and reporting controls

- Approved members receive a named internal ministry calendar. Current and
  upcoming schedules can be printed or exported as CSV without exposing the
  private calendar publicly.
- Signed-in profiles can open every published event and see its general details.
  Standalone public volunteer assignments, including the name covering each
  assignment, are visible to every signed-in profile. Ministry-specific
  assignments and assignee names are visible only when the active profile
  belongs to that responsibility's ministry. Contact details, consent choices,
  conflict indicators, and management controls remain visible only to an
  authorized manager. An Owner or Super Admin can see every ministry assignment
  only while their own global profile is active; switching to a managed child
  profile applies the child's memberships instead.
- Leaders receive a pre-publication review of required-position shortages,
  overlapping assignments, available backup candidates, event-only overrides,
  and pending change requests.
- Assignment and actual service outcome are preserved separately. An assignment
  takes effect immediately and does not require volunteer confirmation. After
  an event begins, an authorized leader can record Served, No-show,
  Substitute served, or Excused. Every change records the actor and before/after
  values in `ministry_audit_log`.
- Candidate selection shows historical reliability when enough recorded outcomes
  exist, including a separate comparison for the event's local start time. This
  is decision support for a leader, not an automatic ban after one incident.
- Members cannot accept or decline assignments. They can request a change. If
  an unavailable-date range overlaps an assignment, the app warns before
  continuing, records the unavailability, creates the change request, and
  alerts enabled ministry leaders.
- Assignment and change-request alerts are stored against the affected profile
  and delivered in short email/Telegram digests instead of one message per
  change. For a parent account, one digest groups totals and details separately
  for the parent and each managed child. Unread profile alerts appear in the
  Home workspace and as orange dots in the profile switcher; profiles without
  unread alerts use a gray dot.
- An availability block can apply to every ministry or only one selected ministry.
  Account-wide remains the default for backward compatibility.
- The Reports workspace provides six-month participation and workload history,
  time-of-day reliability patterns, upcoming coverage, ministry-level history,
  printing, and CSV export. Reports require leader-level access to the ministry.
- An event may be configured for Ministry members, public volunteers, or both.
  For a published volunteer event, an authorized leader chooses an available
  `/volunteer/<event-name>` URL, opens or closes that link, and may copy it for
  distribution. The public page exposes only the event description, time,
  location, available assignments, and remaining openings.
- A standalone volunteer event does not require a coordinating ministry or an
  event template. Every event that accepts public volunteers includes a public
  `General Volunteer` assignment for people whose exact task will be given by
  email or during the event. Its capacity defaults to unlimited, while the event
  creator may set a custom limit from 1 to 10,000 spots. Additional specific
  assignments are optional. An authorized leader chooses the public URL and
  opens signup. These records still
  live exclusively in the Ministry App's `events`, `event_responsibilities`, and
  `responsibility_assignments` tables; they do not use the public website's
  captain-signup tables or Netlify functions.
- A public volunteer supplies a name, email address, and telephone number for one
  event assignment. The signup creates or connects a normal user profile and the
  assignment uses `signup_source = 'public_link'`; it never creates a Ministry
  membership. A new volunteer receives a one-time password-only account
  invitation because their contact details were already collected. Their profile
  can manage reminder timing and assignments even when it has zero ministries.
  The same email cannot claim the same assignment twice. Optional email and SMS
  choices are stored with separate consent timestamps; collecting consent does
  not mean notification delivery is operational.
- Each user also has a separate randomized `public_profile_id`. An addressed
  volunteer-event email may append `?profile=<public_profile_id>` to its public
  event URL so the contact form is prefilled. The volunteer page is no-index,
  no-referrer, and no-store; this identifier is not an authentication credential
  and cannot authorize account changes. Every public form also offers the normal
  password or one-time-email-link sign-in path.
- Each independent account chooses one or more channels and categories in its
  profile: Email, Telegram, SMS, and browser Push; assignment reminders,
  schedule changes, announcements, and volunteer opportunities. The durable
  alert queue retries each enabled channel independently, records its latest
  provider result, expires invalid Push subscriptions, and can fall back from
  Gmail to a second SMTP provider. When an SMS-enabled account explicitly
  accepts the transactional-text disclosure, that dated consent is synchronized
  to Klaviyo as transactional-only consent. Due reminders and schedule alerts
  submit a deduplicated `Ministry Assignment Reminder Due` event whose
  `notification_text` property is used by the metric-triggered transactional SMS
  flow.
  Managed children inherit the guardian account's delivery channels while their
  assignments and history remain attached to the child's profile.
- Accepted members, registered volunteers, and independent profile updates are
  queued for durable Klaviyo profile synchronization. Klaviyo receives the
  independent account's name, email, normalized telephone, stable Ministry
  account identifier, and broad account type. Managed children are excluded
  until separation and continue to use their guardian's contact profile. Profile
  creation does not subscribe anyone to email or SMS. Transactional SMS is
  subscribed only after the account records explicit consent. Enable processing
  only after the Klaviyo private key has `events:write`, `profiles:write`, and
  `subscriptions:write` (and `lists:write`, required by Klaviyo's subscription
  endpoint) by setting
  `KLAVIYO_PROFILE_SYNC_ENABLED=true` in production.
- Reminder reconciliation creates durable, duplicate-safe stages for the
  confirmation midpoint, confirmation deadline, overdue confirmation, one week
  before the event, and the account's configurable event offset. Leaders can
  set an explicit confirmation deadline on an event; otherwise it is calculated
  from the publication date and event date.
- Optional fallback email delivery uses `MINISTRY_FALLBACK_SMTP_HOST`,
  `MINISTRY_FALLBACK_SMTP_PORT`, `MINISTRY_FALLBACK_SMTP_SECURE`,
  `MINISTRY_FALLBACK_SMTP_USER`, `MINISTRY_FALLBACK_SMTP_PASS`, and
  `MINISTRY_FALLBACK_SMTP_FROM`. Successful provider acceptance and failures
  are visible with each in-app alert.
- An enabled device can receive a production-only, rate-limited test Push from
  the profile screen. Test sends are audited, do not expose event information,
  and expire subscriptions rejected permanently by the browser push service.
- Members can connect Telegram from their profile through a 15-minute,
  single-use deep link to the configured bot. The webhook verifies Telegram's
  secret header, stores stable numeric Telegram/chat IDs rather than relying on
  changeable usernames, and lets the member disconnect. A Super Admin can inspect
  the existing webhook before activating or deliberately replacing it. Connected
  accounts receive selected scheduled reminders through Telegram; blocked chats
  are deactivated and delivery attempts are logged. New administrative
  assignments send an immediate informational notice through each enabled Email
  and Telegram channel with a link to the Ministry app. Assigned members may
  request a change from Availability; they do not confirm or decline duties.

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
