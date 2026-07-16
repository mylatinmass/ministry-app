# Chapel Scheduler: Architecture and Product Design

Status: Consolidated architecture draft  
Prepared: July 15, 2026  
Target: Sacristan pilot in early September 2026; sacristan, altar-server, and usher pilots by late October; normal use by the First Sunday of Advent 2026

## 1. Executive summary

Chapel Scheduler will replace the chapel's fragmented use of Ministry Scheduler Pro, Telegram, Google Calendars, spreadsheets, the public website, and manually maintained public schedules.

The system will have one master calendar. Public services, private priest appointments, liturgical and non-liturgical staffing, volunteer tasks, instructions, notifications, printable schedules, personal calendar subscriptions, and future website feeds will all derive from that calendar according to permissions.

The first pilot is deliberately narrow: scheduling eight sacristans. The architecture will be ready for altar servers and ushers next, without requiring those ministries or the future chapel-wide features to be built before September.

The central product principle is low friction with privacy first:

- A phone-friendly web application is the authoritative system.
- Email one-time links avoid passwords for ordinary members.
- Telegram is a convenient optional interface, strongly recommended for current adult volunteers but never the only way to participate.
- Public visitors see chapel services and public liturgical information without signing in. Eligible events may say only that volunteer opportunities are available; names, staffing counts, positions, eligibility, and ministry status remain private.
- A lightweight account may contain only a verified email and explicit notification choices. A name is requested only when the person volunteers, joins a ministry, or begins a separate chapel-membership process.
- Registration presents optional ways to help so that liturgical ministries, the League of Our Lady of Victory, Maintenance, and Events can recruit without turning interest into a commitment.
- Sensitive roles, minors, APR status, and private priest appointments have stricter boundaries.
- Automatic decisions remain reviewable and overridable by authorized people.

## 2. Measures of success

### September sacristan pilot

The pilot succeeds if:

- all eight sacristans self-register;
- ministry approval and the applicable APR eligibility check work;
- sacristans enter recurring preferences and absences;
- the system produces a usable draft schedule;
- the leader reviews and publishes it;
- sacristans review each newly published weekly batch with one-tap Confirm all or individual exception handling;
- reminders and substitutions work;
- the current schedule stays filled with less manual follow-up;
- phone use is easy enough that members actually use it.

### Advent rollout

By the First Sunday of Advent, sacristans, altar servers, and ushers should be able to use Chapel Scheduler as their normal scheduling system after four-week parallel pilots with MSP.

## 3. Scope and phases

### Phase 0: foundation and design validation

- Chapel-owned production accounts and source repository
- Chapel-level data separation
- Master calendar and event model
- Account, household, role, permission, privacy, and audit model
- Email delivery and notification-channel adapter foundations
- Automated backups and operational monitoring
- Ordo import adapter with caching and failure detection
- Responsive, installable web experience using the mylatinmass.com visual style

### Phase 1: early September sacristan pilot

- Self-registration
- Email one-time-link sign-in
- Privileged-user second factor on new devices or after 30 days
- Main administrator, APR Coordinator, Head, Alternate, and scheduling roles
- Requirement-based APR eligibility and ministry-specific leader approval
- Regular service calendar generation
- Preferred Ordo import, with manual correction fallback
- Sacristan recurring preferences and absences
- Flexible desired workload and leader-overridable hard maximum
- Draft automatic schedule, leader review, publication, assignment notices, reminders, and substitutions
- Month, week, day, and personal calendar views
- Public service calendar without volunteer names, opening counts, positions, or staffing details
- Named ministry calendar for approved members
- Printable current/upcoming schedule
- Email notifications; Telegram is added only if the core alpha is stable ahead of plan
- Basic feedback/problem-reporting button
- Daily backup and weekly emergency schedule emailed to leaders

Not included in the September pilot: document repository, detailed scheduler explanations, SMS, rooms and maintenance, lightweight notification accounts, expanded volunteer recruitment, RSVP, website integration, fsspx.today integration, multiple live chapels, and priest travel coordination.

### Phase 2: altar-server and usher pilots by late October

- Altar-server qualifications, regular/backup qualification levels, position rotation, and six-month position history
- Minor profiles, households, guardians, parent controls, and under-13 restrictions
- Archconfraternity of St. Stephen level history
- Altar-server ceremony staffing rules
- Usher staffing rules and overnight adoration shifts
- Cross-ministry conflict avoidance and ministry preference ranking
- Ministry-specific printable schedules
- Combined ceremony blocks

### Phase 3: Advent normal use and calendar transition

- Four-week parallel validation completed for all three ministries
- Chapel Scheduler becomes official; MSP becomes historical/fallback only
- Pastor-assistant web scheduling with privacy-tiered plain-language input
- Telegram entry for non-confidential public services
- Future Google events imported
- Four-week calendar comparison, followed by read-only Google archives
- Personal Google/Apple calendar subscriptions from private revocable feeds

### Phase 4: post-Advent enhancements

- PDF and photo-guide repository with metadata and full-text PDF search
- Scheduler choice explanations
- Public website API/feed coordinated with the webmaster
- fsspx.today integration if supported
- Lightweight notification accounts and public-calendar volunteer invitations, coordinated with the webmaster
- Optional notification categories: Mass changes, special services, chapel events, volunteer opportunities, and general announcements
- League of Our Lady of Victory scheduling for chapel cleaning and priests' meals
- Maintenance shifts and task assignments
- Events planning, food preparation, setup, staffing, and cleanup opportunities
- One-time volunteer approvals alongside ongoing ministry membership
- Rooms, setup/cleanup buffers, and maintenance blocks
- Configurable APR document packets and screening-type requirements
- SMS if later justified
- Spanish localization and accessibility enhancements
- Public-event RSVP

### Future readiness, not an initial commitment

- Additional ministries and service areas using the same shift/task pattern
- Cross-functional operational cases linking liturgy, Schola, hospitality, meals, facilities, venue reservations, communications, fundraising, setup, cleanup, and volunteer staffing
- Banquets, potlucks, major-feast hospitality, Confirmation receptions, and annual fundraising events
- Invitation-only ceremonial staffing, including Apostles, bier bearers, and canopy bearers
- Priest and delegate scheduling across chapels
- Sick-call privacy and priest travel buffers
- Multiple mission chapels using shared software but isolated data
- Optional read-only higher-level oversight if explicitly granted by a chapel

