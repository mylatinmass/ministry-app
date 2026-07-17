# OLV Operations Platform — Requirements Rationale and Design Considerations

Status: Living project document  
Initial compilation: July 17, 2026  
Scope reviewed: architecture, documentation principles, approved workflow specifications, pilot plans, integration questions, repository policy, and demonstrated alpha/POC boundaries

## 1. Purpose

This document explains why the OLV Operations Platform requirements exist. It is intended to let developers, technical reviewers, subject-matter experts, clergy, and stakeholders understand and challenge the reasoning behind the requirements without needing the raw conversations that produced them.

This is not a substitute for the workflow specifications. The workflow documents define expected behavior and acceptance criteria. This document records the operational problems, assumptions, alternatives, dependencies, uncertainties, and technical questions behind those expectations.

The document deliberately distinguishes:

- **Underlying operational need** — the outcome the chapel must achieve. This should be preserved unless chapel operations change.
- **Proposed functional requirement** — the current product behavior proposed to meet that need. It may be revised if a better approach preserves the need.
- **Proposed technical solution** — an implementation idea or architectural direction. It is not binding until technical review and an architecture decision approve it.

Where the available material does not establish a rationale, this document says so rather than inventing one. It excludes private commentary about individual collaborators, interpersonal dynamics, and personal evaluations of another person's ideas or working style.

## 2. Governing principles

### 2.1 Human-Centered Ministry Principle

The platform supports chapel ministries rather than replacing them. Automation should remove repetitive administration, reduce missed communication, and surface problems while preserving meaningful human judgment, responsibility, and volunteer participation.

### 2.2 Privacy first

The platform should disclose only what each actor needs. Convenience does not justify exposing volunteer schedules, family information, minors' information, APR status, priest appointments, pastoral details, or private operational notes.

### 2.3 Operations before screens

Requirements model real chapel work: requests, decisions, preparation, staffing, resources, communication, exceptions, and accountability. Screen layouts and conversational interfaces are replaceable presentations of those operations.

### 2.4 Authentic terminology and clerical authority

The product should use authentic liturgical terminology. It may import, organize, recommend, warn, and explain, but it must not present software as the final authority on rubrics or replace Father's judgment.

### 2.5 Desired behavior before component reuse

Existing components, connectors, and data sources may accelerate implementation. They do not redefine the operational need merely because they are already available.

### 2.6 Progressive disclosure

Detailed rules belong in the model; each user should see only the next information or decision relevant to that person's role. Thorough design is intended to produce a simpler experience, not a longer form.

## 3. Status and maintenance convention

Each rationale record has a status:

- **Approved** — accepted by the Product Owner for stakeholder review or implementation planning.
- **In development** — currently being interviewed or drafted; do not treat as complete.
- **Provisional** — a working rule that needs confirmation from a stakeholder, subject-matter expert, counsel, or technical review.
- **Future** — preserve architectural compatibility, but do not assume inclusion in the first release.

Update this document whenever a significant requirement, assumption, rationale, or design decision changes. An update should identify the affected rationale record, workflow, acceptance criteria, dependencies, and effective date. If a functional or technical solution changes, retain the underlying operational need and record why the new approach meets it better.

## 4. Rationale records

### R-001 — One authoritative chapel operations calendar

**Status:** Approved direction; migration and integration details remain provisional.

**Underlying operational need:** The chapel currently maintains related information in several calendars, scheduling tools, spreadsheets, public listings, and messages. Changes can be entered in one place but not reach other ministries or public schedules, causing duplicate work and people being blindsided.

**Proposed functional requirement:** Maintain one authoritative operational calendar from which public services, ministry schedules, restricted operations, priest availability, printed schedules, notifications, and future external feeds derive according to permissions.

**Proposed technical solution:** A shared event and case model with permission-controlled calendar projections and read-only output feeds. This is an architectural direction, not a final stack decision.

**Reasoning:** A shared source of truth reduces contradictory dates, repeated entry, and assumptions that another person has relayed a change. It also lets staffing and preparation requirements respond to a service change rather than being maintained separately.

**Important assumptions:** The chapel is willing to make this platform authoritative after a controlled pilot and comparison period. Not every external system can immediately consume a feed.

**Alternatives considered:** Continue separate calendars with manual reconciliation; treat Google Calendar as permanent authority; use a master spreadsheet. These may work as migration aids but do not adequately support permissions, conditional workflows, assignments, qualifications, and audit history.

**Edge cases:** Imported events conflict with locally corrected events; a private appointment blocks a public service without exposing its details; an external source removes or changes a previously published event; a cancelled service must remain in history.

**Unresolved questions:** Final migration sequence; website integration; whether external public listings accept an API or only manual updates; final ownership of calendar operations.

**Dependencies:** R-002, R-005, R-006, R-007, R-008, R-017, R-021, R-024.

**Technical feasibility review:** Conflict handling, event identity across imports, recurrence migration, read-only feeds, offline/emergency availability, and safe rollback.

**Implementation constraints:** Existing Google calendars and a priory-maintained Sheet may remain authoritative during transition. Two-way synchronization is explicitly not an initial goal.

**Stakeholder or priest review:** Authority boundaries, migration acceptance, private-calendar delegation, and final transition from legacy calendars.

### R-002 — Privacy-tiered views and field-level disclosure

**Status:** Approved principle; formal privacy policy requires review.

**Underlying operational need:** Public visitors need service times, volunteers need assignments, leaders need staffing details, and authorized staff may need restricted family or priest information. These audiences must not receive the same view.

**Proposed functional requirement:** Separate Public, Signed-in, Relevant Ministry, Leader/Administrator, and Private Priest/Delegate visibility. Store public titles separately from restricted titles, notes, contacts, and reasons. Unauthorized users should not be able to infer the existence of a restricted appointment when even its existence is private.

**Proposed technical solution:** Enforce role- and field-level authorization on the server and generate separate safe projections for pages, feeds, exports, printouts, and notifications.

**Reasoning:** Calendar convenience otherwise creates unnecessary exposure of volunteer names, openings, minors, ceremony contacts, private appointments, and pastoral information. Field-level separation permits useful operational sharing without copying sensitive details into broadly visible descriptions.

**Important assumptions:** Roles can be assigned accurately and reviewed. Ministry leaders need operational facts but generally not family contact information or APR details.

**Alternatives considered:** One calendar with hidden notes; separate applications for every privacy tier; public volunteer names for transparency. The current proposal favors one model with controlled projections because hidden notes alone do not prevent title or event-existence leakage, while separate applications create synchronization problems.

**Edge cases:** Public permission is withdrawn after publication; a private event conflicts with a public event; a ministry member belongs to several ministries; screenshots, exports, printouts, personal feeds, and notification text can leak protected details.

**Unresolved questions:** Final privacy notice, detailed role matrix, sensitive export policy, and legal/policy review for minors and APR workflows.

**Dependencies:** R-001, R-004, R-012, R-015, R-017, R-019, R-020.

**Technical feasibility review:** Field-level authorization, server-side enforcement, cache isolation, audit without duplicating confidential text, export controls, and tests proving non-disclosure.

