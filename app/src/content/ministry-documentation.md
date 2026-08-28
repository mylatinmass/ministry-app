---
title: Ministry App Documentation
description: Step-by-step help for completed Ministry App features.
updated: 2026-08-28
guide:
  version: 1
  coverage: all-completed-topics
  defaultMode: auto
  commitPolicy: explain-without-submitting
---

# Ministry App Documentation

Use this file as the canonical source for the in-app Support → Documentation page. Add a topic only when the feature is complete and the instructions reflect the current interface.

## Accept plain-language availability statements and require confirmation of interpreted dates
<!-- guide: auto -->

**Purpose:** Reduce data-entry friction while preventing ambiguous natural-language dates or times from affecting schedules without confirmation.

### How to

1. Menu.
2. Availability. Calendar: select a future date.
3. choose Available all day, Partially available (select a quarter-hour AM/PM window), or Unavailable; use Add an unavailable range for multiple dates. Exclusion Rules: Create New Exclusion Rule.
4. choose ministries, occurrence, weekday, and unavailable time or All day.
5. Create Exclusion Rule.

## Add public-event volunteer RSVP and volunteer profiles
<!-- guide: auto -->

**Purpose:** Lower the barrier to public volunteering, preserve contact and consent information, and connect repeat volunteers to a reusable profile without granting ministry access.

### How to

1. Open the volunteer-enabled event.
2. Publish the event and select Copy Volunteer Link.
3. Share the link with the intended audience.
4. The visitor opens the link and selects an available responsibility.
5. The visitor enters the requested contact details and submits the RSVP.
6. Review the registration from the event roster.

## Add Spanish localization and broader accessibility enhancements
<!-- guide: auto -->

**Purpose:** Make the app usable by a broader range of languages, devices, abilities, and text-size needs so accessibility is part of normal participation.

### How to

1. Open My Profile, then Account Details or Preferences.
2. Choose Light or Dark appearance and save.
3. Use the browser or device text-size/zoom controls for larger text.
4. The responsive layout reflows through 200% zoom without clipping navigation, forms, calendars, dialogs, or actions.
5. Use browser translation when another language is needed.

## Add, edit, and cancel responsibilities directly on an event
<!-- guide: auto -->

**Purpose:** Allow leaders to respond to real event changes without modifying the reusable template or rebuilding the event.

### How to

Admin only: 1. Open the event details.
2. In Responsibilities, select Edit.
3. Use Add Responsibility to create one, or select an existing responsibility to modify it.
4. To remove it from active use, cancel/delete that responsibility.
5. Save assignments or responsibility changes, then leave edit mode.

## Allow a managed child profile to become an independent account without losing history
<!-- guide: auto -->

**Purpose:** Allow a maturing child to take control of the same identity and history instead of creating a duplicate account.

### How to

Parent/guardian: 1. Open My Profile > Profiles and select the managed child.
2. Under Create an independent account, enter the child's new email address.
3. Select Send Activation.
4. The child opens the emailed link and creates/verifies independent credentials.
5. The same profile and history are retained when guardian management ends.

## Allow a parent or guardian to create managed child profiles
<!-- guide: auto -->

**Purpose:** Represent each child as a distinct person with their own memberships and service history while keeping management with a guardian.

### How to

Parent/guardian: 1. Open My Profile.
2. Select Profiles.
3. Choose Add Child Profile.
4. Enter the child's required information.
5. Submit the form.
6. The child appears as a separate managed profile linked to the guardian.

## Allow a temporary absence to be limited to one ministry instead of all ministries
<!-- guide: auto -->

**Purpose:** Avoid unnecessarily blocking a person from every ministry when an absence affects only one ministry.

### How to

1. Open Availability.
2. Select the temporary absence dates.
3. Open Applies To.
4. Choose the single ministry affected by the absence.
5. Select Update.
6. Confirm that availability in the profile’s other ministries remains unchanged.

## Allow a volunteer to report an assignment error or request a change while the assignment remains active
<!-- guide: auto -->

**Purpose:** Give members a formal way to report an error or request a correction without silently dropping an active responsibility.

### How to

1. Open Home and locate Upcoming Assignments.
2. Open the affected assignment.
3. Select Request Change.
4. Enter a clear explanation of the error or requested adjustment.
5. Submit the request.
6. Continue to treat the assignment as active until an administrator resolves it.

## Allow an unconfirmed assignment to be declined without creating substitute responsibility
<!-- guide: auto -->

**Purpose:** Return an unaccepted proposal to the open schedule without treating it like abandonment of a confirmed commitment.

### How to

1. Open the pending or unconfirmed assignment invitation.
2. Review the event and responsibility.
3. Select Decline.
4. Confirm the response.
5. Verify that the opening returned to the event without creating a substitute request.

## Allow authorized users to create ministry events
<!-- guide: auto -->

**Purpose:** Capture new ministry activity in the authoritative schedule with consistent permissions, staffing, and notification behavior.

### How to

Admin only: 1. Open Events in a ministry you administer.
2. Select Create Event.
3. Enter the event name, date, start/end time, location, and optional description or notes.
4. Choose a template and participating ministries if applicable.
5. Review the generated responsibilities.
6. Save or publish the event.

## Allow authorized users to edit and clone existing events
<!-- guide: auto -->

**Purpose:** Make recurring or similar event setup faster while allowing authorized corrections without re-entering the entire event.

### How to

Admin only: 1. Open Events and select an event owned by a ministry you administer.
2. To edit it, choose Edit, update the permitted fields, and save.
3. To copy it, choose Clone Event beside the event name.
4. Change the copied event's date, time, title, or other details.
5. Save the clone as a new event.

## Allow each ministry to define an ordered hierarchy of serving levels
<!-- guide: auto -->

**Purpose:** Represent ministry-specific qualification and progression so assignments can respect experience, training, and position requirements.

### How to

1. Open the applicable ministry, then Members.
2. Open the Levels action.
3. Add a level name and optional badge icon.
4. Drag levels or use the move controls to place them from least to most capable.
5. Assign each member's highest level.
6. In a template or responsibility, choose the minimum required level and save.

## Allow effective-dated changes to one event or this-and-future events with a preview
<!-- guide: auto -->

**Purpose:** Change recurring schedules safely without unintentionally rewriting past or unrelated occurrences.

### How to

**Admin only**
1. Open an event that belongs to a recurring schedule.
2. Select Edit.
3. Choose This Event to change only the selected occurrence, or This and Future Events to change the remaining series.
4. Enter the revised information.
5. Review the preview of affected events and conflicts.
6. Select Apply to save the effective-dated change.

## Allow individual confirmation, Confirm All, and Confirm all non-conflicting assignments
<!-- guide: auto -->

**Purpose:** Make new assignments visible and obtain clear volunteer or guardian responses without requiring separate replies for every ministry.

### How to

1. Open an assigned event from Calendar, Events, or the alert link.
2. Select Confirm to acknowledge the duty; the checkmark beside the member becomes green.
3. If the member cannot serve, use Request Sub only when that responsibility requires a substitute.
4. For open-attendance responsibilities, use Can't Make It instead.

## Allow leaders to enter preferences and absences for technology-resistant volunteers with source and audit details
<!-- guide: auto -->

**Purpose:** Include volunteers who do not use the app regularly by letting authorized leaders record their information with source and audit history.

### How to

**Leader only**
1. Open the applicable Ministry.
2. Select Availability.
3. Use the member selector to choose one or several ministry members.
4. Select the unavailable dates or enter the preference.
5. Record the permitted source or audit detail.
6. Select Update and confirm the change for each selected member.

## Allow leaders to record confirmations, declines, informal substitutions, and no-shows from offline conversations
<!-- guide: auto -->

**Purpose:** Capture decisions made by phone or in person so the digital roster and history remain accurate even when the conversation happened offline.

### How to

**Leader only**
1. Open Events and select the affected event.
2. Open the applicable assignment.
3. Select Record Response or Record Outcome.
4. Choose Confirmed, Declined, Served, No-show, Substitute Served, or Excused.
5. Add any permitted operational note.
6. Save the outcome and verify it in the event roster.

## Allow one-time volunteer approval without creating ongoing ministry membership
<!-- guide: auto -->

**Purpose:** Approve help for a single event without accidentally creating permanent ministry membership or broader access.

### How to