## 4. Conceptual model

The system should be built around a small set of durable concepts.

### Chapel

Owns its members, locations, calendars, ministries, rules, documents, Telegram configuration, and branding name. All data is assigned to a chapel from the beginning. The initial UI supports one chapel, while the data boundary permits future missions.

### Person and household

A person has one account and may have memberships at multiple chapels in the future. A household links guardians and minors without merging their individual records. A parent can manage their own schedule and selected children from the same account.

A notification-only account needs only a verified email address. Telegram linking, notification subscriptions, preferred name, volunteer profile, ministry membership, and formal chapel membership are separate optional relationships rather than required registration fields. Expressing interest in a volunteer opportunity causes the system to request the person's full name privately; a shorter preferred name may be used on authorized schedules.

### Organization, ministry, and service area

A chapel organization or ministry has leaders, members, service areas, opportunity templates, documents, and permission rules. Initial examples include:

- Sacristans, altar servers, and ushers;
- the Schola, with music and ceremony requirements defined and validated by its subject-matter expert;
- the League of Our Lady of Victory, with separately approved Chapel Cleaning and Priests' Meals service areas;
- Maintenance;
- Events, with separately approved planning, food preparation, setup, staffing, and cleanup service areas;
- the Holy Name Society, whose President controls designated invitation-only ceremonial assignments.

Approval for an organization does not automatically qualify a person for every service area. A leader may approve ongoing participation or a single opportunity only.

### Calendar and event

An event is the primary calendar item. Examples include Mass, Exposition, Benediction, a wedding, funeral, private appointment, procession, meeting, maintenance block, or sick call.

An event includes:

- chapel and location;
- date, start, end, and timezone;
- type and liturgical metadata;
- public title and description;
- separate restricted title/notes;
- visibility;
- status: draft, published, changed, cancelled, or completed;
- source: generated rule, Ordo import, manual, Google import, or API;
- linked or bundled events;
- change and audit history.

### Operational case and liturgical event

An operational case coordinates a real-world matter that may contain several events, decisions, contacts, permissions, and tasks. Examples include Funeral, Wedding, Baptism, and Anniversary Observance. A liturgical event is a rite or service within a case, such as Requiem Mass, Reception of the Body, Absolution, Burial Service, Nuptial Mass, or Baptism.

Cases, liturgical events, ordinary calendar events, and staffing duties remain distinct. For example, a Funeral case may link a viewing at a funeral home, Rosary, Requiem Mass at the chapel, and burial at a cemetery. A simple Requiem selected for an existing ferial Mass does not create a Funeral case.

A major operational case may also contain non-liturgical workstreams without collapsing them into the liturgical event. For example, a Confirmation case may link the Confirmation ceremony, Schola requirements, a reception or banquet, venue and room reservations, food, communications, setup, cleanup, and volunteer opportunities. A major feast or procession may likewise link its Mass and procession to a potluck or banquet. Each workstream retains its own owner, permissions, tasks, status, and SME-approved workflow while sharing the case-level date, dependencies, and change notifications.

Ceremony cases use guided, conditional intake. Family-facing questions remain separate from internal liturgical planning. Restricted contact information is stored in a separately permissioned linked record and is never copied into public or ordinary ministry calendars.

### Duty and staffing need

An event can contain one or more duties. A duty has its own ministry, time context, required headcount, positions, qualifications, instructions, and workload weight. Multiple separately timed duties can belong to one event, but ordinary Mass scheduling need not expose unnecessary sub-events to users.

### Opportunity, shift, and task

An opportunity is a way to help that may be linked to a calendar event or stand alone. Both Maintenance and League service areas may use:

- a shift with a date, time, location, desired headcount, and recurrence; or
- a task with a description, deadline or approved work window, assigned people, qualifications, and restricted instructions.

Leaders define the valid scheduling windows. Volunteers choose recurring preferences only within those parameters. Every signed-in account holder may browse general opportunities to encourage participation. Unapproved people send an expression of interest rather than claiming the work; approved people may claim ordinary openings, while specially marked tasks require leader approval. Restricted details such as keys, alarms, broken locks, access instructions, dietary details, or private notes are visible only after authorization.

Opportunities can carry an age rule such as adults only or minor-with-guardian. A minor may see an adults-only opportunity labeled as unavailable but cannot volunteer for it. One-time approval expires with the opportunity and does not create continuing ministry membership.

### Assignment

An assignment links a person to a duty and optionally a position. Its state includes draft, invited, offered, pending review, confirmed, response overdue, substitute requested, replaced, completed, or cancelled. Self-volunteered assignments are confirmed immediately. Invitation records remain distinct from assignments until accepted.

Volunteers normally commit to the service, not a particular position. Position allocation is made by the scheduler and can be changed by the ministry leader without requiring the service to be reconfirmed.

### Qualification

Position qualifications are granted only by the ministry Head. Altar-server qualifications may be regular or backup. Backup is used only when needed and is flagged in the draft for leader review.

Non-liturgical qualifications may include leader-verified skills such as electrical work, plumbing, carpentry, equipment operation, or heavy lifting. The system stores simple qualification flags and verifier history, not licenses or employment documents.

### Preference and absence

For each recurring service, a volunteer chooses:

- Prefer
- Available
- Do not schedule

They may also set a flexible desired workload, a hard maximum, ministry ranking, recurring constraints, and dated absences. Website and Telegram entry write to the same record. Telegram repeats exact interpreted dates and requires confirmation.

### Rule and recommendation

Rules are versioned, sourced, and previewable. Each is classified as automatic or recommendation-for-review. Conflicts between Ordo data and local rules are surfaced rather than silently resolved.

### Document

Documents and photo guides belong to a chapel and can be associated with ministries, ceremonies, feasts, services, or positions. The post-pilot repository supports PDFs, ordered photo albums, downloads, metadata search, and text extraction from text-based PDFs. Image location metadata is stripped on upload.