**Implementation constraints:** Telegram and email are external channels with their own retention and forwarding behavior; sensitive records must not be placed in Telegram.

**Stakeholder or priest review:** Private priest calendar boundaries, public ceremony permissions, formal privacy/minors/APR policies.

### R-003 — Phone-first, low-friction participation

**Status:** Approved.

**Underlying operational need:** Adoption of the current scheduler is weak because volunteers find it cumbersome. Most routine interactions occur on phones and through messaging, while some configuration work is easier on a laptop.

**Proposed functional requirement:** Provide a responsive web experience and concise conversational interactions. Ordinary accounts use expiring email sign-in links rather than permanent passwords. Routine actions should be one-tap where safe, with natural-language input for absences and selected scheduling tasks followed by an explicit interpretation check.

**Proposed technical solution:** A responsive web application or PWA backed by a secure API, with passwordless email authentication and replaceable messaging-channel adapters.

**Reasoning:** Scheduling automation depends on current preferences, absences, confirmations, and volunteer claims. Reducing the effort of those actions is an operational requirement, not merely a visual preference.

**Important assumptions:** Volunteers have access to email; Telegram is common but should not be mandatory for the platform as a whole; privileged actions warrant more friction than routine volunteer actions.

**Alternatives considered:** Native mobile applications; password-based accounts; Telegram-only participation; SMS through a personal phone. Native apps increase initial scope, passwords create recovery burdens, Telegram-only access is unsuitable for all users and minors, and personal-phone SMS is not a safe or maintainable automation method.

**Edge cases:** Technology-resistant volunteers; delayed Telegram responses; ambiguous natural language; lost email access; a guardian acting for a child; a user who prefers a laptop.

**Unresolved questions:** Final identity provider, exact privileged-user second factor, Spanish localization approach, accessibility review, and which conversational channel ships in each phase.

**Dependencies:** R-004, R-010, R-011, R-012, R-013, R-018.

**Technical feasibility review:** Passwordless authentication, secure Telegram linking, response latency, idempotent button handling, natural-language date parsing, and channel-independent workflow state.

**Implementation constraints:** Email-domain authentication requires DNS support. SMS requires a dedicated number, consent, carrier registration, opt-out, and ongoing cost.

**Stakeholder or priest review:** None for the general principle; guardian controls and production communication policy require review.

### R-004 — Separate account, notification, volunteering, ministry, and chapel membership

**Status:** Approved direction; external membership integration is unresolved.

**Underlying operational need:** A person may only want public schedule notifications, may express interest in helping, may belong to a ministry, or may seek formal chapel membership. These are not the same commitment or approval.

**Proposed functional requirement:** Permit a lightweight notification account with verified email only. Request a name when the person volunteers or joins a ministry. Treat interest, one-time approval, ongoing ministry membership, and formal chapel membership as distinct states.

**Proposed technical solution:** Model identity, notification subscriptions, volunteer profile, ministry approval, and chapel membership as separate linked records rather than one account-status flag.

**Reasoning:** Requiring a full volunteer or membership profile just to receive Mass changes creates friction and unnecessary data collection. Conversely, a notification signup must not silently make someone an approved volunteer.

**Important assumptions:** A separate chapel membership process may already exist or be planned. Ministry leaders retain approval authority.

**Alternatives considered:** One universal registration form; importing all existing members from a spreadsheet; requiring Telegram. The selected direction favors self-registration and progressive data collection to improve engagement and data accuracy.

**Edge cases:** A public subscriber later volunteers; an unapproved person expresses interest in a restricted role; a one-time volunteer later joins a ministry; duplicate accounts.

**Unresolved questions:** Existing membership process, account linking, identity deduplication, and which volunteer opportunities are visible before authentication.

**Dependencies:** R-002, R-003, R-019, R-025.

**Technical feasibility review:** Identity merging, consent records, external links or single sign-on, and lifecycle transitions.

**Implementation constraints:** Avoid duplicating capabilities already maintained on mylatinmass.com until coordination is complete.

**Stakeholder or priest review:** Formal membership ownership and ministry approval rules.

### R-005 — Separate liturgical-reference and operational-scheduling horizons

**Status:** Approved.

**Underlying operational need:** Members may want to look far ahead for feast dates, while operational staffing too far in advance becomes unreliable and burdensome.

**Proposed functional requirement:** Show liturgical reference information as far ahead as reliable Ordo data exists. Generate actual chapel services, resource reservations, and staffing only within a rolling two-month operational horizon.

**Proposed technical solution:** Maintain a cached reference-calendar layer separately from generated operational events, with independent horizon and publication rules.

**Reasoning:** A long reference horizon serves planning and education without implying that distant operational details or volunteer assignments are final.

**Important assumptions:** The external source publishes future data and may revise it. The chapel can define local recurring rules separately.

**Alternatives considered:** Limit all calendar visibility to two months; generate operational schedules for the full liturgical year. The former unnecessarily hides useful feast information; the latter creates false precision and excessive change management.

**Edge cases:** Ordo correction after publication; source data unavailable; local observance differs from the source; future year not yet published.

**Unresolved questions:** Supported source horizon and terms of use.

**Dependencies:** R-001, R-006, R-009, R-021.

**Technical feasibility review:** Caching, source versioning, distinction between reference dates and operational events, and safe regeneration.

**Implementation constraints:** No supported 1962ordo.today API was identified during discovery.

**Stakeholder or priest review:** Public liturgical fields and local rule inventory.

### R-006 — Ordo-derived calendar with local rules and human liturgical judgment

**Status:** Approved principle; many individual rules are provisional pending clerical or SME validation.

**Underlying operational need:** The chapel follows the SSPX calendar and local customs not represented adequately by MSP's general calendar. Sacristans, servers, and schola need timely, accurate preparation information.

**Proposed functional requirement:** Prefer 1962ordo.today data, retain it defensively, layer effective-dated OLV rules and ceremony templates, flag ambiguity, and require Father or an authorized delegate for controlling liturgical decisions. Published events are not silently rewritten by source changes.

**Proposed technical solution:** A replaceable Ordo importer plus versioned local-rule engine, preview/diff process, source provenance, and human-review queue.

**Reasoning:** The Ordo is operationally more useful than a generic calendar, but external data and automated rubrical interpretation can be incomplete. The platform should prevent surprises while respecting clerical authority.

**Important assumptions:** The source may be used or permission can be obtained; chapel rules can be documented over time; a human can resolve flagged uncertainty.

**Alternatives considered:** General 1960 calendar only; fully manual entry; software-enforced rubrics. The proposal uses imported reference plus local review because the alternatives are respectively incomplete, labor-intensive, or overstep the intended role of the system.

**Edge cases:** SSPX proper rank conflicts with imported rank; External Solemnity eligibility; feast precedence; priest-dependent blessings; source structure changes; late Requiem selection.

**Unresolved questions:** Source permission/API; final validation of External Solemnities, Foundation Mass precedence, annual blessings, Holy Week staffing, and additional SSPX first-class feasts.

