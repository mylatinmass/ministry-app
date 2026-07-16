# Generate and Maintain the Regular Service Calendar

Status: Approved by Product Owner on July 16, 2026  
Module: Scheduling  
Platform: OLV Operations Platform

## Purpose

Maintain one reliable chapel calendar derived from the 1962 liturgical calendar, OLV's recurring schedule, approved chapel customs, priest coverage, and authorized exceptions. The workflow must let people look far ahead for liturgical reference while limiting operational scheduling and staffing to a rolling two-month horizon.

## Actors

- **Main Chapel Administrator** — owns the recurring operational schedule, locations, times, additions, cancellations, publication, and facility reservations.
- **Ceremony Coordinator** — owns liturgical representation, ceremony templates, preparation requirements, and ministry implications.
- **Father or authorized delegate** — final authority for liturgical decisions, including exceptions and alternate timing of blessings.
- **Father's Assistant** — may record priest assignments, added Masses, and decisions communicated by Father.
- **Ministry Leaders** — receive relevant service changes and manage staffing generated from services.
- **Sacristans and Altar Servers** — view detailed liturgical preparation information.
- **Volunteers and authenticated chapel members** — view services and authorized ministry information according to role.
- **Public visitors** — view public service times and public liturgical information only.
- **External Liturgical Calendar Source** — supplies 1962 Ordo data used as reference and input.
- **Priory Priest-Assignment Source** — supplies helpful but nonessential celebrant assignments.

One person may hold several roles, but the permissions remain logically separate.

## Trigger

The workflow runs when:

- the nightly process extends the rolling operational horizon by one day;
- new or corrected Ordo information becomes available;
- an administrator changes a recurring service rule;
- an authorized person adds, changes, or cancels a service;
- a priest assignment or availability change is received; or
- an annual chapel-specific rule becomes applicable.

## Preconditions

- The chapel has an active configuration and timezone.
- The recurring service rules and effective dates are defined.
- The latest available Ordo information has been retained.
- Roles and permissions are assigned.
- Annual templates approved for automatic publication are active.
- Draft-only blessing templates are identifiable.

## Main Success Scenario

1. The system obtains or reuses the latest available 1962 Ordo data.
2. It makes the liturgical reference calendar available as far ahead as the source provides data.
3. It maintains a rolling two-month operational calendar, adding one new operational day nightly.
4. It applies OLV's effective-dated recurring service rules to that new day.
5. It applies liturgical precedence, chapel-specific observances, seasonal rules, and annual templates.
6. It associates known celebrant assignments without requiring a celebrant in order to schedule a Mass.
7. It detects conflicts, missing inputs, rubrical questions, and draft-only blessings.
8. It automatically publishes ordinary services and approved fixed annual services.
9. It holds draft-only blessings for review based on priest availability.
10. It generates or updates ministry staffing requirements from the resulting services.
11. It sends role-appropriate notices to affected leaders and volunteers.
12. It preserves the service, rule source, publication state, and change history for audit and future review.

## Calendar Horizons and Visibility

### Liturgical Reference Calendar

The reference calendar is viewable as far ahead as Ordo data is available. Public information may include:

- feast or feria;
- class;
- liturgical color; and
- commemorations.

Detailed Mass information such as Gloria, Credo, preface, and permitted Mass options is restricted to authenticated sacristans, altar servers, their leaders, the Ceremony Coordinator, administrators, and clergy.

### Operational Chapel Calendar

Actual chapel services, resources, assignments, and staffing are generated only within the rolling two-month horizon. Public visitors see services but never volunteer names, staffing requirements, private notes, or restricted events.

## Ordinary Recurring Schedule

### Sunday

- 7:00 a.m. Mass
- 9:00 a.m. Mass
- 11:00 a.m. Mass, normally Sung except during the summer rule
- 5:00 p.m. Mass
- Confessions and Rosary begin 30 minutes before each Mass and are informational rather than staffed events.

### Weekday and Saturday

- Monday, 7:15 a.m. Mass
- Friday, 6:30 p.m. Mass
- Saturday, 9:00 a.m. Mass
- Confessions and Rosary begin one hour before each Mass and are informational rather than staffed events.

## Recurring and Seasonal Rules

### SSPX Proper Calendar and First-Class Feasts

- The liturgical source must include the SSPX proper calendar rather than only the general 1960 calendar.
- SSPX-specific first-class feasts include, at minimum, Our Lady of Compassion on Friday of Passion Week and St. Pius X on September 3.
- When an SSPX first-class feast occurs on a day with a scheduled OLV Mass, the Mass defaults to Sung.
- The system applies the rubrics governing eligibility, precedence, and timing of an External Solemnity and flags any uncertainty for Father and the Ceremony Coordinator.
- Father or his authorized delegate retains final authority to confirm or change the form and observance.

