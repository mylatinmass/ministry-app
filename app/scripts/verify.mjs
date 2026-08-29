import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) =>
  fs.readFile(path.join(root, relativePath), "utf8")
const ministrySectionActions = await read(
  "src/react/components/ministry/MinistrySectionActions.jsx",
)

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

const substitutionMigration = await read(
  "migrations/20260812_04_add_assignment_substitution_offers.sql",
)
const substitutionScheduling = await read(
  "src/server/scheduling/substitutions.ts",
)
const conflictTicker = await read(
  "src/react/components/ministry/MinistryConflictTicker.jsx",
)
const eventAgenda = await read(
  "src/react/components/ministry/MinistryEventAgenda.jsx",
)
const homeCalendar = await read(
  "src/react/components/ministry/MinistryHomeCalendar.jsx",
)
const eventPinsMigration = await read(
  "migrations/20260824_01_add_profile_event_pins.sql",
)
const assignmentModeMigration = await read(
  "migrations/20260826_01_add_responsibility_assignment_modes.sql",
)
const attendanceConfirmationReset = await read(
  "migrations/20260827_03_reset_automatic_attendance_confirmations.sql",
)
const sourceEventAttendanceMigration = await read(
  "migrations/20260826_03_add_source_event_attendance.sql",
)
const saturdayPracticeBackfill = await read(
  "migrations/20260826_02_backfill_saturday_practice_members.sql",
)
const assignmentNotificationSource = await read(
  "src/server/notifications/assignment-notifications.ts",
)
const ministryTemplatesComponent = await read(
  "src/react/components/ministry/MinistryTemplates.jsx",
)
const globalStyles = await read("src/styles/global.css")
const priestMinistryMigration = await read(
  "migrations/20260813_01_add_priest_ministry_and_event_conflicts.sql",
)
const appearanceMigration = await read(
  "migrations/20260813_03_add_profile_appearance_theme.sql",
)
const ministryTheme = await read("src/react/utils/ministryTheme.js")
const householdCalendar = await read("src/react/utils/householdCalendar.js")
const dayBeforeReminderMigration = await read(
  "migrations/20260827_02_add_day_before_assignment_reminders.sql",
)
const accessibleDialog = await read("src/react/hooks/useAccessibleDialog.js")
const monthCalendar = await read(
  "src/react/components/ministry/MinistryMonthCalendar.jsx",
)
const messagesComponent = await read(
  "src/react/components/ministry/MinistryMessages.jsx",
)
const ministryGroupsMigration = await read(
  "migrations/20260823_01_add_ministry_groups.sql",
)
const cadenceMigration = await read(
  "migrations/20260814_01_simplify_member_notification_cadence.sql",
)
const prioryAllocationMigration = await read(
  "migrations/20260817_03_add_priory_priest_allocations.sql",
)
const prioryAllocations = await read(
  "src/server/scheduling/priory-allocations.ts",
)
const priorySettings = await read(
  "src/react/components/ministry/PrioryScheduleSettings.jsx",
)

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
assert.match(apiRoute, /scheduling\/priory-allocations/)
assert.match(apiRoute, /handlePrioryAllocations/)
assert.match(prioryAllocationMigration, /CREATE TABLE IF NOT EXISTS priory_integration_settings/)
assert.match(prioryAllocationMigration, /CREATE TABLE IF NOT EXISTS priory_priest_mappings/)
assert.match(prioryAllocationMigration, /CREATE TABLE IF NOT EXISTS priory_allocation_cache/)
assert.match(prioryAllocationMigration, /CREATE TABLE IF NOT EXISTS priory_allocation_requests/)
assert.match(prioryAllocationMigration, /priory_allocation_conflict BOOL NOT NULL DEFAULT false/)
assert.match(prioryAllocations, /GOOGLE_PRIORY_SCHEDULE_CREDENTIALS_JSON/)
assert.match(prioryAllocations, /PRIORY_SCHEDULE_NOTIFICATION_EMAILS/)
assert.match(prioryAllocations, /PRIORY_SCHEDULE_TELEGRAM_CHAT_IDS/)
assert.match(prioryAllocations, /last verified cached Priory schedule|last_sync_error/)
assert.match(prioryAllocations, /assertPriestAllocation/)
assert.match(prioryAllocations, /request_allocation/)
assert.match(priorySettings, /Use the shared Priory schedule/)
assert.match(priorySettings, /Priest profile mappings/)
assert.match(appearanceMigration, /appearance_theme STRING NOT NULL DEFAULT 'light'/)
assert.match(appearanceMigration, /appearance_theme IN \('light', 'dark'\)/)
assert.match(ministryProfileServer, /contact\.appearance_theme/)
assert.match(ministryProfileServer, /appearanceTheme: profile\.appearance_theme \|\| "light"/)
assert.match(ministryProfileServer, /appearance_theme = \$18/)
assert.match(ministryProfileServer, /notification_email_connected_value = \$16/)
assert.match(ministryProfileServer, /notification_sms_connected_value = \$17/)
assert.match(ministryProfileServer, /notificationConnections:/)
assert.match(profile, /role="switch"/)
assert.match(profile, /SunIcon/)
assert.match(profile, /MoonIcon/)
assert.match(profile, /connected[\s\S]*?"Send test"[\s\S]*?: "Connect"/)
assert.doesNotMatch(profile, />\s*Disconnected\s*</)
assert.doesNotMatch(profile, /Connected to \$\{draft\.(email|phone)\}/)
assert.match(profile, /applyMinistryTheme\(result\.profile\.appearanceTheme/)
assert.match(ministryTheme, /dataset\.ministryTheme/)
assert.match(ministryTheme, /ministry_active_theme/)
assert.doesNotMatch(ministryTheme, /ministry_theme_\$\{profileId\}/)
assert.match(profile, /Managed profiles use the parent account's appearance/)
assert.match(ministrySectionActions, /hidden shrink-0 justify-center lg:flex/)
assert.match(ministrySectionActions, /ministry-mobile-actions fixed inset-x-0 bottom-0/)
assert.match(ministrySectionActions, /action\.hidden/)
assert.match(profile, /MinistrySectionActions/)
assert.match(householdCalendar, /#f97316/)
assert.match(householdCalendar, /#22c55e/)
assert.match(householdCalendar, /#a855f7/)
assert.match(ministryWorkspace, /ministry_visible_profile_ids:\$\{actorId\}/)
assert.match(ministryWorkspace, /profileColor:/)
assert.match(homeWorkspace, /ministry_visible_profile_ids:\$\{actorId\}/)
assert.match(homeWorkspace, /toggleVisibleProfile/)
assert.match(homeCalendar, /const hasAssignment = dayEvents\.some/)
assert.match(homeCalendar, /MinistrySectionActions/)
assert.match(homeCalendar, /\{hasEvents && \(/)
assert.match(homeCalendar, /hasAssignment \? "bg-orange-500" : "bg-gray-400"/)
assert.match(
  homeCalendar,
  /matchMedia\("\(max-width: 639px\)"\)\.matches \? "week" : "month"/,
)
assert.match(ministryList, /managed\.guardian_user_id = \$1/)
assert.match(ministryList, /profileId: assignment\.user_id/)
assert.match(eventAgenda, /assignmentProfiles/)
assert.match(eventAgenda, /backgroundColor: assignment\.profileColor/)
assert.match(globalStyles, /data-ministry-theme="dark"/)
assert.match(globalStyles, /#047857/)
assert.match(globalStyles, /#6ee7b7/)
assert.match(accessibleDialog, /event\.key === "Escape"/)
assert.match(accessibleDialog, /returnFocusRef\.current/)
assert.match(monthCalendar, /includes your assignment/)
assert.match(monthCalendar, /aria-label="Next month"/)
assert.match(messagesComponent, /role="alert"/)
assert.match(messagesComponent, /aria-live="polite"/)
assert.match(ministryGroupsMigration, /CREATE TABLE IF NOT EXISTS ministry_groups/)
assert.match(ministryGroupsMigration, /automatic_membership BOOL NOT NULL DEFAULT false/)
assert.match(ministryGroupsMigration, /INSERT INTO ministry_group_members/)
assert.match(ministryGroupsMigration, /'Choir'.*true/s)
assert.match(ministryGroupsMigration, /'Schola'.*false/s)
assert.match(ministryGroupsMigration, /'ceremony', 'sacred-music', 'choir'/)
assert.match(ministryList, /WHERE m\.status = 'active'/)
assert.match(ministryList, /'ceremony', 'sacred-music', 'choir'/)
assert.doesNotMatch(ministryMembers, /choir_only|set_choir_only/)
assert.match(ministryMembers, /set_member_groups/)
assert.match(ministryMembers, /automatic_membership/)
assert.match(ministryMembersComponent, /Automatic membership/)
assert.match(schedulingEvents, /ministry_group_members/)
assert.match(schedulingEvents, /required_group_id/)
assert.match(schedulingEvents, /isEventParticipant/)
assert.match(schedulingEvents, /canSeeAssignmentDetails/)

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

const independentNotificationChannelsMigration = await read(
  "migrations/20260807_04_add_notification_channels.sql",
)
const pushNotificationsComponent = await read(
  "src/react/components/ministry/PushNotifications.jsx",
)
const notificationDelivery = await read(
  "src/server/notifications/delivery.ts",
)
assert.match(independentNotificationChannelsMigration, /notification_email_enabled/)
assert.match(independentNotificationChannelsMigration, /notification_telegram_enabled/)
assert.match(independentNotificationChannelsMigration, /notification_sms_enabled/)
assert.match(independentNotificationChannelsMigration, /notification_push_enabled/)
assert.match(independentNotificationChannelsMigration, /last_test_at/)
assert.match(independentNotificationChannelsMigration, /'email', 'telegram', 'sms', 'push'/)
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
const astroKlaviyoProfileQueue = await read(
  "src/server/notifications/klaviyo-profile-sync.ts",
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
assert.match(klaviyoProfiles, /status = 'failed'/)
assert.match(klaviyoProfiles, /updated_at <= now\(\) - INTERVAL '24 hours'/)
assert.doesNotMatch(klaviyoProfiles, /ministry_names|ministry_roles/)
assert.match(klaviyoProfileQueue, /SELECT managed_profile\.guardian_user_id/)
assert.match(astroKlaviyoProfileQueue, /export const queueKlaviyoProfileSync/)
assert.match(klaviyoManagedProfilesMigration, /managed_profile\.child_user_id/)
assert.match(familyProfiles, /queueKlaviyoProfileSync\(client, childId\)/)
assert.match(klaviyo, /assignment_subject_external_id/)
assert.match(klaviyo, /external_id: `ministry:\$\{context\.recipient_user_id\}`/)
assert.match(reminders, /processKlaviyoProfileSyncs/)
assert.match(reminders, /queueDailyAdminAlerts/)
assert.doesNotMatch(reminders, /queueTomorrowSchedules/)
assert.match(reminders, /type:\s*"day_before"/)
assert.match(reminders, /type:\s*"event_offset"/)
assert.match(dayBeforeReminderMigration, /'day_before'/)
assert.match(reminders, /'one_week',[\s\S]*'confirmation_midpoint'/)
assert.match(volunteerSignupProfileSync, /queueKlaviyoProfileSync/)
assert.doesNotMatch(
  volunteerSignupProfileSync,
  /legacy\/helper\/klaviyo-profile-sync/,
)
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
const messageAlertMigration = await read(
  "migrations/20260818_01_add_message_alert_delivery.sql",
)
const expandedMessageAudienceMigration = await read(
  "migrations/20260825_01_expand_message_audiences.sql",
)
const externalMessageRecipientMigration = await read(
  "migrations/20260827_01_support_external_message_recipients.sql",
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
assert.match(messageAlertMigration, /CREATE TABLE IF NOT EXISTS ministry_message_deliveries/)
assert.match(messageAlertMigration, /channel IN \('email', 'telegram', 'sms', 'push'\)/)
assert.match(messageAlertMigration, /UNIQUE \(recipient_id, channel\)/)
assert.match(messageServer, /Only a Super Admin can message all members/)
assert.match(messageServer, /Only ministry administrators can send messages/)
assert.match(messageServer, /body\.action === "mark_all_read"/)
assert.match(messageServer, /event_participants/)
assert.match(messageServer, /manageableMembers/)
assert.match(expandedMessageAudienceMigration, /ministry_message_ministries/)
assert.match(expandedMessageAudienceMigration, /ministry_message_selected_members/)
assert.match(expandedMessageAudienceMigration, /event_participants/)
assert.match(externalMessageRecipientMigration, /external_email/)
assert.match(externalMessageRecipientMigration, /external_sms_consent_at/)
assert.match(externalMessageRecipientMigration, /ALTER COLUMN profile_user_id DROP NOT NULL/)
assert.match(messageServer, /processMinistryMessageDeliveries/)
assert.match(messageServer, /processMinistryMessageDeliveries\(messageId\)/)
assert.match(messageServer, /deliveryProcessingDeferred/)
assert.match(messageServer, /\.filter\(Boolean\)/)
assert.match(messageServer, /assignment\.user_id IS NULL/)
assert.match(messageServer, /external_email_enabled/)
assert.match(messageServer, /external_sms_consent_at/)
assert.match(messageServer, /\?section=messages/)
assert.match(messageServer, /recipient\.message_id = \$1/)
assert.match(messageServer, /deliverySummary/)
assert.match(messageServer, /sendAccountPush/)
assert.match(messageServer, /sendKlaviyoAlertDue/)
assert.match(messageServer, /sendTelegramMessage/)
assert.match(messageServer, /MINISTRY_OUTBOUND_DELIVERY_ENABLED/)
assert.match(messageComponent, /View All/)
assert.match(messageComponent, /label: "Unread", icon: FunnelIcon/)
assert.match(messageComponent, /Mark All Read/)
assert.match(messageComponent, /New Message/)
assert.doesNotMatch(messageComponent, /Sent Messages/)
assert.match(messageComponent, /One or more ministries/)
assert.match(messageComponent, /Selected members/)
assert.match(messageComponent, /Alerts use enabled Telegram, push, and SMS notifications—never email/)
assert.match(messageComponent, /\{form\.body\.length\}\/200/)
assert.match(messageComponent, /form\.body\.length > 200/)
assert.match(messageComponent, /channel deliveries/)
assert.match(messageComponent, /receivedFilter/)
assert.match(messageComponent, /MinistrySectionActions/)
assert.match(availabilityComponent, /MinistrySectionActions/)
assert.match(availabilityComponent, /Explain availability calendar markers/)
assert.match(availabilityComponent, /availability-legend-title/)
assert.match(availabilityComponent, /translate-x-full/)
assert.match(availabilityComponent, /border-0 bg-white p-0 shadow-none/)
assert.match(availabilityComponent, /className="w-full border-0 p-0"/)
assert.match(homeWorkspace, /All Events/)
assert.match(homeWorkspace, /Pinned Events/)
assert.match(homeWorkspace, /Create Event/)
assert.doesNotMatch(homeWorkspace, /Create for ministry/)
assert.doesNotMatch(homeWorkspace, /Back to events/)
assert.match(homeWorkspace, /All Ministries/)
assert.match(homeWorkspace, /My Ministries/)
assert.match(homeWorkspace, /Request Access/)
assert.match(homeWorkspace, /New Ministry/)
assert.match(homeWorkspace, /grid-cols-\[auto_minmax\(0,1fr\)\]/)
assert.match(homeWorkspace, /Active Member/)
assert.doesNotMatch(homeWorkspace, /Most templates/)
assert.match(homeWorkspace, /request_memberships/)
assert.match(familyProfiles, /requestableMinistries/)
assert.match(familyProfiles, /Choose at least one ministry/)
assert.match(messageServer, /delivery_account_user_id === context\.actor\.id/)
assert.match(globalMembersUi, /All Members/)
assert.match(globalMembersUi, /Pending Members/)
assert.match(globalMembersUi, /Add New Member/)
assert.match(messageComponent, /message\.eventTitle \|\| "Event participants"/)
assert.match(eventDetails, /deliveryProcessingDeferred/)
assert.match(eventDetails, /no recipient currently has an enabled delivery channel/)
assert.match(messageServer, /Alerts must be 200 characters or fewer/)
for (const accountCreationSource of [
  invitationResponse,
  familyProfiles,
  volunteerSignupProfileSync,
]) {
  assert.match(accountCreationSource, /notification_email_enabled/)
  assert.match(accountCreationSource, /notification_announcements_enabled/)
}
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
assert.match(schedulingTemplates, /action === "preview_update"/)
assert.match(schedulingTemplates, /start_time > now\(\)/)
assert.match(schedulingTemplates, /propagateTemplateToFutureEvents/)
assert.match(schedulingTemplates, /confirmedTemplateImpact/)
assert.match(schedulingTemplates, /syncTemplateStructure/)
assert.match(ministryTemplatesComponent, /Confirm assignment cancellations/)
assert.match(ministryTemplatesComponent, /confirmedTemplateImpact/)
assert.match(
  assignmentNotificationSource,
  /sendTemplateAssignmentCancellationNotifications/,
)
assert.match(
  schedulingEvents,
  /responsibilitiesToUpdate = \[\s*responsibility,\s*\.\.\.futureResult\.rows/,
)
assert.match(
  schedulingEvents,
  /!EXPECTED_ATTENDANCE_MODES\.includes\(input\.assignmentMode\)[\s\S]{0,200}input\.quantityNeeded < Number\(target\.assigned_quantity\)/,
)
assert.match(schedulingEvents, /effectiveFromEventId: event\.id/)
const ministryEventsComponent = await read(
  "src/react/components/ministry/MinistryEvents.jsx",
)
assert.match(ministryEventsComponent, /activeAction\.id === "add-event"/)
assert.match(ministryEventsComponent, /w-full border-0 bg-white p-0 shadow-none/)
assert.match(ministryEventsComponent, /status: editing \? undefined : "published"/)
assert.match(ministryEventsComponent, /"PUBLISH EVENT"/)
assert.match(ministryEventsComponent, /"PUBLISH COPY"/)
assert.match(ministryEventsComponent, /Update current event/)
assert.match(ministryEventsComponent, /Update all future events/)
assert.match(
  ministryEventsComponent,
  /event\.nativeEvent\?\.submitter\?\.value === "this_and_future"/,
)
assert.doesNotMatch(ministryEventsComponent, /type="radio"/)
assert.match(ministryEventsComponent, /Event template[\s\S]*\(optional\)/)
assert.match(ministryEventsComponent, /No template — start with a blank event/)
assert.match(ministryEventsComponent, /ministryId: data\.ministry\.id/)
assert.match(ministryEventsComponent, /Event name/)
assert.match(ministryEventsComponent, /disabled=\{Boolean\(form\.templateId\)\}/)
assert.match(ministryEventsComponent, /This event uses the template name/)
assert.doesNotMatch(ministryEventsComponent, /Create an active template before creating an event/)
assert.doesNotMatch(
  ministryEventsComponent,
  /\(!form\.sourceEventId && !form\.templateId\)/,
)
assert.doesNotMatch(
  ministryEventsComponent,
  /SAVE DRAFT|Create draft copy|save the event as a draft/i,
)
assert.doesNotMatch(
  ministryEventsComponent,
  /name="eventStatus"[\s\S]{0,100}value="draft"/,
)
assert.match(schedulingEvents, /const status = "published"/)
assert.match(schedulingEvents, /templateId\s*\? await loadTemplateStructure/)
assert.match(schedulingEvents, /responsibilities: \[\]/)
assert.match(schedulingEvents, /Event title is required/)
assert.match(schedulingEvents, /const title = templateId[\s\S]*structure\.template\.name/)
assert.match(schedulingEvents, /title = \$5,[\s\S]*participation_type = \$6/)
assert.doesNotMatch(schedulingEvents, /rsvp/i)
assert.doesNotMatch(ministryEventsComponent, /rsvp/i)
assert.doesNotMatch(eventDetails, /rsvp/i)
assert.match(assignmentModeMigration, /all_available_members/)
assert.match(assignmentModeMigration, /preferred_assignee_user_id/)
assert.match(sourceEventAttendanceMigration, /source_event_assignees/)
assert.match(sourceEventAttendanceMigration, /all_active_members/)
assert.match(saturdayPracticeBackfill, /db55364b-63a0-4445-a50d-439f46c3bef0/)
assert.match(saturdayPracticeBackfill, /membership\.can_serve = true/)
assert.match(schedulingEvents, /normalizeInlineResponsibilities/)
assert.match(schedulingEvents, /decline_all_member_expectation/)
assert.match(schedulingEvents, /all-members-series:/)
assert.match(ministryEventsComponent, /Expected ministry attendance/)
assert.match(ministryEventsComponent, /Ministry level or higher/)
assert.match(ministryEventsComponent, /All active members/)
assert.match(ministryEventsComponent, /requiredLevelId/)
assert.match(ministryEventsComponent, /Call the source event roster to attend/)
assert.match(eventDetails, /Can’t make it/)
assert.match(eventDetails, /confirm_my_assignments/)
assert.match(eventDetails, /assignmentResponseOrder/)
assert.match(schedulingEvents, /const confirmMyEventAssignments/)
assert.match(schedulingEvents, /canDeclineAssignment/)
assert.match(attendanceConfirmationReset, /SET status = 'assigned'/)
assert.match(eventDetails, /Clone and modify/)
assert.match(eventDetails, /displayedEvent\.template_name\?\.trim\(\)/)
assert.match(eventDetails, /eventDescription &&/)
assert.match(eventDetails, /const activeResponsibilities =/)
assert.match(eventDetails, /\["cancelled", "deleted"\]/)
assert.match(eventDetails, /renderEventActions\("hidden shrink-0 sm:flex"\)/)
assert.match(
  eventDetails,
  /const canMessageParticipants = Boolean\(details\?\.canManageEvent\)/,
)
assert.doesNotMatch(schedulingEvents, /event\.created_by === context\.user\.id/)
assert.match(
  messageServer,
  /audience === "event_participants"[\s\S]{0,700}\$3::BOOL[\s\S]{0,120}event\.ministry_id = ANY/,
)
assert.match(eventDetails, /border-t border-gray-100 pt-5 sm:hidden/)
assert.match(ordoReference, /InformationCircleIcon/)
assert.match(ordoReference, /More Details/)
assert.match(ordoReference, /hover:border-\[#C1A387\] sm:hidden/)
assert.match(ordoReference, /showDayDetails \? "translate-x-0" : "translate-x-full"/)
assert.match(eventDetails, /aria-label="Loading assignments"/)
assert.match(eventDetails, /overflow-x-hidden overflow-y-auto/)
assert.match(globalStyles, /\.ministry-scroll-region[\s\S]{0,180}overflow-x: hidden/)
assert.match(eventDetails, /animate-pulse rounded-xl/)
assert.match(eventDetails, /isEditingResponsibilities/)
assert.match(eventDetails, /isEditingResponsibilities \? "Done" : "Edit"/)
assert.match(eventDetails, /showAssignmentControls && eventCanChange/)
assert.match(eventDetails, /Admin attention required/)
assert.match(eventDetails, />\s*Automate\s*</)
assert.match(eventDetails, /Save assignments/)
assert.match(schedulingEvents, /responsibility\.status <> 'cancelled'/)
assert.match(homeWorkspace, /cloneEventFromDetails/)
assert.match(schedulingEvents, /source_event_assignees/)
assert.match(schedulingEvents, /Only a Super Admin can call all active members/)
assert.match(schedulingEvents, /copySourceRoster/)
assert.match(schedulingEvents, /required_ministry_level_id/)
assert.match(schedulingAvailability, /assignmentMode === "all_available_members"/)
assert.match(assignmentNotificationSource, /responsibility\.assignment_mode = 'standard'/)
assert.match(ministryList, /COALESCE\(e\.visibility, 'public'\) <> 'private'/)
assert.match(eventDetails, /action: "request_substitute"/)
assert.match(substitutionScheduling, /assignment\.substitute_requested/)
assert.match(schedulingEvents, /status: "published",[\s\S]{0,200}sourceEventId/)
assert.doesNotMatch(
  schedulingEvents,
  /status: occurrenceStarts\.length > 1 \? "draft" : status/,
)
assert.match(reminders, /AS duty_start_time/)
assert.match(reminders, /dutyStart\.getTime\(\) - Number\(candidate\.lead_minutes\)/)
assert.match(reminders, /e\.updated_at::STRING AS event_updated_at/)
assert.doesNotMatch(reminders, /new Date\(candidate\.event_updated_at\)\.toISOString\(\)/)
assert.match(substitutionMigration, /assignment_substitution_offers/)
assert.match(substitutionMigration, /'replaced'/)
assert.match(substitutionScheduling, /minimum_level_rank/)
assert.match(substitutionScheduling, /FOR UPDATE OF request, assignment/)
assert.match(substitutionScheduling, /conflicting assignment and cannot accept/)
assert.match(substitutionScheduling, /status = 'accepted'/)
assert.match(substitutionScheduling, /status = 'expired'/)
assert.match(conflictTicker, /bg-orange-500/)
assert.match(conflictTicker, /change_requested/)
assert.match(conflictTicker, /ministry-conflicts-updated/)
assert.match(conflictTicker, /Handle now/)
assert.match(ministryWorkspace, /MinistryConflictTicker/)
assert.match(homeWorkspace, /MinistryConflictTicker/)
assert.match(schedulingEvents, /other_responsibility\.relative_start_minutes/)
assert.match(schedulingEvents, /responsibility\.relative_start_minutes/)
assert.match(eventAgenda, /ministry-scroll-region/)
assert.match(globalStyles, /height:\s*100dvh/)
assert.match(globalStyles, /-webkit-overflow-scrolling:\s*touch/)
assert.match(priestMinistryMigration, /'Priests'/)
assert.match(priestMinistryMigration, /'priest_sick_call'/)
assert.match(priestMinistryMigration, /'priest_private_appointment'/)
assert.match(priestMinistryMigration, /conflict_override_reason/)
assert.match(schedulingEvents, /preview_event_conflicts/)
assert.match(schedulingEvents, /Fix the time or explicitly ignore the warning/)
assert.match(availabilityComponent, /Existing Exclusion Rules/)
assert.match(availabilityComponent, /Create New Exclusion Rule/)
assert.match(schedulingAvailability, /resolveManagedSubjects/)
assert.match(schedulingAvailability, /Availability can only be managed for active members of this ministry/)
assert.match(eventDetails, /Request Sub/)
assert.match(eventDetails, /Accept substitution/)
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
assert.match(globalMembersServer, /ministry_profile_suppressions suppression/)
assert.match(globalMembersServer, /suppression\.reactivated_at IS NULL/)
assert.match(ministryMembers, /hasParticipationHistory/)
assert.match(ministryMembers, /permanentlyDeleteUnusedProfile/)
assert.match(ministryMembers, /app_membership\.declined_and_deleted/)
assert.match(ministryMembers, /ministry_profile\.deleted_unused/)
assert.match(globalMembersServer, /LEFT JOIN ministry_members membership/)
assert.match(globalMembersServer, /visible_membership\.status = 'active'/)
assert.match(globalMembersServer, /pendingMembers:/)
assert.match(globalMembersUi, /Search members/)
assert.match(globalMembersUi, /hidden: !data\.canManage/)
assert.match(globalMembersUi, /data\.canManage && \(/)
assert.match(globalMembersUi, /cursor-default/)
assert.match(globalMembersServer, /visibleMinistriesResult/)
assert.match(globalMembersServer, /const canManage = managedMinistriesResult\.rowCount > 0/)
assert.match(globalMembersUi, /Pending member approvals/)
assert.match(globalMembersUi, /action: "approve_app_member"/)
assert.doesNotMatch(globalMembersUi, /action: "add_existing_member"/)
assert.match(globalMembersUi, /userId: selectedMember\.id/)
assert.match(globalMembersUi, /action: "set_role"/)
assert.match(globalMembersUi, /action: "set_ministry_level"/)
assert.match(globalMembersUi, /action: "set_global_role"/)
assert.match(ministryMembers, /ministry_user\.global_role_changed/)
assert.match(ministryMembers, /You cannot change your own global access/)
assert.doesNotMatch(accountNavigation, /id: "members"[\s\S]{0,180}managerOnly: true/)
assert.match(accountNavigation, /label: "Ministries"/)
assert.match(homeWorkspace, /accountSections/)
assert.match(homeWorkspace, /canManageMembers/)
assert.match(ministryWorkspace, /accountMenuSections/)
assert.match(homeWorkspace, /<MinistryGlobalMembers \/>/)
assert.match(globalMembersServer, /membership\.level IN \('owner', 'admin'\)/)
assert.match(globalMembersServer, /ORDER BY directly_managed DESC/)
assert.match(globalMembersServer, /invitableMinistries/)
assert.match(ministryMembers, /getDirectlyManagedMinistries/)
assert.match(globalMembersServer, /membership\.ministry_id = ANY\(\$1::UUID\[\]\)/)
assert.match(globalMembersServer, /canManageAll/)
assert.match(globalMembersUi, /data\.canManageAll/)
assert.match(globalMembersServer, /communicationsResult/)
assert.match(globalMembersServer, /telegram_connected/)
assert.match(globalMembersServer, /active_push_devices/)
assert.match(globalMembersServer, /sms_consented/)
assert.match(globalMembersUi, /Communications and notifications/)
assert.match(globalMembersUi, /Ready to receive/)
assert.match(globalMembersUi, /Consent required/)
assert.match(globalMembersUi, /Notification categories/)
assert.match(globalMembersServer, /invitation\.status = 'pending'/)
assert.match(globalMembersUi, /MinistryPendingInvitations/)
assert.match(ministryMembersComponent, /MinistryPendingInvitations/)
assert.match(globalMembersServer, /AS recipient_email/)
assert.match(globalMembersServer, /invitation\.requested_by = \$3/)
assert.match(ministryMembers, /AS recipient_email/)
assert.match(ministryMembers, /invitation\.requested_by = \$3/)
assert.match(ministryMembers, /invitation\.requested_by !== user\.id/)
assert.match(pendingInvitations, /invitation\.recipientEmail/)
assert.match(ministryMembersComponent, /Pending invited members/)
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
assert.doesNotMatch(schedulingEvents, /body\.action === "set_schedule_status"/)
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
assert.match(eventDetails, /Update current event/)
assert.match(eventDetails, /Update all future events/)
assert.match(
  eventDetails,
  /submitEvent\.nativeEvent\?\.submitter\?\.value === "this_and_future"/,
)
assert.match(eventDetails, /Event only/)
assert.match(eventDetails, /LEAVE BLANK/)
assert.match(eventDetails, />\s*Automate\s*</)
assert.match(schedulingEvents, /responsibility_assignment\.auto_assigned/)
assert.match(schedulingEvents, /event\.auto_published/)
assert.match(schedulingEvents, /event\.auto_publish_held/)
assert.match(schedulingEvents, /preview_matching_conflicts/)
assert.match(schedulingEvents, /event\.matching_conflicts_resolved/)
assert.match(eventDetails, /Apply to matching conflicts/)
assert.match(eventDetails, /action:\s*"save_assignments"/)
assert.match(schedulingEvents, /preview_template_assignments/)
assert.match(schedulingEvents, /A member can fill only one position in an event/)
assert.match(schedulingEvents, /event\.assignments_saved/)
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
assert.match(availabilityComponent, /Save partial availability/)
assert.doesNotMatch(eventDetails, /Request change/)
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
  schedulingEvents,
  /required_level\.rank_order DESC NULLS LAST/
)
assert.match(
  schedulingEvents,
  /granted_level\.rank_order - required_level\.rank_order/
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
assert.match(ordoReference, /isOrdoSource \? "1962 Ordo" : "Ordo source"/)
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
const schedulingReliability = await read("src/server/scheduling/reliability.ts")
assert.match(schedulingEvents, /loadReliabilitySummaries/)
assert.match(schedulingReliability, /if \(noticeHours < 24\) return -5/)
assert.match(schedulingReliability, /if \(noticeHours < 48\) return -3/)
assert.match(schedulingReliability, /return -1/)
assert.match(schedulingReliability, /row\.service_outcome === "served" \? 1 : -10/)
assert.match(schedulingReliability, /index < 5 \? 3 : 2/)
assert.match(schedulingReliability, /needsFollowUp: score < 100/)
assert.match(eventDetails, /Pre-publication review/)
assert.match(eventDetails, /Record outcome/)
assert.doesNotMatch(schedulingAvailability, /decline_assignment/)
assert.match(schedulingAvailability, /requestChanges/)
assert.match(schedulingAvailability, /changeRequestedAssignmentIds/)
assert.match(schedulingAvailability, /block\.ministry_id/)
assert.match(availabilityComponent, /Ministries/)
assert.match(availabilityComponent, /ministryIds: ruleMinistryIds/)
assert.match(availabilityComponent, /Choose at least one ministry/)
const [alertMigration, assignmentNotifications, alertsServer] = await Promise.all([
  read("migrations/20260808_02_add_ministry_alert_digests.sql"),
  read("src/server/notifications/assignment-notifications.ts"),
  read("src/server/notifications/alerts.ts"),
])
const [chapelSettingsServer, chapelSettingsComponent, notificationTestMode] =
  await Promise.all([
    read("src/server/chapel-settings.ts"),
    read("src/react/components/ministry/ChapelSettings.jsx"),
    read("src/server/notifications/test-mode.ts"),
  ])
assert.match(chapelSettingsComponent, /Danger Zone/)
assert.match(chapelSettingsComponent, /Notification Settings/)
assert.match(chapelSettingsComponent, /TEST MODE IS ACTIVE/)
assert.match(chapelSettingsComponent, /Select a Super Admin/)
assert.match(chapelSettingsServer, /update_notification_test_mode/)
assert.match(chapelSettingsServer, /notificationTestModeEnabled/)
assert.match(chapelSettingsServer, /notificationTestAccountUserId/)
assert.match(chapelSettingsServer, /global_role IN \('owner', 'super_admin'\)/)
assert.doesNotMatch(
  chapelSettingsServer,
  /UPDATE ministry_message_deliveries[\s\S]*status = 'skipped'/,
)
assert.match(notificationTestMode, /applyNotificationTestMetadata/)
assert.match(notificationTestMode, /notification_test_profile_missing/)
assert.match(alertMigration, /subject_user_id/)
assert.match(alertMigration, /recipient_user_id/)
assert.match(completedNotificationsMigration, /notification_reminders_enabled/)
assert.match(completedNotificationsMigration, /notification_schedule_changes_enabled/)
assert.match(completedNotificationsMigration, /sms_transactional_consent_at/)
assert.match(completedNotificationsMigration, /CREATE TABLE IF NOT EXISTS ministry_alert_deliveries/)
assert.match(assignmentNotifications, /processNotificationDigests/)
assert.match(assignmentNotifications, /applyNotificationTestMetadata/)
assert.match(assignmentNotifications, /delivery_recipient_user_id/)
assert.match(assignmentNotifications, /notificationTestAccountUserId/)
assert.match(assignmentNotifications, /\$2::UUID/)
const outboundAlertKinds = assignmentNotifications.match(
  /const OUTBOUND_ALERT_KINDS = new Set\(\[([\s\S]*?)\]\)/,
)?.[1] || ""
assert.match(outboundAlertKinds, /weekly_schedule_summary/)
assert.match(outboundAlertKinds, /daily_admin_summary/)
assert.match(outboundAlertKinds, /day_before_schedule_reminder/)
assert.match(outboundAlertKinds, /final_schedule_reminder/)
assert.doesNotMatch(outboundAlertKinds, /assignment_created/)
assert.doesNotMatch(outboundAlertKinds, /event_changed/)
assert.doesNotMatch(outboundAlertKinds, /substitution_available/)
assert.match(assignmentNotifications, /event\.updated_at::STRING AS event_updated_at/)
assert.match(
  assignmentNotifications,
  /date_trunc\('milliseconds', event\.updated_at\)[\s\S]*date_trunc\('milliseconds', reminder\.event_updated_at\)/,
)
assert.doesNotMatch(
  assignmentNotifications,
  /event\.updated_at = reminder\.event_updated_at/,
)
assert.match(assignmentNotifications, /buildDigest/)
assert.match(assignmentNotifications, /sendEventScheduleNotifications/)
assert.match(assignmentNotifications, /sendAccountPush/)
assert.match(assignmentNotifications, /sendTelegramMessage/)
assert.match(assignmentNotifications, /sendKlaviyoAlertDue/)
assert.match(assignmentNotifications, /queueWeeklyAssignmentReviews/)
assert.match(assignmentNotifications, /queueDailyAdminAlerts/)
assert.match(assignmentNotifications, /weekly_schedule_summary/)
assert.match(assignmentNotifications, /daily_admin_summary/)
assert.match(assignmentNotifications, /count\(DISTINCT event\.id\)/)
assert.match(assignmentNotifications, /conciseAssignmentMessage/)
assert.match(assignmentNotifications, /conciseDailyAdminMessage/)
assert.doesNotMatch(assignmentNotifications, /Ministry App \$\{alerts\.length === 1 \? "update"/)
assert.match(assignmentNotifications, /Hello \$\{recipientName\}/)
assert.match(assignmentNotifications, /day_before_schedule_reminder/)
assert.match(assignmentNotifications, /Sub Requests Pending/)
assert.match(assignmentNotifications, /buildDigestHtml/)
assert.match(assignmentNotifications, /processUrgentStaffingShortages/)
assert.match(assignmentNotifications, /processUrgentAcknowledgmentEscalations/)
assert.match(assignmentNotifications, /final-schedule/)
assert.match(assignmentNotifications, /"Event Reminder"/)
assert.match(assignmentNotifications, /delivery_status = 'failed'/)
assert.match(
  assignmentNotifications,
  /updated_at <= now\(\) - INTERVAL '24 hours'/,
)
assert.match(assignmentNotifications, /OUTBOUND_ALERT_KINDS/)
assert.match(cadenceMigration, /retired_by_summary_notification_policy/)
assert.match(cadenceMigration, /assignment_weekly_review/)
assert.match(profile, /notificationCategoryOptions/)
assert.match(profile, /transactional text messages/)
assert.match(alertsServer, /mark_all_read/)
assert.match(alertsServer, /deliveryStatus/)
assert.match(alertsServer, /body\.action === "acknowledge"/)
assert.match(alertsServer, /notification\.acknowledged/)
assert.match(alertsServer, /recipient_user_id = \$2/)
assert.match(homeWorkspace, /profile\.alertCount > 0/)
assert.match(homeWorkspace, /bg-orange-400/)
assert.match(apiRoute, /scheduling\/reports/)
assert.match(schedulingReports, /INTERVAL '6 months'/)
assert.match(schedulingReports, /levelHistory/)
assert.match(reportsComponent, /Export CSV/)
assert.match(reportsComponent, /Time patterns/)
assert.match(workspaceContent, /Internal calendar/)
assert.match(workspaceContent, /downloadEventSchedulePdf/)
assert.match(workspaceContent, /Download PDF/)
const eventSchedulePdf = await read(
  "src/react/components/ministry/downloadEventSchedulePdf.js",
)
assert.match(eventSchedulePdf, /jsPDF/)
assert.match(eventSchedulePdf, /event\.title/)
assert.match(eventSchedulePdf, /event\.location/)

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
assert.doesNotMatch(homeWorkspace, /VolunteerEvents/)
assert.match(homeWorkspace, /events=\{calendarEvents\}/)
assert.match(homeWorkspace, /Pinned Events/)
assert.match(homeWorkspace, /action: "set_pin"/)
assert.match(homeWorkspace, /eventView === "pinned"/)
assert.match(eventAgenda, /onTogglePin/)
assert.match(eventAgenda, /aria-pressed=\{isPinned\}/)
assert.match(schedulingEvents, /const setEventPin/)
assert.match(schedulingEvents, /profile\.event_pinned/)
assert.match(ministryList, /AS is_pinned/)
assert.match(eventPinsMigration, /CREATE TABLE IF NOT EXISTS ministry_event_pins/)
assert.match(eventPinsMigration, /PRIMARY KEY \(user_id, event_id\)/)
assert.match(ministryList, /WHERE e\.status IN \('published', 'cancelled', 'completed'\)/)
assert.match(ministryList, /pendingSubRequestEventIds/)
assert.match(ministryList, /unfilledPositionEventIds/)
assert.doesNotMatch(ministryList, /request\.request_type = 'substitute'/)
assert.match(homeWorkspace, /Unread Messages/)
assert.match(homeWorkspace, /My Assignments/)
assert.match(homeWorkspace, /Pending Requests/)
assert.match(homeWorkspace, /PendingRequestList/)
assert.match(homeWorkspace, /event\.issueCount/)
assert.match(ministryList, /pendingRequests: attentionEvents\.reduce/)
assert.match(ministryList, /severity/)
assert.match(homeWorkspace, /selectSection\("events", "mine"\)/)
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
assert.match(schedulingVolunteers, /is_public_assignment = true/)
assert.match(schedulingVolunteers, /responsibility\.unlimited_capacity/)
assert.match(schedulingEvents, /generalVolunteerUnlimited/)
assert.match(eventDetails, /General Volunteer spots/)

const [
  privatePriestMigration,
  priestAppointments,
  priestPrivacy,
  telegramScheduling,
  emergencySchedules,
] = await Promise.all([
  read("migrations/20260813_02_add_private_priest_workflows.sql"),
  read("src/server/scheduling/priest-appointments.ts"),
  read("src/server/scheduling/priest-privacy.ts"),
  read("src/server/notifications/telegram.ts"),
  read("src/server/notifications/emergency-schedules.ts"),
])
assert.match(privatePriestMigration, /CREATE TABLE IF NOT EXISTS priest_appointment_details/)
assert.match(privatePriestMigration, /CREATE TABLE IF NOT EXISTS telegram_event_drafts/)
assert.match(priestAppointments, /protectedValuesExcluded: true/)
assert.doesNotMatch(priestAppointments, /afterData:\s*next/)
assert.match(priestPrivacy, /access\.canManage \|\|/)
assert.match(priestPrivacy, /assignment\.user_id = \$2/)
assert.match(schedulingEvents, /visibility === "private" \? null/)
assert.match(apiRoute, /scheduling\/priest-appointment-details/)
assert.match(telegramScheduling, /gpt-4o-mini-transcribe/)
assert.match(telegramScheduling, /eventdraft:confirm/)
assert.match(telegramScheduling, /Do not include names, addresses, telephone numbers/)
assert.match(emergencySchedules, /weekly emergency schedule/)
assert.match(emergencySchedules, /privacy-safe copy intentionally excludes private names/)
assert.doesNotMatch(reminders, /processWeeklyEmergencySchedules/)

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
assert.match(schedulingVolunteers, /INSERT INTO ministry_accounts/)
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

const [
  sharedGuardianMigration,
  managedProfilesServer,
  guardianLinkResponse,
  managedProfileEmail,
  managedProfileComponent,
  guardianLinkPage,
  sharedProfileSeparation,
] = await Promise.all([
  read("migrations/20260814_02_add_shared_guardian_links.sql"),
  read("src/server/legacy/ministry-profiles.js"),
  read("src/server/legacy/ministry-guardian-link-response.js"),
  read("src/server/legacy/helper/managed-profile-email.js"),
  read("src/react/components/ministry/MinistryProfile.jsx"),
  read("src/react/pages/GuardianLinkApp.jsx"),
  read("src/server/legacy/ministry-profile-separation.js"),
])
assert.match(sharedGuardianMigration, /DROP INDEX IF EXISTS managed_profiles_active_child_key/)
assert.match(sharedGuardianMigration, /managed_profiles_active_guardian_child_key/)
assert.match(sharedGuardianMigration, /CREATE TABLE IF NOT EXISTS managed_profile_link_invitations/)
assert.match(sharedGuardianMigration, /token_hash STRING NOT NULL UNIQUE/)
assert.match(sharedGuardianMigration, /ministry_message_recipients_message_profile_account_key/)
assert.match(managedProfilesServer, /action === "invite_guardian"/)
assert.match(managedProfilesServer, /action === "unlink_guardian"/)
assert.match(managedProfilesServer, /action === "remove_pending_child"/)
assert.match(managedProfilesServer, /Only a child awaiting app approval can be removed/)
assert.match(managedProfilesServer, /managed_profile\.removed/)
assert.match(managedProfilesServer, /A managed child must retain one guardian/)
assert.match(managedProfilesServer, /guardian_link\.invited/)
assert.match(guardianLinkResponse, /guardian_link\.accepted/)
assert.match(guardianLinkResponse, /guardian_link\.declined/)
assert.match(guardianLinkResponse, /locked\.invitee_user_id/)
assert.match(managedProfileEmail, /Review profile invitation/)
assert.match(managedProfileComponent, /Link another guardian/)
assert.match(managedProfileComponent, /Unlink from my account/)
assert.match(managedProfileComponent, /Remove child/)
assert.match(managedProfileComponent, /remove_pending_child/)
assert.match(guardianLinkPage, /Accept link/)
assert.match(guardianLinkPage, /Decline/)
assert.match(sharedProfileSeparation, /WHERE child_user_id = \$1 AND status IN \('active', 'separation_pending'\)/)
assert.match(reminders, /recipient\.notification_lead_minutes/)
assert.match(messageServer, /SELECT DISTINCT ON \(message\.id\)/)
assert.match(messageServer, /count\(DISTINCT message_id\)::INT AS unread_count/)
assert.match(messageServer, /WHERE delivery_account_user_id = \$1/)
assert.match(messageServer, /\[context\.actor\.id, body\.messageId\]/)
assert.match(messageServer, /sendTelegramMessage\([\s\S]*delivery\.body/)
assert.match(messageServer, /privacy_safe_message: delivery\.body/)
assert.match(messageServer, /message_id, profile_user_id, delivery_account_user_id/)
assert.match(assignmentNotifications, /notificationRecipientsForProfile/)
assert.match(assignmentNotifications, /assignment\.recipient_user_id/)
assert.match(assignmentNotifications, /const householdSchedules = new Map/)
assert.match(assignmentNotifications, /assignment-created:\$\{assignment\.recipient_user_id\}:\$\{assignment\.event_id\}/)
assert.match(assignmentNotifications, /affectedProfileUserIds/)
assert.match(assignmentNotifications, /assignment\.status NOT IN \('declined', 'cancelled'\)/)
assert.match(schedulingEvents, /sendAssignmentNotifications\(/)
assert.match(schedulingEvents, /newAssignmentRecipientIds/)

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

const migrationFiles = (await fs.readdir(path.join(root, "migrations")))
  .filter((file) => file.endsWith(".sql"))
  .map((file) => path.join(root, "migrations", file))
const forbiddenParishAccountReference =
  /\b(?:FROM|JOIN|UPDATE|INTO|REFERENCES|ALTER\s+TABLE|DELETE\s+FROM)\s+(?:public\.)?users\b/i
for (const file of [...serverFiles, ...migrationFiles]) {
  const source = await fs.readFile(file, "utf8")
  assert.doesNotMatch(
    source,
    forbiddenParishAccountReference,
    `Parish account-table dependency found in ${path.relative(root, file)}`,
  )
}

const databaseSource = await read("src/server/database.ts")
const accountMigration = await read(
  "migrations/20260716_01_create_ministry_scheduling.sql",
)
assert.match(databaseSource, /process\.env\.MINISTRY_DATABASE_URL/)
assert.doesNotMatch(databaseSource, /process\.env\.COCKROACHDB_CONNECTION_STRING/)
assert.match(databaseSource, /assertMinistryDatabaseIsolation/)
assert.match(migrationRunner, /Migration refused:[\s\S]*parish users table/)
assert.match(accountMigration, /CREATE TABLE IF NOT EXISTS ministry_accounts/)
assert.doesNotMatch(accountMigration, /REFERENCES\s+users/i)
assert.match(
  independentNotificationChannelsMigration,
  /notification_email_enabled BOOL NOT NULL DEFAULT false/,
)
assert.match(
  assignmentNotifications,
  /MINISTRY_OUTBOUND_DELIVERY_ENABLED === "true"/,
)
assert.match(assignmentNotifications, /MINISTRY_MAX_NOTIFICATION_RECIPIENTS/)
assert.match(
  assignmentNotifications,
  /FROM ministry_members membership[\s\S]*membership\.status = 'active'/,
)

console.log(
  "Verified Astro base path, one API dispatcher, active-profile authorization, multi-ministry templates and events, template versioning, ministry-level publication, reminder timing, Web Push scope, OIDC checks, durable deduplication, and migration-only schema changes."
)