1. Open the public link for an approval-required volunteer event.
2. Select the desired opportunity.
3. Enter the requested contact details.
4. Submit the request.
5. An authorized leader opens the event and reviews the pending volunteer.
6. Approval applies to that event only and does not create ongoing ministry membership.

## Allow ordinary members to sign in with username/password or a secure one-time email link
<!-- guide: auto -->

**Purpose:** Make routine sign-in easier for ordinary members while retaining secure password access and short-lived, single-use email authentication.

### How to

1. Open the Ministry App sign-in page.
2. Enter a username and password, or choose the secure email sign-in-link option.
3. If using email, open the one-time link in the received message.
4. Complete sign-in and continue to the Ministry workspace.

## Allow privacy-tiered plain-language event entry for Father's Assistant and non-confidential Telegram entry
<!-- guide: auto -->

**Purpose:** Make fast event entry possible from conversational input while preventing confidential information from being placed in an unsafe channel or broad view.

### How to

**Father’s Assistant**
1. Open Telegram and message MinistryAppBot with a non-confidential event request.
2. Review the generated draft.
3. Select Confirm to create the event.
4. Open the Priests ministry in the Ministry App.
5. Find the new event and add any permitted private details.
6. Save and verify the event’s privacy setting.

## Apply exact-date availability and unavailable ranges across all of the profile's ministries
<!-- guide: auto -->

**Purpose:** Use one person-level availability record across ministries so members do not repeat the same information and schedulers do not receive conflicting answers.

### How to

1. Open Availability from the account-level menu.
2. Select a date or create an unavailable date range.
3. Choose the final availability and save it.
4. Open another ministry belonging to the same profile.
5. Confirm that the same exact-date or range availability is used there automatically.

## Apply First Friday/First Saturday, all-night adoration, Holy Days, Christmas, summer schedule, Holy Week, patronal, procession, and annual blessing rules
<!-- guide: auto -->

**Purpose:** Encode recurring and seasonal chapel customs so important exceptional services and preparations are not omitted or recreated manually each year.

### How to

**Super Admin only**
1. Open Events and select Create Repeating Event.
2. Choose the template for the special or seasonal service.
3. Select the applicable monthly, yearly, first-weekday, or custom recurrence rule.
4. Enter the effective dates for First Friday, First Saturday, Holy Week, annual feasts, processions, or another approved observance.
5. Preview the generated dates.
6. Save and review any exceptions before publication.

## Apply ministry template-section changes only to future events
<!-- guide: auto -->

**Purpose:** Keep already-created events stable while allowing template improvements to shape future events.

### How to

1. Open the shared template.
2. Edit the participating ministry’s template block.
3. Save the change.
4. Create a new event from the updated template.
5. Confirm that the new event contains the revised staffing plan.
6. Open an older event and confirm that its copied staffing plan did not change.

## Apply OLV recurring Mass times, Confession/Rosary timing, and effective-dated schedule rules automatically
<!-- guide: auto -->

**Purpose:** Turn approved recurring chapel times and preparation offsets into consistent events so Confession, Rosary, Mass, and duties stay aligned.

### How to

**Super Admin only**
1. Open Events.
2. Select Create Repeating Event.
3. Choose the approved Mass template.
4. Set the recurrence dates and the effective start or end date.
5. Confirm the configured Mass, Confession, Rosary, and duty-time offsets.
6. Save the repeating event and review the generated occurrences.

## Apply SSPX proper-calendar precedence and chapel-specific liturgical rules automatically with human review
<!-- guide: auto -->

**Purpose:** Apply SSPX and chapel-specific observances consistently while keeping Father or an authorized delegate as the final liturgical authority.

### How to

**Super Admin only**
1. Open Chapel Settings.
2. Select Local Observances.
3. Add or edit the fixed chapel feast or local liturgical rule.
4. Choose the applicable template, time, precedence, and effective year.
5. Save the observance.
6. Review the affected event dates and make any required human correction.

## Assign eligible ministry members to event responsibilities
<!-- guide: auto -->

**Purpose:** Place qualified and available people into required work while enforcing ministry access, serving levels, and scheduling rules.

### How to

Admin only: 1. Open the event details.
2. In Responsibilities, select Edit.
3. Open the assignment control for the required position or task.
4. Choose an eligible, available member from the candidate list.
5. Save assignments.
6. Confirm the member appears in the responsibility roster.

## Automatically generate and maintain the regular chapel service calendar
<!-- guide: auto -->

**Purpose:** Maintain one reliable base calendar for regular chapel services so downstream staffing and preparation do not depend on repeated manual entry.

### How to

**Automatic workflow**
1. Super Admins configure the approved recurring service rules and templates.
2. The schedule synchronizer creates or updates the regular published Mass events.
3. Administrators review exceptions in Events; ordinary recurring events require no manual recreation.

## Automatically publish normal conflict-free schedules while holding exceptions for review
<!-- guide: auto -->

**Purpose:** Let routine, fully staffed schedules proceed automatically while keeping shortages and conflicts under human review.

### How to

1. A Super Admin creates the repeating event and applies its staffing template.
2. The scheduler checks qualifications, availability, conflicts, and required headcount.
3. Fully staffed conflict-free dates publish automatically.
4. Dates with shortages or conflicts remain drafts and create one review alert.
5. Open a held event, select replacements, and optionally apply the same resolution to matching conflicts.

## Cache Ordo data and retain the last stored reference
<!-- guide: auto -->

**Purpose:** Keep liturgical reference available during source outages and avoid repeatedly depending on a live external page.

### How to

Automatic behavior: 1. Open an event date that has Ordo data.
2. The server retrieves and normalizes the daily reference when a refresh is needed.
3. It stores the result and retrieval time.
4. Later views use the stored reference if the live source is unavailable or a refresh is unnecessary.

## Connect a ministry to a template without requiring positions
<!-- guide: auto -->

**Purpose:** Allow a ministry to participate in an event for coordination purposes without creating false staffing shortages.

### How to

1. Open Templates and create or edit a template.
2. Add the ministry as a participating ministry.
3. Leave the ministry’s responsibility list empty.
4. Save the template.
5. Create an event from the template.
6. Confirm that the ministry participates without creating a shortage or open role.

## Coordinate event planning, food preparation, setup, staffing, and cleanup opportunities
<!-- guide: auto -->

**Purpose:** Coordinate every stage of a chapel event so planning, food, setup, staffing, and cleanup are not managed as disconnected tasks.

### How to

1. Open Events.
2. Select Add Event.
3. Choose Standalone Volunteer Event.
4. Add the required Planning, Food Preparation, Setup, Staffing, and Cleanup responsibilities.
5. Set the work windows and number of openings.
6. Publish or copy the volunteer link.
7. Review signups from the event roster.

## Coordinate several ministries and work areas through one event template
<!-- guide: auto -->

**Purpose:** Give several ministries one shared event context while preserving ownership of each ministry’s work, staffing, and permissions.

### How to

1. Templates.
2. Add/Edit Template.
3. connect each current ministry. Add required positions, optional staffing defaults, or no positions. Ministry admins manage their own blocks; apply the template when creating an event.

## Copy template responsibilities into an event so later template edits do not rewrite the event
<!-- guide: auto -->

**Purpose:** Protect existing events from unintended future template changes while retaining the template as a reusable source for new events.

### How to

1. Create an event and select a template.
2. Save the event so the template responsibilities are copied into event-specific records.
3. Later, edit the original template.
4. Reopen the existing event and confirm its copied responsibilities remain unchanged unless an admin explicitly reapplies a template.

## Create a ministry account while accepting an invitation
<!-- guide: auto -->

**Purpose:** Turn an accepted invitation into a usable account without losing the ministry relationship or requiring a separate onboarding process.

### How to

1. Open the ministry invitation and choose Accept.
2. Enter the required name, phone, email, username, and password information.
3. Resolve any username-availability warning.
4. Submit the form.
5. Sign in with the new account after the membership is activated.

## Create a notification-only account with only a verified email and explicit subscriptions
<!-- guide: auto -->

**Purpose:** Let people receive explicitly chosen notifications without forcing full ministry membership or unnecessary personal-data collection.

### How to

For an event volunteer without a Ministry account: 1. Open the public event registration link.
2. Enter the volunteer's name and contact information.
3. Give consent for the event-related communication channel.
4. Submit the registration; no Ministry membership or login is required.
5. The volunteer receives alerts only for that registered event and does not receive ministry-wide member messages.