### First Friday and First Saturday

- First Saturday governs the overnight-adoration pattern; First Friday alone does not.
- On the Friday preceding First Saturday:
  - 6:30 p.m. Mass;
  - 7:00 p.m. Exposition;
  - 7:30 p.m.–7:30 a.m. all-night Adoration.
- On First Saturday:
  - 8:00–9:00 a.m. First Saturday Devotions and Benediction;
  - 9:00 a.m. Mass.
- First Friday devotions occur when permitted. The preferred Mass is the Sacred Heart when rubrics permit.
- The preferred First Saturday Mass is the Immaculate Heart when rubrics permit.
- A rubrical impediment produces an advisory for Father and the Ceremony Coordinator; the system does not make the final liturgical decision.

### Summer Schedule

- The summer schedule begins on the Sunday after the External Solemnity of Saints Peter and Paul.
- The Sunday 11:00 a.m. Mass becomes Low during the summer period.
- The Assumption on August 15 is always Sung.
- Sundays after August 15 return to the normal Sung 11:00 a.m. Mass.
- Liturgical precedence governs when the Assumption falls on Sunday.

### Holy Days of Obligation

- Weekday: 7:00 a.m. Low Mass and 7:00 p.m. Sung Mass.
- Saturday: one Sung Mass at 9:00 a.m.
- Sunday: normal Sunday times, with the 11:00 a.m. Mass Sung.
- Christmas replaces the ordinary schedule regardless of weekday:
  - 12:00 a.m. Sung Mass;
  - 9:00 a.m. Low Mass;
  - 11:00 a.m. Low Mass.
- Confessions and Rosary use the applicable normal timing rule.

## Holy Week and Easter Templates

- **Palm Sunday, 11:00 a.m.** — distribution of palms and procession precede Mass; the published start remains 11:00 a.m.
- **Holy Thursday, 7:00 p.m.** — Mass.
- **Holy Thursday, 8:30 p.m.–12:00 a.m.** — Adoration.
- **Good Friday, 1:45 p.m.** — Rosary, staffed independently through the usher ministry.
- **Good Friday, 2:15 p.m.** — Solemn Stations of the Cross, staffed independently with Cross Bearer, Acolyte 1, and Acolyte 2; no sacristan assignment is required.
- **Good Friday, 3:00 p.m.** — Solemn Liturgy, staffed independently.
- **Easter Vigil** — one combined assignment covering the Vigil and midnight Mass:
  - begins 10:00 p.m. when baptisms are included;
  - begins 10:30 p.m. when no baptisms are included;
  - Mass begins at 12:00 a.m.
- **Easter Sunday** — Low Masses at 9:00 and 11:00 a.m., with normal Sunday Confessions and Rosary.
- Tenebrae is not currently generated but may be added as a future annual template.

## Other Annual Rules

### Ashes

- OLV currently has no automatic Ash Wednesday Mass because it does not have a resident priest.
- Distribution of ashes occurs after every Mass on the following Sunday without changing Mass start times.
- This chapel configuration must be changeable if resident-priest coverage is established.

### Corpus Christi and Christ the King

- No Thursday Corpus Christi service is generated under current OLV practice.
- The External Solemnity of Corpus Christi is celebrated at the following Sunday 11:00 a.m. Sung Mass, with procession afterward.
- Christ the King includes a procession after the 11:00 a.m. Sung Mass.
- Each is one combined service for scheduling and workload purposes.

### Chapel Patronal and Foundation Observances

- St. Philomena Foundation Masses:
  - January 10 — birthday;
  - May 25 — finding of her relics;
  - August 10 — martyrdom and translation of her body;
  - August 11 — patronal feast.
- The January 10 Foundation Mass is celebrated on January 10 and is not transferred. It defaults to Low Mass unless January 10 falls on Sunday.
- When January 10 is not Sunday, an additional External Solemnity of St. Philomena, with procession, is celebrated on an eligible Sunday under the rubrics for the External Solemnity of a chapel patroness and uses the 11:00 a.m. Sung Mass.
- When January 10 itself is Sunday, the dated Foundation Mass is celebrated directly as the patronal feast rather than being labeled an External Solemnity. It is Sung at 11:00 a.m. with the procession afterward. Precedence issues are flagged for Father and the Ceremony Coordinator.
- The first Sunday in May includes the Crowning of Our Lady and procession after the 11:00 a.m. Sung Mass.
- Our Lady of Victory is observed on the first Sunday in October with procession after the 11:00 a.m. Sung Mass.
- Previously defined patronal-feast precedence and review rules remain applicable.

