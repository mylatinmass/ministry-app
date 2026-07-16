# Chapel Scheduler: Webmaster Coordination Request

**Target:** Private sacristan alpha in early September 2026  
**Current status:** Architecture and stakeholder proof of concept prepared

I would like to develop Chapel Scheduler, a web application that brings the chapel's service calendar, ministry schedules, and related communications into one coordinated system. The first release will be a small, private alpha for sacristan scheduling. It is not intended to replace or disrupt the existing website during testing.

The initial alpha is expected to include a public service calendar, secure user accounts, sacristan preferences and automatically accepted assignments, open-position volunteering, basic substitute handling, email notifications, administration, printing, and scheduling history.

## What I need from the webmaster

I would appreciate a short technical-planning conversation covering:

1. **Website and hosting:** What platform and hosting provider currently support mylatinmass.com? Could Chapel Scheduler run as a separate application on a subdomain such as `schedule.mylatinmass.com`, even if the existing hosting is not suitable for it?
2. **DNS and security:** Who can configure the subdomain, HTTPS certificate, and related DNS records?
3. **Email:** Can the application send authenticated transactional email from an address such as `schedule@mylatinmass.com`? Who can configure the necessary SPF, DKIM, and DMARC records?
4. **Existing work:** Does mylatinmass.com already have accounts, notification subscriptions, membership registration, calendar feeds, or related functionality that should be reused rather than duplicated?
5. **Website integration:** Could the website eventually consume a read-only public calendar feed from Chapel Scheduler? No integration is required for the private alpha.
6. **Deployment and maintenance:** What technology and deployment approach would be easiest for the webmaster or other parish technical volunteers to support? Where should the chapel-owned source code and production credentials be kept?
7. **Operations:** What backup, monitoring, logging, and recovery arrangements already exist, and what should be separate for this application?
8. **Visual coordination:** May the application reuse the website's colors and general visual style, and are there existing brand assets or style rules available?

## Proposed boundaries

- Begin with a separate private test environment and fictional or explicitly approved pilot data.
- Do not change the current website or calendars without separate approval.
- Keep private priest appointments, volunteer information, and APR-related status out of public feeds.
- Do not give application administrators access to private calendar details merely because they are administrators.
- Use managed hosting if that is safer and easier to maintain than placing the application on the current website server.
- Keep initial infrastructure within the provisional budget ceiling of **$75 per month**, excluding development and support labor.

## Requested next step

A 30–45 minute conversation should be enough to identify the existing platform, avoid duplicating current work, and choose a safe alpha-hosting approach. I can share the detailed architecture document and demonstrate the proof of concept during that discussion.
