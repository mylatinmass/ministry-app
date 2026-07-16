# Workflow: Generate and Publish a Ministry Schedule

**Status:** Approved for stakeholder review

## Purpose

Generate a timely, balanced ministry schedule with minimal manual effort by combining self-volunteered services, member preferences and unavailability, qualifications, household scheduling preferences, fair workload and position rotation, and leader-reviewed automatic assignments. The result becomes the ministry's official live schedule while remaining continuously updated.

## Actors

Ministry Leader; Designated Ministry Scheduler; Ministry Volunteer; guardian acting for a minor; Chapel Coordinator; Ceremonies Coordinator for liturgical ministries; Main Chapel Administrator; Automatic Scheduler; Notification Service.

## Trigger

The monthly scheduling cycle advances and opens the next calendar month for volunteering. For example, on August 15, September becomes the published schedule and October opens for volunteering. October volunteering closes September 8; review and confirmations occur September 8–15; October publishes September 15.

## Preconditions

- The approved master chapel calendar contains the services for the scheduling period.
- Each service identifies its ministry staffing requirements.
- The ministry has an active leader and, optionally, a designated scheduler.
- The ministry publication policy is configured as Leader approval required or Delegated publication authority.
- Active volunteers have appropriate membership and qualification records.
- Preferences, unavailability, family links, and guardian controls are available when provided.
- The ministry's operational escalation role is configured.
- The Chapel Coordinator is the default escalation above the ministry leader; the Ceremonies Coordinator is copied for liturgical ministries.

## Main Success Scenario

1. The system creates the next scheduling period from the approved master chapel calendar.
2. Confirmed services requiring the ministry are included; tentative ceremonies appear separately for planning.
3. Required staffing positions are created from ministry and ceremony templates.
4. The month opens for volunteering and qualified active volunteers receive one notice.
5. Volunteers select services rather than positions; each self-selected service is immediately confirmed.
6. Where positions apply, the system proposes them using qualifications, rank, workload, and position rotation.
7. Three days before volunteering closes, qualified members with relevant opportunities receive one reminder.
8. Volunteering closes on the eighth day of the preceding month.
9. The Automatic Scheduler fills remaining needs using the approved priority order.
10. The Ministry Leader or authorized scheduler reviews people, positions, shortages, and recommendations.
11. Moving a volunteer to another service removes confirmation; changing only a position preserves it and sends notice.
12. The reviewer approves the automatic assignments.
13. Auto-assigned volunteers receive confirmation requests immediately, after three days, and the day before publication if still unconfirmed.
14. A declined assignment becomes open and the system proposes the next best-qualified person for reviewer approval without rerunning the entire schedule.
15. The authorized person publishes by the fifteenth.
16. The schedule becomes the official live schedule in day, week, and month views.
17. The system records who generated, reviewed, approved, published, and changed the schedule.

## Automatic Scheduling Priority

1. Hard eligibility and qualification requirements.
2. Recorded unavailability.
3. Minor and guardian restrictions.
4. Family Keep together rules.
5. Maximum automatic assignment limits.
6. Regular service preferences.
7. Workload and position balancing.
8. Backup qualifications when ordinary coverage is insufficient.

The scheduler flags a shortage rather than silently violating a higher-priority rule. It may recommend qualified, best-balanced people beyond automatic limits, but it may not assign them automatically.

## Family Coordination

A linked family may select No family scheduling preference or Keep selected family members at the same service. A Keep together rule prevents the Automatic Scheduler from splitting those people across Masses. The family may voluntarily choose different services. If the rule prevents complete staffing, the Ministry Leader may propose an exception, but the affected family must approve it before it takes effect.

## Schedule Readiness

- **Green:** every required position is filled and every auto-assigned service is confirmed.
- **Yellow:** every required position is filled, but one or more assignments remain unconfirmed.
- **Red:** at least one required position is open or a hard rule is violated.

## Alternate Flows

### Delegated Publication Authority

The Ministry Leader may grant or revoke the scheduler's publication authority. When delegated, the scheduler may review, approve, and publish without another action. Otherwise, the leader gives final approval.

### Incomplete Schedule

The schedule may publish with open or unconfirmed assignments. Readiness remains yellow or red. Unconfirmed people remain assigned, and reminders and leader alerts continue.

### Controlled Automatic Publication

If no person publishes by the deadline, confirmed self-volunteered assignments and reviewed auto-assignments publish. Unreviewed automatic proposals do not become obligations; their positions publish as open. Leaders see **Automatically published—incomplete**. The Chapel Coordinator receives the overdue escalation, and the Ceremonies Coordinator is copied for a liturgical ministry.

### New Service After Publication

