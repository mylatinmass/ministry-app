import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) =>
  fs.readFile(path.join(root, relativePath), "utf8")

const [
  astroConfig,
  apiRoute,
  authHelper,
  ministryList,
  profile,
  reminderMigration,
  reminders,
  schedulerAuth,
  serviceWorker,
  manifestSource,
  multiMinistryMigration,
  schedulingTemplates,
  schedulingEvents,
  workspaceContent,
  eventDetails,
  familyProfiles,
  profileSeparation,
  availabilityMigration,
  schedulingAvailability,
  availabilityComponent,
  availabilityRoute,
  availabilityApp,
] = await Promise.all([
  read("astro.config.mjs"),
  read("src/pages/api/[...path].ts"),
  read("src/server/legacy/helper/ministry-auth.js"),
  read("src/server/legacy/ministry-list.js"),
  read("src/react/components/ministry/MinistryProfile.jsx"),
  read("migrations/20260723_01_add_push_reminders.sql"),
  read("src/server/notifications/reminders.ts"),
  read("src/server/notifications/scheduler-auth.ts"),
  read("public/ministry/service-worker.js"),
  read("public/ministry/manifest.webmanifest"),
  read("migrations/20260729_01_add_multi_ministry_templates.sql"),
  read("src/server/scheduling/templates.ts"),
  read("src/server/scheduling/events.ts"),
  read("src/react/components/ministry/MinistryWorkspaceContent.jsx"),
  read("src/react/components/ministry/MinistryEventDetails.jsx"),
  read("src/server/legacy/ministry-profiles.js"),
  read("src/server/legacy/ministry-profile-separation.js"),
  read("migrations/20260729_02_add_availability_blocks.sql"),
  read("src/server/scheduling/availability.ts"),
  read("src/react/components/ministry/MinistryAvailability.jsx"),
  read("src/pages/availability.astro"),
  read("src/react/pages/AvailabilityApp.jsx"),
])

assert.match(astroConfig, /site:\s*"https:\/\/www\.mylatinmass\.com"/)
assert.match(astroConfig, /base:\s*"\/ministry"/)

const apiFiles = []
const walk = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(target)
    else apiFiles.push(target)
  }
}
await walk(path.join(root, "src/pages/api"))
assert.deepEqual(
  apiFiles.map((file) => path.relative(root, file)),
  ["src/pages/api/[...path].ts"],
)
assert.match(apiRoute, /push\/subscriptions/)
assert.match(apiRoute, /reminders\/process/)
assert.match(apiRoute, /scheduling\/templates/)
assert.match(apiRoute, /scheduling\/events/)
assert.match(apiRoute, /scheduling\/availability/)

assert.match(authHelper, /activeProfileUserId/)
assert.match(ministryList, /const user = context\.user/)
assert.match(ministryList, /user\.global_role/)

const leadValues = [
  ...profile.matchAll(/\[(15|30|45|60|120|180|240),\s*"/g),
].map((match) => Number(match[1]))
assert.deepEqual(leadValues, [15, 30, 45, 60, 120, 180, 240])

assert.match(reminderMigration, /CREATE TABLE IF NOT EXISTS push_subscriptions/)
assert.match(reminderMigration, /CREATE TABLE IF NOT EXISTS ministry_reminders/)
assert.match(reminderMigration, /dedupe_key STRING NOT NULL UNIQUE/)
assert.match(reminders, /FOR UPDATE SKIP LOCKED/)
assert.match(reminders, /COALESCE\(mp\.guardian_user_id, ra\.user_id\)/)
assert.match(reminders, /context\.event_status !== "published"/)
assert.match(reminders, /\[404, 410\]/)
assert.match(schedulerAuth, /verifyIdToken/)
assert.match(schedulerAuth, /payload\.email === expectedEmail/)

assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS template_ministries/,
)
assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS template_responsibilities/,
)
assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS event_ministries/,
)
assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS template_versions/,
)
assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS ministry_audit_log/,
)
assert.match(schedulingTemplates, /template_versions/)
assert.match(schedulingTemplates, /writeSchedulingAudit/)
assert.match(schedulingEvents, /createEventFromStructure/)
assert.match(schedulingEvents, /set_schedule_status/)
assert.match(schedulingEvents, /event_responsibility\.created/)
assert.match(schedulingEvents, /event_responsibility\.updated/)
assert.match(schedulingEvents, /event_responsibility\.cancelled/)
assert.match(schedulingEvents, /body\.action === "assign_member"/)
assert.match(schedulingEvents, /FROM availability_blocks block/)
assert.match(schedulingEvents, /membership\.can_serve = true/)
assert.match(schedulingEvents, /responsibility_assignment\.assigned/)
assert.match(schedulingEvents, /source:\s*"event_override"/)
assert.match(
  schedulingEvents,
  /responsibility\.template_responsibility_id\s*&&/,
)
assert.match(workspaceContent, /MinistryTemplates/)
assert.match(workspaceContent, /MinistryEvents/)
assert.match(eventDetails, /Add responsibility/)
assert.match(eventDetails, /Event only/)
assert.match(eventDetails, /Choose available member/)
assert.match(eventDetails, /action:\s*"assign_member"/)
assert.match(familyProfiles, /cancel_separation/)
assert.match(familyProfiles, /separation\.cancelled/)
assert.match(familyProfiles, /mp\.status IN \('active', 'separation_pending'\)/)
assert.match(profileSeparation, /That email is now connected to another account/)
assert.match(
  availabilityMigration,
  /CREATE TABLE IF NOT EXISTS availability_blocks/,
)
assert.match(
  availabilityMigration,
  /CREATE TABLE IF NOT EXISTS assignment_change_requests/,
)
assert.match(schedulingAvailability, /context\.user\.id/)
assert.match(schedulingAvailability, /toStoredDateKey/)
assert.match(schedulingAvailability, /splitAroundAssignedDates/)
assert.match(schedulingAvailability, /assignment\.change_requested/)
assert.match(
  schedulingAvailability,
  /notificationStatus:\s*"pending_implementation"/,
)
assert.match(availabilityComponent, /Block available dates/)
assert.match(availabilityComponent, /Request change/)
assert.match(availabilityRoute, /AvailabilityApp/)
assert.match(availabilityApp, /MinistryRouteGuard/)

const manifest = JSON.parse(manifestSource)
assert.equal(manifest.start_url, "/ministry/")
assert.equal(manifest.scope, "/ministry/")
assert.match(serviceWorker, /destination\.pathname\.startsWith\("\/ministry\/"\)/)
assert.doesNotMatch(serviceWorker, /caches\.open/)

const serverFiles = []
const collectServerFiles = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) await collectServerFiles(target)
    else if (/\.(js|ts)$/.test(entry.name)) serverFiles.push(target)
  }
}
await collectServerFiles(path.join(root, "src/server"))
for (const file of serverFiles) {
  const source = await fs.readFile(file, "utf8")
  assert.doesNotMatch(
    source,
    /\b(?:CREATE|ALTER)\s+TABLE\b/i,
    `Runtime schema DDL found in ${path.relative(root, file)}`,
  )
}

console.log(
  "Verified Astro base path, one API dispatcher, active-profile authorization, multi-ministry templates and events, template versioning, ministry-level publication, reminder timing, Web Push scope, OIDC checks, durable deduplication, and migration-only schema changes.",
)