## Create recurring or one-time volunteer shifts and tasks with work windows, headcount, qualifications, age rules, and restricted instructions
<!-- guide: auto -->

**Purpose:** Represent flexible operational work with appropriate windows, capacity, qualifications, age rules, and privacy instead of forcing it into a Mass-position model.

### How to

1. Continue coordinating informal cleaning and maintenance through the chapel’s current process.
2. Use a normal event or volunteer opportunity when a dated task needs to be published.
3. Add the work details and contact instructions permitted for that event.
4. Publish the opportunity and review responses.
5. Revisit structured recurring shifts only if the chapel adopts a formal process.

## Create reusable event and staffing templates
<!-- guide: auto -->

**Purpose:** Standardize recurring event structure and staffing expectations so leaders do not rebuild the same responsibilities for every occurrence.

### How to

Admin only: 1. Open the ministry and select Templates.
2. Select New.
3. Enter the template name, description, coordinating ministry, participating ministries, and responsibilities.
4. Save the template.
5. Use Edit, Duplicate, Archive, or Restore from the template list as needed.

## Define event responsibilities as positions, food needs, tasks, or time slots
<!-- guide: auto -->

**Purpose:** Use one flexible model for service positions and operational work so liturgical duties, food, setup, and timed tasks can be scheduled consistently.

### How to

Admin only: 1. Open Templates and create/edit a template, or open an event and select Responsibilities > Edit.
2. Add a responsibility.
3. Choose Position, Food Need, Task, or Time Slot.
4. Set quantity, timing, instructions, volunteer rules, owning ministry, and required level as applicable.
5. Save.

## Detect calendar, facility, resource, and priest conflicts before confirmation
<!-- guide: auto -->

**Purpose:** Prevent double-booked people, priests, rooms, and resources before an event is confirmed, while allowing accountable authorized exceptions.

### How to

**Admin only**
1. Open Events and create or edit an event.
2. Enter the date, time, rooms, resources, ministries, and priest information.
3. Save or preview the event to run the conflict check.
4. Review every calendar, facility, resource, member, or priest conflict shown.
5. Resolve the conflict, or select Ignore and enter the required override reason.
6. Save the event after the conflict review is complete.

## Detect Ordo source failures or structural changes and alert authorized administrators
<!-- guide: auto -->

**Purpose:** Surface unreliable or changed source data before it silently produces incorrect liturgical preparation.

### How to

**Automatic workflow**
1. Open an event and select 1962 Ordo.
2. If the live source cannot be parsed, the app uses the last stored reference.
3. Select the warning indicator to review the fallback and the item requiring verification.
4. An authorized administrator confirms or corrects the event details.

## Email a weekly emergency schedule to leaders
<!-- guide: auto -->

**Purpose:** Give leaders an offline emergency reference so ministry operations can continue during an application or connectivity outage.

### How to

No separate weekly emergency email is sent.
1. The scheduler creates one Daily Admin Alerts summary when substitute requests or unfilled positions need attention.
2. Leaders open Home and select the applicable count.
3. Open the affected event and resolve it.

## Export ministry reports and schedules
<!-- guide: auto -->

**Purpose:** Make schedules and reports portable for printing, sharing, archiving, offline work, and analysis.

### How to

1. Open the applicable Ministry and select Reports.
2. Apply the desired filters.
3. Select Export CSV to download the report.
4. For a printable schedule, open Calendar or Events.
5. Choose the date range and select Download PDF.
6. Open the exported file to verify the permitted information.

## Generate an automatic draft ministry schedule from the approved master calendar
<!-- guide: auto -->

**Purpose:** Reduce manual scheduling work by turning the approved calendar, staffing rules, qualifications, and availability into a reviewable draft.

### How to

**Super Admin only**
1. Open Events.
2. Select Create Repeating Event.
3. Choose the approved template and recurrence rule.
4. Enter the scheduling dates and staffing requirements.
5. Save the series.
6. Review the generated draft occurrences and their automatically selected eligible members.

## Give each user one landing page for all of their ministries
<!-- guide: auto -->

**Purpose:** Give each person one clear starting point for every ministry they belong to, reducing navigation and account confusion.

### How to

1. Sign in to the Ministry App.
2. Open Ministries.
3. Select My Ministries to see every active ministry membership for the account.
4. Choose a ministry to open its shared workspace.

## Import and maintain the public chapel Mass schedule through the approved MyLatinMass Mass Schedule feed
<!-- guide: auto -->

**Purpose:** Keep the Ministry App’s Mass calendar aligned with the approved public schedule and eliminate duplicate manual entry while preserving local corrections.

### How to

**Automatic workflow**
1. The approved Mass Schedule feed is configured for the Ministry App.
2. During build/deployment, or when `npm run sync:mass-schedule` is run, the synchronizer imports the public schedule.
3. It creates or updates normal Ministry App Mass events and the system-managed Low Mass/High Mass templates.
4. It connects the configured Sacristans, Altar Servers, and Ushers ministries.
5. Administrators review exceptions in Events.

## Import future Google Calendar events and compare calendars during transition
<!-- guide: auto -->

**Purpose:** Reduce transition risk by comparing future schedules and avoiding missing or duplicated events while the Ministry App becomes authoritative.

### How to

1. Use the Ministry App Calendar as the official scheduling source.
2. Create and maintain future events directly in the Ministry App.
3. Review the Ministry App schedule during the transition.
4. Do not import or compare a separate Google Calendar unless the chapel later approves a different transition process.

## Invite a person to one or several ministries in one action
<!-- guide: auto -->

**Purpose:** Reduce repetitive invitation work and support people who legitimately serve in more than one ministry.

### How to

**Admin only**
1. Open Members.
2. Select Add New Member.
3. Enter the person’s email address.
4. Select only the ministry or ministries that you are authorized to administer.
5. Send the invitation.
6. Track the response under Pending Members for those ministries.

## Keep administrative access separate from eligibility to serve
<!-- guide: auto -->

**Purpose:** Prevent administrative authority from automatically making someone a staffing candidate, keeping access control separate from serving qualification.

### How to

1. Open the applicable ministry, then Members.
2. Select a member.
3. Set the person's access role (Member or Leader/Admin) independently.
4. Set Can Serve on or off separately.
5. Save; a person may administer the ministry without becoming an assignment candidate.

## Keep cancelled event history instead of deleting it
<!-- guide: auto -->

**Purpose:** Preserve accountability and historical context for cancelled services without continuing to treat them as active events.

### How to

1. Open the event as an authorized admin.
2. Change its status to Cancelled instead of deleting it.
3. Confirm the cancellation.
4. The app retains the event, responsibilities, assignments, and audit history while removing cancelled responsibilities from the active display.

## Keep one-way ministry announcements and notices in an in-app Messages area
<!-- guide: auto -->

**Purpose:** Provide one authoritative in-app inbox for announcements and notices, including a sender copy, so important communication remains visible and auditable.

### How to

1. Open Messages to view the inbox only; there is no separate Sent Messages view.
2. Use View All or Unread to filter the inbox, then open a message or choose Mark All Read.
3. Authorized users choose New Message and select the permitted audience.
4. Every message automatically copies the sender, so sent messages remain available in that person's inbox.

## Keep unanswered assignments reserved and mark them confirmation overdue
<!-- guide: auto -->

**Purpose:** Prevent silence from creating an invisible staffing gap while clearly showing leaders that follow-up is overdue.

### How to

**Automatic workflow**
1. The assignment remains reserved for the assigned member while unconfirmed.
2. The Monday weekly summary includes the upcoming event.
3. The day-before reminder and the profile-selected lead-time reminder are queued without duplicating the event.
4. The member opens the event and confirms or requests the appropriate change.

## Let a guardian switch between their own profile and managed child profiles
<!-- guide: auto -->

**Purpose:** Let guardians act for the correct family member without mixing assignments, availability, or history between profiles.

### How to

Parent/guardian: 1. Open the profile switcher.
2. Select the parent or a managed child.
3. The app reloads Calendar, Events, Availability, and assignments for that active profile.
4. Use the switcher again to return to another linked profile.

## Let a member filter the calendar to only events assigned to them or selected family profiles
<!-- guide: auto -->

**Purpose:** Reduce calendar noise and help members or guardians concentrate on the events that directly affect the selected profiles.

### How to

1. Open Calendar.
2. Select My Events to show events assigned to the active profile or enabled family profiles.
3. In a parent account, open My Profile, then Profiles, and turn individual profile views on or off as needed.
4. Return to Calendar; assigned events remain visually distinguished.

