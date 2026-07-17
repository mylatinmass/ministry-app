# Workflow: Volunteer Confirms or Declines New Assignments

**Status:** Approved by Product Owner for stakeholder and technical review on July 17, 2026

## Purpose

Allow volunteers and authorized family contacts to review and respond to automatically assigned services with minimal friction, while ensuring assignments are visible, conflicts are addressed, and non-response does not silently create staffing gaps.

## Actors

- Volunteer
- Minor volunteer with guardian-approved access
- Guardian or Family Scheduling Contact
- Ministry Leader
- Designated Scheduler
- Chapel Coordinator as escalation role
- Notification service
- Automatic scheduler

## Trigger

The automatic scheduler creates one or more new assignments requiring confirmation.

## Preconditions

- The volunteer is qualified and eligible.
- Hard availability, family, guardian, APR, and scheduling constraints have been applied.
- Every assignment included in a bulk action is visibly listed.
- The volunteer or authorized family contact has an approved communication channel.
- Guardian confirmation settings are established for minors.

## Main Success Scenario

1. The system prepares one consolidated message showing all new assignments across the volunteer's ministries.
2. Assignments are grouped by person for a family account.
3. The message distinguishes confirmed assignments from new assignments awaiting confirmation.
4. The volunteer reviews dates, times, services, ministries, and any same-day burden notices.
5. The volunteer may confirm assignments individually or select **Confirm All**.
6. Confirm All applies only to assignments visibly represented in the message.
7. The system records the response, actor, time, and communication channel.
8. Confirmed assignments become part of the volunteer's active schedule.
9. The volunteer receives the normal one-week service reminder unless it would duplicate a confirmation notice within 48 hours.

## Alternate Flows

### Confirm All Non-Conflicting Assignments

If one or more assignments contain a conflict:

- Confirm All is disabled.
- The volunteer may confirm all non-conflicting assignments together.
- Conflicting assignments remain for individual review.

### Decline an Unconfirmed Assignment

- No reason is requested.
- The assignment immediately returns to the open schedule.
- The volunteer has no substitute responsibility.
- The decline creates a hard restriction against auto-assigning or re-proposing that specific service.
- The volunteer may later claim the service voluntarily if it remains open and the volunteer remains qualified.
- Voluntary reclamation removes the service-specific restriction and confirms the assignment immediately.

### Confirmation by Conversation

A Ministry Leader or Designated Scheduler may record **Confirmed by conversation** after speaking with the volunteer or authorized guardian.

The system records:

- who entered the confirmation;
- when it was entered; and
- that it resulted from direct communication.

No written explanation is required.

The volunteer receives a brief confirmation notice with **This is not correct** as an exception action.

### Disputed Confirmation

If the volunteer reports that a leader-recorded confirmation is incorrect:

- the assignment remains temporarily active;
- it is privately marked **Needs resolution**;
- the volunteer sees the same status in their personal schedule;
- the schedule may still be published; and
- only the appropriate volunteer, Ministry Leader, Designated Scheduler, and operations escalation role see the dispute.

The Ministry Leader or Designated Scheduler resolves it by selecting:

- **Keep and confirm assignment**, or
- **Release to open schedule**.

### Family Confirmation

A Family Scheduling Contact receives one consolidated message grouped by family member.

The contact may:

- confirm one person's assignments;
- confirm all non-conflicting assignments for one person; or
- confirm all family assignments when no family member has a conflict.

A conflict affecting one person does not prevent confirmation of another person's assignments.

### Minor Confirmation

Each guardian chooses a confirmation mode for each minor:

- **Guardian final approval**, which is the default; or
- **Independent confirmation**, with guardian notification.

Under Guardian final approval:

- the minor may respond provisionally;
- the assignment is not confirmed until the guardian approves;
- the guardian may confirm directly;
- the seven-day deadline applies to guardian approval;
- reminders go to the minor and guardian as appropriate;
- overdue approval alerts the Ministry Leader or Designated Scheduler; and
- approval may be recorded after a direct guardian conversation.

A guardian decline overrides a minor's provisional confirmation and follows the normal unconfirmed-assignment decline rule.