### Procession Invitations and Banner Positions

- For every procession, the Holy Name Society President invites four men.
- Corpus Christi and Christ the King use four Canopy Bearers.
- Marian and St. Philomena processions use four Bier Bearers.
- Invitees may differ between processions.
- Banner Bearers are event-volunteer roles coordinated and approved by the Holy Name Society President; they do not require usher or altar-server membership.
- Normal procession banner positions:
  - Holy Name Society banner — 2;
  - Cor Unum banner — 1;
  - OLV banner — 1;
  - Lepanto banner — 1;
  - Sacred Heart banner — 1;
  - Christ the King banner — 1.
- Corpus Christi and Christ the King omit the OLV banner because they are Blessed Sacrament processions.
- Holy Thursday Mandatum requires twelve invitation-only Apostles selected by the Holy Name Society President.
- An Apostle may not also be an altar server. He may also be the sacristan. He may continue as an usher if the usher ministry leader approves the dual assignment.

### Candlemas

- The full February 2 rite comprises blessing, distribution, procession, and Mass.
- Saturday observance begins at 9:00 a.m.
- Sunday observance begins at 11:00 a.m.
- On a weekday, the system creates a review item recommending the full rite and lets Father decide whether it can be celebrated; it does not silently reduce the rite to a blessing alone.

### Blessing of Throats

- The Blessing of Throats occurs on February 3 when a weekday Mass is available.
- It also occurs after every Mass on the following Sunday.
- If February 3 is Saturday, it occurs after the 9:00 a.m. Mass and after all Sunday Masses the next day.
- If February 3 is Sunday, it occurs after that day's Masses only.

### Epiphany Blessings

- OLV currently uses only Epiphany water and chalk.
- January 5 Epiphany water is a separate liturgical event, not part of Mass.
- January 6 chalk blessing is a separate liturgical event.
- Fixed versus ad-libitum scheduling and exact times remain stakeholder decisions.
- If no priest is present on the proper date, the system preserves the proper date and may suggest the nearest priest-covered Mass. Father must authorize alternate timing; the system does not describe the rite as rubrically transferred.

### St. John Wine

- The Blessing of Wine is a separate event after Mass on December 27.
- If no Mass is scheduled that day, the system preserves the proper date, suggests the nearest priest-covered Mass, and requires Father's authorization for alternate timing.

### St. Michael Blessing of Arms

- The Blessing of Arms occurs discreetly in the sacristy after Mass on September 29 or on the following Saturday, depending on priest availability.
- It is visible only to Father, his assistant, the Ceremony Coordinator, administrators, and sacristans.

### Additional Blessings

- Other traditional annual blessings are not generated until stakeholders approve them.
- Candidate blessings are included in stakeholder review and may be added later as configurable templates.

## Priest Coverage and Celebrants

- Current mission-chapel coverage normally has a priest travel from Sanford on Friday and return after Monday Mass.
- Extended stays may produce additional midweek Masses entered by an authorized person.
- A future priory configuration may establish resident priests and daily Mass templates.
- A regular Mass remains scheduled even when no celebrant assignment has been received.
- Missing celebrant information creates a warning but never cancels or blocks the Mass.
- When known, the celebrant is shown according to approved visibility and helps sacristans prepare vestment sizes, chalice linens, and other preferences.
- Impossible priest travel or overlapping assignments are flagged for review under the priest-scheduling workflow.

## Alternate Flows

### Change a recurring rule

1. The Main Chapel Administrator selects an effective date.
2. The administrator chooses this event only or this and future events where applicable.
3. The system previews affected future services and ministry staffing.
4. The administrator confirms the change.
5. Historical services remain unchanged.

### Add an exceptional Mass or service

An authorized person creates the event, records the source of the instruction when acting for Father, and supplies the minimum information available. The system applies permissions, staffing templates, resource checks, and notices.

### Cancel a published service

The service remains visible as Cancelled until its scheduled time passes. Assignments and history are preserved, and affected people receive neutral cancellation notices.

### Ordo correction

- Unpublished drafts update automatically.
- Published services are not silently rewritten; affected items are flagged for review with an explanation of the source change.

## Exception Handling