## Let a member leave a ministry
<!-- guide: auto -->

**Purpose:** Let members end a ministry relationship themselves while preserving their account, other memberships, and historical service.

### How to

1. Open the applicable ministry's member view or My Profile > Ministries.
2. Select Leave Ministry.
3. Confirm the action.
4. The membership is removed while the person's account, other ministries, and history remain intact.

## Let a member request a change for an assignment affected by unavailability
<!-- guide: auto -->

**Purpose:** Convert an availability conflict into a trackable request so leaders can correct the assignment while preserving accountability.

### How to

1. Create an unavailable date/range in Availability.
2. Review the affected assignments shown before saving.
3. Select Request Change for the applicable assignment.
4. Confirm the request.
5. The assignment remains tracked with a change-requested state for member and admin follow-up.

## Let a profile mark an exact date available all day, partially available, or unavailable, and add unavailable date ranges
<!-- guide: auto -->

**Purpose:** Let people communicate exact future availability clearly enough for the scheduler to avoid unsuitable assignments.

### How to

1. Open Availability from the main menu.
2. Select Calendar.
3. Choose a future date.
4. Select Available all day, Partially available, or Unavailable.
5. For partial availability, enter the start and end times.
6. To block several dates, enter the range and an optional label, then select Save Range.

## Let administrators mark a member profile as verified and show a shield with a checkmark beside the verified member’s name, primarily for security personnel.
<!-- guide: auto -->

**Purpose:** Provide a simple, visible trust indicator for verified members—especially security personnel—without exposing sensitive verification records.

### How to

1. An authorized admin opens Members and selects the member.
2. Turn the Verified setting on or off.
3. Save the profile.
4. A shield-with-checkmark appears beside the verified member where relevant.
5. The app stores only the verification status, not APR documents or photo metadata.

## Let all signed-in account holders browse general volunteer opportunities
<!-- guide: auto -->

**Purpose:** Help signed-in people discover ways to serve beyond their current ministry memberships.

### How to

1. Sign in to any active Ministry account.
2. Open Volunteer Opportunities from the menu.
3. Browse the published general volunteer opportunities.
4. Open an opportunity to review its date, details, and available roles.
5. Follow the displayed signup or interest instructions.

## Let an invitee securely accept or decline a ministry invitation only once
<!-- guide: auto -->

**Purpose:** Protect invitation decisions from reuse, forwarding mistakes, or duplicate responses while giving the invitee a clear choice.

### How to

1. Open the secure invitation link from the email.
2. Review the inviting chapel/ministry information.
3. Choose Accept or Decline.
4. Submit the response.
5. The one-time link cannot be used to submit a second response.

## Let approved volunteers self-select a service and become immediately confirmed
<!-- guide: auto -->

**Purpose:** Give approved volunteers agency to claim a service immediately, improving engagement and reducing manual assignment work.

### How to

1. Open the published volunteer opportunity link.
2. Review the event date, time, and available opportunities.
3. Select an open service.
4. Enter the requested contact details.
5. Submit the selection.
6. Review the confirmation that the service has been reserved.

## Let authorized users choose the applicable Ordo Mass option and record sacristy notes
<!-- guide: auto -->

**Purpose:** Preserve human liturgical judgment by letting authorized users select the applicable Mass option and record restricted preparation guidance.

### How to

Authorized users: 1. Open the event details and select More Details.
2. Review the available Ordo Mass options.
3. Choose the option applicable to the event.
4. Enter restricted sacristy/preparation notes if needed.
5. Save so the selection, source, and notes remain attached to the event.

## Let each user choose an account-wide reminder lead time
<!-- guide: auto -->

**Purpose:** Let each person choose a useful reminder window that matches their preparation and travel needs.

### How to

1. Open My Profile.
2. Select Notifications.
3. Choose the reminder lead time: 15, 30, 45, 60, 120, 180, or 240 minutes before the event.
4. Save the profile.
5. Future final event reminders use that one account-wide setting for the parent and linked profiles.

## Let each user choose how the app notifies them through profile-level notification settings.
<!-- guide: auto -->

**Purpose:** Respect user choice and consent by letting each account select the delivery methods used for approved Ministry App communications.

### How to

1. Open My Profile.
2. Select Notifications.
3. Enable or disable Email, Telegram, SMS, and Push as desired.
4. Complete any required channel connection or consent.
5. Save; the selected methods apply account-wide to approved summaries, reminders, alerts, and administrator messages.

## Let Father or his assistant convert an existing Mass by changing its template
<!-- guide: auto -->

**Purpose:** Let Father or an authorized assistant change an existing Mass into the needed form quickly so affected ministries can prepare without creating a disconnected event.

### How to

**Authorized users**
1. Open Events and select the existing Mass.
2. Select Edit.
3. Choose Change Template.
4. Select the replacement template.
5. Review the responsibility preview and any staffing changes.
6. Select Apply.
7. Publish the updated event when the review is complete.

## Let guardians manage one or several family members' availability and assignment responses together
<!-- guide: auto -->

**Purpose:** Reduce family scheduling effort by letting guardians coordinate several linked profiles from one account.

### How to

1. Open the profile switcher.
2. Select the family member whose availability or assignment needs attention.
3. Update that profile’s Availability or respond to its assignment.
4. Save the change.
5. Switch to another linked family profile and repeat as needed.
6. Linked parents receive the child’s relevant notifications.

## Let leaders view the roster and change Member/Leader access
<!-- guide: auto -->

**Purpose:** Give leaders an accurate roster and controlled way to manage ministry access without granting chapel-wide authority.

### How to

Admin only: 1. Open Members, then All Members.
2. Select the member to manage.
3. Change Member/Leader access, Can Serve status, or the highest serving level.
4. Save the change.
5. Confirm the updated badge and permitted controls in the roster.

## Let members create recurring exclusion rules while remaining available by default
<!-- guide: auto -->

**Purpose:** Let members express recurring unavailability efficiently while treating all unmatched dates and times as available by default.

### How to

1. Open Availability.
2. Select Exclusion Rules.
3. Choose Create New Exclusion Rule.
4. Select the ministry or ministries, occurrence, and weekday.
5. Choose an unavailable quarter-hour window or All Day.
6. Select Create Exclusion Rule.
7. Confirm that dates not covered by the rule remain available by default.

## Let members mark a specific future date available all day, partially available, or unavailable
<!-- guide: auto -->

**Purpose:** Allow an exact future date to override general rules when a member’s availability is different from their usual pattern.

### How to

1. Open Availability.
2. Select Calendar.
3. Choose a future date.
4. Select Available all day, Partially available, or Unavailable.
5. For partial availability, enter the start and end times.
6. Save the date.
7. Reopen it to confirm the exact-date setting.

## Let ministry admins review pending event issues in date and severity order, then resolve shortages, conflicts, change requests, backups, and overrides from the event details page
<!-- guide: auto -->

**Purpose:** Put the most urgent staffing and schedule exceptions first so ministry admins can resolve them quickly from the authoritative event record.

### How to

**Admin only**
1. Open the dashboard and review Pending Requests, ordered by event date with today's events first and then newer to older.
2. Each item shows only the date, event, issue count, and a severity color so the most urgent work stays at the top.
3. Open an item to go directly to that event's details.
4. Review the admin-only issues for each assignment, select an eligible member from its dropdown, or choose Automate.
5. Select Save Assignments; resolved events leave the pending queue.

## Let one template coordinate several ministries
<!-- guide: auto -->

**Purpose:** Coordinate several ministries around one shared event while preserving each ministry’s responsibilities and authority.

### How to

Admin only: 1. Open Templates and create or edit a template.
2. Choose the coordinating ministry.
3. Add each participating ministry as a separate ministry block.
4. Enter that ministry's instructions and responsibilities.
5. Save; applying the template creates one coordinated event for all included ministries.

## Let participating ministry admins own their section of a shared template
<!-- guide: auto -->

**Purpose:** Give participating ministry admins ownership of their own template section without allowing them to alter another ministry’s plan.

### How to

**Participating Ministry Admin**
1. Open the shared template.
2. Locate your ministry’s template block.
3. Add or edit only your ministry’s permitted instructions and responsibilities.
4. Save the ministry block.
5. Confirm that other ministry blocks remain unchanged.
6. Coordinating ministry admins and Super Admins may review the full template.

