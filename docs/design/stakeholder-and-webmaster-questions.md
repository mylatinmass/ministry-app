# Chapel Scheduler: Review and Integration Questions

Use this alongside the architecture proposal. Questions are grouped by the person most likely to answer them.

## Questions for all reviewers

1. Does the proposed September sacristan pilot contain anything unnecessary?
2. Is anything essential missing from the pilot's registration, scheduling, confirmation, or substitution workflow?
3. Are the role and privacy boundaries understandable?
4. Are public, ministry-only, and private calendar visibility rules correct?
5. Is the Advent rollout realistic given the four-week parallel pilots?
6. Who has final authority to accept the Phase 1 pilot?

## Questions for the webmaster

### Website and domain

1. What platform and hosting provider power mylatinmass.com?
2. Can `schedule.mylatinmass.com` point to a separately hosted application?
3. Who controls DNS and TLS configuration?
4. Can the site embed or consume a JSON, iCalendar, or other read-only public-event feed?
5. Does the website already have a public subscription/member-alert feature in development?
6. What visual assets, colors, fonts, and layout rules should Chapel Scheduler reuse?

### Email

7. Can the chapel send authenticated mail from `schedule@mylatinmass.com` or a similar address?
8. Who can add SPF, DKIM, and DMARC records for a transactional mail provider?
9. Are there existing mail services or limits that should be reused or avoided?

### Hosting and operations

10. Does the current hosting support an application server, relational database, background jobs, object storage, and automated backups?
11. Would the webmaster prefer a separate managed application host?
12. Which programming languages/frameworks can the webmaster comfortably maintain?
13. Where should the parish-owned source repository live?
14. Which two or more people will be technical custodians?
15. How should production secrets and recovery codes be stored and handed over?
16. What monitoring and alerting does the webmaster already use?
17. Who will respond to production incidents and user support requests?
18. Can the proposed $75/month infrastructure ceiling support the webmaster's preferred stack?

### Migration

19. How can future events be exported from the existing Google calendars?
20. Are there private events whose details must not be included in a broad export?
21. Can old shared Google calendars be made read-only after a four-week comparison?
22. Is any existing calendar code on mylatinmass.com reusable?

## Questions for Father

1. Are private-calendar visibility and delegation rules acceptable?
2. Is showing the celebrant publicly acceptable?
3. Are conflict overrides with immediate notice, rather than required approval, appropriate?
4. Is one-year retention of private appointment names and minimal notes sufficient?
5. Is the ferial-Mass selection workflow appropriate: request at 24 hours, Ordo default finalized at three hours?
6. Should any private appointment category be hidden even from delegates?
7. Which liturgical rules require Father's review before automation?
8. Confirm St. Philomena Foundation Mass precedence and External Solemnity practices.

## Questions for Father's assistant

1. What are the most common phrases used to enter appointments and services?
2. What default appointment durations are useful?
3. Which calendars are currently maintained and by whom?
4. Which appointment details are actually needed for scheduling?
5. Are generic categories such as Private, Pre-Cana, Sick Call, Baptism, Wedding, and Funeral sufficient?
6. What conflicts or mistakes occur most often today?
7. Is the website assistant plus Telegram-for-public-services workflow convenient enough?
8. Which notifications are useful versus noisy?

## Questions for the Head Sacristan

1. Verify regular Mass and First Friday/First Saturday sacristan requirements.
2. Which existing preferences or recurring assignments should be represented in the pilot?
3. What information must a printable schedule contain?
4. What last-minute changes are most difficult today?
5. Does the proposed substitute workflow match actual practice?
6. Which PDFs and photo guides should be uploaded first after the pilot?
7. How should guides be categorized by feast, ceremony, and setup?
8. Does the ferial-Mass notification provide enough preparation time?

## Questions for the APR/privacy review

1. Confirm that only status, renewal date, and verifier should be stored for APR.
2. Confirm annual renewal and reminder-recipient rules.
3. Confirm that expired APR status does not automatically stop serving.
4. Confirm the birth-year-only minor model.
5. Confirm guardian linking and under-13 parent-managed accounts.
6. Confirm parent attestation for direct access at ages 13–17.
7. Confirm the three-year named assignment retention and seven-year security-audit retention.
8. Confirm the privacy notice and parent-consent language before minors launch.
9. Identify any SSPX, insurer, or Florida requirements not captured here.

## Questions for the 1962 Ordo maintainer

Subject: Structured calendar access for a chapel scheduling project

Hello,

Our chapel in South Florida is designing a private scheduling system for Masses and volunteer ministries. We currently rely on the calendar and notes at 1962ordo.today because they reflect SSPX-specific observances more accurately than the general 1960 calendar used by our existing software.

Before building an integration, could you please tell us:

1. Is there an API, iCalendar feed, JSON feed, database export, or other structured source for calendar days and monthly notices?
2. If not, would you permit a low-volume automated importer that retrieves only the upcoming date range and caches results?
3. How far in advance is calendar data normally published, and can previously published entries change?
4. Are there attribution or linking requirements?
5. Are there rate limits or preferred retrieval times?
6. Is there a contact method for reporting import-breaking changes or calendar corrections?
7. Would you be interested in discussing a small structured feed that other SSPX chapels might also use?

The system would always allow local administrator review and would link back to the source. It would not represent itself as an official replacement for the Ordo.

Thank you.

## Questions for fsspx.today maintainers

1. Does fsspx.today provide a chapel API or import format?
2. Can an authorized chapel create, update, and cancel Mass listings programmatically?
3. How is chapel authorization established?
4. What liturgical and schedule fields are accepted?
5. Are there rate limits, attribution rules, or review steps?
6. Is there a test environment?
7. If no API exists, can a standard CSV or iCalendar file be imported?

