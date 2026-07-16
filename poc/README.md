# Chapel Scheduler stakeholder POC

This is a disposable, browser-only prototype. It has no backend, real authentication, email, Telegram, AI, or production scheduling engine. Volunteer, member, and private-appointment data is fictional. The September 2026 Davie priest assignments shown in the calendar were refreshed from the provided mission schedule CSV.

## Demo data provenance

- Priest assignment source: `Priest Weekend Mission 2025-26 - Aug 2024-Jan 2025.csv` (provided July 14, 2026)
- Imported slice: Davie assignments for September 6, 13, 20, and 27, 2026
- Imported celebrant: Fr. Gerrity on all four Sundays
- The source filename and internal title do not reliably describe its full contents; the exported sheet spans August 4, 2024 through September 27, 2026.
- All volunteer staffing, member names, and protected appointments remain fictional.

## Run it

The simplest option is to open `index.html` directly in a browser.

For a local web address, run this command from the project root:

```sh
python3 -m http.server 8080 --directory poc
```

Then open:

```text
http://localhost:8080
```

## Suggested stakeholder walkthrough

Select **Guided demo** in the top bar for an in-app ten-step presentation with automatic role switching, talking points, and Next/Back controls. Drag the guide by its dark header whenever it covers the part of the POC being discussed. Allow roughly 10–12 minutes plus questions.

### Presenter script

1. Start as **Public visitor** and show that volunteer information disappears while each Mass displays its related Confessions and Rosary time. No ministry or restricted-calendar controls—or indications that those calendars exist—are displayed.
2. Select **Get updates or volunteer** from the public calendar. Show that notification categories and volunteer interests are opt-in, a name is requested only after someone offers to help, Telegram is optional, and chapel membership remains a separate link.
3. Switch to **Michael · Sacristan**, then toggle the monthly calendar between **Public** and **Ministry** to demonstrate the staffing layer. Father’s restricted view remains locked.
4. Open the September 6 9:00 a.m. Mass and volunteer.
5. Open **My schedule** and confirm the September 5 assignment.
6. Select **Need a substitute**, choose a qualified available member, and send the privacy-preserving request.
7. Open **Availability**, change a preference, and add an absence.
8. Open **Telegram demo** and begin with the Chats-list wireframe. Select the ministry group for announcements, then select the private bot for personal schedule actions.
9. Switch to **Ministry leader** and revisit **Telegram demo** to show leader-specific summaries and actions.
10. Open **Draft review**, resolve the cross-ministry conflict, and publish the draft.
11. Switch to **Father's assistant**, compare **Public** and **Father's restricted** on the monthly calendar, then revisit **Telegram demo** to add a non-confidential public service.
12. Demonstrate the secure website's private scheduling proposal, then open the separate **Protected details** window to add a name and minimal note.
13. Open **Father's calendar** and compare the full delegate view with the permission summary for administrators, ministry users, and public visitors. Confession languages remain on the general public calendar rather than this scheduling view.
14. Show **Instructions** as a post-pilot repository preview.

Use the reset button in the top-right corner to restore the fictional starting state.

### Opening and closing

Open with: “This is a disposable proof of concept using fictional data. We are validating workflows and permissions, not presenting finished production software.”

Close with three questions:

1. Would current volunteers understand what to do without training?
2. Do the permission boundaries match how the chapel actually works?
3. Is anything essential missing from the September sacristan pilot?

## Deliberate limitations

- Month view is the only implemented calendar layout.
- Data is stored only in the browser's local storage.
- Buttons demonstrate workflows but do not call external services.
- The prototype validates product direction, not technical architecture or production security.