## Let unapproved people express interest without claiming an assignment
<!-- guide: auto -->

**Purpose:** Let interested people raise their hand without granting themselves a role or bypassing leader approval.

### How to

1. Open the public volunteer-interest link.
2. Review the event or opportunity details.
3. Enter the name, email, and optional phone number or message.
4. Select Submit Request.
5. Wait for an authorized leader to review the request; submitting interest does not claim an assignment.

## Let users maintain their own contact and account details
<!-- guide: auto -->

**Purpose:** Keep contact and identity information accurate by allowing each user to maintain their own account details.

### How to

1. Open My Profile.
2. Select Account Details.
3. Update the first name, last name, phone, email, or username.
4. Save the changes.
5. Reopen Account Details to confirm the updated information.

## Let volunteers commit to a service while leaders allocate or change the specific position
<!-- guide: auto -->

**Purpose:** Let volunteers commit to attending a service without requiring them to choose a specialized role they may not be qualified to select.

### How to

**Leader setup**
1. Open the event and select Responsibilities.
2. Add a General Volunteer or open-headcount responsibility.
3. Set the number of volunteer openings and publish the opportunity.
4. Allow volunteers to commit to the event through the published link.
5. Open the event roster and assign or change each volunteer’s specific position when ready.

## Maintain a rolling two-month operational scheduling horizon while allowing farther-ahead liturgical reference
<!-- guide: auto -->

**Purpose:** Provide useful long-range liturgical reference without creating unreliable staffing commitments too far in advance.

### How to

1. Open Calendar from the main menu.
2. Use Month, Week, Today, or Custom to review the current operating schedule.
3. Navigate through the current two-month scheduling window to manage assignments and events.
4. For dates farther ahead, navigate to the future date and open its Ordo reference for liturgical planning.

## Maintain one combined calendar across ministries
<!-- guide: auto -->

**Purpose:** Show a person’s ministry commitments together so overlapping events and cross-ministry conflicts are visible in one place.

### How to

1. Open Calendar from the main menu.
2. Leave the view on All Events to see every visible event across ministries.
3. Use event colors and assignment indicators to identify the active profile's participation.
4. Select an event for details.

## Make the app installable like a mobile app
<!-- guide: auto -->

**Purpose:** Reduce adoption friction by letting people launch the Ministry App from their home screen with an app-like experience, without maintaining separate native apps.

### How to

1. Open ministry.mylatinmass.com in Safari on iPhone/iPad or Chrome on Android/desktop.
2. On iPhone/iPad, tap Share, then Add to Home Screen; in Chrome, choose Install app or Add to Home screen.
3. Confirm the installation.
4. Open Ministry from the new app icon and sign in.

## Make the ministry directory compact and easy to scan
<!-- guide: auto -->

**Purpose:** Reduce visual noise and help people find the correct ministry quickly, especially on a phone.

### How to

1. Open Ministries.
2. Use Search or Sort to narrow the ministry directory.
3. Scan the compact cards by icon and single-line ministry name.
4. Open the desired ministry card.
5. Super Admins may use Add Ministry; regular members will not see that control.

## Manage APR requirements, document packets, screening types, renewals, and hard assignment eligibility without exposing private reasons
<!-- guide: auto -->

**Purpose:** Enforce role-specific screening eligibility without exposing or storing sensitive evidence and private reasons in ordinary ministry workflows.

### How to

No official APR documents are stored in the Ministry App.
1. An authorized administrator records only the permitted reminder date or simple verification status.
2. The app sends the configured renewal reminder when due.
3. Official documents, screening files, and private compliance reasons remain in the chapel's approved external system.

## Open a detailed event view from calendars and lists
<!-- guide: auto -->

**Purpose:** Put the complete permitted context for an event in one place so users can understand time, location, responsibilities, assignments, and status before acting.

### How to

1. Open Calendar or Events.
2. Select an event card or calendar entry.
3. Review the feast/class/vestments header, event name, date, time, location, and active responsibilities.
4. Select More Details for the slide-in day information or 1962 Ordo for the source.
5. Close the panel or return to the schedule when finished.

## Persist real ministry data in the existing database
<!-- guide: auto -->

**Purpose:** Preserve authoritative schedules, memberships, assignments, preferences, and history across sessions and devices instead of relying on temporary browser data.

### How to

1. Create or update a ministry record through the app, such as an event, assignment, availability block, profile, or template.
2. Save the change.
3. Refresh the page or sign in on another device.
4. Confirm the saved information reloads from the Ministry database.

## Prevent assignment of a member who is blocked or already assigned to an overlapping event
<!-- guide: auto -->

**Purpose:** Avoid assigning someone who is unavailable or already committed elsewhere, reducing last-minute corrections and volunteer frustration.

### How to

1. The member records unavailable dates in Availability, and existing assignments remain visible for review.
2. An admin opens an event responsibility and views candidates.
3. Members blocked for that time or already assigned to an overlapping active event are excluded.
4. Any direct assignment attempt is rechecked by the server before saving.

## Prevent duplicate coverage and assignments beyond the required headcount
<!-- guide: auto -->

**Purpose:** Prevent duplicate assignments and unnecessary overstaffing so coverage totals remain trustworthy.

### How to

Automatic safeguard: 1. Set the required headcount on the responsibility.
2. Assign eligible members and save.
3. Once the required quantity is covered, the server prevents additional active assignments.
4. If the same person is selected twice, the duplicate is rejected.

## Preview and apply a different template to an existing event
<!-- guide: auto -->

**Purpose:** Let leaders safely restructure an existing event and understand what responsibilities will be retained, added, or removed before applying the change.

### How to

Admin only: 1. Open an existing event and choose Edit.
2. Select a different template.
3. Review the preview showing responsibilities that will be retained, added, or removed.
4. Resolve any highlighted level or assignment issue.
5. Confirm the change and save the event.

## Provide a basic feedback or problem-reporting button inside the app
<!-- guide: auto -->

**Purpose:** Give users a low-friction way to report defects and confusion with enough context for maintainers to diagnose and improve the app.

### How to

1. Sign in to the Ministry App.
2. Open the Support/Report a Problem option from the desktop menu or mobile menu.
3. Describe the problem and, if useful, attach up to three supported image, PDF, or text files.
4. Submit the form.
5. The app adds account, active-profile, and page context and sends the report to the configured support recipients.

## Provide a privacy-safe public chapel calendar without volunteer names, roles, counts, or private notes
<!-- guide: auto -->

**Purpose:** Give the public accurate service information while preventing disclosure of volunteers, staffing needs, private notes, and restricted operations.

### How to

1. Open the public chapel website.
2. Select Events to open the public calendar.
3. Browse or open a published event.
4. Review the public date, time, title, and permitted event information.
5. Volunteer names, private roles, staffing counts, and private notes are automatically excluded from this view.

## Provide automated daily backups, restore procedures, and operational monitoring
<!-- guide: auto -->

**Purpose:** Protect mission-critical scheduling data from loss and shorten recovery time when a provider, deployment, or database fails.

### How to

Operational setup:
1. Confirm automated database recovery/backups are enabled with the database provider.
2. Keep application versions in the chapel-owned GitHub repository.
3. Monitor failed deployments, scheduler runs, and notification-delivery errors.
4. Test a restore procedure periodically and record the result outside the Ministry App.

## Provide browser push notifications
<!-- guide: auto -->

**Purpose:** Provide timely device-level alerts without requiring users to keep the app open or depend on a single external messaging service.

### How to

1. Install the Ministry App on the Home Screen first when using iPhone or iPad.
2. Open My Profile, then Notifications.
3. Select Enable Push Notifications and approve the browser prompt.
4. Use Send Test Notification to confirm delivery.
5. Disable push later from the same screen if desired.

## Provide month, week, today, and custom-date calendar views
<!-- guide: auto -->

**Purpose:** Support quick daily checks, weekly planning, monthly scheduling, and custom-range review without forcing one calendar format on every task.

### How to

1. Open Calendar.
2. Choose List, Week, or Month to change the layout.
3. Select Today to return to the current date.
4. Use the date navigation controls to move to another date or range.
5. Select any event to open its details.

## Provide named internal ministry calendars only to approved members
<!-- guide: auto -->

**Purpose:** Provide approved members with the named operational schedule they need without exposing it publicly.

### How to