- **Ordo unavailable:** use the last successful data, alert the Main Chapel Administrator and Ceremony Coordinator, and make no destructive changes.
- **SSPX proper-calendar discrepancy:** retain the last verified SSPX rank, alert the Ceremony Coordinator, and do not silently publish the conflicting imported rank.
- **Rubrical ambiguity:** show the source information and request a decision from Father or his delegate.
- **Missing priest assignment:** retain the Mass and show a warning.
- **Conflicting priest assignment:** retain the service but escalate the conflict through priest scheduling.
- **Resource conflict:** allow a request or draft to exist, but do not finalize the conflicting reservation until resolved.
- **Late change:** update immediately, preserve the audit trail, and notify affected roles through their preferred and backup channels as urgency requires.
- **Duplicate source event:** prevent duplicate operational services or flag them for review rather than silently merging uncertain records.

## Permissions

- Main Chapel Administrators may create, change, cancel, and publish operational services and recurring schedule rules.
- Ceremony Coordinators may manage liturgical templates, ceremony details, preparation implications, and ministry requirements.
- Father or his delegate may approve liturgical exceptions and alternate timing.
- Father's Assistant may record authorized decisions and priest assignments.
- Ministry Leaders may view all service information needed by their ministries but not unrelated private details.
- Sacristans and altar servers may view detailed liturgical preparation data.
- Public users see only approved public services and public liturgical reference data.
- Restricted events and notes never reveal their existence to unauthorized public users when even the event's existence is private.

## Notifications

- Ministry leaders receive heads-up notices for newly published special services and material changes.
- Assigned volunteers receive role-appropriate assignment, change, cancellation, confirmation, and substitution notices under the common notification rules.
- Father and the Ceremony Coordinator receive rubrical and alternate-timing review requests.
- The Main Chapel Administrator receives source failures, generation failures, duplicates, and unresolved resource conflicts.
- Sacristans receive celebrant changes and liturgical-preparation changes.
- Public subscribers receive neutral notices only for public schedule changes; private reasons are excluded.

## Business Rules

- The Ordo is the preferred liturgical source even though the connector may be fragile.
- The system advises on rubrics but never presents itself as replacing Father's liturgical judgment.
- Published services are not silently changed by source updates.
- All recurring rules and templates are effective-dated and historically preserved.
- Fixed annual services may publish automatically.
- Blessings affected by priest availability remain drafts until authorized.
- Public visibility, ministry visibility, and restricted visibility are independent attributes.
- Service generation and staffing generation are related but distinct operations.
- The Human-Centered Ministry Principle governs automation: repetitive administration is automated while meaningful ministry roles, judgment, and participation are preserved.

## Acceptance Criteria

- Users can view public Ordo reference information beyond the operational scheduling horizon.
- Detailed liturgical information is visible only to authorized roles.
- The system always maintains a rolling two-month operational horizon without month-end scheduling rushes.
- Ordinary weekly services generate at the correct times with the correct Confessions and Rosary information.
- First Friday, First Saturday, summer, Holy Day, Christmas, Holy Week, Easter, procession, Foundation Mass, and approved blessing rules generate as specified.
- SSPX proper-calendar feasts are retained with their SSPX ranks; first-class feasts default to Sung and receive the applicable External Solemnity review.
- The Easter Vigil is one combined assignment; Good Friday events are linked but independently staffed.
- Missing priest assignments warn without removing Masses.
- Fixed annual services publish automatically; priest-dependent blessings remain drafts.
- Changes preserve history and notify affected roles.
- Ordo outages never delete or corrupt published services.
- Public users cannot infer private staffing, appointments, restricted blessings, or confidential notes.
- Authorized administrators can add new effective-dated rules as OLV practice evolves.

## Open Questions

- Stakeholder confirmation of whether Epiphany water and chalk are fixed annual events or ad-libitum events, and their exact times.
- Stakeholder inventory of other traditional annual blessings currently practiced at OLV.
- Final review of external-solemnity and precedence rules with Father.
- Complete staffing templates for Holy Week, processions, blessings, and other ceremonies belong in their ministry and ceremony workflows.
- Priory-mode daily Mass and multi-priest mission scheduling require a separate workflow.
- Conduct Monthly Operations Review requires a separate governance workflow and specification.

## Potential Existing Capabilities to Reuse

- Existing 1962 Ordo reader or connector
- Existing `fsspx.today` reader or calendar feed
- Priory Google Sheet or CSV reader for priest assignments
- Existing calendar display components
- Existing messaging and notification components
- Existing chapel website design system

Reuse is evaluated only after this required behavior is accepted. Existing components may be adapted or replaced if they cannot preserve the workflow, permissions, terminology, privacy boundaries, or historical integrity.