APR documents are a separate protected administrative class. The system may distribute versioned documents and track sent, due, reminded, and received states, but signed agreements and screening reports remain in the approved external records process unless a later policy explicitly authorizes secure storage.

## 5. Calendar architecture

### One source of truth

Chapel Scheduler is the authoritative calendar. The website, Telegram, printed schedules, personal calendars, and future external sites consume controlled views of it.

The system keeps logically separate calendars and permissions:

- Public chapel services and events
- Internal ministry schedules
- Father/private-priest calendars
- Volunteer shifts, tasks, rooms, and maintenance calendars

Private appointments expose only busy/unavailable information outside the priest and explicitly authorized delegates. Main administrators do not automatically receive private-calendar access.

### Visibility levels

- Public
- Signed-in account holder
- Relevant ministry member
- Ministry leader/administrator
- Private priest/delegate

Every event separates public information from private staff notes. Safe visibility defaults are selected by event type and can be overridden by authorized staff.

### Calendar views

- Month is the default
- Week and day are selectable
- Personal assignment view
- Combined multi-ministry view with ministry colors
- Open opportunities highlighted
- Public services may display a clickable “Volunteer opportunities available” indicator without revealing ministry, count, position, invitee, or eligibility information
- Signed-in account holders may browse general volunteer opportunities across ministries
- Assigned names visible only within ministries to which the member belongs
- Other ministries hidden rather than disclosed as named rosters

### Printing and history

Approved members may print their ministry's current and upcoming named schedule. Historical named schedules are limited to leaders and administrators. Printouts identify who generated them and when.

Named assignment history is retained for three years, then anonymized while aggregate staffing statistics remain. Deactivated people remain in authorized history until anonymization.

Cancelled services remain in history marked cancelled, including their assignments.

### Personal calendar subscriptions

Each member may generate a private, revocable calendar feed for Google Calendar or Apple Calendar. It contains only the person's pending and confirmed services and assigned positions. Open opportunities remain on Chapel Scheduler and Telegram.

## 6. Standard service patterns

### Regular calendar

All regular Masses require one sacristan.

| Service | Time | Sacristans | Ushers | Altar servers |
|---|---:|---:|---:|---|
| Monday Low Mass | 7:15 a.m. | 1 | 1 | Ac1 |
| Friday Low Mass | 6:30 p.m. | 1 | 1 | Ac1 |
| Saturday Low Mass | 9:00 a.m. | 1 | 1 | Ac1 |
| Sunday Low Mass | 7:00 a.m. | 1 | 2 | Ac1 |
| Sunday Low Mass | 9:00 a.m. | 1 | 4 | Ac1, Ac2 |
| Sunday Sung Mass | 11:00 a.m. | 1 | 4 | See Sung Mass rule |
| Sunday Low Mass | 5:00 p.m. | 1 | 2 | Ac1 |

Confessions and Rosary are informational and linked to the Mass: one hour before weekday Masses and 30 minutes before Sunday Masses.

### First Friday/First Saturday

The first Saturday governs the overnight-adoration pattern. The immediately preceding Friday triggers it even when that Friday falls in the previous calendar month. A calendar First Friday does not independently trigger Exposition, overnight adoration, or Benediction.

On the Friday preceding the first Saturday:

- Friday Mass at 6:30 p.m.
- Exposition at 7:00 p.m.
- All-night adoration from 7:30 p.m. to 7:30 a.m.
- Twelve one-hour usher shifts, each staffed by one usher
- Benediction Saturday at 8:00 a.m.
- Saturday Mass at 9:00 a.m.

The public 8:00–9:00 a.m. event is titled **First Saturday Devotions | Benediction**. The 9:00 a.m. Mass prefers the Immaculate Heart votive Mass when rubrically permitted. Every First Friday retains its ordinary Mass and First Friday devotions and prefers the Sacred Heart votive Mass when permitted. Rubrical impediments become Ceremony Coordinator and priest advisories rather than automatic overrides.

Sacristan assignments are bundled: Friday Mass plus Exposition is one duty; Benediction plus Saturday Mass is one duty.

Server assignments are also bundled:

- Friday Mass Ac1 and Ac2 become MC and Th for Exposition
- MC and Th for Benediction become Ac1 and Ac2 for Saturday Mass
- Specifically, MC maps to Ac1 and Th maps to Ac2
- Each combined block counts as one assignment for workload balance

Overnight adoration counts as two regular assignments per hour for usher balancing. Automatic scheduling assigns at most one hour per usher unless the usher volunteers for additional shifts or a leader overrides.

### Sunday Sung Mass server rule

Required positions:

- Master of Ceremonies (MC)
- Thurifer (Th)
- Cross bearer (Cb)
- Acolyte 1 (Ac1)
- Acolyte 2 (Ac2)

Optional expansion after the five required positions:

| Extra qualified servers | Added positions |
|---:|---|
| 1 | Bb |
| 2 | Tb1, Tb2 |
| 3 | Bb, Tb1, Tb2 |
| 4 | Tb1, Tb2, Tb3, Tb4 |
| 5+ | Bb, Tb1, Tb2, Tb3, Tb4; further needs require a service-specific template |

Bb is normally optional. Torchbearers are assigned in even numbers, up to four. A shortage in the five required positions is flagged for the leader; the system does not invent combinations or omissions.

During the Summer Schedule, the Sunday 11:00 a.m. Mass becomes Low Mass and requires Ac1 and Ac2.

### Special server recommendations

- First-class feast: recommend secondary MC
- Holy Thursday: recommend second thurifer
- Corpus Christi Blessed Sacrament procession: recommend second thurifer
- Christ the King Blessed Sacrament procession: recommend second thurifer
- Secondary MC uses the same qualification as MC and participates in rotation
- Confirmations and other exceptional ceremonies use reusable draft templates reviewed each time

### Invitation-only ceremonial positions (future)

Some ceremonial positions are filled by private invitation rather than open volunteering. Initial examples are bier bearers, canopy bearers, and the twelve Apostles for the Holy Thursday washing of feet. These positions do not appear in public opportunity lists or general volunteer-interest registration.

Responsibility is deliberately separated:

- The Server Leader creates or activates the required positions on the service, normally from a reusable ceremony template.
- The Holy Name Society President manually selects the men, sends private invitations, and controls the ordered alternate list.
- The system does not calculate prominence, rank candidates, or recommend invitees from donations, titles, or other inferred status.
- The Server Leader may see each invitee and whether the invitation is pending, accepted, declined, or unanswered so that shortages can be resolved.
- Accepted invitations populate the service positions automatically.
- The public calendar shows the ceremony but not invitee or assignment names. Invitee information is restricted to the Holy Name Society President, Server Leader, and specifically authorized administrators.

If a primary invitee has not responded one week before the ceremony, the system alerts the Holy Name Society President and advances to the next approved alternate. The original invitation closes unless the President explicitly reopens it. Invitations may be sent through an existing account or a private one-time email link. Acceptance creates a lightweight account through which the man can view the assignment and optionally connect Telegram. Declining does not create an account.

Ceremony templates remember the usual positions and staffing counts, including twelve Apostles for Holy Thursday, while allowing the Server Leader to adjust a particular service. Declined and unanswered invitation records retain only the invitee name, ceremony, outcome, and response date and are deleted after one year. Accepted assignments remain in scheduling history.

## 7. Liturgical calendar and local rules

### Source strategy

1962ordo.today is the preferred liturgical source because MSP's general calendar lacks SSPX-specific information. No supported API was found during discovery. The initial integration may therefore use a replaceable importer that:

- fetches only the required date range;
- caches source data and retrieval time;
- preserves source links;
- validates expected fields;
- detects missing or structurally changed content;
- never deletes approved local calendar data because an import fails;
- flags uncertainty for administrator review;
- allows manual correction;
- can later be replaced by an official feed without changing the rest of the system.

The main administrator reviews and approves the generated service calendar before ministry scheduling begins.

### Known local rules

- External Solemnity of Saints Peter and Paul: recommendation for the first Sunday after June 29, celebrated only at the Sunday 11:00 a.m. Mass
- Summer Schedule: Sunday after that External Solemnity through August 15; 11:00 a.m. changes from Sung Mass to Low Mass, while times and other ministry needs remain unchanged
- Our Lady of Victory/Our Lady of the Rosary: first Sunday in October; I class patronal observance
- St. Philomena feast: August 11; I class patronal observance even on a weekday
- St. Philomena External Solemnity: recommend the closest Sunday and flag for review because Father selects the Sunday
- St. Philomena Foundation Masses: January 10, May 25, and August 10; currently scheduled to replace the regular Mass, subject to later correction if precedence rules require

Rules added later retain a version, source, explanation, author, approver, and activation date. A preview shows all affected future services before activation.

## 8. Scheduling behavior

### Rolling horizon

The system runs each Monday and maintains two rolling four-week windows. The next four weeks are the commitment window: the scheduler preserves volunteer claims and fills remaining positions. Weeks five through eight are visible as an open volunteer window and are not automatically assigned. When a week crosses into the commitment window, it is scheduled and added to each affected member's next batch review. Inside two weeks, changes use the substitution workflow rather than silently reshuffling published assignments.

### Draft and publication

1. Main administrator reviews the generated service calendar.
2. The scheduler creates ministry drafts.
3. Each ministry leader reviews assignments, shortages, backups, conflicts, and overrides.
4. A normal, conflict-free week publishes automatically; shortages, conflicts, overrides, and unusual services are held for leader review.
5. Volunteers receive one weekly review containing only new or changed assignments, with **Confirm all** and **Review individually** actions.
6. After three days, the system reminds members who have not responded. A second reminder follows one week later.
7. After the second unanswered reminder, the assignment remains in place as **Response overdue** and the ministry leader receives one consolidated alert.
8. Confirmed members receive a service reminder one week before serving, with a prominent **I can't serve** action.

### Balancing

The scheduler considers:

- approval and qualification;
- regular versus backup qualification;
- absence and hard do-not-schedule preference;
- service preference;
- hard maximum workload;
- flexible desired workload;
- recent assignment count;
- six-month position history for altar servers;
- ministry priority for multi-ministry volunteers;
- Sunday and same-service conflict rules;
- optional versus required positions;
- workload weights.

Automatic scheduling assigns a person to at most one Sunday Mass across all ministries. It also avoids two ministries at the same Mass. Members may volunteer for additional compatible duties, and authorized leaders may override with an audit record and notice to the affected member.

Sacristan plus altar-server or usher duties are technically compatible, but the automatic scheduler still avoids double assignment. Altar-server plus usher duties are incompatible. If combined voluntarily or by override, each ministry counts the assignment separately.

### Assignment review and position changes

Self-volunteered assignments are confirmed immediately. Scheduler-created assignments are reviewed as a weekly batch, so the member can confirm all with one action or flag individual exceptions. Selecting **I can't serve** asks whether the conflict is one-time or requires a regular-availability update, then starts the qualified-substitute workflow. Position changes remain visible and may notify the member, but do not require reconfirmation.

### New or changed services

Adding a service in the published window creates staffing openings and alerts relevant ministry leaders. The system suggests best-fit people, but the leader decides. Cancelling or changing a service automatically notifies assigned members through their available channels.

### Substitutions

The assigned volunteer remains responsible until a qualified substitute accepts.

- Member selects “I need a substitute.”
- Opening is offered without exposing private contact details.
- More than 48 hours out: unresolved requests escalate at 48 hours; waitlisted candidates receive 12-hour sequential offers ordered by best workload balance.
- Inside 48 hours: ministry leader is alerted immediately; all qualified available people are notified; first acceptance wins.
- Accepted substitutes update the assignment automatically.
- Leaders can correct informal substitutions or no-shows afterward.
- No mandatory check-in is required.

### Non-liturgical shifts and tasks

1. A ministry leader creates an opportunity from an approved template or submits a new template for review.
2. The template defines service area, valid work windows, recurrence, qualifications, age rules, restricted instructions, and whether approved volunteers may claim it directly.
3. Every signed-in account holder may see the general opportunity. Restricted details remain hidden.
4. An unapproved person selects “I'm interested”; the appropriate leader receives a private expression of interest without creating an assignment.
5. The leader may approve the person for that single opportunity or for continuing participation in the service area.
6. If APR eligibility is required, assignment is blocked until the necessary initial clearances are complete. The user sees only a discreet private eligibility message.
7. Completed shifts and tasks count separately for workload history unless a template explicitly bundles them.