1. Sign in to the Ministry App.
2. Open Ministries and select an approved ministry.
3. Select Calendar.
4. Browse the ministry’s named internal events and assignments.
5. If the ministry is not available, request access and wait for an administrator’s approval.

## Provide one phone-friendly web app as the authoritative Ministry App
<!-- guide: auto -->

**Purpose:** Create one trusted, device-independent system of record for ministry operations so members and leaders work from the same current information.

### How to

1. Open ministry.mylatinmass.com on a phone, tablet, or computer.
2. Sign in with the same Ministry account on any device.
3. Use the shared Calendar, Events, Availability, Messages, Ministries, and My Profile areas; saved changes remain available from every device.

## Provide optional SMS notifications through the user’s profile notification settings.
<!-- guide: auto -->

**Purpose:** Offer an optional text-message channel for users who prefer SMS, with explicit consent and controlled transactional use.

### How to

1. Open My Profile, then Notifications.
2. Enable SMS.
3. Review and provide transactional-message consent.
4. Confirm the account phone number and save.
5. Applicable reminders and alerts are then sent through the configured SMS provider.

## Provide optional Telegram direct messages for private schedules, confirmations, absences, and substitutions
<!-- guide: auto -->

**Purpose:** Offer private, optional direct messaging through a channel many volunteers already use while keeping the app as the authoritative record.

### How to

1. Open My Profile, then Notifications.
2. Select Connect Telegram.
3. Start MinistryAppBot and complete account linking.
4. Return to the Ministry App, enable Telegram, and save.
5. Use Send Test Message to verify delivery; disconnect or disable Telegram from the same area.

## Provide printable current and upcoming ministry schedules
<!-- guide: auto -->

**Purpose:** Make schedules usable for posting, meetings, offline reference, and emergency continuity outside the app.

### How to

1. Open Calendar, Events, or a ministry schedule.
2. Select the required date range or filter.
3. Choose Download PDF or Print / PDF.
4. Review the generated current or upcoming schedule.
5. Save the PDF or send it to the printer.

## Provide private, revocable Google/Apple personal calendar subscriptions
<!-- guide: auto -->

**Purpose:** Place a person’s permitted schedule in their preferred calendar while allowing access to be withdrawn when needed.

### How to

1. Open the public Events calendar.
2. Select Add or Subscribe to Calendar.
3. Choose Google Calendar or Apple Calendar.
4. Follow the calendar provider’s confirmation prompt.
5. Remove the subscription later from the same calendar provider if access is no longer needed.

## Provide reliable email delivery with visible delivery status, retries, and fallback handling
<!-- guide: auto -->

**Purpose:** Make email delivery dependable and diagnosable so administrators can distinguish delivered, pending, retried, disabled, and failed messages.

### How to

1. An administrator sends a message or the scheduler creates a reminder.
2. Open Messages, then Sent, to review recipient totals and Delivered, Pending, Not Enabled, or Failed counts.
3. Failed deliveries retry automatically.
4. If primary Gmail delivery fails, email uses the configured fallback SMTP provider.
5. Recheck Sent to confirm the final delivery state.

## Provide reports for participation, coverage, workload, fairness, shortages, and recent service
<!-- guide: auto -->

**Purpose:** Give leaders evidence for coverage, fairness, workload, reliability, and shortage decisions instead of relying on memory.

### How to

1. Open the applicable Ministry.
2. Select Reports.
3. Choose the reporting period or member filter.
4. Review participation, coverage, workload, fairness, shortages, and recent service.
5. Open a detailed member or event record when follow-up is required.
6. Export the report if a separate copy is needed.

## Provide the full substitute workflow while the original volunteer remains responsible until acceptance
<!-- guide: auto -->

**Purpose:** Manage substitution as a traceable handoff so the original volunteer remains responsible until a qualified replacement is secured.

### How to

1. Open Home and locate Upcoming Assignments.
2. Open the assignment that requires a substitute.
3. Select Request Sub.
4. Enter an optional explanation and submit the request.
5. Monitor the request while the original assignment remains active.
6. Review the notification when a qualified substitute accepts the duty.

## Publish a controlled calendar API/feed for MyLatinMass and future external sites
<!-- guide: auto -->

**Purpose:** Provide a controlled, privacy-safe source that MyLatinMass and future websites can reuse without direct access to private application data.

### How to

1. Open the public Events calendar on MyLatinMass.
2. Apply the desired public date or event filters.
3. Use the published public calendar or feed as the privacy-safe source.
4. External websites should consume this same source instead of creating a separate schedule.
5. Confirm that private volunteer and ministry information is not present in the public output.

## Require a second factor for privileged users on new devices or after 30 days
<!-- guide: auto -->

**Purpose:** Add stronger protection for high-impact administrative accounts, especially when a privileged user signs in from an unfamiliar or long-unverified device.

### How to

1. Sign in with the privileged account’s existing username and password.
2. Complete the normal protected sign-in process.
3. Continue using the authorized administrative areas; the chapel currently does not require a separate second-factor prompt.
4. Contact a chapel owner if privileged access must be reviewed or changed.

## Require authenticated access to private ministry workspaces
<!-- guide: auto -->

**Purpose:** Protect private ministry, family, assignment, and operational information from unauthenticated access.

### How to

1. Open a private Ministry App page.
2. Enter the account username and password.
3. Select Sign In.
4. The app creates a protected session and opens only the pages and data permitted for that account.

## Require ministry leader approval before a managed child joins a ministry
<!-- guide: auto -->

**Purpose:** Preserve ministry approval authority and child safety before a managed child becomes an active ministry member.

### How to

Parent/guardian: 1. Switch to the managed child profile.
2. Request access to the desired ministry.
3. A ministry admin opens Members > Pending Members.
4. The admin reviews and approves or declines the request.
5. The child joins only after approval.

## Revalidate access when a protected session is used
<!-- guide: auto -->

**Purpose:** Make permission changes and account deactivation take effect promptly instead of trusting an old session indefinitely.

### How to

Automatic security check: 1. Use any protected page or action while signed in.
2. The server rechecks the account and applicable ministry membership.
3. If either is inactive or unauthorized, access is refused and the user must sign in again or obtain approval.

## Run four-week parallel pilots for sacristans, altar servers, and ushers, then make Chapel Scheduler the official system and retain MSP as history/fallback
<!-- guide: auto -->

**Purpose:** Validate the system against real chapel work in controlled stages, correct problems before full adoption, and preserve a fallback during transition.

### How to

1. Continue the parallel pilot with Sacristans, Altar Servers, and Ushers.
2. Compare Ministry App schedules with the current system during the four-week transition.
3. Report defects through Menu > Support.
4. Have stakeholders review results and approve production cutover.
5. After cutover, use the Ministry App as the official scheduler and retain MSP only as history/fallback.

## Run the monthly volunteering, close, review, confirmation, and publication cycle
<!-- guide: auto -->

**Purpose:** Create a predictable scheduling rhythm that gives volunteers time to participate and leaders time to review before schedules become final.

### How to

No separate monthly confirmation cycle is used.
1. Create repeating events for the upcoming schedule.
2. Let conflict-free assignments publish automatically.
3. Administrators adjust assignments when needed.
4. Members use Request Change or Request Sub only when they cannot serve.

## Schedule League of Our Lady of Victory chapel cleaning and priests' meals
<!-- guide: auto -->

**Purpose:** Make recurring chapel cleaning and priests’ meal needs visible and assignable instead of relying entirely on informal coordination.

### How to

1. Open Events.
2. Select Add Event.
3. Choose Standalone Volunteer Event.
4. Add Chapel Cleaning or Priest Meal responsibilities.
5. Set the dates, work times, openings, and approval requirements.
6. Publish the event and monitor the volunteer roster.

## Schedule maintenance work, rooms, setup/cleanup buffers, and facility blocks
<!-- guide: auto -->

**Purpose:** Prevent facility and resource conflicts while ensuring setup, cleanup, maintenance, and room blocks are included in event planning.

### How to

1. Super Admin: Chapel Settings.
2. Chapel rooms to add, edit, deactivate, or delete rooms. Reservation Admin: Reservations.
3. Events.
4. Add Event.
5. Room Reservation.
6. choose one, several, or all rooms and the time.
7. Save Draft or Publish. Conflicting room reservations produce an immediate warning. Priest Ministry events default to Father's Office.

## Scope open roles and editing to the active ministry
<!-- guide: auto -->

**Purpose:** Keep leaders focused on their own ministry’s shortages and enforce editing boundaries within shared events.