A new master-calendar service creates open ministry positions, alerts the leader and scheduler, and invites qualified volunteers. Existing unrelated assignments are not regenerated.

### Tentative Ceremony

Tentative ceremonies appear in the planning view and may receive provisional staffing, but they remain outside the official published schedule until confirmed. Cancellation or material change sends a neutral notice to provisionally assigned volunteers and affected leaders.

### Assignment Declined

The position becomes open, leaders are notified, and the system recommends the next best-qualified person for approval. The replacement must confirm.

### Unconfirmed After Publication

The assignment remains published as unconfirmed. One week before the service, the volunteer receives the existing reminder and the Ministry Leader is alerted if it remains unconfirmed.

### Published Schedule Changes

Authorized changes appear immediately in live calendar views. Only affected people and leaders are notified. The schedule remains Published, printed schedules reflect the time printed, and history is retained. Underlying service changes use the separate master-calendar workflow.

## Exception Handling

- Hard qualification failure or recorded unavailability blocks assignment.
- Family Keep together conflicts remain shortages until the family approves an exception.
- Automatic assignment limits may not be exceeded silently.
- If no qualified person exists, the position remains open and red.
- Notification failure retries through the approved backup channel and exposes delivery status to leaders.
- Conflicting edits preserve both versions and require an authorized reviewer to select the controlling change.
- The ministry schedule never independently changes the master service.

## Permissions

### Ministry Volunteer or Guardian

View relevant ministry schedules and personal assignments; volunteer for qualified services; confirm or decline auto-assignments; view positions; manage permitted preferences, unavailability, and family settings. Guardians act for linked minors according to their controls.

### Designated Scheduler

Generate and edit proposed schedules; change people and positions; review shortages and recommendations; publish only when delegated.

### Ministry Leader

Perform all scheduler actions; approve and publish; grant or revoke delegated publication authority; configure ministry scheduling parameters; propose family-rule exceptions.

### Chapel Coordinator

View cross-ministry readiness, receive overdue escalations, and drill into publication failures and unresolved shortages.

### Ceremonies Coordinator

View liturgical-ministry readiness, receive copied overdue escalations for liturgical ministries, and review ceremony-related staffing implications.

### Main Chapel Administrator

Maintain the master calendar, recurring rules, permissions, and platform configuration. The administrator may view status but is not a routine operational escalation point.

### Public and Unrelated Members

They may view public services but not volunteer names, staffing counts, positions, shortages, or confirmation status.

## Notifications

- Volunteer month opened and a three-day closing reminder.
- Auto-assignment and confirmation reminders.
- Service or position change.
- Decline and replacement proposal.
- Publication and controlled automatic publication.
- Publication reminders seven days before, three days before, and on the deadline.
- Overdue escalation the following day.
- One-week-before-service unconfirmed reminder.
- New service, open opportunity, or tentative-event change.
- Family exception proposal.

## Business Rules

- Ministry schedules originate from the master chapel calendar.
- Ministries publish independently.
- The next month's official schedule is due on the fifteenth; volunteering closes one week earlier.
- Volunteers normally choose services, not positions. A ministry may configure an exception where appropriate.
- Self-volunteered services are confirmed immediately; auto-assigned services require confirmation.
- A position-only change does not require renewed service confirmation; a service change does.
- Published schedules remain live and continuously updated.
- Automatic scheduling never exceeds configured limits without authorized action.
- Publication authority is configurable by the Ministry Leader.
- Privacy is enforced through ministry membership and operational role.

## Acceptance Criteria

- A complete monthly schedule can be generated from the master calendar.
- Qualified volunteers can choose services, and those selections become confirmed.
- Remaining needs are filled according to the approved priority order.
- Reviewers can change both people and positions.
- Readiness correctly displays green, yellow, or red.
- Family Keep together rules are honored, and exceptions require family approval.
- No unreviewed auto-assignment becomes official through automatic publication.
- Incomplete schedules can publish on time.
- Published views update immediately after authorized changes.
- Unrelated members cannot view volunteer details.
- Overdue schedules escalate to the Chapel Coordinator and copy the Ceremonies Coordinator when liturgical.
- Material actions are auditable.

## Potential Existing Capabilities to Reuse

- Existing calendar and service-generation components.
- Ministry scheduling preferences and qualifications.
- Telegram notification and confirmation interactions.
- Existing Schola availability or messaging capabilities.
- Calendar month, week, and day views.
- Green-yellow-red staffing dashboard concepts.
- Substitute-request logic.
- Existing family or household relationships, if available.

Reuse must not weaken the workflow, privacy rules, approval boundaries, or family constraints.

## Open Questions

No blocking product questions remain. Exact wording and notification-channel behavior may be validated during stakeholder review without changing the core workflow.