**Dependencies:** R-005, R-007, R-008, R-015, R-017, R-021.

**Technical feasibility review:** Replaceable importer, structural-change detection, source attribution, local-rule engine, decision audit, and preview of affected services.

**Implementation constraints:** Existing source connectors may be reusable but must be evaluated for reliability, terms, field coverage, and maintainability.

**Stakeholder or priest review:** All ambiguous rubrical behavior and any automatic annual template before activation.

### R-007 — Durable distinction among cases, events, duties, tasks, and assignments

**Status:** Approved domain direction.

**Underlying operational need:** A funeral, wedding, baptism, major feast, or Confirmation can include several rites, facilities, contacts, tasks, and ministries. Treating everything as either one calendar entry or many unrelated entries loses context.

**Proposed functional requirement:** Model an Operational Case separately from its Liturgical Events, ordinary Calendar Events, Duties, Staffing Needs, Opportunities, Shifts, Tasks, and Assignments. Link them without collapsing their owners, permissions, or statuses.

**Proposed technical solution:** A relational domain model using explicit links and independent state machines rather than one overloaded calendar-event record.

**Reasoning:** The model must express both shared context and independent execution. For example, a Funeral case may contain a viewing, Rosary, Requiem Mass, and burial; a simple Requiem selection on a scheduled ferial Mass is not a Funeral case.

**Important assumptions:** Users should not be forced to understand the entire domain model; progressive disclosure can present a simple workflow.

**Alternatives considered:** One generic event record; a separate application per ministry; duplicating a case into each ministry calendar. Those approaches make linked changes, privacy, and readiness difficult to manage.

**Edge cases:** One combined assignment spans Exposition, Mass, and Benediction; linked Good Friday events have different volunteers; a reception shares a case but has separate publication permission; one task is not tied to a service.

**Unresolved questions:** Final domain terminology for several traditional rites and the appropriate case boundaries for future events.

**Dependencies:** R-001, R-008, R-015, R-016, R-025.

**Technical feasibility review:** Aggregate status, linked-event propagation, independent permissions, cancellation behavior, and avoiding duplicate notifications.

**Implementation constraints:** Existing simple calendar components may not natively support case-level coordination.

**Stakeholder or priest review:** Authentic rite names and SME validation for each cross-functional workflow.

### R-008 — Services generate ministry needs; volunteering is normally for the service

**Status:** Approved.

**Underlying operational need:** The master service calendar should drive sacristan, server, usher, schola, and other operational needs. Volunteers often know that they can attend a Mass but should not need to select a specialized position.

**Proposed functional requirement:** Generate ministry duties and headcounts from service templates. Volunteers normally claim or confirm a service. The scheduler allocates positions based on qualifications, backup levels, fairness, and rotation; authorized leaders may override positions without requiring service reconfirmation.

**Proposed technical solution:** Versioned staffing templates and a constraint-aware assignment engine that separates service commitment from position allocation.

**Reasoning:** This reduces volunteer friction and prevents repeated self-selection of preferred positions while preserving qualified staffing and leader judgment.

**Important assumptions:** Ministry leaders define qualifications and templates. Some ministries may have no meaningful position allocation.

**Alternatives considered:** Have volunteers claim exact positions as in MSP; assign positions permanently; require confirmation after every position change. These were rejected as unnecessarily rigid or burdensome for the stated use cases.

**Edge cases:** Backup qualification used due to shortage; invitation-only roles; optional positions; position changes after service confirmation; combined ceremonies.

**Unresolved questions:** Complete ministry templates and qualification matrices, especially Holy Week, schola, and special ceremonies.

**Dependencies:** R-006, R-007, R-009, R-010, R-011, R-015.

**Technical feasibility review:** Template versioning, qualification constraints, fair position rotation, compatible assignment preservation, and leader override audit.

**Implementation constraints:** Existing components centered on position-first signup may need adaptation rather than direct reuse.

**Stakeholder or priest review:** Ministry leaders validate each template; Father validates exceptions affecting ceremony form.

### R-009 — Rolling open-volunteer and commitment windows

**Status:** Approved direction; exact job timing should be reconciled across documents.

**Underlying operational need:** Month-end schedule creation creates a recurring administrative rush. Volunteers may not be able to confirm two months ahead, but families benefit from seeing future services and volunteering early.

**Proposed functional requirement:** Maintain two calendar months operationally. The nearer period becomes the commitment/auto-assignment window, while the later period remains open for volunteering. The first calendar month should be fully assigned and confirmed two weeks before month-end; publication may occur with private warnings if gaps or approvals remain.

**Proposed technical solution:** Scheduled background processing advances windows, proposes assignments, evaluates readiness, and records publication state. Exact cadence is not selected until the documented inconsistency is resolved.

**Reasoning:** The model combines predictable lead time, early self-selection, and ongoing automation without demanding distant commitments.

**Important assumptions:** Calendar-month deadlines are easier for ministry operations than purely rolling dates, even though the calendar generation itself advances continuously.

**Alternatives considered:** Two fully assigned months; one schedule built at month-end; eight-week rolling windows. Earlier drafts contain rolling four-week language, while the later approved workflow uses calendar-month publication controls. These must be reconciled before implementation.

**Edge cases:** New service added after publication; incomplete ministry schedule; leader approval overdue; a month with unusual Holy Week or special ceremonies.

**Unresolved questions:** Exact boundary between calendar-month publication and rolling weekly assignment generation; cut-off dates; daylight-saving/timezone job behavior.

**Dependencies:** R-005, R-008, R-010, R-011, R-018.

**Technical feasibility review:** Deterministic scheduling jobs, idempotency, publication snapshots versus live schedules, and deadline calculations.

**Implementation constraints:** Current documentation contains both Monday-based four-week windows and calendar-month readiness rules; this is a documented inconsistency, not a resolved rationale.

**Stakeholder or priest review:** Ministry leaders should validate the operational cadence.

### R-010 — Preference-aware, scarcity-aware, and fair automatic scheduling

**Status:** Approved workflow.

**Underlying operational need:** Some Masses, especially 5:00 p.m., are chronically understaffed. Some people cannot serve them, some can occasionally, and some are very flexible but should not be overused. Volunteers may serve in several ministries or coordinate with family members.

**Proposed functional requirement:** Capture service-time preferences as Prefer, Can help sometimes, Available if necessary, Cannot serve, and Not specified; allow optional frequency and workload limits; consider absences, qualifications, family constraints, special-service willingness, ministry ranking, prior workload, and scarcity. Hard restrictions are never exceeded without an authorized, volunteer-confirmed exception. Cross-ministry recommendations are coordinated before separate ministry schedules are approved.

**Proposed technical solution:** A deterministic constraint-and-scoring engine with configurable weights, hard-rule validation, auditable explanations, and leader override controls.

**Reasoning:** A simple equal-rotation algorithm would either leave difficult services unfilled or repeatedly burden flexible people. Explicit constraints reduce assignments that volunteers immediately decline and reduce substitute work.