### How to

1. Open the applicable Ministry.
2. Select Open Roles.
3. Review only the unfilled positions owned by that ministry.
4. Open a role to view the full event details.
5. Ministry admins may edit their ministry’s section; Super Admins may edit all permitted ministry sections.
6. Save changes and return to Open Roles to confirm the updated list.

## Send assignment invitations and one consolidated weekly or monthly assignment review
<!-- guide: auto -->

**Purpose:** Reduce notification fatigue and hidden commitments by presenting upcoming assignments in one consolidated review.

### How to

Automatic every Monday morning:
1. The scheduler gathers published assignments from Monday through Sunday for each account.
2. It counts distinct events, not individual duties.
3. For a parent account, it combines the parent's and all linked children's events into one profile-level alert.
4. Email includes full event and duty details; SMS, Telegram, and push use a concise count and direct the user to the Ministry App.

## Send guardian alerts for a child's critical assignment or schedule change
<!-- guide: auto -->

**Purpose:** Keep guardians informed about critical changes affecting a managed child so they can coordinate transportation and responsibility.

### How to

Automatic household workflow:
1. Link the child profile to the parent/guardian account.
2. The scheduler includes the child's assignments in the parent's consolidated household summary and reminders.
3. The parent opens the Ministry App and switches profiles when detailed child-specific action is needed.

## Send midpoint, deadline, overdue, and one-week service reminders without duplicates
<!-- guide: auto -->

**Purpose:** Prompt timely action at meaningful milestones while deduplication prevents repeated reminders for the same responsibility.

### How to

Automatic reminder sequence:
1. The scheduler reconciles published assignments and queues one day-before reminder for each upcoming event.
2. It also queues the final reminder using the account's selected lead time.
3. Parent accounts receive one combined profile alert when several linked members are assigned to the same event.
4. The reminder worker runs every minute and sends through the account's enabled channels.
5. Event-version timestamps are preserved and compared at millisecond precision so valid reminders are not canceled by database timestamp rounding.
6. Duplicate keys prevent the same scheduled reminder from being sent twice.

## Send schedule publication, change, cancellation, and substitute notifications
<!-- guide: auto -->

**Purpose:** Keep affected people informed when an authoritative schedule changes so they do not rely on stale plans.

### How to

**Automatic workflow**
1. An authorized admin publishes, changes, cancels, or substitutes an assignment.
2. The app records the change in Home > Pending Alerts.
3. The approved weekly summary and event reminders use the member's enabled external notification methods.
4. Open the alert to review the affected event.

## Send urgent last-minute acknowledgments and escalate when nobody responds
<!-- guide: auto -->

**Purpose:** Require visible acknowledgment and escalation for urgent gaps so critical last-minute changes are not lost in ordinary messages.

### How to

Automatic admin workflow:
1. The scheduler identifies unresolved substitute requests and unfilled positions.
2. It combines them into one Daily Admin Alerts summary.
3. An admin opens Home and selects Sub Requests Pending or Unfilled Positions.
4. Open the affected event and resolve the assignment.

## Separate every chapel's data so the software can safely support multiple chapels
<!-- guide: auto -->

**Purpose:** Prevent one chapel from seeing or affecting another chapel’s information while preserving a safe path for future multi-chapel adoption.

### How to

No member action is required.
1. Each chapel uses its own deployment and database configuration.
2. Chapel administrators keep environment credentials specific to that chapel.
3. Access checks scope every protected record and action to the configured chapel.

## Show assignments that overlap a newly selected unavailable range
<!-- guide: auto -->

**Purpose:** Warn members about commitments affected by new unavailability before a scheduling problem is hidden.

### How to

1. Open Availability and select a date or range.
2. Mark it unavailable.
3. Before saving, review the conflict list.
4. The app shows each overlapping assignment with its event and duty details.
5. Resolve or acknowledge the conflicts, then save the availability block.

## Show compact event cards with clear coverage urgency
<!-- guide: auto -->

**Purpose:** Communicate event coverage and urgency at a glance so leaders can prioritize staffing problems without opening every event.

### How to

1. Open a Ministry and select Upcoming Events.
2. Scan each compact card for the event date, time, and template.
3. Use the green check to identify filled events.
4. Use the yellow warning to identify open roles.
5. Treat a red warning as urgent because the event has an opening within two days.
6. Open the event card to review or resolve its staffing.

## Show final availability on the calendar and use the same result for automatic scheduling
<!-- guide: auto -->

**Purpose:** Ensure the calendar display and automatic scheduler use the same final availability result, preventing contradictory decisions.

### How to

1. Open Availability and select Calendar.
2. Review neutral dates as available, split dates as partially available, and blocked dates as unavailable.
3. Open a date to review its final availability window.
4. Create or edit an event that falls within that window.
5. Run automatic assignment.
6. Confirm that only events fitting the member’s final available time are eligible for assignment.

## Show leaders an overview of upcoming events, serving members, open roles, and active templates
<!-- guide: auto -->

**Purpose:** Give leaders immediate situational awareness of upcoming work, available people, staffing gaps, and reusable plans.

### How to

1. Open a ministry you administer.
2. Use the overview cards for Upcoming Events, Serving Members, Open Roles, and Active Templates.
3. Select a card to open its detailed list.
4. Review the upcoming-event and template summaries for the next action.

## Show members a personal home view focused on upcoming assignments and items needing attention
<!-- guide: auto -->

**Purpose:** Focus members on their next commitments and unresolved actions so important assignments or requests are not missed.

### How to

1. Sign in and open the home/dashboard view.
2. Review upcoming published assignments.
3. Check the items marked as needing attention, such as an unconfirmed assignment or unresolved response.
4. Select an item to open its event and respond.

## Show only current ministries in templates and identify validation errors precisely
<!-- guide: auto -->

**Purpose:** Prevent obsolete ministry choices and make configuration errors easy to identify and correct at the exact field.

### How to

1. Open Templates and create or edit a template.
2. Add a participating ministry from the current-ministry list.
3. Configure its responsibilities and required levels.
4. If validation highlights a field, read the inline explanation.
5. Correct the ministry or level mismatch.
6. Save again after all highlighted errors are resolved.

## Show the 1962 Ordo reference for an event date
<!-- guide: auto -->

**Purpose:** Give sacristans, servers, clergy, and other authorized users the liturgical context needed to prepare correctly for a specific date.

### How to

1. Open an event from Calendar or Events.
2. Review the feast of the day, liturgical class, and vestment color at the top.
3. Select More Details to open the slide-in day information.
4. Select 1962 Ordo to open the referenced source.

## Support Auto Suggest, event-level approval, and Leave Open
<!-- guide: auto -->

**Purpose:** Speed routine staffing while preserving leader review, intentional open positions, and one clear event-level approval decision.

### How to

**Admin only**
1. Open the Ministry and select Open Roles.
2. Select Auto Suggest for the event.
3. Review the suggested members based on history, levels, and availability.
4. Adjust any position or select Leave Open when no assignment should be made.
5. Select Approve All to approve the event once.
6. Confirm that a fully staffed event no longer appears under Open Roles.

## Support chapel-wide Owner/Super Admin and ministry-specific Leader/Member access
<!-- guide: auto -->

**Purpose:** Apply least-privilege access so chapel-wide administrators, ministry leaders, and members see and change only what their responsibilities require.

### How to

1. A Super Admin signs in to access chapel-wide administration and every ministry.
2. A ministry admin opens only a ministry they administer to use that ministry's management tools.
3. A regular member opens the same workspace with member-only controls.
4. The server enforces the role on every protected action, even if a button is hidden in the interface.

## Support draft, published, cancelled, completed, and archived event states
<!-- guide: auto -->

**Purpose:** Represent the full operational lifecycle of an event so drafts, live schedules, cancellations, completion, and retained history are not confused.

### How to

Admin only: 1. Open the event.
2. Choose Edit or the available status action.
3. Select Draft, Published, Cancelled, Completed, or Archived as appropriate.
4. Confirm and save.
5. The event remains stored with its new lifecycle state.

## Support explicit opt-in for compatible double duty while blocking incompatible duties
<!-- guide: auto -->

**Purpose:** Use compatible double duty when a volunteer explicitly allows it while continuing to block unsafe or impossible overlaps.

### How to

