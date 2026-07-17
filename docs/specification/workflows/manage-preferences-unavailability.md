# Workflow: Volunteer Sets Preferences and Unavailability

**Status:** Approved for stakeholder review

## Purpose

Allow volunteers and authorized family contacts to communicate when and how they are willing to serve, with enough detail for fair automatic scheduling without creating unnecessary technology burdens. Preferences guide future scheduling; unavailability prevents assignments during specific services, days, or date ranges.

## Actors

Volunteer; Guardian; Family Scheduling Contact; Ministry Leader; Designated Ministry Scheduler; Ceremonies Coordinator; Automatic Scheduler; Notification Service.

## Trigger

- A volunteer is approved for a ministry.
- A volunteer updates regular preferences or records temporary unavailability.
- A six-month preference review becomes due.
- A new recurring service time or special-service category becomes relevant.
- A leader records information provided verbally, on paper, or through another reliable channel.

## Preconditions

- The volunteer has an active account or an authorized leader can maintain information on the person's behalf.
- Approved ministry memberships and qualifications are known.
- Recurring service times and special-service categories exist.
- Family relationships and delegated authority are configured where applicable.
- Privacy and notification permissions are active.

## Main Success Scenario

1. A newly approved volunteer receives a short preference-setup invitation and may complete or skip it.
2. The system shows recurring service times relevant to the chapel.
3. One general service-time preference applies across ministries, with optional ministry-specific exceptions.
4. For each service time, the volunteer selects Prefer this Mass, Can help sometimes, Available if necessary, Cannot serve, or Not specified.
5. Can help sometimes permits an optional monthly frequency.
6. The volunteer may set an overall monthly automatic-assignment limit.
7. The volunteer may opt into compatible double duty at the same service.
8. A multi-ministry volunteer may rank ministries as a soft preference.
9. The volunteer selects availability for recurring and special-service categories.
10. The system summarizes the selections for confirmation.
11. Preferences apply to future scheduling cycles; existing proposed or published assignments remain unchanged.
12. The system records the source, author, and time of the change.

## Service-Time Preference Meanings

### Prefer This Mass

Assign here regularly when staffing and balancing permit.

### Can Help Sometimes

Use when needed up to the volunteer's selected frequency.

### Available if Necessary

Use to resolve shortages, but track and balance how often the flexibility is used so willing volunteers are not abused.

### Cannot Serve This Mass

A hard restriction. The Automatic Scheduler may never assign the volunteer at this time. A leader may not change it unless the volunteer explicitly provides the change and the source is recorded.

### Not Specified

Do not assume regular availability. After stated availability has been exhausted, the person may be proposed as a last resort only with leader approval and volunteer confirmation. Prompt the volunteer to clarify the preference for future cycles.

## Ministry Ranking and Cross-Ministry Balancing

A volunteer may rank ministries as a soft preference. Ranking influences but does not determine allocation and never allows a ministry to claim a volunteer. Qualifications, hard restrictions, absences, family rules, serious shortages, scarcity of qualified alternatives, and workload history take precedence. A coordinated recommendation is presented to affected ministry leaders before separate schedules are approved. The Ceremonies Coordinator resolves unresolved allocation disputes among liturgical ministries.

## Compatible Double Duty

The system may propose compatible duties at one service only after the volunteer opts in. Two duties at one Mass count as one attendance against a service-time limit and two duties for workload balancing. Hard incompatibilities remain prohibited; altar serving and ushering at the same Mass are incompatible.

## Overall Assignment Limit

A volunteer may set a maximum number of automatic assignments per month across ministries. Self-volunteering may exceed the limit. A leader may propose an additional assignment, but it becomes effective only after explicit volunteer acceptance.

## Special-Service Preferences

The same preference levels apply to categories including Sundays, ordinary weekday Masses, Holy Days of Obligation, important feasts, weddings, funerals and Requiem Masses, baptisms, Holy Week and major ceremonies, processions, last-minute weekday services, and other relevant events. Important feasts come from the approved liturgical calendar and chapel rules.

When a relevant ceremony is scheduled, Prefer, Can help sometimes, and Available if necessary receive an opportunity notice; Cannot serve receives none; Not specified receives only a prompt to clarify. Specific absences override category preferences.

## Temporary Unavailability

A volunteer may record one service, an entire day, or a date range. It applies to all ministries by default and may be limited to one ministry. No reason is required. An optional note is restricted to the volunteer and authorized leader or scheduler and never appears in ministry calendars or ordinary notifications.

## Plain-Language Entry

A supported conversational channel may accept statements such as “I cannot serve the 5:00 Mass this Sunday” or “I will be away July 17–20.” The system repeats the dates, services, ministries, and limits it understood and requires confirmation before saving. The approved messaging technology remains subject to technical review.

## Effects on Existing Assignments

### Unconfirmed Automatic Assignment

An overlapping absence automatically declines the proposal and returns it to scheduling. No substitute request is created, and the volunteer has no substitute responsibility.

### Confirmed Assignment

An overlapping absence starts the substitute-request workflow. The volunteer is not silently removed. Self-volunteered assignments are already confirmed and follow the same rule.

### Cancelling an Absence

The volunteer is restored only to assignments whose substitute requests remain unresolved. An accepted substitute is not displaced automatically. Exceptional restoration requires leader action.

## Family Scheduling

