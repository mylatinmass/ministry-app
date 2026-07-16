# Workflow: Select a Requiem Mass for a Scheduled Mass

**Status:** Approved for stakeholder review

## Purpose

Allow a priest or Father's Assistant to designate an existing scheduled Mass as a Requiem quickly, including at short notice, so sacristans, servers, and the schola can prepare correctly. This is not a funeral case and does not store donor, offering, deceased-person, or intention details.

## Actors

Celebrant; Father's Assistant; assigned sacristan; sacristan leader or alternate; server leader or alternate; schola leader or alternate; assigned ministers; Main Chapel Administrator.

## Trigger

The celebrant decides that an existing scheduled Mass will be offered as a Requiem Mass.

## Preconditions

- A Mass exists on the chapel calendar.
- A celebrant is identified.
- The priest or assistant may modify the liturgical selection.
- Requiem preparation and staffing templates exist.

## Main Success Scenario

1. The priest or assistant opens the scheduled Mass and selects Requiem.
2. The priest chooses Low or Sung; this choice is required.
3. The priest may optionally select the occasion.
4. The system recommends the corresponding Missal formulary and allows Father to override it.
5. The system checks the day and displays a discreet rubrical advisory without blocking the priest.
6. The existing Mass is updated; no separate event or funeral case is created.
7. The system records the celebrant, person entering the decision, time, and previous and new forms.
8. The assigned sacristan is notified immediately.
9. Sung Requiem selections also notify server and schola leaders.
10. The applicable staffing template is applied, preserving compatible assignments.
11. Incompatible assignments enter ministry-leader review.

## Optional occasion and formulary mapping

- Funeral or Exequial Mass — *In die obitus seu depositionis defuncti*
- Day of death or burial — *Pro die obitus*
- News of death — *Pro die obitus*
- Reburial or final interment — *Pro die obitus*
- Third, seventh, or thirtieth day — *Pro die obitus* with applicable prayers
- Anniversary — *In anniversario defunctorum*
- Other Mass for the dead — *In Missis quotidianis defunctorum*

If the celebrant leaves the optional list untouched, the sacristan sees **Requiem formulary not specified**. This is a system status, not a celebrant-facing option, and it generates no reminder. All Souls belongs to the annual calendar workflow tied to November 2.

## Alternate Flows

- The assistant may enter, change, or cancel a selection based on the priest's verbal direction without electronic confirmation.
- A changed selection reapplies the appropriate template and notifies everyone previously alerted.
- Cancellation restores the previous Mass form and template while preserving compatible assignments.
- Low Requiem without body or catafalque requires one server; a second is optional.
- Low Requiem with body or catafalque prefers MC, thurifer, Ac1, Ac2, and cross bearer; one acolyte is the absolute minimum.
- Sung Requiem requires MC, thurifer, Ac1, Ac2, cross bearer, and schola. Father decides any exception or change of form.

## Last-Minute Coordination

Selections, changes, or cancellations inside three hours activate last-minute coordination:

- One to three hours: 15 minutes to acknowledge.
- Thirty to sixty minutes: 5 minutes to acknowledge.
- Under thirty minutes: assigned personnel, leaders, and alternates are notified together.
- One **Ready** or **Cannot staff** response is required per affected ministry.
- Automated reminders stop thirty minutes before Mass.
- Father and his assistant receive one final readiness summary.

## Exception Handling

- Rubrical conflict: advisory only; Father retains the decision.
- Missing acknowledgment: escalate to leader or alternate, then Father and assistant.
- Insufficient Sung staffing or schola: remain unresolved until Father decides.
- Incompatible assignments: human review; never silently remove them.

## Permissions

- Priest and Father's Assistant may select, change, or cancel.
- Ministry leaders manage resulting staffing.
- Sacristans and affected leaders may see the rubrical advisory.
- Intention details are neither collected nor exposed.

## Notifications

Notify the assigned sacristan for every selection. Notify server and schola leaders for Sung Requiems and template changes. Notify all previously affected recipients when the selection changes or is cancelled. Delivery uses approved preferred and backup channels; delivery and acknowledgment are separate statuses.

## Business Rules

- The selection modifies an existing Mass.
- Low or Sung is required; occasion is optional.
- The system advises but never overrules Father.
- Only operationally necessary information is stored.
- Compatible assignments survive template changes.
- All Souls is not a manual Requiem-selection case.

## Acceptance Criteria

- A priest or assistant can designate an existing Mass as Low or Sung Requiem quickly.
- Leaving the occasion blank does not block or nag the priest.
- The sacristan receives the essential setup information immediately.
- Correct staffing, review, urgent acknowledgment, escalation, restoration, and audit behavior occurs.
- No private intention information appears in the scheduling system.

## Open Questions

- Confirm exact preparation checklists and position qualifications.
- Confirm future Solemn Requiem support.
- Adjust urgent thresholds after pilot experience if needed.

## Potential Existing Capabilities to Reuse

Ordo connector; calendar-event updates; Telegram and email delivery; ministry templates; leader/alternate escalation; audit history.