An already reviewed opportunity template may be reused without a new APR review. A newly created role or task type remains in draft until the APR Coordinator classifies its document and screening requirements.

## 9. Roles and permissions

### Chapel-wide roles

| Role | Main permissions |
|---|---|
| Main Chapel Administrator | Controls whether, when, and where operational events occur; chapel configuration, public calendar, role recovery, exports, and non-private operational oversight |
| Backup main administrator | Same authority for continuity |
| Ceremony Coordinator | One ongoing chapel-level role delegated by Father; full restricted ceremony-case access; controls ceremonial representation, templates, checklists, ministry implications, and resolution of conflicting verbal directions |
| Pastor oversight | Read-only oversight of ministries, schedules, approvals, and audit history; private-calendar access remains separate |
| APR Coordinator | Screening types, role/task eligibility rules, document packets, referral/receipt/result metadata, renewal dates, and private eligibility inquiries; no screening reports stored |
| Pastor's assistant/service scheduler | Public services and delegated private priest calendar |
| Holy Name Society President | Private selection, invitation, alternate, and response management for designated ceremonial positions |
| Technical custodian | Production operations, deployment, backups, and recovery; not automatically entitled to application content |

At least two chapel-approved technical custodians hold production account and recovery access.

Operational authority and technical ownership remain separate. One person may hold Main Chapel Administrator, Ceremony Coordinator, and technical roles today, but each permission set must be independently assignable. Changes within a role's authority take effect without dual approval while other affected roles are notified. Cross-domain conflicts are flagged for resolution.

### Ministry roles

| Role | Main permissions |
|---|---|
| Head | Full ministry membership, qualifications, assignments, documents, and role delegation |
| Alternate | Full ministry authority when needed |
| Scheduling coordinator | Assignments, confirmations, and substitutions |
| Document contributor | Upload and organize ministry instructions |
| Approved volunteer | View authorized ministry calendar and documents; browse general opportunities; manage own availability and assignments |
| One-time volunteer | Access only to the accepted opportunity and its authorized instructions until completion |

The Head assigns ministry roles. Main administrators may change leadership if the Head is unavailable. Changes are logged and people are notified.

Ministry title and software authority are separate. “Head Sacristan” can remain a title even when another authorized person performs most scheduling.

### Account, interest, and approval

The public calendar needs no account. Optional self-registration begins with a verified email and presents three independent, skippable paths:

1. explicitly opt into one or more notification categories;
2. express interest in one or more ways to help; or
3. follow a configurable link to the chapel's separate formal-membership process.

All notification categories begin unchecked. Telegram linking occurs only after email verification and is optional. A notification-only account does not require a name. Volunteer interest requests a full name, but is neither a commitment nor an assignment. The relevant leader follows up and may approve ongoing service-area participation or one-time participation.

A person with a pending formal ministry-membership request may view that ministry's schedule but cannot volunteer, claim an opening, receive restricted instructions, or be assigned until the required leader approval and eligibility checks are complete. A general expression of interest alone does not grant ministry-schedule access.

Ministry leaders approve membership or service areas separately. APR is not one global yes/no approval: the APR Coordinator defines protected screening types and document requirements, then maps them to roles, task templates, or individual opportunities. Eligibility is computed from those requirements without revealing the underlying details.

- A new candidate cannot serve in an APR-required role until every required initial clearance is current.
- Pending APR requirements do not prevent participation in roles that do not require them.
- An overdue renewal does not automatically penalize or suspend an existing volunteer. Reminders continue to the APR Coordinator until renewal is recorded or the Coordinator manually marks the person ineligible.
- APR eligibility is a hard scheduling rule. No leader, scheduler, or administrator may override it.
- A leader attempting an ineligible assignment sees only: “This person is not currently eligible for this assignment. Contact the APR Coordinator for more information.”
- The contact action sends a private, auditable inquiry containing only the volunteer, ministry, proposed assignment, date, and requesting leader. The Coordinator may respond administratively without disclosing missing requirements.

## 10. Minors and households

### Minimum data

- No profile photos
- No home addresses
- Birth year only
- Minor status through the entire 18th-birthday year
- Automatic adult transition January 1 of the following year, with parent and administrator notice
- At least one linked guardian for a minor

### Guardians

- One primary guardian
- Additional guardians invited by the primary guardian
- Family chooses which guardians receive critical alerts
- Guardians see all minor assignments and system actions
- Parent manages permission settings; child cannot change them
- Parent can mark all or selected family members unavailable in one action

### Direct access

- Under 13: parent-managed profile only
- Ages 13–17: optional direct access after explicit parent attestation that the child is at least 13
- Parent chooses whether the child may sign in, receive email, connect Telegram, view schedule, volunteer, confirm, decline, or request substitutes
- The parent does not approve each assignment individually
- Critical cancellation, last-minute change, and unresolved substitution messages involving the child are mandatory to the guardian contacts selected by the family

No annual permission-review prompt is required. Parents can change or revoke permissions at any time.

### Archconfraternity of St. Stephen

Levels:

- Postulant
- Junior Acolyte
- Senior Acolyte
- Master of Ceremonies
- President

The system retains each level and its date. Dates may be unknown or year-only. Advancement is manual. Visibility is limited to the server, guardians, altar-server leaders, and main administrators.

## 11. Notifications and communication

### Channels

- Verified email is the only required field for a notification-only account and remains the fallback channel for volunteer and guardian accounts.
- Telegram is optional at the system level and recommended for current adult volunteers.
- SMS is postponed; notification design must permit it later.

### Notification subscriptions and engagement

The public calendar includes an optional “Get updates or volunteer” invitation. A person may subscribe independently to:

- Mass schedule changes;
- special services;
- chapel events;
- volunteer opportunities; or
- all chapel announcements.

Every category is opt-in, starts unchecked, and can be changed or unsubscribed later. A dismissible “Ways to participate” card remains available after registration. Eligible public events may link to the signup path using “Volunteer opportunities available,” but the public calendar never exposes the ministry, number of openings, positions, eligibility requirements, or names.

