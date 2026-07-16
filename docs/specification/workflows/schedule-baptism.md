# Workflow: Schedule a Baptism

**Status:** Approved for stakeholder review

## Purpose

Coordinate one or more baptisms by capturing family information once, reserving facilities, preparing the sacristan, checking celebrant-language compatibility, and communicating changes to affected roles. Support ordinary baptisms and baptisms linked to the Easter Vigil.

## Actors

Candidate or candidates; parent, guardian, or family contact; Father; Father's Assistant; Ceremony Coordinator; celebrant; sacristan leader and sacristan; server leader if later required; maintenance leader; Main Chapel Administrator; public subscribers.

## Trigger

Father or Father's Assistant receives a request. Father generally refers scheduling to the assistant, but either may create the request.

## Preconditions

- Father's Assistant can manage the calendar.
- Chapel, facility, and priest availability are accessible.
- A restricted family contact can be created.
- A sacristan template exists.

## Main Success Scenario

1. Father or the assistant creates the request; Father may delegate it to the assistant.
2. The assistant records candidates, classification, approximate age if uncertain, proposed date/time, location, preferred family-facing language, restricted contact, and whether a reception is planned.
3. The system checks chapel, facilities, Father's calendar, and priest-language compatibility.
4. A conflict permits a restricted tentative hold but blocks confirmation.
5. A language mismatch warns but may be overridden.
6. The assistant resolves conflicts and confirms the date without separate approval from Father.
7. The sacristan leader receives a tentative heads-up and later confirmation or cancellation.
8. The system creates one required sacristan position.
9. The assistant completes the guided family intake and sends a reviewed family summary.
10. An unambiguous family response may verify the family-facing details; requested changes require review.
11. Authorized public information is published only after family permission and explicit assistant action.
12. Facility use appears in the Restricted Operations Calendar.

## Candidate Classification

Choices are Infant, Adult, or Unsure—enter age. Age supports preparation but does not automatically determine the rite. Under the traditional Ritual, use of reason is the relevant distinction. Father handles the final ritual determination *in actu functionis*; no electronic approval or Ceremony Coordinator selection is required.

## Multiple Candidates and Duration

One ceremony case may contain multiple family members. Shared date, time, location, celebrant, contact, reception, and ministry planning are stored once. Default duration is one hour for the first candidate plus ten minutes for each additional candidate; the assistant may adjust it.

## Staffing

The initial ordinary template requires one sacristan and no server. The template may later add a server without redesigning the workflow.

## Location and Reception

Ordinary baptisms default to the chapel; alternate locations are explicit exceptions. A linked reception reserves the hall but creates no chapel setup or cleanup duties. The family is responsible. Default family access blocks the hall for one hour before and one hour after, adjustable by the assistant. Reception publication requires separate authorization.

## Language Matching

The preferred family-facing language is compared with the assigned priest's profile. A mismatch warns the assistant but does not block confirmation; an interpreter or another arrangement may be recorded.

## Godparents and Preparation

The initial workflow stores no godparent names or evidence. It may record Not reviewed, Pending, or Confirmed. Whether godparent details or a general Preparation complete status belongs in the platform is TBD; detailed pastoral and sacramental preparation remains outside scheduling initially.

## Easter Vigil Baptisms

An Easter Vigil baptism is a linked Baptism Ceremony Case within the existing Vigil event, not an overlapping calendar event. The assistant may add it without separate approval from Father. Adding it updates scope, duration, checklist, and ministry requirements and immediately notifies the Ceremony Coordinator and all affected Vigil ministry leaders.

## Public Calendar and Privacy

Baptisms are restricted by default. Publishing event details and candidate names require separate family permissions plus an explicit assistant publish action. Contact data remains separately restricted. The provisional contact-retention period is one year after the ceremony.

## Cancellation

Father, Father's Assistant, or the Ceremony Coordinator may cancel. A reason is optional and restricted. Leaders may see it; volunteers and public subscribers receive a neutral notice. Linked reception reservations cancel unless explicitly retained.

## Exception Handling

- Calendar conflict: hold allowed; confirmation blocked.
- Language mismatch: warning with override.
- Unknown classification: store approximate age; do not decide the rite.
- Alternate location: explicit exception.
- Family-requested change: assistant review.
- Withdrawn publication: remove public information, retain restricted history.
- Easter Vigil addition: update and notify the existing Vigil plan.

## Permissions

- Father's Assistant creates, holds, confirms, communicates, publishes, and cancels.
- Father may create, refer, determine the rite, and cancel.
- Ceremony Coordinator sees the restricted case and coordinates operations.
- Sacristan and maintenance leaders see only needed operational and facility information.
- Platform Administrator receives no automatic ceremony authority or private access.

## Notifications

Tentative and confirmed sacristan notices are distinguishable. Material changes notify affected roles. Cancellation and public notices respect privacy. Preferred and backup channels follow the common notification rules.

## Business Rules

- The assistant may confirm an ordinary baptism without Father.
- Age never automatically determines the rite.
- Candidate sacramental records remain separate.
- Reception and baptism are linked but separately publishable.
- Facility access participates in conflict detection.
- Information is captured once and disclosed by role.

## Acceptance Criteria

- Father or assistant can initiate and the assistant can confirm after conflicts clear.
- Multiple candidates, approximate age, duration, one sacristan, language warning, reception reservation, family verification, public permission, privacy, cancellation, and Easter Vigil linkage work as specified.
- Operational staff can see facility impacts without private family information.

## Open Questions

Godparent details; preparation status; sacramental-record boundary; future server requirement; alternate locations; additional candidate information; Easter Vigil template effects; final privacy and retention policy.

## Potential Existing Capabilities to Reuse

Guided Ceremony Intake; restricted contacts; calendar conflicts; priest-language profiles; staffing templates; family summary; notifications; facilities calendar; publication permissions; Easter Vigil templates; audit history.