**Important assumptions:** Volunteers or authorized leaders will provide reasonably current preferences. Preferences are aids, not entitlements, except for hard availability and safety/guardian constraints.

**Alternatives considered:** Pure rotation; permanent assignments; ministry-first scheduling with no cross-ministry view; let volunteers fill every opening. The selected direction combines volunteering with controlled auto-assignment because current staffing levels cannot rely on self-selection alone.

**Edge cases:** Not specified preference; double duty at the same Mass; two Masses in one day; compatible versus incompatible ministries; family transportation; rare special ceremony; low-technology volunteer whose leader records preferences.

**Unresolved questions:** Exact scoring weights, fairness period, explanation detail, and dispute resolution among non-liturgical ministries.

**Dependencies:** R-008, R-009, R-011, R-012, R-019.

**Technical feasibility review:** Constraint solver or deterministic scoring, explainability, reproducibility, audit, configuration, and performance.

**Implementation constraints:** The required outcome should not be simplified merely to fit an existing scheduler. A simpler algorithm is acceptable only if acceptance testing shows it preserves the operational rules.

**Stakeholder or priest review:** Ministry leaders validate preference meanings, limits, and scarcity priorities.

### R-011 — Consolidated confirmation and decline of new assignments

**Status:** In development; decisions below are accepted so far but the workflow interview is not complete.

**Underlying operational need:** Auto-assignment is necessary, but volunteers should not be silently committed to services they cannot perform. At the same time, non-response should not automatically create an opening or reward disengagement.

**Proposed functional requirement:** Send one consolidated message containing all visible pending assignments across the person's ministries. Permit individual confirmation, Confirm All, and Confirm all non-conflicting assignments. A decline requires no reason, immediately returns the unconfirmed position to the schedule, creates a hard service-specific no-auto-assignment rule, and does not require a substitute. The volunteer may later reclaim the still-open service voluntarily. Provide seven days to respond, with a midpoint and deadline reminder. Non-response leaves the assignment reserved, marks it Confirmation overdue, and alerts the leader.

**Proposed technical solution:** A channel-independent confirmation batch with atomic per-assignment actions, conflict evaluation, reminder jobs, and a web fallback for large batches.

**Reasoning:** One message is easier than ministry-by-ministry prompts and prevents hidden assignments from being confirmed accidentally. Silence is not reliable consent, but automatically releasing silent assignments can worsen shortages and undermine adoption.

**Important assumptions:** The system clearly lists every assignment affected by a bulk action. Leaders or designated schedulers may record Confirmed by conversation as a light-touch accommodation.

**Alternatives considered:** Treat silence as confirmation; automatically reopen at deadline; require a decline reason; confirm separately by ministry. Each creates either consent, staffing, friction, or visibility problems.

**Edge cases:** A leader-recorded confirmation is disputed; assignments overlap; multiple Masses occur on the same day; a family contact manages several people; confirmation occurs near the normal one-week service reminder. Confirm All is disabled for conflicts, while non-conflicting assignments remain bulk-confirmable. Same-day multiple Masses are a blocking burden unless the volunteer explicitly allowed them; permitted combinations still receive a neutral notice.

**Unresolved questions:** The next unanswered workflow question is whether a minor with guardian-approved independent access and the Family Scheduling Contact may both confirm, with the first valid response taking effect. Remaining exception, permission, notification, and acceptance-criteria review is also incomplete.

**Dependencies:** R-003, R-008, R-009, R-010, R-012, R-013, R-018.

**Technical feasibility review:** Atomic bulk actions, conflict detection, idempotency, channel synchronization, deadline/reminder jobs, audit of confirmation by conversation, and dispute state.

**Implementation constraints:** Confirmation messages must not exceed channel button or message limits; a web fallback may be needed for large families or many assignments.

**Stakeholder or priest review:** Ministry leaders should validate overdue handling and leader-recorded confirmation.

### R-012 — Household coordination, guardians, and minors

**Status:** Approved direction; policy review required before minors launch.

**Underlying operational need:** Families may coordinate transportation and attendance across several ministries. Minors require guardian visibility and controls without forcing them to have phones or Telegram accounts.

**Proposed functional requirement:** Keep individual person records linked by a household. A family may designate a Family Scheduling Contact. Family scheduling can request that members be assigned together, with hard transportation constraints distinguished from soft preferences. Under 13 is parent-managed; ages 13–17 may receive direct access only after explicit guardian attestation and selected permissions. Birth year, not full birth date, is stored.

**Proposed technical solution:** Individual accounts and profiles linked through a household/delegation model with granular guardian permissions and an audit trail.

**Reasoning:** Family coordination prevents siblings or parents and children from being unnecessarily split across Masses. Birth-year-only data minimizes privacy risk while still supporting minor status review, though it cannot establish the exact birthday.

**Important assumptions:** Guardians can reliably attest age and relationships. The platform is scheduling software, not the authoritative sacramental or catechism record.

**Alternatives considered:** Full birth dates; month/year; separate family accounts with no individual records; mandatory Telegram for older minors; guardian approval of every assignment. The selected design minimizes data and routine burden while preserving oversight.

**Edge cases:** Minor ages out; two guardians; a primary guardian adds another contact; family members disagree; an adult consents to family management and later revokes it; a family-together request cannot be satisfied.

**Unresolved questions:** Exact aging transition with year-only data, consent language, direct-access confirmation behavior, and formal policy review.

**Dependencies:** R-002, R-003, R-010, R-011, R-018, R-020.

**Technical feasibility review:** Delegated authority, revocation, race conditions between minor and guardian actions, household privacy, and age-transition reminders.

**Implementation constraints:** Telegram minimum-age and platform-safety considerations must be respected; guardian-approved direct access remains optional.

**Stakeholder or priest review:** Formal minors policy, guardian consent, and APR/privacy review.

### R-013 — Substitution as a managed transfer, not silent abandonment

**Status:** Approved direction; a standalone workflow remains to be finalized.

**Underlying operational need:** Volunteers sometimes cannot fulfill confirmed assignments. Today they may contact the leader through several channels, placing the leader in the middle and risking an untracked gap.

**Proposed functional requirement:** A confirmed volunteer requests a substitute and remains assigned until a qualified substitute accepts or an authorized leader resolves it. The system can display qualified candidates, track outreach, escalate inside 48 hours, and allow cancellation of the request if the original volunteer can serve after all.

**Proposed technical solution:** A substitution-request state machine with qualification filtering and an atomic assignment-transfer operation.

**Reasoning:** A confirmed commitment is different from declining an unconfirmed proposal. Keeping responsibility visible prevents an assignment from disappearing while making it easier for volunteers to solve the problem themselves.

**Important assumptions:** Qualification data is current; direct outreach respects privacy; leaders can intervene when self-service fails.

**Alternatives considered:** Immediate release to open schedule; leader handles every request; broadcast all personal details to a group. These create gaps, bottlenecks, or privacy problems.

**Edge cases:** Substitute accepts while original cancels the request; multiple candidates respond; service changes; no qualified substitute; minor assignment; urgent request.

