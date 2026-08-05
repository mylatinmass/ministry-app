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
  ministryLevelsMigration,
  ministryMembers,
  ministryProfileServer,
  ministryMembersComponent,
  ministryDetail,
  ministryWorkspace,
  ministryNavigation,
  weekCalendar,
  ordoMigration,
  schedulingOrdo,
  ordoReference,
  loginLinkMigration,
  loginLinkRequest,
  loginLinkResponse,
  ministryLogin,
  ministryLoginUi,
  membershipReview,
  accessRequestMigration,
  accessRequestServer,
  accessRequestUi,
  globalMembersServer,
  globalMembersUi,
  homeWorkspace,
  profileSuppressionMigration,
  invitationResponse,
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
  read("migrations/20260729_03_add_ministry_levels.sql"),
  read("src/server/legacy/ministry-members.js"),
  read("src/server/legacy/ministry-profile.js"),
  read("src/react/components/ministry/MinistryMembers.jsx"),
  read("src/server/legacy/ministry-detail.js"),
  read("src/react/components/ministry/MinistryWorkspace.jsx"),
  read("src/react/components/ministry/ministryNavigation.jsx"),
  read("src/react/components/ministry/MinistryWeekCalendar.jsx"),
  read("migrations/20260730_01_add_ordo_reference.sql"),
  read("src/server/scheduling/ordo.ts"),
  read("src/react/components/ministry/MinistryOrdoReference.jsx"),
  read("migrations/20260805_01_add_ministry_login_links.sql"),
  read("src/server/legacy/ministry-login-link.js"),
  read("src/server/legacy/ministry-login-link-response.js"),
  read("src/server/legacy/ministry-login.js"),
  read("src/react/components/ministry/MinistryLogin.jsx"),
  read("src/server/legacy/ministry-membership-request-response.js"),
  read("migrations/20260805_02_add_ministry_access_requests.sql"),
  read("src/server/legacy/ministry-access-request.js"),
  read("src/react/pages/AccessRequestApp.jsx"),
  read("src/server/legacy/ministry-global-members.js"),
  read("src/react/components/ministry/MinistryGlobalMembers.jsx"),
  read("src/react/components/ministry/MinistryHomeWorkspace.jsx"),
  read("migrations/20260805_03_add_ministry_profile_suppressions.sql"),
  read("src/server/legacy/ministry-invitation-response.js"),
])

assert.match(astroConfig, /site:\s*"https:\/\/ministry\.mylatinmass\.com"/)
assert.match(astroConfig, /base:\s*"\/"/)
assert.match(astroConfig, /noExternal:\s*\[/)
assert.match(astroConfig, /"jsonwebtoken"/)
assert.match(astroConfig, /"lodash\.includes"/)
assert.match(astroConfig, /"jwa"/)

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
  ["src/pages/api/[...path].ts"]
)
assert.match(apiRoute, /push\/subscriptions/)
assert.match(apiRoute, /reminders\/process/)
assert.match(apiRoute, /scheduling\/templates/)
assert.match(apiRoute, /scheduling\/events/)
assert.match(apiRoute, /scheduling\/availability/)
assert.match(apiRoute, /scheduling\/ordo/)

assert.match(authHelper, /activeProfileUserId/)
assert.match(authHelper, /authMethod: options\.authMethod \|\| "password"/)
assert.match(authHelper, /authMethod === "email_link"/)
assert.match(ministryList, /const user = context\.user/)
assert.match(ministryList, /user\.global_role/)