Under Independent confirmation:

- the minor's confirmation takes effect immediately;
- the guardian is notified;
- a later guardian objection uses the normal confirmed-assignment change or substitution process; and
- the guardian may not retroactively convert it into an unconfirmed decline.

A minor cannot override a guardian's decline, absence, or hard restriction.

## Exception Handling

### No Response

- Volunteers have seven days to respond.
- One reminder is sent midway through the period.
- A final reminder is sent on the deadline.
- Non-response does not return the assignment to the open schedule.
- The assignment remains reserved and becomes **Confirmation overdue**.
- The Ministry Leader or Designated Scheduler is alerted.

For guardian-controlled minors, the corresponding status is **Guardian approval overdue**.

### Same-Day Multiple Masses

The automatic scheduler must not assign a volunteer to multiple Masses on the same day unless the volunteer explicitly permitted it.

When permitted:

- it is not a blocking conflict;
- the system still balances the burden fairly; and
- the confirmation message states **Two Masses this day—allowed by your preferences**.

### Schedule Error

A volunteer may use **Review or request a change** to report an incorrect date, time, ministry, or role.

The assignment remains active and displays **Needs resolution** until the Ministry Leader or Designated Scheduler resolves it.

## Permissions

- Volunteers may confirm or decline their own unconfirmed assignments.
- Family Scheduling Contacts may act for authorized family members.
- Guardians control each minor's confirmation mode.
- Minors may act only within guardian-granted permissions.
- Ministry Leaders and Designated Schedulers may record confirmations by conversation and resolve disputes.
- Chapel Coordinator receives escalation visibility when ministry-level resolution is overdue.
- Unrelated ministries and ordinary members cannot see confirmation disputes or family controls.

## Notifications

- One consolidated new-assignment message across ministries.
- Midpoint reminder during the seven-day response period.
- Final reminder on the deadline.
- Overdue alert to the Ministry Leader or Designated Scheduler.
- Guardian reminders and overdue alerts when final approval is required.
- Notification when an assignment is confirmed on someone's behalf.
- Neutral notice when an assignment is released.
- One-week service reminder unless combined with a confirmation sent within 48 hours.
- Service reminder uses **Review or request a change**, not a prominent **I can't serve** action.

## Business Rules

- Silence is never treated as confirmation.
- Silence also does not automatically release an assignment.
- Bulk confirmation applies only to visibly listed assignments.
- Blocking conflicts disable Confirm All.
- Declining an unconfirmed assignment does not create substitute responsibility.
- A confirmed assignment must use the normal change or substitution process.
- Guardian safeguards take precedence over a minor's provisional action.
- Leader-entered confirmations and resolutions are auditable but light-touch.
- Confirmation concerns the service; later position changes do not require service reconfirmation.

## Acceptance Criteria

- A volunteer can review all pending assignments in one consolidated message.
- No hidden assignment can be confirmed through a bulk action.
- Individual, Confirm All, and Confirm all non-conflicting actions work correctly.
- Declines reopen the position and prevent automatic reassignment for that service.
- A volunteer can later reclaim a declined service voluntarily.
- Seven-day reminders and overdue escalation work without automatically releasing assignments.
- Leaders and schedulers can record confirmation by conversation.
- Disputes remain private and resolvable without blocking publication.
- Families can confirm by person or as a family when no conflicts exist.
- Guardian final approval is the default for minors.
- Guardian-selected independent confirmation works as defined.
- Same-day burdens and true scheduling conflicts are handled correctly.
- Duplicate confirmation and service reminders are suppressed within 48 hours.
- Every response and authorized override is auditable.

## Open Questions

- Exact message wording and channel-specific presentation.
- Maximum assignment count that fits comfortably in a messaging interface before requiring a web summary.
- Final escalation timing after confirmation becomes overdue.
- Whether the Chapel Coordinator needs a consolidated overdue dashboard.

## Potential Existing Capabilities to Reuse

- Telegram bot buttons and direct-message workflow
- Email notifications and one-time authenticated links
- Existing assignment and family-account concepts
- Conflict-detection rules
- Reminder scheduler
- Audit history
- Technical Steward review of existing messaging components