**Unresolved questions:** Candidate ordering, whether volunteers select candidates or send a qualified pool request, escalation cadence, and final responsibility at service time.

**Dependencies:** R-008, R-011, R-012, R-018, R-020.

**Technical feasibility review:** Atomic transfer, concurrent acceptance, privacy-safe candidate display, delivery/acknowledgment, and audit.

**Implementation constraints:** Telegram group discussion may support collaboration, but personal schedules and requests should use direct bot or web interactions.

**Stakeholder or priest review:** Ministry-specific substitute practices.

### R-014 — Live schedule with controlled publication and warnings

**Status:** Approved workflow.

**Underlying operational need:** Members need the latest schedule, while leaders need a review and accountability step. Requiring full republication after every change would create bottlenecks and stale information.

**Proposed functional requirement:** Publish a ministry schedule as a live view. Authorized changes update it immediately and notify affected people rather than creating a second full publication. Each ministry leader chooses whether a designated scheduler may publish directly or requires leader review. Controlled automatic publication may occur after a deadline and is marked privately as published without approval. Incomplete schedules may publish with private alerts.

**Proposed technical solution:** Store live assignment state separately from publication/readiness metadata and generate change-specific notifications and timestamped print views.

**Reasoning:** Uniform approval rules do not fit every ministry, but no ministry should miss publication deadlines. Private warnings preserve accountability without confusing ordinary members.

**Important assumptions:** The ministry leader remains responsible for the ministry's configuration. Chapel Coordinator is the escalation beyond the ministry leader, not the routine approver.

**Alternatives considered:** Require leader approval everywhere; allow every scheduler unrestricted publication; republish the whole schedule after every edit. The selected model is configurable at ministry level with deadline controls.

**Edge cases:** Leader does not respond; open positions remain; a tentative ceremony is cancelled; disputed assignment remains; new service appears after publication.

**Unresolved questions:** Exact public/private indicators and escalation reporting.

**Dependencies:** R-001, R-009, R-011, R-018, R-020.

**Technical feasibility review:** Publication state versus live event state, audit snapshots, print timestamps, and notification diffing.

**Implementation constraints:** Printed schedules become stale; they must show generation time and the live application remains authoritative.

**Stakeholder or priest review:** Each ministry's publication-authority setting.

### R-015 — Guided, conditional ceremony cases

**Status:** Wedding, Funeral, Baptism, and Requiem-selection workflows approved for stakeholder review; details remain provisional.

**Underlying operational need:** Weddings, funerals, and baptisms require facts that affect the rite, staffing, sacristy preparation, facilities, and communications. Information is often gathered verbally and does not reliably reach every affected ministry.

**Proposed functional requirement:** Use a phone-friendly, save/resume guided intake. Ask only what the current actor can reasonably answer. Separate family-facing facts and contact information from internal liturgical planning. Allow tentative holds, explicit confirmation, role-specific readiness, family summary/verification, resource reservations, and automatic notifications to affected ministries.

**Proposed technical solution:** Configurable conditional case templates with linked contacts, events, resources, workstreams, statuses, and role-scoped views.

**Reasoning:** Capturing information once reduces repeated sensitive conversations and prevents assumptions that one recipient will relay everything. Conditional questions keep compassionate or brief first contacts light-touch.

**Important assumptions:** Father's Assistant commonly conducts family communication; Ceremony Coordinator manages internal liturgical planning; Father or delegate controls liturgical decisions.

**Alternatives considered:** One large form; free-form notes only; separate ministry forms; require all details before holding a date. These increase burden, duplicate information, or delay compassionate first response.

**Edge cases:** Funeral notice under one week; body present versus catafalque; schola unavailable; multiple baptism candidates; Easter Vigil baptism; reception or off-site burial; family publication permission withdrawn; conflicting verbal directions.

**Unresolved questions:** Exact rite names and checklists, retention, godparent/preparation boundary, Solemn Requiem support, schola workflow, and correspondence interpretation.

**Dependencies:** R-002, R-006, R-007, R-008, R-016, R-017, R-018, R-020, R-025.

**Technical feasibility review:** Conditional templates, case/event linking, status model, mobile save/resume, warm templated communication, reply classification with mandatory human review, and facility conflicts.

**Implementation constraints:** Natural-language classification may assist but must not auto-apply ambiguous family replies or send protected data to an unapproved external service.

**Stakeholder or priest review:** Father, assistant, Ceremony Coordinator, relevant ministry SMEs, schola SME, and facilities/hospitality owners.

### R-016 — Record and distribute verbal operational direction

**Status:** Approved direction in the Funeral workflow; reusable pattern proposed.

**Underlying operational need:** Father may communicate a change verbally to the assistant, server leader, sacristan, or another person and expect it to be shared. Contradictory reports can arise on different days.

**Proposed functional requirement:** Authorized actors may record Father's Direction, retain the source wording and structured effect, notify every affected role, and flag contradictions without silently overwriting either report. Father, delegate, assistant, or Ceremony Coordinator identifies the controlling direction according to workflow authority.

**Proposed technical solution:** Store immutable direction reports and reviewed structured change proposals, with conflict flags and explicit supersession rather than last-write-wins updates.

**Reasoning:** The problem is not only data entry; it is ensuring that a verbal decision becomes a shared operational fact with traceability.

**Important assumptions:** Recording who relayed a direction is acceptable and useful. The platform should minimize form burden.

**Alternatives considered:** Require Father to enter every change; rely on informal messages; let the most recent report automatically win. These do not match current communication patterns or safely resolve contradiction.

**Edge cases:** Later report conflicts with earlier sacristy instruction; urgent change; report affects several ministries; source wording is ambiguous.

**Unresolved questions:** Which workflows reuse this pattern and exact authority order outside ceremonies.

**Dependencies:** R-001, R-007, R-015, R-018, R-020.

**Technical feasibility review:** Conflict comparison, structured change proposal, audit, and targeted notification.

**Implementation constraints:** Plain-language processing can propose structured changes but must require review before saving.

**Stakeholder or priest review:** Father and delegated operational roles.

### R-017 — Priest privacy, delegation, coverage, and future mission assignments

**Status:** Mixed: private-calendar direction approved; multi-priest/mission scheduling is future and incomplete.

**Underlying operational need:** The chapel needs to know priest availability and celebrants for services without exposing private appointments. Current mission coverage comes from a priory schedule; a future priory may need to assign priests across several chapels and missions.

**Proposed functional requirement:** Each priest controls delegates to a private calendar. Other actors see only busy/unavailable. Public Masses may show celebrant. Missing celebrant warns but does not cancel a Mass. Future scheduling supports priest/delegate availability, mission assignments, language capabilities, substitutes, travel buffers, and controlled overrides.

**Proposed technical solution:** A separate private-calendar permission boundary linked to shared free/busy and service-assignment records; future priest scheduling uses chapel-aware travel and conflict rules.

**Reasoning:** Sacristans benefit from knowing the celebrant, and operations need conflict detection, but private appointments and sick-call details require a strict boundary. Multi-chapel readiness should not force premature assumptions about future priory governance.