1. Open Events and create or edit an event.
2. Add the applicable responsibilities and assignments.
3. Review any double-duty conflict warning.
4. Keep incompatible duties separated.
5. For an allowed operational overlap, select Ignore and enter the reason.
6. Save and verify the final assignments.

## Support Main Administrator, APR Coordinator, Head, Alternate, scheduler, Ceremony Coordinator, Father's Assistant, clergy, and other fine-grained operational roles
<!-- guide: auto -->

**Purpose:** Model real operational responsibilities precisely so approval, scheduling, compliance, and clerical decisions reach the correct authorized people.

### How to

1. Use Super Admin for chapel-wide administration.
2. Use ministry-admin access for administrators of a specific ministry.
3. Use Member, Can Serve, and ministry Level settings for ordinary ministry participation and eligibility.
4. The additional named operational roles are not separately configured because the chapel considers the current access model sufficient.

## Support optional default staffing targets that do not create shortages
<!-- guide: auto -->

**Purpose:** Preserve useful planning targets without treating optional staffing goals as required coverage failures.

### How to

1. Open a template and select the participating ministry.
2. Add the suggested responsibility or staffing target.
3. Enter the suggested quantity, such as Usher × 3.
4. Leave Required turned off.
5. Save the template.
6. Confirm that the suggested slots are available without creating shortage warnings.

## Support optional frequency limits and a cross-ministry monthly automatic-assignment maximum
<!-- guide: auto -->

**Purpose:** Protect volunteers from excessive automatic assignments within one ministry or across all of their ministries.

### How to

**Ministry Admin**
1. Open Members and select the member.
2. Open Service Frequency.
3. Set the optional monthly limit for that ministry.
4. Save the member setting.
5. If an account-wide limit is needed, ask a Super Admin to set the cross-ministry monthly maximum.
6. Confirm that automatic assignments respect the saved limits.

## Support parent accounts with managed child profiles and guardian contact delivery
<!-- guide: auto -->

**Purpose:** Route child-related notices to responsible guardians while keeping each child’s assignments and history attached to the correct profile.

### How to

1. Use Parent membership with managed child profiles.
2. One child profile may be linked to both Mom and Dad; each linked parent has full management access and receives the child's relevant assignment and event notifications.

## Support parent-only access to managed child profiles
<!-- guide: auto -->

**Purpose:** Support children without requiring their own device or login by keeping all actions under parent or guardian control.

### How to

1. Open My Profile and select Profiles.
2. Choose the managed child profile.
3. Use the parent or guardian account to manage the child’s ministries, availability, and assignments.
4. Switch back to the parent profile when finished.
5. A separate child login is not required while the profile remains parent-managed.

## Support recurring service preferences such as Prefer, Can help sometimes, Available if necessary, Cannot serve, and Not specified
<!-- guide: auto -->

**Purpose:** Capture different degrees of willingness for recurring service times so automatic scheduling can distinguish preference from mere possibility.

### How to

1. Open Availability.
2. Select Service Frequency.
3. Choose the applicable ministry.
4. Select Prefer, Can help sometimes, Available if necessary, Cannot serve, or Not specified.
5. Select Update.
6. Reopen the ministry preference to confirm the saved choice.

## Support special invitation-only positions through template and event responsibilities
<!-- guide: auto -->

**Purpose:** Keep sensitive or specialized positions controlled by leaders while still scheduling them within the same event and template system.

### How to

1. Open Templates or Event Details.
2. Select Add Responsibility.
3. Enter the special position and owning ministry.
4. Add the required ministry level or qualification.
5. Enable approval or keep the position privately assigned.
6. Save and verify that only eligible people can be selected.

## Track Archconfraternity of St. Stephen level history
<!-- guide: auto -->

**Purpose:** Preserve dated formation and advancement history so leaders can understand a server’s current level and progression over time.

### How to

1. Open the applicable ministry and select Members.
2. Choose the member.
3. Open the ministry level or advancement history.
4. Select the Archconfraternity of St. Stephen level achieved.
5. Enter the date the member achieved that level.
6. Save and confirm that the dated level appears in the member’s history.

## Track completed service, recent workload, and six-month position history
<!-- guide: auto -->

**Purpose:** Support fair scheduling, reliability review, and recognition of service with a trustworthy record of outcomes and recent workload.

### How to

1. Open the applicable Ministry.
2. Select Reports.
3. Choose the member or reporting period.
4. Review completed service, recent workload, and the six-month position history.
5. Apply filters or export the report when a separate record is needed.

## Track each participating ministry's schedule state for an event
<!-- guide: auto -->

**Purpose:** Let each participating ministry manage its own readiness within a shared event without forcing every ministry into the same state.

### How to

Admin only: 1. Open an event that includes several ministries.
2. Open the participating ministry's event controls.
3. Set that ministry's schedule state to Planning, Under Review, Ready, Published, Changed, or Cancelled.
4. Save.
5. Repeat for other participating ministries without changing their independent states.

## Track guardian-final versus independent minor confirmation modes
<!-- guide: auto -->

**Purpose:** Make it clear who has final authority for a minor’s assignment responses and prevent ambiguous or conflicting confirmations.

### How to

1. Keep the child as a managed profile under the parent or guardian account.
2. Use the guardian account to review the child’s assignments.
3. Submit confirmations, declines, or change requests for the child.
4. Switch profiles to confirm that the response was saved.
5. No separate independent-minor confirmation mode is required while the profile remains managed.

## Turn ministry summary cards into admin filtering and navigation controls
<!-- guide: auto -->

**Purpose:** Turn summary information into direct navigation so admins can move immediately from a count to the work that requires attention.

### How to

Ministry Admin or Super Admin:
1. Open the Ministry workspace.
2. Select Upcoming Events, Serving Members, Open Roles, or Templates.
3. Review the filtered list opened by that summary action.
4. On mobile, use the same four actions in the compact navigation area.
5. Return to the Ministry overview to choose another section.

## Update an assignment automatically when an accepted substitute takes over
<!-- guide: auto -->

**Purpose:** Complete the handoff atomically so only one qualified substitute receives the assignment and the original responsibility is closed correctly.

### How to

1. Open the substitution offer from Notifications or Messages.
2. Review the event, responsibility, and time.
3. Select Accept.
4. Wait while the app checks qualifications and schedule conflicts.
5. Confirm that the assignment now appears under the accepting member and the original request is closed.

## Use a compact ministry header with optional Learn More details
<!-- guide: auto -->

**Purpose:** Keep the working header compact while making descriptive information available only when someone asks for it.

### How to

1. Open a Ministry page.
2. Review the ministry name in the compact header.
3. Select Learn More when additional ministry information is needed.
4. Read the description in the slide-in panel.
5. Select Close to return to the ministry workspace.

## Use chapel-owned production accounts and at least two approved technical custodians
<!-- guide: auto -->

**Purpose:** Ensure the chapel retains control and operational continuity so the system does not depend on one person’s credentials, accounts, or institutional knowledge.

### How to

Operational setup:
1. The chapel Owner keeps ownership of the production Vercel, database, email, and related provider accounts.
2. Add at least two chapel-approved technical custodians to those provider accounts.
3. Review access periodically and remove anyone who is no longer authorized.

## Use shared components so one implementation can serve many ministries
<!-- guide: auto -->

**Purpose:** Keep behavior consistent across ministries, reduce duplicate development, and allow improvements or fixes to benefit every ministry at once.

### How to

1. Open Ministries, then choose My Ministries.
2. Select any ministry you belong to.
3. Use the same Events, Templates, Members, Availability, and profile tools.
4. Return to Ministries and select another ministry; the same components load that ministry's permitted data.

## Use skeleton loading states for ministry data views
<!-- guide: auto -->

**Purpose:** Reassure users that data is loading and reduce the perception that a ministry screen is empty or broken.

### How to

1. Open Members, Open Roles, or Templates.
2. Watch for the skeleton cards or rows while data is loading.
3. Wait for the requested records to replace the skeletons.
4. If the skeleton remains indefinitely, refresh the page and try again.
5. Use Support to report the page if the records still do not load.

## Use the MyLatinMass visual style and a consistent ministry workspace
<!-- guide: auto -->

**Purpose:** Make the workspace feel familiar and coherent with MyLatinMass so users can move between ministry functions without relearning the interface.

### How to

1. Sign in to the Ministry App.
2. Move between the main menu items and any ministry workspace.
3. The shared MyLatinMass colors, typography, navigation, cards, calendars, and responsive layout apply automatically.
