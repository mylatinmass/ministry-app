# Chapel Scheduler: Early-September Alpha Plan

## Target outcome

Launch a private, reversible alpha for the chapel administrator and approximately eight sacristans during the week of **August 31–September 4, 2026**. The current scheduling process remains available during the alpha; Chapel Scheduler does not become the official schedule until the pilot is accepted.

## Alpha scope

- Public chapel service calendar without volunteer information
- Secure passwordless accounts and role-based permissions
- Sacristan roster, preferences, and absences
- Draft assignments with workload balancing and leader override
- Open-position volunteering
- Automatically accepted assignments, notices, reminders, and exception handling
- Basic substitute requests
- Manual service additions, changes, and cancellations
- Email notifications
- Printable current schedule and retained assignment history
- Administrative audit trail, backups, and recovery procedure

Telegram, altar servers, ushers, plain-language scheduling, advanced APR document handling, website feeds, and other volunteer ministries remain outside the alpha unless the core schedule is stable ahead of plan.

## Milestones

### July 15–24: prerequisites and technical decision

- Review the webmaster brief together.
- Identify hosting, DNS, email, source-code custody, backups, and support ownership.
- Confirm the alpha decision-maker and tester list.
- Obtain permission from participating sacristans.
- Select the production technology only after the webmaster discussion.

**Gate:** Do not place real personal data into an environment that lacks approved access controls, backups, and ownership.

### July 27–August 7: secure foundation

- Establish the chapel-owned source repository and separate test environment.
- Implement the database, authentication, chapel boundary, roles, and audit trail.
- Implement the public/private calendar boundary.
- Load fictional services and complete security-focused tests.

**Deliverable for August 8:** production-foundation status, remaining risks, and the existing stakeholder POC.

### August 8: stakeholder review

- Demonstrate the proposed workflows and permission boundaries.
- Confirm that the private alpha may proceed.
- Record requested corrections and explicitly reject scope additions that would endanger the alpha date.

### August 10–16: calendar and administration

- Implement recurring chapel services and manual exceptions.
- Implement the administrator calendar editor.
- Import or enter the initial alpha schedule.
- Verify public, ministry, and administrative visibility.

### August 17–23: sacristan scheduling

- Implement roster approval, preferences, absences, open positions, and balancing.
- Implement draft review, manual overrides, assignment notices, exception handling, and history.
- Test cancelled and changed services.

### August 24–30: communications and acceptance testing

- Implement authenticated email, reminders, printing, and substitute requests.
- Test backup restoration and administrator recovery.
- Run complete fictional-data scenarios.
- Invite the administrator and two sacristans to a pre-alpha test.
- Correct blocking usability and privacy defects.

### August 31–September 4: private alpha launch

- Invite the remaining pilot sacristans.
- Run Chapel Scheduler in parallel with the current process.
- Review defects and feedback daily during the first week.
- Make no automatic assignments or public website changes without administrator review.

## Information needed from the chapel administrator

- Names and verified email addresses of consenting pilot sacristans
- Their current recurring preferences and known absences
- The initial service date range and known exceptions
- The people assigned to main-administrator, sacristan-leader, alternate, and APR roles
- The name and email address from which system messages should appear
- Confirmation of who may view names, current schedules, and history
- Availability for short acceptance-test sessions during August

## Schedule risks

The early-September target depends on resolving hosting and email decisions promptly, keeping the alpha limited to sacristans, receiving pilot information on time, and obtaining stakeholder permission on August 8. Telegram or other ministry scheduling should not delay this alpha. If secure hosting or email cannot be established in time, the alpha should move rather than weaken privacy or reliability controls.

## Alpha success criteria

- All pilot services and sacristan positions are represented correctly.
- Public users cannot see volunteer or restricted information.
- Sacristans can understand their assignments and respond without training.
- The administrator can change a service and produce an accurate printable schedule.
- No assignment is lost when a service changes or a substitute is requested.
- Backups can be restored and all administrative changes are auditable.
- The pilot group agrees that the application reduces rather than increases scheduling work.