**Important assumptions:** A Mass generally proceeds even if assignment data is late. Priests or delegates will maintain enough information for conflict detection. Future governance is not yet known.

**Alternatives considered:** Continue a separate Sheet indefinitely; expose private appointment titles to administrators; require celebrant before publishing Mass. Each either perpetuates duplicate work, violates privacy, or makes service scheduling brittle.

**Edge cases:** Substitute priest; overlapping missions; travel impossible; priest stays additional days; private appointment conflicts; language mismatch; no resident priest versus future daily Masses.

**Unresolved questions:** Priory authority model, mission scheduling workflow, source-of-truth transition from Sheet, travel buffers, delegate roles, and public celebrant policy confirmation.

**Dependencies:** R-001, R-002, R-006, R-015, R-021, R-022.

**Technical feasibility review:** Private/free-busy boundary, delegated calendars, travel-time rules, Sheet import, multi-chapel access, and conflict override.

**Implementation constraints:** The current Sheet is human-formatted and may require reviewed CSV upload if automated access is unavailable.

**Stakeholder or priest review:** Father, assistant, and any future priory authority.

### R-018 — Channel-independent notifications with urgency, fallback, and acknowledgment

**Status:** Approved principle; final channels and vendor choices unresolved.

**Underlying operational need:** People use different communication tools, messages can fail or be delayed, and urgent changes must reach the right people without flooding everyone.

**Proposed functional requirement:** Define notification events, recipients, privacy content, urgency, acknowledgment, reminder, escalation, and fallback independently of the delivery channel. Email is the baseline fallback; Telegram is optional and favored for current adult volunteers; SMS is future. Urgent changes inside 48 hours may use preferred and backup channels.

**Proposed technical solution:** A notification service with email, Telegram, and future SMS adapters, durable delivery jobs, idempotency keys, acknowledgment tracking, and privacy-safe templates.

**Reasoning:** Workflow correctness should not depend on one messaging service. Delivery and acknowledgment are different facts. Consolidated, role-specific messages reduce fatigue.

**Important assumptions:** Users opt into categories and provide a usable fallback. Leaders can respond to unresolved urgent items.

**Alternatives considered:** Telegram-only; SMS from a personal number; email-only; send every change to every group. Each has adoption, privacy, interoperability, ownership, or noise problems.

**Edge cases:** Telegram bot latency; duplicate buttons; repeated messages; message exceeds platform limits; delivery succeeds but user does not acknowledge; minor has no direct channel.

**Unresolved questions:** Technical advisor's recommended channels, providers, delivery budget, quiet hours, and exact escalation thresholds by workflow.

**Dependencies:** R-002, R-003, R-011, R-012, R-013, R-014, R-015, R-016, R-024.

**Technical feasibility review:** Adapter interface, deduplication, retries, idempotent actions, delivery receipts, acknowledgment, rate limits, and secure account linking.

**Implementation constraints:** Email requires authenticated domain configuration; Telegram should not carry sensitive records; SMS has regulatory and cost requirements.

**Stakeholder or priest review:** Notification expectations, minor/guardian notices, and urgent escalation recipients.

### R-019 — APR eligibility without storing screening evidence

**Status:** Approved direction; exact requirements and renewal cycles unresolved.

**Underlying operational need:** Some roles require APR approval before a person may volunteer or be assigned. Different duties may require different screening types, while screening vendors and district headquarters hold the sensitive evidence.

**Proposed functional requirement:** APR Coordinator configures screening types, role mappings, document packets, and eligibility. The scheduler applies eligibility as a hard rule only for roles that require it. Store minimal status metadata, never reports, Social Security numbers, license data, vendor questionnaires, or reasons for results. Leaders see only operational eligibility.

**Proposed technical solution:** A restricted APR metadata and eligibility component that exposes only role-specific eligibility decisions to the scheduling engine.

**Reasoning:** Scheduling needs a yes/no eligibility decision, not the sensitive source material. Separating screening types future-proofs roles such as driving or catechism without falsely activating requirements today.

**Important assumptions:** District/vendor remains the authoritative screening process; APR Coordinator alone verifies completion; screening expiration should notify the Coordinator rather than penalize the volunteer without review.

**Alternatives considered:** Store signed files and reports; one global cleared flag; let ministry leaders define screening. These create excess privacy risk, cannot express role-specific requirements, or place policy authority in the wrong role.

**Edge cases:** Cleared for one role but pending for another; document version changes; invitation-only role requires APR; expiration occurs while assigned; future chapel vehicle.

**Unresolved questions:** Exact screening types, levels, renewal cycle, district acceptance of electronic acknowledgment, retention, and policy/counsel review.

**Dependencies:** R-002, R-004, R-008, R-010, R-020, R-024.

**Technical feasibility review:** Restricted metadata service, rule evaluation, deduplication by person/version, reminders, audit, and safe exports.

**Implementation constraints:** Existing external signature and vendor workflows remain in place initially.

**Stakeholder or priest review:** APR Coordinator, district policy, and appropriate legal/privacy review.

### R-020 — Audit, history, retention, and correction

**Status:** Approved principle; retention periods are provisional until policy review.

**Underlying operational need:** Leaders need current schedules and enough history for accountability, fairness, APR-related inquiries, and correction of errors, while indefinite retention increases privacy risk.

**Proposed functional requirement:** Audit privileged changes and assignment transitions; retain cancelled services; retain named assignment history provisionally for three years then anonymize; retain security audit logs provisionally for seven years; strip private appointment names/notes after one year; preserve aggregate statistics. Record source and timestamp for leader-entered preferences and confirmations.

**Proposed technical solution:** Structured audit events, scheduled retention/anonymization jobs, backup lifecycle controls, and redacted export logging.

**Reasoning:** A live schedule alone cannot explain why an assignment changed, who approved an exception, or whether workload has been balanced. Anonymization preserves operational learning without permanent identification.

**Important assumptions:** Proposed periods are adequate for chapel policy and any safeguarding inquiry. Backups can age out expired data.

**Alternatives considered:** Keep everything indefinitely; delete completed schedules immediately; log confidential note contents. These respectively increase exposure, remove accountability, or duplicate sensitive information.

**Edge cases:** Deactivated account; corrected family direction; public permission withdrawn; restore from backup reintroduces expired data; printed schedule persists outside system.

**Unresolved questions:** Final retention policy, APR inquiry retention, ceremony-contact retention, and archival access.

**Dependencies:** R-002, R-010, R-011, R-012, R-013, R-014, R-015, R-019, R-024.

**Technical feasibility review:** Append-only audit design, redaction, anonymization jobs, backup lifecycle, and export auditing.

**Implementation constraints:** Public Git history must never contain production data or secrets; deleting a current file does not clean Git history.

**Stakeholder or priest review:** Privacy/APR review and chapel retention policy approval.

### R-021 — Defensive integrations and staged migration

**Status:** Approved strategy; individual integrations unresolved.

**Underlying operational need:** The platform benefits from existing Ordo, website, Google calendar, public listing, messaging, and priest-assignment data, but their interfaces, reliability, and ownership vary.