### Telegram

The Telegram volunteer alpha is accepted and frozen after clean end-to-end testing of five workflows: viewing confirmed and new assignments; confirming all or individually; reporting one-time conflicts and vacation ranges; requesting, tracking, and cancelling substitutes; and viewing and claiming open opportunities. Later changes require a demonstrated usability, safety, or correctness need.

- Existing usher group receives one daily opening summary.
- Urgent openings inside 48 hours post immediately.
- Private confirmations, schedules, absences, and personal details use direct bot conversations.
- The bot never asks for passwords.
- Natural-language absence entry repeats exact interpreted dates and requires confirmation.
- Sensitive records never appear in Telegram.

### Urgent messages

Inside 48 hours, urgent changes use both Telegram and email where available. Acknowledgment is required, and the leader is alerted if it is not received.

### Website coordination

Lightweight subscriptions and chapel-membership links must be coordinated with the webmaster before production so that Chapel Scheduler does not duplicate an account, notification, or membership process already being built for mylatinmass.com. Formal chapel membership remains separate from a Scheduler account; the initial implementation may link to an existing external process.

## 12. Priest and private-calendar design

### Privacy boundary

Each priest may have a private calendar. Full details are limited to that priest and delegates personally approved by the priest. Chapel administrators may request but cannot grant themselves access.

Outside that group, conflicts reveal only “unavailable.” Public Mass calendars may show the celebrant's name. Sick calls expose only unavailability; names, addresses, and notes remain restricted.

Private scheduling stores only the name and minimal notes such as “Pre-Cana.” Names and private notes are removed automatically one year after the appointment; a generic private-appointment history remains. Safeguarding case records must not be stored in calendar notes.

### Plain-language entry

Use a hybrid:

- Secure website assistant for private appointments
- Telegram bot for ordinary public services without confidential content

Private plain-language processing receives only date, time, duration, and generic category. Names, contacts, and confidential notes use separate protected fields and are never sent to an external AI provider. No administrator override permits confidential notes to be sent.

Every proposed entry displays title, date, time, duration, calendar, visibility, and conflicts before confirmation.

### Conflict overrides

Authorized assistants may override a conflict after entering a brief reason. The event takes effect immediately; Father and the backup main administrator are notified. Father approval is not required.

### Future priest coordination

- Priest accounts record administrator-maintained languages in which the priest has explicitly confirmed he can hear Confessions. These capabilities may be shown with public Confession times, but need not appear in private scheduling views; they are never inferred from nationality or general profile preferences.
- Priests or authorized delegates maintain availability
- Priest, delegate, chapel scheduler, or future priory scheduler may assign a celebrant
- Changes notify affected priests, delegates, and relevant ministry leaders
- Configured travel buffers between chapel locations prevent impossible schedules
- Conflicts can be overridden with reason and audit

### Ferial Mass selection

- Celebrant may enter the desired permitted Mass in plain language
- System suggests color and missal/setup details
- Celebrant confirms details before sacristan notification
- At 24 hours, remind the celebrant and tell the sacristan selection is pending
- Message explains the Ordo's Mass of the feria will be used by default
- At three hours, finalize the default and send definite instructions
- A later change becomes an urgent acknowledgment-required sacristan message

## 13. Security, privacy, retention, and resilience

### APR eligibility and document workflow

APR requirements are configurable rather than hard-coded. The APR Coordinator alone may define or change screening types and map them to roles, task templates, or particular opportunities. Leaders may request review but cannot alter eligibility requirements. Example screening types include standard background screening, DMV screening for a future driving duty, and social-media screening for catechists. No chapel-vehicle screening is active while the chapel has no vehicle.

Clearance is evaluated separately by screening type so a person may be eligible for one role and pending for another. The system stores only screening type, referral date, received status, eligibility result, review or expiration date, verifier, and audit metadata. District headquarters and its vendor remain responsible for collecting personal screening data; reports, vendor questionnaires, Social Security numbers, license details, and reasons for a result never enter Chapel Scheduler.

The APR Coordinator may create reusable, versioned document packets for roles such as adult altar server, minor altar server, catechist, or a future maintenance duty involving minors. Requirements are deduplicated by person and document version: one current document can satisfy several roles. Ordinary documents default to once-only or renewed when their version changes; periodic renewal belongs to specifically configured screening types. When a document changes, the Coordinator decides whether existing volunteers must complete the new version.

For the current Personnel Agreement and similar documents, the conservative workflow is:

1. Chapel Scheduler emails the original PDF through the approved channel.
2. The volunteer signs and returns it through the existing external process.
3. Only the APR Coordinator may mark it received.
4. Chapel Scheduler stores document version, sent date, due date, reminder history, received date, and recorder—not the signed file.

Automatic reminders may continue until completion. Ministry leaders see only cleared, pending, or not currently eligible; detailed workflow dates remain visible only to the APR Coordinator. Eligibility inquiries and responses have a Coordinator-configurable retention period because even their existence may imply protected information.

If the district later approves a true electronic acknowledgment, the system may store the document version, acknowledgment date, and person's name instead of a signed file. Until that approval is confirmed, a web checkbox is not treated as a replacement for the existing signature process.

### Authentication

- Ordinary accounts: single-use, expiring email sign-in link/code
- Privileged accounts: additional authenticator code on a new device or after approximately 30 days
- Recovery codes stored offline
- Controlled privileged-account recovery
- Telegram accounts linked only after verified web/email authentication

### Data minimization

Do not store:

- Full birth dates
- Home addresses
- Background-check reports
- Signed APR agreements unless a later approved policy explicitly authorizes their storage
- Screening-vendor links, questionnaire answers, Social Security numbers, driver-license data, and reasons for screening results
- Profile photos
- APR case records
- Sensitive pastoral details in AI prompts

### Retention

