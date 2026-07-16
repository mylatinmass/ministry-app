# Workflow: Schedule a Funeral

**Status:** Approved for stakeholder review

## Purpose

Coordinate a funeral from compassionate first contact through calendar confirmation, liturgical planning, ministry preparation, family verification, public authorization, and cancellation. Information is captured once in an authoritative case and routed to each role without relying on verbal relay.

## Actors

Family contact; Father; Father's Assistant; Ceremony Coordinator; celebrant; sacristan, server, usher, and schola leaders and assigned ministers; Main Chapel Administrator; public subscribers.

## Trigger

A family contacts the chapel following a death and requests a funeral or related rites.

## Preconditions

- An authorized person can create a restricted funeral case and contact record.
- Chapel and priest conflicts are available.
- Father or a delegate can approve the date.
- A Ceremony Coordinator and ministry leaders are configured.

## Main Success Scenario

1. The assistant begins **Compassionate First Contact**.
2. Only proposed date, time, location, case type, and restricted family contact are required initially.
3. The assistant may save and stop; detailed questions do not appear as errors.
4. The system checks conflicts and places a restricted tentative hold.
5. A conflicting request may be retained but cannot be confirmed until resolved.
6. The assistant may set an optional one-tap follow-up reminder.
7. Leaders receive a restricted tentative heads-up with operational facts only.
8. Leaders may review suggested recipients or immediately send clearly tentative availability requests to qualified volunteers.
9. Father approves the date directly or through a delegate recording verbal approval.
10. The case becomes **Confirmed—details pending** and leaders receive a concise notice.
11. The assistant completes the family conversation guide over one or more contacts.
12. The Ceremony Coordinator creates the internal liturgical plan using templates.
13. The plan progresses through Draft, Proposed for Father's review, and Confirmed by Father.
14. Ministry staffing and preparation requirements are generated.
15. Unchanged tentative assignments become confirmed automatically; material changes follow the applicable review rules.
16. The assistant reviews and sends a warm family summary.
17. The system separately tracks **Family details verified** and **Chapel plan approved**.
18. Readiness for liturgy, sacristy, servers, ushers, and schola shows Ready, Waiting for details, or Needs attention.
19. Only explicitly authorized public information is published.

## Family Conversation Guide

Family-facing questions are limited to matters the family can reasonably answer: dates, locations, body present, viewing, Rosary, Rosary leader source, burial, related activities, contact preference, and publication permissions. The guide supports save/resume, Unknown/TBD, conditional questions, automatic saving, phone-first use, and continuation across devices.

## Internal Liturgical Planning

The Ceremony Coordinator manages the internal plan, not the assistant. Initial components include Viewing, Rosary, Reception of the Body, Requiem Mass, Absolution at the coffin, Absolution at the catafalque, procession to burial, burial service, and Other/TBD. The system may suggest applicable rites but does not decide them.

Father confirms the controlling plan. The Coordinator may apply standard templates and record Father's verbal decisions.

## Rosary, Viewing, and Schola Rules

- Rosary defaults to thirty minutes before the funeral.
- If OLV leads it, create a Lead Rosary usher duty; if the funeral party leads, the name is optional and no OLV duty is created.
- When viewing and Rosary both occur, suggest viewing 60–30 minutes before and Rosary 30–0 minutes before.
- When the body is present, the plan may request the *Subvenite*; if schola is unavailable, Father decides.

## Staffing Rules

- Low Requiem without body or catafalque: one server required, second optional.
- Low Requiem with body or catafalque: prefer MC, thurifer, Ac1, Ac2, and cross bearer; one acolyte is the minimum.
- Sung Requiem: MC, thurifer, Ac1, Ac2, cross bearer, and schola are required unless Father authorizes an exception.
- Availability is not an assignment.
- At Proposed status, leaders may create tentative assignments.
- Unchanged tentative assignments become confirmed automatically.
- Date or time changes require volunteer reconfirmation.
- Form or position changes require leader review.

## Cross-Ministry Communication

Ministry leaders may use **Record Father's Direction** to capture a verbal operational instruction, including instructions affecting other ministries. Plain-language input may propose structured changes, but the leader must review them before saving. Every update records source, wording, author, time, and resulting changes; the assistant and affected ministries are notified.

Conflicting reports remain visible and produce an unresolved conflict. Father, his assistant, or the Ceremony Coordinator identifies the controlling direction. No report is silently overwritten.

## Family Confirmation

The assistant reviews and sends an editable, warm email or text containing family-facing facts only. A restricted correspondence capability may classify a reply as confirmed, change requested, question, or unclear. An unambiguous confirmation may set Family verified. Any requested change requires human review.

## Public and Off-Site Activities

Off-site viewing and burial remain restricted by default and do not reserve the chapel or create staffing automatically. They may be published with separate family permission for event details and the deceased's name plus authorized staff publication. Withdrawing permission removes the public listing while preserving the restricted case and audit history; subscribers receive a neutral notice.

## Cancellation

Father, Father's Assistant, or the Ceremony Coordinator may cancel. A reason is optional and restricted. Leaders may see it; volunteers and public subscribers receive a neutral notice. History is retained.

## Exception Handling

- Conflict: hold allowed; confirmation blocked.
- Incomplete details: date may remain confirmed with details pending.
- No ministry acknowledgment: escalate through leaders and authorized coordinators.
- Contradictory verbal direction: flag and resolve explicitly.
- Public permission withdrawn: remove public information immediately.

## Permissions

- Father's Assistant manages the family-facing case and may record verbal approval.
- The single ongoing Ceremony Coordinator has full restricted case access and manages liturgical planning.
- Ministry leaders see operational facts, manage staffing, and may record verbal direction; they do not see family contact information.
- Platform administration does not confer pastoral or ceremony authority.

## Notifications

Sacristan and server leaders are always notified after confirmation. Ushers and schola are notified conditionally. Tentative heads-ups omit names and private details. Material changes use a one-click Save and notify preview. Preferred and backup delivery channels are used according to urgency and delivery status.

## Business Rules

- Funeral is an operational case; Requiem Mass and other rites are linked liturgical events.
- Family and internal liturgical questions remain separate.
- Date confirmation may precede completion of details.
- Technical ownership is distinct from operational authority.
- Complex rules remain behind simple, role-specific steps.
- Contact data is a separately permissioned record, provisionally deleted one year after the ceremony.
- Restricted records use light-touch reauthentication after a provisional thirty-minute inactivity period.

## Acceptance Criteria

- The assistant can place a hold after a brief compassionate first contact.
- Information can be saved, resumed, and used comfortably on a phone.
- Date, family, liturgical plan, readiness, staffing, public permission, communication, and cancellation statuses remain distinct and auditable.
- Every affected role receives the information it needs without private details.
- Verbal and conflicting directions are captured and resolved safely.
- Family verification remains warm and human-led.

## Open Questions

Validate exact rite names and checklists; server qualifications; correspondence integration; one-year retention; thirty-minute reauthentication; Solemn Requiem support; whether family verification may be waived for extreme short notice.

## Potential Existing Capabilities to Reuse

Calendar conflicts; staffing templates; Telegram/email connectors; Ordo data; roles; audit history; plain-language event entry; notification acknowledgment and escalation.

