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

## Planned integrations

Potential integrations include the public website, Klaviyo, authenticated email, Telegram, the SSPX Ordo, a priory priest-assignment Google Sheet or CSV, personal calendar subscriptions, and later public calendar feeds. Integration boundaries and data-sharing rules must be approved before implementation.

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