| Data | Retention |
|---|---|
| Named assignment history | 3 years, then anonymize |
| Security audit log | 7 years |
| Private appointment name and notes | 1 year after appointment, then strip |
| Generic cancelled/completed event history | Retained under chapel calendar policy |
| APR screening metadata | Current requirement, referral/receipt/result, review or expiration date, and verifier; no reports or reasons |
| APR document workflow | Version, sent/due/reminder/received metadata under configurable APR retention; no signed copy by default |
| APR eligibility inquiry | Coordinator-configurable period, then delete |
| Declined/unanswered ceremonial invitation | 1 year, then delete |
| Accepted ceremonial assignment | Follows named assignment history |
| Deactivated account | Access disabled immediately; assignment history follows 3-year rule |

Retention jobs must also account for backups; expired sensitive records should age out of backup retention rather than remain indefinitely.

### Audit

Record who changed what and when for:

- privileged roles;
- APR screening types, document packets, requirements, eligibility status, and receipt records;
- minor and guardian permissions;
- private-calendar access;
- scheduling overrides;
- liturgical rules;
- assignments and cancellations;
- one-time volunteer approvals and invitation-only ceremonial responses;
- exports.

Do not duplicate confidential note contents in the audit log.

### Availability and recovery

- Production services, not pausing free tiers
- HTTPS and encrypted storage/transport
- Daily automated backups
- Target recovery point: prior night's backup, accepting up to one day of data loss initially
- Restore procedure tested before launch and periodically thereafter
- Weekly printable emergency schedule emailed to each ministry leader
- Monitoring for application, job, email, Telegram, and Ordo-import failures

### Ownership and portability

Domain, hosting, database, email, source repository, and integration accounts belong to the chapel, not an individual. Main administrators can export chapel-owned calendar, ministry, assignment, configuration, and membership data in standard formats. Sensitive exports require elevated permission and audit.

## 14. External integrations

### mylatinmass.com

Target: `schedule.mylatinmass.com` using the site's visual style.

The public website should eventually consume all public events from a read-only API or feed. Implementation waits for a webmaster conversation about the current platform, domain/DNS, mail domain, existing subscriptions, and deployment preferences.

### 1962ordo.today

Preferred source, initially through a defensive importer if no supported feed exists. Contact the maintainer about an API/feed, permission, update timing, attribution, rate limits, and future stability.

### fsspx.today

No public integration interface was discovered. Treat as future work. Ask the maintainer whether a chapel can push schedules by API or import. Provide a manual export fallback if necessary.

### Google Calendar

- Import future events only
- Regular service recurrence should be regenerated from Chapel Scheduler rules rather than perpetuating Google recurrence
- Run a four-week comparison
- Convert old shared calendars to read-only archives
- Do not delete them during migration
- New Google/Apple use is primarily private subscription feeds, not two-way authority

### Priory priest-assignment Google Sheet

The priory's Google Sheet may remain the authoritative source for the basic combination of weekend, chapel, and assigned priest. A defensive importer supports either read-only automation, if cooperation and access are available, or periodic administrator-uploaded CSV files.

- Import only Davie and West Palm Beach rows initially.
- Carry each block date to its chapel rows and infer missing years only through validated chronological sequence.
- Normalize harmless name variations and whitespace without silently merging different priests.
- Stage every import for review, showing new, changed, removed, ambiguous, and conflicting assignments before applying it.
- Preserve the original upload and import audit history.
- Never overwrite local service details or confirmed manual corrections blindly.
- Never publish spreadsheet notes automatically; notes may contain travel, vacation, retreat, or contradictory assignment information.
- Map the weekend priest assignment to local services only through chapel-approved rules.

The supplied CSV is usable but human-formatted: dates occur once per block, years are omitted, its filename and internal title do not reliably describe the full range, and notes sometimes modify the priest column. Manual CSV upload is therefore an acceptable Phase 1 fallback, not a throwaway implementation.

### Email and SMS

Use a transactional email provider and a chapel-domain sender if the webmaster can configure DNS authentication. SMS is a later option requiring a dedicated chapel number, carrier registration, consent, opt-out processing, delivery handling, and ongoing cost. Do not automate through a personal phone number.

## 15. Recommended logical components

This is a logical architecture, not a commitment to a programming framework.

1. Responsive web application/PWA
2. Secure application API
3. Relational database with chapel-level ownership on every relevant record
4. Background job scheduler for rolling schedules, reminders, retention, imports, and backups
5. Notification service with channel adapters for email, Telegram, and later SMS
6. Scheduling engine with deterministic constraints and auditable scoring
7. Calendar/rule engine with Ordo adapter and local-rule layer
8. Private calendar permission boundary
9. Volunteer opportunity service for recurring shifts, tasks, one-time approvals, and invitation-only positions
10. APR eligibility service for screening types, document packets, hard assignment constraints, and restricted inquiries
11. Document storage and search, added post-pilot; protected APR document metadata remains separated
12. Public read-only API/feed for website and external integrations
13. Audit and monitoring pipeline

The plain-language assistant proposes structured commands; it does not directly write calendar data. Normal validation, permissions, conflict checks, and explicit confirmation occur before any write.

## 16. Screen sketches

### Public calendar engagement

```text
+--------------------------------------------------+
| Chapel public calendar                           |
| Sunday 9:00 a.m. Low Mass                        |
| Confessions 8:30 a.m. | Rosary 8:30 a.m.         |
| Volunteer opportunities available ->             |
+--------------------------------------------------+
| Get the updates you choose or find a way to help |
| [Get updates or volunteer]                       |
+--------------------------------------------------+
```

The opportunity link reveals no ministry, count, position, invitee, or eligibility information. The calendar remains usable without an account.

### Lightweight registration

```text
Verify email
    |
    +--> Choose notification categories (all unchecked)
    |
    +--> Optional ways to help
    |      Liturgical | League | Maintenance | Events
    |      Name requested only after interest
    |
    +--> Optional Telegram link
    |
    +--> Separate chapel-membership information link
```

### Volunteer phone calendar

```text
+--------------------------------------------------+
| Chapel Scheduler                       [Profile] |
| July 2026                      [Month Week Day]   |
+--------------------------------------------------+
| Sun     Mon     Tue     Wed     Thu     Fri Sat  |
|                         1       2       3    4    |
| 5       6       7       8       9      10   11   |
| 12     [13]     14      15      16      17   18   |
| 7am My assignment                                |
| 9am 1 opening                                    |
| 11am Confirmed: Ac2                              |
| 5pm Fully staffed                                |
+--------------------------------------------------+
| [My schedule] [Openings] [Availability] [Help]   |
+--------------------------------------------------+
```