A family may designate a Family Scheduling Contact who may manage shared preferences, enter absences, confirm or decline assignments, act for linked minors, and act for adult family members who gave one-time consent. Routine per-action notices are unnecessary. Actions identify the Family Scheduling Contact in audit history, and adults may revoke authority.

## Technology-Resistant Volunteers

Technology use is not a condition of ministry. An authorized leader or scheduler may enter volunteer-provided information received in person, by telephone, on paper, by message, or through another reliable method. The system records who entered it, when, the volunteer as source, and the source type. A simple summary may be sent for correction without requiring a login or formal electronic approval.

## Preference Review

Preferences remain effective until changed. Every six months, request a review with a one-step No changes response. Leaders may complete it for technology-resistant volunteers. Failure to review does not remove the person from ministry; stale preferences are identified without becoming hard restrictions.

## New Recurring Service Time

A new recurring time appears as Not specified, prompts qualified members to choose a preference, and never inherits availability from another time automatically.

## Alternate Flows

### Volunteer Skips Setup

All services and categories remain Not specified. The person may self-volunteer and may be used only through the last-resort proposal process for automatic scheduling.

### Leader Enters Information

The record identifies the leader as recorder and volunteer as source. The leader may not invent or alter a hard restriction.

### Cross-Ministry Shortage

The system compares need, scarcity, workload, rankings, and compatible duties, then proposes one coordinated allocation. The Ceremonies Coordinator resolves unresolved liturgical conflicts.

### Ambiguous Plain-Language Request

Save nothing, explain the ambiguity, ask one focused question, and present the final interpretation for confirmation.

### Communication Channel Unavailable

The web portal and leader-assisted process remain available. Approved backup channels may be used without changing the workflow.

## Exception Handling

- Cannot serve and temporary absence block automatic assignment.
- Reaching a frequency or monthly limit blocks automatic assignment but permits an explicit proposal.
- Hard duty conflicts and compatible double duty without opt-in are blocked.
- Conflicting family actions retain audit history and go to affected adults and the leader if unresolved.
- Conflicting ministry demand uses coordinated review and Ceremonies Coordinator resolution for liturgical ministries.
- Invalid or unclear dates require clarification.
- Failed notification uses the approved backup process and exposes delivery failure to authorized leaders.
- Unauthorized changes are rejected and audited.
- Lack of electronic participation activates the leader-assisted process.

## Permissions

### Volunteer

View and change personal preferences; record and cancel unavailability; set frequency and monthly limits; rank ministries; opt into compatible double duty; select special-service interests.

### Guardian

Manage preferences and unavailability for linked minors according to guardian controls.

### Family Scheduling Contact

Manage authorized family preferences, absences, and assignment responses for consenting adults and linked minors.

### Ministry Leader or Scheduler

View preferences relevant to that ministry; record volunteer-provided information; send correction summaries; and propose assignments beyond soft preferences or limits. Hard restrictions require volunteer-provided authority.

### Ceremonies Coordinator

View relevant cross-ministry availability, rankings, and conflicts and resolve liturgical allocation disputes.

### Unrelated Leaders and Members

Cannot view the person's preferences, private notes, ministry rankings, or family authority.

## Notifications

- Initial setup and six-month review.
- New recurring time or special-service opportunity.
- Prompt to clarify Not specified.
- Saved unavailability and affected assignments.
- Substitute workflow started or unconfirmed assignment declined.
- Extra assignment proposed beyond a limit.
- Family Scheduling Contact authority established or revoked.
- Leader-entered summary available for correction.

## Business Rules

- Preferences guide future assignments but do not alter existing schedules.
- Temporary unavailability overrides regular preferences.
- Cannot serve is hard; ministry ranking is soft and non-determinative.
- Serious staffing scarcity may outweigh a soft ranking.
- Fairness is evaluated across ministries and over time.
- Flexible volunteers must not become permanent shortage coverage.
- Compatible double duty is never assumed; hard conflicts cannot be overridden.
- Technology use is not required to volunteer.
- Reasons for unavailability are never mandatory.
- Messaging technology remains an implementation decision.

## Acceptance Criteria

- Volunteers can configure Mass-time and special-category preferences.
- Frequency and monthly limits affect automatic scheduling.
- Cannot serve prevents automatic assignments.
- Not specified uses only the last-resort proposal process.
- Ministry rankings influence but do not control allocation.
- Flexible service is balanced historically.
- Compatible double duty occurs only after opt-in.
- Service, day, and date-range absences are supported.
- Plain-language entries require interpretation confirmation.
- Unconfirmed assignments decline without substitute responsibility; confirmed assignments start substitution.
- Cancelling an absence does not displace an accepted substitute.
- Family Scheduling Contacts act within granted authority.
- Leaders can support volunteers without requiring technology.
- Private notes remain outside schedules and routine messages.
- Six-month review supports No changes.
- New recurring services remain Not specified until answered.
- Cross-ministry visibility is limited to those who need it.

## Potential Existing Capabilities to Reuse

- Telegram conversational parsing and confirmation.
- Existing web profile and preference concepts.
- Ministry qualification records.
- Family and guardian relationships.
- Automatic scheduling and workload history.
- Calendar and service-category data.
- Notification preferences and backup channels.
- Verified MSP preference data as a possible reference.

Reuse is permitted only when it supports the defined workflow and privacy rules.

## Open Questions

- Final conversational channel or channels, subject to Technical Steward recommendation.
- Exact wording of service-category labels.
- Whether individual ministries need additional preference dimensions.
- Stakeholder confirmation of the six-month review interval.
