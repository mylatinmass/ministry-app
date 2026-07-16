# Workflow: Schedule a Wedding

**Status:** Approved for stakeholder review

## Purpose

Receive, hold, approve, prepare, staff, publish, change, and cancel a wedding while separating family information, internal preparation, ministry needs, and public information.

## Actors

Couple or family contact; Father; expected celebrant; Father's Assistant; Ceremony Coordinator; Main Chapel Administrator; sacristan, server, usher, and schola leaders; assigned ministers; public subscribers.

## Trigger

Father or Father's Assistant receives a wedding request.

## Preconditions

- An authorized person may create a restricted case and contact record.
- Chapel and priest conflicts are available.
- Father or the expected celebrant may approve.

## Main Success Scenario

1. The assistant creates a restricted request and tentative chapel hold.
2. The system checks chapel and priest conflicts.
3. A conflicting request may remain recorded but cannot be confirmed until resolved.
4. Father or the expected celebrant approves directly or through authorized verbal delegation.
5. The case remains pending until someone explicitly approves or cancels it; it does not expire automatically.
6. The assistant records the ceremony form and optional linked rehearsal.
7. The system creates draft staffing for sacristans, servers, and ushers; a Sung form also includes schola.
8. Ministry leaders review rather than assigning individuals automatically.
9. Family-facing and internal preparation items are tracked separately.
10. Publication is a separate explicit action; publishing names requires separate authorization.

## Ceremony Forms

Initial provisional choices are Low Nuptial Mass, Sung Nuptial Mass, and Marriage Ceremony without Mass. Authentic terminology and the exact forms OLV celebrates require stakeholder and Father validation.

## Rehearsal

The linked rehearsal is restricted, explicitly scheduled, reserves the chapel, and notifies the priest and Father's Assistant. It creates no ordinary ministry staffing unless explicitly added.

## Preparation Checklist

The case may track operational metadata for sacramental records, permissions, diocesan requests, and related preparation. Provisional statuses include Submitted, Awaiting response, Follow up, and Received. Underlying records and correspondence remain in approved external sacramental systems unless scope is expanded.

Staffing may begin while clearance remains pending. Leaders see only a generic clearance-pending status. Missing clearance escalates but never automatically cancels the wedding.

## Change and Cancellation

Material date, time, form, or priest changes require renewed approval. Father, assigned priest, Father's Assistant, and authorized chapel administration may cancel. A reason is recorded when required by final stakeholder policy. A conflicting event cannot become confirmed until resolved.

## Permissions

- Father or expected celebrant approves.
- Father's Assistant manages intake, hold, communication, and authorized changes.
- Ceremony Coordinator manages ceremonial implications.
- Ministry leaders manage staffing.
- Ordinary ministry members see only date, time, form, and assignment.
- Couple contact information and preparation details remain restricted.

## Notifications

- Approval reminders at 7 and 14 days; overdue at 21 days while the hold remains.
- Approved or materially changed cases notify affected leaders.
- Rehearsal notifies priest and assistant.
- Publication and cancellation notices respect family and role permissions.

## Business Rules

- Request, approval, staffing, clearance, rehearsal, and publication are separate statuses.
- No couple contact information appears in calendars or ministry summaries.
- Ordinary members need the form but no private details.
- Ministry leaders, not volunteers, alter staffing requirements.
- The case is retained until explicitly approved or cancelled.

## Acceptance Criteria

- A request and tentative hold can be created without publishing private information.
- Conflicts block confirmation.
- Authorized approval, reminders, rehearsal, conditional staffing, clearance metadata, role-specific visibility, material-change reapproval, publication permissions, and cancellation operate as defined.

## Open Questions

Validate authentic ceremony forms; detailed preparation owners and due dates; final cancellation reason policy; which names or details may be published.

## Potential Existing Capabilities to Reuse

Calendar holds; conflict detection; guided ceremony intake; restricted contact records; staffing templates; reminders; family confirmation summary; audit history; publication permissions.