### Service detail

```text
Sunday, September 6 - 11:00 a.m. Sung Mass
XV Sunday after Pentecost

My assignment
  Altar Servers: Ac2             CONFIRMED

Open opportunities
  Ushers: 1 opening              [Volunteer]

Visible ministry roster
  Altar Servers: MC, Th, Cb, Ac1, Ac2, Tb1, Tb2

[Instructions] [Add to calendar] [Need a substitute]
```

### Leader draft review

```text
+--------------------------------------------------+
| Altar Servers - Draft schedule                   |
| Sep 1 - Oct 31              [Publish] [Print]    |
+--------------------------------------------------+
| Sep 6 11:00 Sung Mass                            |
| MC   John A.        Regular   balanced           |
| Th   Peter B.       Regular   preferred          |
| Cb   Mark C.        Backup    REVIEW             |
| Ac1  ...                                         |
| Shortages: Tb pair                               |
| [Change positions] [Suggest candidates]          |
+--------------------------------------------------+
```

### Private scheduling assistant

```text
Enter a private appointment without names or notes:

> Pre-Cana next Tuesday at 6:30 for one hour

Proposed entry
  Tuesday, September 8, 2026
  6:30-7:30 p.m. America/New_York
  Calendar: Father's private calendar
  Public visibility: Father unavailable
  Conflict: none

Private name: [________________]
Private note: [________________]

[Confirm] [Edit] [Cancel]
```

## 17. Primary workflow diagrams

### Registration, subscriptions, and interest

```text
Public calendar (no account required)
    |
    v
Optional verified-email account
    |
    +--> Explicit notification opt-ins
    |
    +--> Optional Telegram linking
    |
    +--> Optional chapel-membership information link
    |
    +--> Express volunteer interest
              |
              v
          Request name
              |
              v
        Leader follows up
          /             \
 one-time approval   ongoing service-area approval
          \             /
              v
        APR eligibility check if required
              |
              v
           Assignment
```

### APR eligibility

```text
APR Coordinator defines screening types + documents
                         |
                         v
              Maps requirements to role/task
                         |
                         v
Candidate referred externally -> district/vendor process
                         |
                         v
Coordinator records metadata only; no report or reason
                         |
          +--------------+--------------+
          |                             |
     Initial pending               Renewal overdue
          |                             |
 assignment blocked              remains eligible
          |                     Coordinator reminded
          v
 all required types cleared
          |
          v
 assignment allowed by hard rule
```

### General volunteer opportunity

```text
Approved template -> leader publishes shift/task
                         |
                         v
All signed-in accounts see general opportunity
                         |
            +------------+------------+
            |                         |
 approved member claims       new person is interested
            |                         |
            |                leader approves once/ongoing
            +------------+------------+
                         |
                  eligibility check
                         |
                  assignment + history
```

### Calendar to assignment

```text
Ordo import + recurring rules + manual events
                    |
                    v
         Main administrator review
                    |
                    v
           Approved master calendar
                    |
                    v
      Ministry staffing needs generated
                    |
                    v
        Draft automatic assignments
                    |
                    v
          Ministry leader review
                    |
                    v
           Publish and confirm
                    |
                    v
 Remind -> substitute -> escalate -> history
```

## 18. Open decisions and validation items

These are not blockers to approving the architecture, but must be resolved before the relevant feature is built.

- Confirm the exact First Sunday of Advent 2026 rollout date and internal milestone calendar.
- Verify all altar-server staffing templates with the altar-server leader.
- Identify the Schola SME; document Schola participation, music-selection, availability, staffing, notification, and exception workflows; then decide whether a focused Schola capability belongs in the initial Scheduling release. Evaluate the webmaster's existing Schola components for reuse only after the workflow is defined.
- Identify Hospitality/Events, facilities, venue, food, fundraising, setup, and cleanup SMEs before designing banquets, potlucks, Confirmation receptions, major-feast events, or the annual fundraising gala.
- Confirm St. Philomena Foundation Mass precedence behavior.
- Build the annual local-service rule list over time.
- Identify the 1962 Ordo maintainer and supported-use terms.
- Determine whether fsspx.today supports API/import updates.
- Identify the mylatinmass.com platform, hosting, DNS, and email-domain capabilities.
- Determine whether mylatinmass.com already provides notification accounts or a formal chapel-membership process and configure links rather than duplicate them.
- Determine how the webmaster wants deployments, monitoring, and support handed off.
- Confirm League, Maintenance, and Events leaders, service areas, normal work windows, and initial opportunity templates before those ministries launch.
- Confirm each APR screening type, the roles/tasks that require it, screening level, renewal interval, and document packet with the APR Coordinator and district policy. The possible three-year background-screening cycle remains unconfirmed.
- Confirm whether the district will ever accept electronic Personnel Agreement acknowledgment; until then use external signature and status-only tracking.
- Confirm the chapel's formal privacy notice, minors policy, APR policy, and retention policy with appropriate counsel before minors or expanded APR workflows launch.
- Determine whether the priory priest-assignment Sheet can be read automatically; retain reviewed CSV upload as the fallback.
- Select the production technical stack only after webmaster review.
- Confirm final monthly budget after vendor selection; provisional ceiling is $75/month, excluding development and maintenance labor.

## 19. Explicit non-goals for the first pilot

- Replacing all parish/chapel administrative software
- Storing sacramental, catechism, APR case, or background-check records
- Building a native iOS or Android app
- Production Telegram automation unless the email-based alpha is stable ahead of plan
- SMS automation
- AI-generated liturgical decisions without human confirmation
- Full multi-chapel administration UI
- Public RSVP/event registration
- Lightweight public notification accounts and formal chapel-membership enrollment
- League, Maintenance, and Events production scheduling
- Advanced APR document packets and screening workflow
- Invitation-only ceremonial staffing
- Two-way Google Calendar synchronization
- Equipment inventory and reservation
- Mandatory attendance check-in