assert.match(
  loginLinkMigration,
  /CREATE TABLE IF NOT EXISTS ministry_login_links/
)
assert.match(loginLinkMigration, /token_hash STRING NOT NULL UNIQUE/)
assert.match(
  loginLinkRequest,
  /u\.global_role NOT IN \('owner', 'super_admin'\)/
)
assert.match(loginLinkRequest, /created_at > now\(\) - INTERVAL '60 seconds'/)
assert.match(loginLinkResponse, /\["owner", "super_admin"\]\.includes/)
assert.match(loginLinkResponse, /authMethod: "email_link"/)
assert.match(
  accessRequestMigration,
  /CREATE TABLE IF NOT EXISTS ministry_access_requests/
)
assert.match(accessRequestMigration, /assigned_ministry_id UUID NULL/)
assert.match(accessRequestServer, /firstName/)
assert.doesNotMatch(accessRequestUi, /name="(?:chapel|ministry)"/)
assert.match(
  ministryMembers,
  /Only a global administrator can review unassigned access requests/
)
assert.match(ministryMembers, /approve_access_request/)
assert.match(ministryLogin, /authMethod: "password"/)
assert.match(ministryLoginUi, /EMAIL ME A SIGN-IN LINK/)
assert.match(ministryMembers, /context\.isEmailLinkSession/)
assert.match(membershipReview, /identity\.authMethod !== "password"/)
assert.match(globalMembersServer, /\["owner", "super_admin"\]\.includes/)
assert.match(globalMembersServer, /context\.authMethod !== "password"/)
assert.match(globalMembersServer, /FROM ministry_members membership/)
assert.match(globalMembersServer, /WHERE membership\.status = 'active'/)
assert.doesNotMatch(globalMembersServer, /FROM users user_account\s+LEFT JOIN ministry_members/)
assert.match(globalMembersUi, /Search name, email, username, ministry, or access/)
assert.match(globalMembersUi, /action: "add_existing_member"/)
assert.match(globalMembersUi, /action: "set_role"/)
assert.match(globalMembersUi, /action: "set_ministry_level"/)
assert.match(globalMembersUi, /action: "set_global_role"/)
assert.match(ministryMembers, /ministry_user\.global_role_changed/)
assert.match(ministryMembers, /You cannot change your own global access/)
assert.match(homeWorkspace, /globalOnly: true/)
assert.match(homeWorkspace, /<MinistryGlobalMembers \/>/)
assert.match(ministryMembers, /ministry_member\.added/)
assert.match(ministryMembers, /ministry_member\.role_changed/)
assert.match(ministryMembers, /ministry_member\.removed/)
assert.match(
  profileSuppressionMigration,
  /CREATE TABLE IF NOT EXISTS ministry_profile_suppressions/
)
assert.match(
  profileSuppressionMigration,
  /WHERE reactivated_at IS NULL/
)
assert.match(globalMembersUi, /action: "suppress_profile"/)
assert.match(ministryMembers, /ministry_profile\.suppressed/)
assert.match(ministryMembers, /SET status = 'inactive', updated_at = now\(\)/)
assert.match(invitationResponse, /ministry_profile\.reactivated/)
assert.match(invitationResponse, /SET reactivated_by = \$1/)

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
  /CREATE TABLE IF NOT EXISTS template_ministries/
)
assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS template_responsibilities/
)
assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS event_ministries/
)
assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS template_versions/
)
assert.match(
  multiMinistryMigration,
  /CREATE TABLE IF NOT EXISTS ministry_audit_log/
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
  /responsibility\.template_responsibility_id\s*&&/
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
assert.match(
  profileSeparation,
  /That email is now connected to another account/
)
assert.match(
  availabilityMigration,
  /CREATE TABLE IF NOT EXISTS availability_blocks/
)
assert.match(
  availabilityMigration,
  /CREATE TABLE IF NOT EXISTS assignment_change_requests/
)
assert.match(schedulingAvailability, /context\.user\.id/)
assert.match(schedulingAvailability, /toStoredDateKey/)
assert.match(schedulingAvailability, /splitAroundAssignedDates/)
assert.match(schedulingAvailability, /assignment\.change_requested/)
assert.match(
  schedulingAvailability,
  /notificationStatus:\s*"pending_implementation"/
)
assert.match(availabilityComponent, /UPDATING\.\.\." : "UPDATE/)
assert.match(availabilityComponent, /Request change/)
assert.match(availabilityComponent, /DISPLAYED_MONTH_COUNT = 12/)
assert.match(availabilityComponent, /overflow-x-auto/)
assert.match(availabilityComponent, /overflow-y-hidden/)
assert.match(availabilityComponent, /w-full shrink-0 snap-start/)
assert.match(availabilityComponent, /lg:w-\[calc\(50%-0\.75rem\)\]/)
assert.match(schedulingAvailability, /body\.requireConflictFree === true/)
assert.match(availabilityRoute, /AvailabilityApp/)
assert.match(availabilityApp, /MinistryRouteGuard/)
assert.match(
  ministryLevelsMigration,
  /CREATE TABLE IF NOT EXISTS ministry_levels/
)
assert.match(ministryLevelsMigration, /highest_level_id/)
assert.match(ministryLevelsMigration, /required_ministry_level_id/)
assert.match(ministryMembers, /ministry_level\.created/)
assert.match(ministryMembers, /ministry_member\.level_granted/)
assert.match(ministryMembers, /move_ministry_level/)
assert.match(ministryProfileServer, /highest_level_name/)
assert.match(ministryMembersComponent, /Highest ministry level/)
assert.match(schedulingTemplates, /requiredLevelId/)
assert.match(
  schedulingEvents,
  /granted_level\.rank_order >= required_level\.rank_order/
)
assert.match(
  eventDetails,
  /Requires \$\{responsibility\.requiredLevelName\} or higher/
)
assert.match(ministryNavigation, /label:\s*"Calendar"/)
assert.doesNotMatch(ministryNavigation, /label:\s*"My Calendar"/)
assert.match(ministryDetail, /calendarEvents/)
assert.match(
  ministryDetail,
  /e\.status IN \('published', 'cancelled', 'completed'\)/
)
assert.match(ministryWorkspace, /data\.calendarEvents \|\| data\.events/)
assert.doesNotMatch(
  ministryWorkspace,
  /\.filter\(\(event\) =>\s*event\.profileAssignments/
)
assert.match(workspaceContent, /showOnlyMyEvents/)
assert.match(workspaceContent, /showOnlyMyEvents \? "All Events" : "My Events"/)
assert.match(weekCalendar, /toDateKey\(event\.start_time\) === selectedKey/)
assert.match(eventDetails, /translate-x-full/)
assert.match(schedulingEvents, /isPublicView:\s*publicView/)
assert.match(schedulingEvents, /instructions:\s*publicView \? ""/)
assert.match(ordoMigration, /CREATE TABLE IF NOT EXISTS ordo_days/)
assert.match(ordoMigration, /CREATE TABLE IF NOT EXISTS event_ordo_selections/)
assert.match(ordoMigration, /selected_mass_option_snapshot JSONB/)
assert.match(schedulingOrdo, /get-liturgical-days/)
assert.match(schedulingOrdo, /classLabel/)
assert.doesNotMatch(schedulingOrdo, /rankLabel|liturgicalRank/)
assert.match(schedulingOrdo, /massOptions/)
assert.match(schedulingOrdo, /sourceHash/)
assert.match(schedulingOrdo, /event\.ordo_updated/)
assert.match(ordoReference, /View 1962 Ordo/)
assert.match(ordoReference, /Sacristy page and setup notes/)
assert.match(ordoReference, /Selection required/)
assert.match(
  ordoReference,
  /The Ordo does not explicitly state the vestment color/
)
assert.match(schedulingEvents, /event\.ordo_reset_for_date_change/)

const manifest = JSON.parse(manifestSource)
assert.equal(manifest.id, "/")
assert.equal(manifest.start_url, "/")
assert.equal(manifest.scope, "/")
assert.match(serviceWorker, /destination\.origin !== self\.location\.origin/)
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
    `Runtime schema DDL found in ${path.relative(root, file)}`
  )
}

console.log(
  "Verified Astro base path, one API dispatcher, active-profile authorization, multi-ministry templates and events, template versioning, ministry-level publication, reminder timing, Web Push scope, OIDC checks, durable deduplication, and migration-only schema changes."
)