**Proposed functional requirement:** Put each external source behind a replaceable boundary. Cache and validate imported data, stage ambiguous changes for review, preserve original uploads and audit, never publish private notes automatically, and provide manual CSV/export fallbacks where cooperation or APIs are unavailable.

**Proposed technical solution:** Source-specific adapters feeding a common staging, validation, diff, provenance, and approval pipeline.

**Reasoning:** External capabilities can accelerate the project, but the chapel must not lose control or corrupt approved schedules when a source changes format, becomes unavailable, or contains human-formatted ambiguity.

**Important assumptions:** Manual fallback is acceptable for low-frequency imports. External maintainers may later provide structured feeds.

**Alternatives considered:** Direct scraping throughout the application; manual re-entry only; make an external spreadsheet the permanent application database. Replaceable adapters balance speed and resilience.

**Edge cases:** Missing year in CSV; date appears once per block; notes contradict priest column; harmless name variations; removed row; source correction after local override.

**Unresolved questions:** APIs, permission, rate limits, attribution, supported formats, website stack, and automatic Sheet access.

**Dependencies:** R-001, R-005, R-006, R-017, R-018, R-024.

**Technical feasibility review:** Adapter contracts, import staging/diff, provenance, reconciliation, and monitoring.

**Implementation constraints:** Existing connectors should be demonstrated against required fields and failure cases before adoption.

**Stakeholder or priest review:** Data owners and technical stewards; Father where imported data affects liturgical decisions.

### R-022 — Chapel-level data separation and future multi-chapel readiness

**Status:** Approved architecture direction; operational governance is future.

**Underlying operational need:** OLV may one day become a priory or support missions with different service times, branding, rules, ministries, and priests. Another priory might also adopt the product without sharing its chapel data.

**Proposed functional requirement:** Assign chapel ownership to all relevant data from the beginning. Let each chapel manage its own schedules and configuration. Permit future explicitly granted read-only higher-level oversight, but do not assume it. Initial user interface supports one chapel.

**Proposed technical solution:** Chapel ownership keys and authorization boundaries in the data model from the first release, without building the full multi-chapel interface initially.

**Reasoning:** Retrofitting data separation after production use is risky. Building the boundary now does not require building a full multi-chapel administration interface now.

**Important assumptions:** Chapels require operational independence; shared priests may span chapel boundaries; branding differences are limited but rules and notification channels may differ.

**Alternatives considered:** Single global dataset; separate codebase per chapel; full multi-tenant product in Phase 1. The selected approach creates a durable data boundary while controlling scope.

**Edge cases:** Person belongs to multiple chapels; priest assigned across chapels; priory viewer has no write authority; mission becomes independent; timezone differs in future even if current missions share one.

**Unresolved questions:** Future priory governance, data controller roles, cross-chapel person identity, shared priest records, and oversight permissions.

**Dependencies:** R-001, R-002, R-017, R-024.

**Technical feasibility review:** Tenant isolation, authorization tests, cross-chapel scheduling, exports, and migration of chapel ownership.

**Implementation constraints:** Do not expand the first pilot into a multi-chapel management product.

**Stakeholder or priest review:** Future priory leadership when applicable.

### R-023 — Reuse without requirements capture by the existing stack

**Status:** Approved principle.

**Underlying operational need:** Existing calendar readers, messaging features, schola capabilities, website components, and hosting knowledge may reduce cost and time, but they may not cover the required workflows.

**Proposed functional requirement:** Every workflow identifies Potential Existing Capabilities to Reuse separately from its functional requirements. Technical review maps each capability to satisfied requirements, gaps, constraints, privacy implications, and maintenance ownership.

**Proposed technical solution:** Use an architecture decision record or component-fit matrix before adopting each existing component or connector.

**Reasoning:** This permits collaboration and reuse without simplifying the chapel's operational needs merely to fit what already exists.

**Important assumptions:** Existing components can be inspected or demonstrated. Reimplementation may be preferable where adaptation creates excessive coupling.

**Alternatives considered:** Reject all existing components; adopt them as the product design; choose the stack before completing workflows. The current hybrid approach defines behavior first and evaluates reuse second.

**Edge cases:** A component reads the Ordo but cannot preserve source history; a messaging tool sends notifications but cannot enforce privacy or idempotency; a schola feature lacks the SME-approved workflow.

**Unresolved questions:** Complete component inventory, licenses, code quality, test coverage, deployment model, and technical ownership.

**Dependencies:** All rationale records with technical feasibility sections.

**Technical feasibility review:** Required for every proposed reuse decision.

**Implementation constraints:** Technology selection remains pending technical-steward review.

**Stakeholder or priest review:** Workflow steward validates behavior; Product Owner accepts compromises; clergy review applies where liturgical authority is involved.

### R-024 — Chapel ownership, resilience, recovery, and portability

**Status:** Approved direction.

**Underlying operational need:** Scheduling is mission-critical even though current processes are partly manual. The chapel must be able to continue operations during outages and must not depend on one individual's accounts or knowledge.

**Proposed functional requirement:** Chapel-owned domain, repository, database, email, hosting, and integration accounts; at least two technical custodians; daily backups; tested restoration; monitoring; weekly emergency schedules to leaders; export in standard formats; no pausing production tier.

**Proposed technical solution:** Managed production services with automated backups and monitoring, documented custody and recovery, and scheduled emergency exports. Vendors remain undecided.

**Reasoning:** A feature-rich scheduler that cannot be recovered, transferred, or operated during an outage creates more risk than the current manual process.

**Important assumptions:** The chapel will designate custodians and fund reliable production services. Initial recovery target accepts up to one day of data loss.

**Alternatives considered:** Personal accounts; free pausing host; no formal restore test; proprietary lock-in without export. These were rejected for continuity risk.

**Edge cases:** Custodian unavailable; secret exposed; restore includes expired sensitive data; notification service fails while calendar remains available; local printed schedule is stale.

**Unresolved questions:** Production stack, incident response, support owner, secrets custody, budget, recovery-time target, and monitoring service.

**Dependencies:** R-001, R-002, R-018, R-019, R-020, R-021, R-022.

**Technical feasibility review:** Backup encryption, restore testing, monitoring, disaster recovery, export completeness, and least-privilege custody.

**Implementation constraints:** Provisional infrastructure ceiling is $75 per month excluding labor; validate after vendor selection.

**Stakeholder or priest review:** Chapel ownership and production authorization.

### R-025 — General volunteer opportunities beyond liturgical ministries

**Status:** Future; core concepts approved.

**Underlying operational need:** Cleaning, maintenance, priests' meals, events, setup, cleanup, banner carrying, and other work are currently informal and may benefit from visibility and scheduling. Public registration can help people discover ways to serve.

**Proposed functional requirement:** Support event-linked or standalone opportunities as shifts or tasks. Leaders establish valid windows, headcounts, qualifications, age rules, and restricted instructions. Signed-in users may browse opportunities; unapproved users express interest; approved users may claim ordinary openings; selected roles remain invitation-only.

