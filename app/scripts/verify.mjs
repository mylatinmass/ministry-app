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
  accountNavigation,
  pendingInvitations,
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
  read("src/react/components/ministry/accountNavigation.jsx"),
  read("src/react/components/ministry/MinistryPendingInvitations.jsx"),
])

const [
  massScheduleMigration,
  massScheduleSync,
  massScheduleLibrary,
  packageJson,
] = await Promise.all([
  read("migrations/20260806_04_add_mass_schedule_sync.sql"),
  read("scripts/sync-mass-schedule.mjs"),
  read("scripts/lib/mass-schedule-sync.mjs"),
  read("package.json"),
])

const [
  invitationHelper,
  invitationPage,
  separationPage,
] = await Promise.all([
  read("src/server/legacy/helper/ministry-invitations.js"),
  read("src/react/pages/ministry-invite.jsx"),
  read("src/react/pages/ministry-profile-separate.jsx"),
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
assert.match(apiRoute, /push\/test/)
assert.match(apiRoute, /telegram\/connection/)
assert.match(apiRoute, /telegram\/setup/)
assert.match(apiRoute, /telegram\/webhook/)
assert.match(apiRoute, /handleMessages/)
assert.match(apiRoute, /reminders\/process/)
assert.match(apiRoute, /scheduling\/templates/)
assert.match(apiRoute, /scheduling\/events/)
assert.match(apiRoute, /scheduling\/availability/)
assert.match(apiRoute, /scheduling\/ordo/)

assert.match(packageJson, /"prebuild":\s*"[^"]*sync-mass-schedule\.mjs --build"/)
assert.match(packageJson, /"sync:mass-schedule"/)
const migrationRunner = await read("scripts/migrate.mjs")
assert.match(migrationRunner, /requestedFilename/)
assert.match(migrationRunner, /Unknown migration/)
assert.match(massScheduleMigration, /schedule_source_key STRING NULL/)
assert.match(massScheduleMigration, /events_schedule_source_key_key/)
assert.match(massScheduleMigration, /system_managed BOOL NOT NULL DEFAULT false/)
assert.match(massScheduleLibrary, /classifyMassDescription/)
assert.match(massScheduleLibrary, /Confession and Rosary entries|Confessions \| Rosary|\\bmass\\b/)
assert.match(massScheduleLibrary, /"Sacristan"/)
assert.match(massScheduleLibrary, /"Master of Ceremonies"/)
assert.match(massScheduleLibrary, /"Torchbearer 4"/)
assert.match(massScheduleLibrary, /"Usher"/)
assert.match(massScheduleSync, /MASS_SCHEDULE_SYNC_REQUIRED/)

const notificationChannelsMigration = await read(
  "migrations/20260807_04_add_notification_channels.sql",
)
const pushNotificationsComponent = await read(
  "src/react/components/ministry/PushNotifications.jsx",
)
const notificationDelivery = await read(
  "src/server/notifications/delivery.ts",
)
assert.match(notificationChannelsMigration, /notification_email_enabled/)
assert.match(notificationChannelsMigration, /notification_telegram_enabled/)
assert.match(notificationChannelsMigration, /notification_sms_enabled/)
assert.match(notificationChannelsMigration, /notification_push_enabled/)
assert.match(notificationChannelsMigration, /last_test_at/)
assert.match(notificationChannelsMigration, /'email', 'telegram', 'sms', 'push'/)
assert.match(profile, /Notification methods/)
assert.match(profile, /notificationChannelOptions/)
assert.match(ministryProfileServer, /profile\.notification_preferences_updated/)
assert.match(reminders, /queueAssignmentReminderAlert/)
const klaviyo = await read("src/server/notifications/klaviyo.ts")
assert.match(klaviyo, /Ministry Assignment Reminder Due/)
assert.match(klaviyo, /unique_id: context\.id/)
assert.match(klaviyo, /Klaviyo-API-Key/)
const klaviyoProfileMigration = await read(
  "migrations/20260811_01_add_klaviyo_profile_syncs.sql",
)
const klaviyoManagedProfilesMigration = await read(
  "migrations/20260811_02_queue_managed_children_for_klaviyo.sql",
)
const completedNotificationsMigration = await read(
  "migrations/20260811_03_complete_notification_workflows.sql",
)
const klaviyoProfiles = await read(
  "src/server/notifications/klaviyo-profiles.ts",
)
const klaviyoProfileQueue = await read(
  "src/server/legacy/helper/klaviyo-profile-sync.js",
)
const volunteerSignupProfileSync = await read(
  "src/server/scheduling/volunteers.ts",
)
assert.match(klaviyoProfileMigration, /CREATE TABLE IF NOT EXISTS klaviyo_profile_syncs/)
assert.match(klaviyoProfileMigration, /managed_profile\.status IN \('active', 'separation_pending'\)/)
assert.match(klaviyoProfiles, /api\/profile-import/)
assert.match(klaviyoProfiles, /profile-subscription-bulk-create-jobs/)
assert.match(klaviyoProfiles, /transactional/)
assert.match(klaviyoProfiles, /historical_import: true/)
assert.match(klaviyoProfiles, /profiles:write|KLAVIYO_PROFILE_SYNC_ENABLED/)
assert.match(klaviyoProfiles, /ministry_app_account_type/)
assert.match(klaviyoProfiles, /ministry_notification_recipient_external_id/)
assert.match(klaviyoProfiles, /profile\.is_managed_child/)
assert.match(klaviyoProfiles, /\$4::INT \* INTERVAL '1 minute'/)
assert.doesNotMatch(klaviyoProfiles, /ministry_names|ministry_roles/)
assert.match(klaviyoProfileQueue, /SELECT managed_profile\.guardian_user_id/)
assert.match(klaviyoManagedProfilesMigration, /managed_profile\.child_user_id/)
assert.match(familyProfiles, /queueKlaviyoProfileSync\(client, childId\)/)
assert.match(klaviyo, /assignment_subject_external_id/)
assert.match(klaviyo, /external_id: `ministry:\$\{context\.recipient_user_id\}`/)
assert.match(reminders, /processKlaviyoProfileSyncs/)
assert.match(reminders, /confirmation_midpoint/)
assert.match(reminders, /confirmation_deadline/)
assert.match(reminders, /confirmation_overdue/)
assert.match(reminders, /one_week/)
assert.match(volunteerSignupProfileSync, /queueKlaviyoProfileSync/)
assert.match(invitationResponse, /queueKlaviyoProfileSync/)
assert.match(pushNotificationsComponent, /Send test notification/)

const telegramMigration = await read(
  "migrations/20260807_05_add_telegram_connections.sql",
)
const telegramServer = await read("src/server/notifications/telegram.ts")
const telegramComponent = await read(
  "src/react/components/ministry/TelegramNotifications.jsx",
)
assert.match(telegramMigration, /CREATE TABLE IF NOT EXISTS telegram_connections/)
assert.match(telegramMigration, /CREATE TABLE IF NOT EXISTS telegram_connection_tokens/)
assert.match(telegramServer, /x-telegram-bot-api-secret-token/)
assert.match(telegramServer, /timingSafeEqual/)
assert.match(telegramServer, /getWebhookInfo/)
assert.match(telegramServer, /telegram-webhook/)
assert.match(telegramComponent, /Connect Telegram/)

const messageMigration = await read(
  "migrations/20260812_01_add_ministry_messages.sql",
)
const messageServer = await read("src/server/notifications/messages.ts")
const messageComponent = await read(
  "src/react/components/ministry/MinistryMessages.jsx",
)
const completedAssignmentNotificationsMigration = await read(
  "migrations/20260812_02_complete_assignment_notification_workflows.sql",
)
const effectiveDatedRecurrenceMigration = await read(
  "migrations/20260812_03_add_effective_dated_event_recurrence.sql",
)
assert.match(messageMigration, /CREATE TABLE IF NOT EXISTS ministry_messages/)
assert.match(messageMigration, /CREATE TABLE IF NOT EXISTS ministry_message_recipients/)
assert.match(messageMigration, /channel IN \('email', 'telegram'\)/)
assert.match(messageMigration, /length\(body\) <= 250/)
assert.match(messageMigration, /is_delivery_target BOOL NOT NULL DEFAULT true/)
assert.match(messageServer, /Only a Super Admin can message all members/)
assert.match(messageServer, /requireMinistryAccess\(client, context\.user, ministryId, true\)/)
assert.match(messageServer, /processMinistryMessageDeliveries/)
assert.doesNotMatch(messageServer, /sendAccountPush|sendSms|notification_sms_enabled/)
assert.match(messageComponent, /NEW MESSAGE/)
assert.match(messageComponent, /Telegram messages do not use a subject/)
assert.match(accountNavigation, /id: "messages"/)
assert.match(homeWorkspace, /messageSummary\.unreadCount/)
assert.match(
  completedAssignmentNotificationsMigration,
  /confirmation_overdue_at TIMESTAMPTZ/,
)
assert.match(
  completedAssignmentNotificationsMigration,
  /acknowledgment_deadline_at TIMESTAMPTZ/,
)
assert.match(homeWorkspace, />\s*Acknowledge\s*</)
assert.match(effectiveDatedRecurrenceMigration, /recurrence_anchor_at TIMESTAMPTZ/)
assert.match(effectiveDatedRecurrenceMigration, /recurrence_parent_group_id UUID/)
assert.match(schedulingEvents, /Only a Super Admin can create repeating events/)
assert.match(schedulingEvents, /friday_before_first_saturday/)
assert.match(schedulingEvents, /previewRecurrenceChange/)
assert.match(schedulingEvents, /event\.recurrence_rule_changed/)
assert.match(schedulingEvents, /body\.updateScope === "this_and_future"/)
assert.match(reminders, /AS duty_start_time/)
assert.match(reminders, /dutyStart\.getTime\(\) - Number\(candidate\.lead_minutes\)/)
assert.match(homeWorkspace, /user: currentUser/)

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
assert.match(globalMembersServer, /WITH eligible_users AS/)
assert.match(globalMembersServer, /LEFT JOIN ministry_members membership/)
assert.match(globalMembersServer, /existing_membership\.status = 'active'/)
assert.match(globalMembersUi, /Search name, ministry, or access/)
assert.doesNotMatch(globalMembersUi, /action: "add_existing_member"/)
assert.match(globalMembersUi, /userId: selectedMember\.id/)
assert.match(globalMembersUi, /action: "set_role"/)
assert.match(globalMembersUi, /action: "set_ministry_level"/)
assert.match(globalMembersUi, /action: "set_global_role"/)
assert.match(ministryMembers, /ministry_user\.global_role_changed/)
assert.match(ministryMembers, /You cannot change your own global access/)
assert.match(accountNavigation, /managerOnly: true/)
assert.match(accountNavigation, /label: "Ministries"/)
assert.match(homeWorkspace, /accountSections/)
assert.match(homeWorkspace, /canManageMembers/)
assert.match(ministryWorkspace, /accountMenuSections/)
assert.match(homeWorkspace, /<MinistryGlobalMembers \/>/)
assert.match(globalMembersServer, /membership\.level IN \('owner', 'admin'\)/)
assert.match(globalMembersServer, /membership\.ministry_id = ANY\(\$1::UUID\[\]\)/)
assert.match(globalMembersServer, /canManageAll/)
assert.match(globalMembersUi, /data\.canManageAll/)
assert.match(globalMembersServer, /invitation\.status = 'pending'/)
assert.match(globalMembersUi, /MinistryPendingInvitations/)
assert.match(ministryMembersComponent, /MinistryPendingInvitations/)
assert.match(ministryMembers, /resend_invitation/)
assert.match(ministryMembers, /cancel_invitation/)
assert.match(ministryMembers, /token_hash = \$2/)
assert.match(pendingInvitations, /Resend/)
assert.match(pendingInvitations, /Cancel/)
assert.doesNotMatch(globalMembersServer, /email:\s*row\.email/)
assert.doesNotMatch(globalMembersServer, /phone:\s*row\.phone/)
assert.doesNotMatch(globalMembersServer, /username:\s*row\.username/)
assert.doesNotMatch(globalMembersUi, /member\.(email|phone|username)/)
assert.doesNotMatch(ministryMembersComponent, /member\.(email|phone|username)/)
assert.doesNotMatch(ministryMembersComponent, /request\.(email|phone|message)/)
assert.doesNotMatch(pendingInvitations, /invitation\.email/)
assert.doesNotMatch(ministryMembers, /email:\s*member\.email/)
assert.doesNotMatch(ministryMembers, /username:\s*member\.username/)
assert.doesNotMatch(ministryMembers, /email:\s*request\.email/)
assert.doesNotMatch(ministryMembers, /phone:\s*request\.phone/)
assert.doesNotMatch(schedulingEvents, /volunteerEmail:|volunteerPhone:|notifyEmail:|notifySms:/)
assert.doesNotMatch(eventDetails, /assignment\.(volunteerEmail|volunteerPhone|notifyEmail|notifySms)/)
assert.doesNotMatch(invitationHelper, /const toPublicInvitation[\s\S]*?\b(email|username):/)
assert.doesNotMatch(volunteerSignupProfileSync, /WHERE public_profile_id/)
assert.doesNotMatch(invitationPage, /invitation\.(email|username)/)
assert.doesNotMatch(separationPage, /separation\.email/)
assert.match(ministryProfileServer, /email:\s*profile\.email/)
assert.match(ministryProfileServer, /phone:\s*profile\.phone/)
assert.match(ministryMembers, /ministry_invitation\.created/)
assert.match(ministryMembers, /Membership requires an invitation/)
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
assert.match(reminders, /event\.status = 'published'/)
assert.match(notificationDelivery, /\[404, 410\]/)
assert.match(notificationDelivery, /MINISTRY_FALLBACK_SMTP_HOST/)
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
assert.match(schedulingAvailability, /assignment\.change_requested/)
assert.match(
  schedulingAvailability,
  /notificationStatus:\s*"delivery_requested"/
)
assert.match(availabilityComponent, /UPDATING\.\.\." : "UPDATE/)
assert.match(availabilityComponent, /Request change/)
assert.match(availabilityComponent, /showsTwoMonths/)
assert.match(availabilityComponent, /displayedMonths/)
assert.match(availabilityComponent, /lg:grid-cols-2/)
assert.doesNotMatch(availabilityComponent, /overflow-x-auto|snap-mandatory|touch-pan-x/)
assert.doesNotMatch(homeWorkspace, /assignments awaiting confirmation/)
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
assert.match(ministryMembersComponent, /Highest level in/)
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
assert.match(schedulingEvents, /instructions:\s*accessChecks\[index\]\.canView/)
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
assert.match(ordoReference, /const selectionRequired/)
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

const [serviceOutcomeMigration, schedulingReports, reportsComponent] =
  await Promise.all([
    read("migrations/20260805_04_add_service_outcomes_and_scoped_availability.sql"),
    read("src/server/scheduling/reports.ts"),
    read("src/react/components/ministry/MinistryReports.jsx"),
  ])
assert.match(serviceOutcomeMigration, /service_outcome STRING NULL/)
assert.match(serviceOutcomeMigration, /outcome_recorded_by UUID NULL/)
assert.match(serviceOutcomeMigration, /ministry_id UUID NULL REFERENCES ministries/)
assert.match(schedulingEvents, /record_service_outcome/)
assert.doesNotMatch(schedulingEvents, /record_assignment_status/)
assert.match(schedulingEvents, /sameTimeReliability/)
assert.match(eventDetails, /Pre-publication review/)
assert.match(eventDetails, /Record outcome/)
assert.doesNotMatch(schedulingAvailability, /decline_assignment/)
assert.match(schedulingAvailability, /requestChanges/)
assert.match(schedulingAvailability, /changeRequestedAssignmentIds/)
assert.match(schedulingAvailability, /block\.ministry_id/)
assert.match(availabilityComponent, /All ministries/)
assert.match(availabilityComponent, /Assigned duties need a change request/)
assert.match(availabilityComponent, /"Continue"/)
const [alertMigration, assignmentNotifications, alertsServer] = await Promise.all([
  read("migrations/20260808_02_add_ministry_alert_digests.sql"),
  read("src/server/notifications/assignment-notifications.ts"),
  read("src/server/notifications/alerts.ts"),
])
assert.match(alertMigration, /subject_user_id/)
assert.match(alertMigration, /recipient_user_id/)
assert.match(completedNotificationsMigration, /notification_reminders_enabled/)
assert.match(completedNotificationsMigration, /notification_schedule_changes_enabled/)
assert.match(completedNotificationsMigration, /sms_transactional_consent_at/)
assert.match(completedNotificationsMigration, /CREATE TABLE IF NOT EXISTS ministry_alert_deliveries/)
assert.match(assignmentNotifications, /processNotificationDigests/)
assert.match(assignmentNotifications, /buildDigest/)
assert.match(assignmentNotifications, /sendEventScheduleNotifications/)
assert.match(assignmentNotifications, /sendAccountPush/)
assert.match(assignmentNotifications, /sendTelegramMessage/)
assert.match(assignmentNotifications, /sendKlaviyoAlertDue/)
assert.match(assignmentNotifications, /queueWeeklyAssignmentReviews/)
assert.match(assignmentNotifications, /processUrgentStaffingShortages/)
assert.match(assignmentNotifications, /processUrgentAcknowledgmentEscalations/)
assert.match(assignmentNotifications, /confirmation-overdue-leader/)
assert.match(profile, /notificationCategoryOptions/)
assert.match(profile, /transactional text messages/)
assert.match(alertsServer, /mark_all_read/)
assert.match(alertsServer, /deliveryStatus/)
assert.match(alertsServer, /body\.action === "acknowledge"/)
assert.match(alertsServer, /notification\.acknowledged/)
assert.match(homeWorkspace, /profile\.alertCount > 0/)
assert.match(homeWorkspace, /bg-orange-400/)
assert.match(apiRoute, /scheduling\/reports/)
assert.match(schedulingReports, /INTERVAL '6 months'/)
assert.match(schedulingReports, /levelHistory/)
assert.match(reportsComponent, /Export CSV/)
assert.match(reportsComponent, /Time patterns/)
assert.match(workspaceContent, /Internal calendar/)
assert.match(workspaceContent, /window\.print/)

const [volunteerConsentMigration, schedulingVolunteers, volunteerSignupPage] =
  await Promise.all([
    read("migrations/20260805_05_add_volunteer_contact_consent.sql"),
    read("src/server/scheduling/volunteers.ts"),
    read("src/react/pages/VolunteerSignupApp.jsx"),
  ])
assert.match(volunteerConsentMigration, /volunteer_email_consent_at/)
assert.match(volunteerConsentMigration, /volunteer_sms_consent_at/)
assert.match(apiRoute, /volunteer-signup/)
assert.match(schedulingEvents, /configure_volunteer_signup/)
assert.match(schedulingEvents, /event\.volunteer_signup_configured/)
assert.match(schedulingEvents, /That volunteer URL is already in use/)
assert.match(schedulingVolunteers, /signup_source/)
assert.match(schedulingVolunteers, /'public_link'/)
assert.match(schedulingVolunteers, /volunteer_name/)
assert.match(schedulingVolunteers, /volunteer_phone/)
assert.match(schedulingVolunteers, /signup_open = true/)
assert.match(volunteerSignupPage, /create or connect a volunteer profile/)
assert.match(volunteerSignupPage, /This does not add me to a ministry/)
assert.match(volunteerSignupPage, /emailConsent/)
assert.match(volunteerSignupPage, /smsConsent/)
assert.match(eventDetails, /Volunteer signup link/)
assert.match(eventDetails, /Copy link/)
assert.match(accountNavigation, /label:\s*"Events"/)
assert.doesNotMatch(accountNavigation, /label:\s*"My Events"/)
assert.match(homeWorkspace, /Create event/)
assert.match(homeWorkspace, /<MinistryEvents/)
assert.match(homeWorkspace, /events=\{data\.calendarEvents\}/)
assert.match(homeWorkspace, /Public events, ministry events visible to this profile/)
assert.match(ministryList, /WHERE e\.status IN \('published', 'cancelled', 'completed'\)/)
assert.doesNotMatch(ministryList, /membership\.user_id = \$1/)
assert.match(schedulingEvents, /visibleResponsibilities/)
assert.match(schedulingEvents, /responsibilityAccessByMinistry/)
assert.match(schedulingEvents, /assignmentVisibilityRestricted/)
assert.match(schedulingEvents, /const assignmentResult = await client\.query/)
assert.match(schedulingEvents, /canManageAssignment/)
assert.match(eventDetails, /assignment\.isVolunteer && canManage/)

const [
  standaloneVolunteerMigration,
  generalVolunteerMigration,
  generalVolunteerBackfill,
  standaloneVolunteerEvents,
  volunteerEventsComponent,
] = await Promise.all([
  read("migrations/20260805_06_allow_standalone_volunteer_events.sql"),
  read("migrations/20260806_02_add_general_volunteer_capacity.sql"),
  read("migrations/20260806_03_backfill_general_volunteer.sql"),
  read("src/server/scheduling/volunteer-events.ts"),
  read("src/react/components/ministry/VolunteerEvents.jsx"),
])
assert.match(standaloneVolunteerMigration, /ALTER COLUMN ministry_id DROP NOT NULL/)
assert.match(generalVolunteerMigration, /is_public_assignment BOOL NOT NULL DEFAULT false/)
assert.match(generalVolunteerMigration, /unlimited_capacity BOOL NOT NULL DEFAULT false/)
assert.match(generalVolunteerBackfill, /'General Volunteer'/)
assert.match(standaloneVolunteerEvents, /event\.ministry_id IS NULL/)
assert.match(standaloneVolunteerEvents, /normalizeGeneralVolunteerCapacity/)
assert.match(standaloneVolunteerEvents, /generalVolunteerUnlimited/)
assert.match(standaloneVolunteerEvents, /INSERT INTO event_responsibilities/)
assert.match(standaloneVolunteerEvents, /volunteer_event\.created/)
assert.match(apiRoute, /scheduling\/volunteer-events/)
assert.match(schedulingVolunteers, /LEFT JOIN ministries coordinator/)
assert.match(volunteerEventsComponent, /Create event and assignments/)
assert.match(volunteerEventsComponent, /Unlimited spots/)
assert.match(volunteerEventsComponent, /Add a specific assignment/)
assert.match(volunteerEventsComponent, /A ministry is optional/)
assert.match(volunteerSignupPage, /Choose an available assignment/)
assert.match(volunteerSignupPage, /Unlimited openings/)
assert.doesNotMatch(volunteerSignupPage, /<select name="responsibilityId"/)
assert.match(homeWorkspace, /<VolunteerEvents creating/)
assert.match(schedulingVolunteers, /is_public_assignment = true/)
assert.match(schedulingVolunteers, /responsibility\.unlimited_capacity/)
assert.match(schedulingEvents, /generalVolunteerUnlimited/)
assert.match(eventDetails, /General Volunteer spots/)

const [
  volunteerAccountMigration,
  volunteerAccountInvitation,
  volunteerAccountPage,
  authWithVolunteers,
  loginLinkWithVolunteers,
] = await Promise.all([
  read("migrations/20260806_01_add_volunteer_accounts.sql"),
  read("src/server/legacy/volunteer-account-invitation.js"),
  read("src/react/pages/VolunteerAccountApp.jsx"),
  read("src/server/legacy/helper/ministry-auth.js"),
  read("src/server/legacy/ministry-login-link.js"),
])
assert.match(volunteerAccountMigration, /public_profile_id UUID NOT NULL DEFAULT gen_random_uuid/)
assert.match(volunteerAccountMigration, /is_volunteer_profile BOOL NOT NULL DEFAULT false/)
assert.match(volunteerAccountMigration, /CREATE TABLE IF NOT EXISTS volunteer_account_invitations/)
assert.match(schedulingVolunteers, /INSERT INTO users/)
assert.match(schedulingVolunteers, /user\.id/)
assert.match(schedulingVolunteers, /public_profile_id/)
assert.match(schedulingVolunteers, /accountInvitationSent/)
assert.doesNotMatch(volunteerSignupPage, /searchParams\.set\("profile"/)
assert.doesNotMatch(volunteerSignupPage, /result\.prefill/)
assert.match(volunteerSignupPage, /Sign in with password or one-time link/)
assert.match(volunteerAccountInvitation, /Password must be at least 8 characters/)
assert.doesNotMatch(volunteerAccountInvitation, /invitation:\s*\{[\s\S]*?email:\s*row\.email/)
assert.match(volunteerAccountInvitation, /createMinistryToken/)
assert.match(volunteerAccountPage, /We already collected your profile information/)
assert.match(authWithVolunteers, /is_volunteer_profile/)
assert.match(loginLinkWithVolunteers, /u\.is_volunteer_profile = true/)

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