**Proposed technical solution:** A reusable opportunity service linked optionally to events and using the same identity, eligibility, notification, and assignment foundations as liturgical scheduling.

**Reasoning:** A Mass-position model does not fit deadline-based maintenance work, flexible cleaning windows, meals, or event setup. A reusable opportunity model avoids creating a new scheduling subsystem for each ministry.

**Important assumptions:** Each ministry or service area will provide an SME/Workflow Steward. Public visibility of an opportunity does not imply visibility of staffing details.

**Alternatives considered:** Treat every task as a calendar service; place everything under ushers; keep all non-liturgical work outside the platform. The proposed model retains distinct ownership while sharing common scheduling capabilities.

**Edge cases:** Adults-only task; minor with guardian; keys/alarm details; one-time approval; invitation-only prominent roles; task conflicts with chapel use; reception needs facility time but family handles setup.

**Unresolved questions:** Ministry owners, normal work windows, templates, meal workflow, event/banquet planning, gala workflow, and HNS service expectation policy.

**Dependencies:** R-004, R-007, R-018, R-019, R-022.

**Technical feasibility review:** Mixed shift/task model, deadlines, resource calendar, one-time eligibility, restricted instructions, and public recruitment funnel.

**Implementation constraints:** These workflows must not be invented without SME review. Existing schola capabilities may justify earlier focused scope only after workflow validation.

**Stakeholder or priest review:** Relevant leaders, Workflow Stewards, Holy Name Society President, Father where policy or liturgy is involved.

### R-026 — Documentation as an authoritative, controlled product artifact

**Status:** Approved.

**Underlying operational need:** The platform is being shaped through extensive operational discovery. Developers and future maintainers need durable, reviewable requirements instead of relying on conversational history or personal memory.

**Proposed functional requirement:** Maintain version-controlled vision, workflows, domain model, UX guidance, technical decisions, tests, rationale, open questions, and change history. Interview and approve one workflow at a time. Reconcile documents after logical workflow groups.

**Proposed technical solution:** Repository-managed Markdown specifications linked to future decision records, acceptance tests, release notes, and an access-controlled approval register.

**Reasoning:** The complexity belongs in explicit rules and acceptance criteria. Without controlled documentation, implementation choices can silently redefine operations.

**Important assumptions:** Stakeholders will review concise workflow documents and changes will be recorded.

**Alternatives considered:** Treat the prototype or source code as the specification; retain only meeting notes; store rationale only in AI conversations. These are insufficient for challenge, handoff, and long-term governance.

**Edge cases:** Workflow approved before another workflow reveals a contradiction; implementation discovers a simpler solution; SME changes current practice; document and code diverge.

**Unresolved questions:** Formal approval register, decision-log format, traceability to tests, and release documentation process.

**Dependencies:** All workflow and rationale records.

**Technical feasibility review:** Documentation tooling is flexible; the important issue is workflow-to-test and decision traceability.

**Implementation constraints:** Public repository documents must use roles instead of unnecessary personal names and must not contain real operational data.

**Stakeholder or priest review:** Each workflow's designated authority and SME.

## 5. Cross-cutting inconsistencies and gaps requiring resolution

The following are not necessarily product defects; they are areas where current materials should not be implemented without reconciliation:

1. **Schedule cadence:** Architecture text includes Monday-based rolling four-week commitment/open windows, while the approved publication workflow uses calendar-month readiness and a two-month view. Preserve the need for continuous scheduling without month-end rush, but agree on one operational rule.
2. **Assignment acceptance language:** Older pilot material refers to automatically accepted assignments, while the current confirmation workflow requires explicit volunteer confirmation of auto-assigned services. The newer workflow direction should control once completed and approved.
3. **Preference vocabulary:** Older architecture uses Prefer, Available, and Do not schedule. The approved preference workflow adds Can help sometimes, Available if necessary, Cannot serve, and Not specified. The domain model and UI guidance must be updated after the workflow group is complete.
4. **Ceremony terminology and templates:** Authentic rite names, Requiem formulary mapping, procession details, blessings, and staffing templates need SME or priest validation before automation.
5. **Ceremony staffing versus ministry workflows:** Ceremony cases identify required staffing, but each ministry must validate qualifications, minimums, backup rules, and assignment behavior.
6. **Schola scope:** Schola is operationally important and existing capabilities may be reusable, but its end-to-end workflow still requires SME review before inclusion in a release.
7. **Facilities and hospitality:** Cases may reserve rooms or link receptions, but banquet, potluck, venue, food, setup, cleanup, and fundraising workflows remain future and require their own stewards.
8. **Minor confirmation authority:** The confirmation workflow interview paused before resolving concurrent guardian/minor confirmation behavior.
9. **Retention periods:** Three-year assignment history, seven-year security audit, one-year ceremony contacts/private appointment notes, and APR-specific periods remain provisional pending policy review.
10. **Production scope and dates:** Early planning dates and phase assumptions should be re-baselined after workflow completion and technical feasibility review rather than treated as current commitments.

## 6. Technical feasibility review checklist

Before implementation is approved, technical reviewers should produce evidence for:

- Server-enforced authorization for every calendar and field visibility tier.
- Chapel-level data isolation tests.
- Deterministic scheduling constraints, fairness, overrides, and explanations.
- Idempotent bulk confirmation, volunteering, substitution, and notification actions.
- Import staging, provenance, caching, failure behavior, and manual fallback.
- Conditional case templates, linked events, independent status, and permission propagation.
- Secure passwordless authentication, privileged-user protection, and Telegram linking.
- Notification delivery, acknowledgment, retry, fallback, rate-limit, and deduplication behavior.
- Data minimization, retention, anonymization, audit redaction, and backup aging.
- Recovery testing, emergency schedule access, monitoring, and export portability.
- Mobile usability for the highest-frequency volunteer and assistant workflows.
- Accessibility and future localization approach.
- Mapping of every proposed reused component to requirements met, gaps, risks, and ownership.

Technical review may recommend a different functional or technical solution. The recommendation must state how it preserves the underlying operational need, what requirement text changes, what new edge cases appear, and which stakeholders must approve the change.

## 7. Source documents reviewed

- `docs/design/chapel-scheduler-architecture.md`
- `docs/design/early-september-alpha-plan.md`
- `docs/design/stakeholder-and-webmaster-questions.md`
- `docs/design/webmaster-alpha-brief.md`
- `docs/project-documentation-framework.md`
- `docs/repository-publication-policy.md`
- `docs/specification/workflows/generate-maintain-regular-service-calendar.md`
- `docs/specification/workflows/generate-publish-ministry-schedule.md`
- `docs/specification/workflows/manage-preferences-unavailability.md`
- `docs/specification/workflows/schedule-wedding.md`
- `docs/specification/workflows/schedule-funeral.md`
- `docs/specification/workflows/schedule-baptism.md`
- `docs/specification/workflows/select-requiem-mass.md`
- `README.md`, `poc/README.md`, and `alpha/README.md` for stated prototype and alpha boundaries

The demonstration code was treated as evidence of explored interaction patterns, not as authoritative functional requirements.
