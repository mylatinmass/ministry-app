const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  getMinistryIdentityContext,
  getMinistryTokenPayload,
  normalizeUsername,
} = require("./helper/ministry-auth")
const {
  queueKlaviyoProfileSync,
} = require("./helper/klaviyo-profile-sync")

const REMINDER_OPTIONS = new Set([15, 30, 45, 60, 120, 180, 240])

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
})

const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}")
  } catch (error) {
    return null
  }
}

const usernameError = (username) => {
  if (username.length < 4) return "Username must be at least 4 characters"
  if (username.length > 40) return "Username must be 40 characters or fewer"
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return "Use only letters, numbers, periods, underscores, or hyphens"
  }
  return ""
}

const loadProfile = async (client, context) => {
  const userId = context.user.id
  const contactUserId = context.isManagedProfile ? context.actor.id : userId
  const [profileResult, ministriesResult] = await Promise.all([
    client.query(
      `
        SELECT
          profile.id,
          profile.first_name,
          profile.last_name,
          contact.email,
          COALESCE(NULLIF(contact.phone, ''), contact.telephone) AS phone,
          profile.username,
          profile.global_role,
          profile.status,
          profile.background_check_verified,
          profile.background_check_verified_at,
          profile.appearance_theme,
          contact.notification_lead_minutes,
          contact.notification_email_enabled,
          contact.notification_telegram_enabled,
          contact.notification_sms_enabled,
          contact.notification_push_enabled,
          contact.notification_reminders_enabled,
          contact.notification_schedule_changes_enabled,
          contact.notification_announcements_enabled,
          contact.notification_volunteer_opportunities_enabled,
          contact.sms_transactional_consent_at,
          EXISTS (
            SELECT 1
            FROM telegram_connections telegram_connection
            WHERE telegram_connection.account_user_id = contact.id
              AND telegram_connection.status = 'active'
          ) AS telegram_connected
        FROM ministry_accounts profile
        JOIN ministry_accounts contact ON contact.id = $2
        WHERE profile.id = $1
        LIMIT 1
      `,
      [userId, contactUserId]
    ),
    client.query(
      `
        SELECT
          m.id,
          m.slug,
          m.name,
          mm.level,
          mm.can_serve,
          ministry_level.id AS highest_level_id,
          ministry_level.name AS highest_level_name,
          ministry_level.rank_order AS highest_level_rank
        FROM ministry_members mm
        JOIN ministries m ON m.id = mm.ministry_id
        LEFT JOIN ministry_levels ministry_level
          ON ministry_level.id = mm.highest_level_id
        WHERE mm.user_id = $1
          AND mm.status = 'active'
          AND m.status = 'active'
        ORDER BY lower(m.name)
      `,
      [userId]
    ),
  ])

  const profile = profileResult.rows[0]
  if (!profile) return null

  return {
    id: profile.id,
    firstName: profile.first_name || "",
    lastName: profile.last_name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    username: profile.username || "",
    globalRole: profile.global_role,
    status: profile.status,
    backgroundCheckVerified: Boolean(profile.background_check_verified),
    backgroundCheckVerifiedAt: profile.background_check_verified_at || null,
    appearanceTheme: profile.appearance_theme || "light",
    isManagedProfile: context.isManagedProfile,
    inheritsGuardianContact: context.isManagedProfile,
    notificationLeadMinutes: Number(profile.notification_lead_minutes || 60),
    notificationChannels: {
      email: Boolean(profile.notification_email_enabled),
      telegram: Boolean(
        profile.notification_telegram_enabled && profile.telegram_connected
      ),
      sms: Boolean(profile.notification_sms_enabled),
      push: Boolean(profile.notification_push_enabled),
    },
    notificationCategories: {
      reminders: Boolean(profile.notification_reminders_enabled),
      scheduleChanges: Boolean(
        profile.notification_schedule_changes_enabled
      ),
      announcements: Boolean(profile.notification_announcements_enabled),
      volunteerOpportunities: Boolean(
        profile.notification_volunteer_opportunities_enabled
      ),
    },
    smsTransactionalConsentAccepted: Boolean(
      profile.sms_transactional_consent_at
    ),
    smsTransactionalConsentAt: profile.sms_transactional_consent_at || null,
    telegramConnected: Boolean(profile.telegram_connected),
    ministries: ministriesResult.rows.map((ministry) => ({
      id: ministry.id,
      slug: ministry.slug,
      name: ministry.name,
      level: ministry.level,
      canServe: Boolean(ministry.can_serve),
      highestLevelId: ministry.highest_level_id,
      highestLevelName: ministry.highest_level_name,
      highestLevelRank: Number(ministry.highest_level_rank) || null,
    })),
  }
}

const validateProfile = (body) => {
  const firstName = body.firstName?.toString().trim() || ""
  const lastName = body.lastName?.toString().trim() || ""
  const email = body.email?.toString().trim().toLowerCase() || ""
  const phone = body.phone?.toString().trim() || ""
  const username = normalizeUsername(body.username)
  const notificationLeadMinutes = Number(body.notificationLeadMinutes)
  const notificationChannels = {
    email: body.notificationChannels?.email === true,
    telegram: body.notificationChannels?.telegram === true,
    sms: body.notificationChannels?.sms === true,
    push: body.notificationChannels?.push === true,
  }
  const notificationCategories = {
    reminders: body.notificationCategories?.reminders !== false,
    scheduleChanges: body.notificationCategories?.scheduleChanges !== false,
    announcements: body.notificationCategories?.announcements !== false,
    volunteerOpportunities:
      body.notificationCategories?.volunteerOpportunities !== false,
  }
  const smsTransactionalConsentAccepted =
    body.smsTransactionalConsentAccepted === true
  const appearanceTheme = body.appearanceTheme === "dark" ? "dark" : "light"
  const usernameMessage = usernameError(username)

  if (!firstName || !lastName) return { error: "First and last name are required" }
  if (usernameMessage) return { error: usernameMessage }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" }
  }
  if (notificationChannels.email && !email) {
    return { error: "Add an email address or turn off Email notifications" }
  }
  if (notificationChannels.sms && !phone) {
    return { error: "Add a telephone number or turn off SMS notifications" }
  }
  if (notificationChannels.sms && !smsTransactionalConsentAccepted) {
    return {
      error:
        "Accept the transactional text-message consent before selecting SMS",
    }
  }
  if (!REMINDER_OPTIONS.has(notificationLeadMinutes)) {
    return { error: "Choose a valid notification time" }
  }
  if (!Object.values(notificationChannels).some(Boolean)) {
    return { error: "Choose at least one notification method" }
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    username,
    notificationLeadMinutes,
    notificationChannels,
    notificationCategories,
    smsTransactionalConsentAccepted,
    appearanceTheme,
  }
}

const handler = async (event) => {
  if (!["GET", "PATCH"].includes(event.httpMethod)) {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.MINISTRY_DATABASE_URL
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, { message: "Ministry profiles are not configured" })
  }

  let payload
  try {
    payload = getMinistryTokenPayload(event, jwtSecret)
  } catch (error) {
    return jsonResponse(401, { message: "Session expired" })
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    const context = await getMinistryIdentityContext(client, payload)
    if (!context) return jsonResponse(401, { message: "Ministry access is inactive" })

    if (event.httpMethod === "PATCH") {
      if (context.isEmailLinkSession) {
        return jsonResponse(403, {
          message: "Sign in with your username and password to change account details.",
        })
      }
      const body = parseBody(event)
      if (!body) return jsonResponse(400, { message: "Invalid request" })
      if (context.isManagedProfile) {
        const firstName = body.firstName?.toString().trim() || ""
        const lastName = body.lastName?.toString().trim() || ""
        if (!firstName || !lastName) {
          return jsonResponse(400, { message: "First and last name are required" })
        }
        const appearanceTheme = body.appearanceTheme === "dark" ? "dark" : "light"
        const beforeTheme = context.user.appearance_theme || "light"
        await client.query(
          `UPDATE ministry_accounts SET first_name = $1, last_name = $2, appearance_theme = $3, updated_at = now() WHERE id = $4`,
          [firstName, lastName, appearanceTheme, context.user.id]
        )
        await client.query(
          `
            INSERT INTO managed_profile_audit (
              actor_user_id, subject_user_id, action, entity_type, entity_id
              , metadata
            ) VALUES ($1, $2, 'profile.updated', 'user', $2, $3::JSONB)
          `,
          [
            context.actor.id,
            context.user.id,
            JSON.stringify({
              appearanceThemeBefore: beforeTheme,
              appearanceThemeAfter: appearanceTheme,
            }),
          ]
        )
        const profile = await loadProfile(client, context)
        return jsonResponse(200, { profile })
      }
      const fields = validateProfile(body)
      if (fields.error) return jsonResponse(400, { message: fields.error })

      if (fields.notificationChannels.telegram) {
        const telegramConnection = await client.query(
          `
            SELECT 1
            FROM telegram_connections
            WHERE account_user_id = $1
              AND status = 'active'
            LIMIT 1
          `,
          [context.actor.id]
        )
        if (!telegramConnection.rowCount) {
          return jsonResponse(400, {
            message: "Connect Telegram before selecting it as a notification method",
          })
        }
      }

      const duplicateUsername = await client.query(
        `SELECT 1 FROM ministry_accounts WHERE lower(username) = $1 AND id <> $2 LIMIT 1`,
        [fields.username, context.user.id]
      )
      if (duplicateUsername.rowCount) {
        return jsonResponse(409, { message: "Username is already in use" })
      }

      const beforeResult = await client.query(
        `
          SELECT
            notification_lead_minutes,
            notification_email_enabled,
            notification_telegram_enabled,
            notification_sms_enabled,
            notification_push_enabled,
            notification_reminders_enabled,
            notification_schedule_changes_enabled,
            notification_announcements_enabled,
            notification_volunteer_opportunities_enabled,
            sms_transactional_consent_at,
            appearance_theme
          FROM ministry_accounts
          WHERE id = $1
          LIMIT 1
        `,
        [context.user.id]
      )

      await client.query(
        `
          UPDATE ministry_accounts
          SET
            first_name = $1,
            last_name = $2,
            email = $3,
            phone = $4,
            telephone = $4,
            username = $5,
            notification_lead_minutes = $6,
            notification_email_enabled = $7,
            notification_telegram_enabled = $8,
            notification_sms_enabled = $9,
            notification_push_enabled = $10,
            notification_reminders_enabled = $11,
            notification_schedule_changes_enabled = $12,
            notification_announcements_enabled = $13,
            notification_volunteer_opportunities_enabled = $14,
            sms_transactional_consent_at = CASE
              WHEN $9 AND $15 THEN COALESCE(sms_transactional_consent_at, now())
              ELSE sms_transactional_consent_at
            END,
            sms_transactional_consent_source = CASE
              WHEN $9 AND $15 THEN 'ministry_profile'
              ELSE sms_transactional_consent_source
            END,
            sms_transactional_consent_text_version = CASE
              WHEN $9 AND $15 THEN '2026-08-11'
              ELSE sms_transactional_consent_text_version
            END,
            appearance_theme = $16,
            updated_at = now()
          WHERE id = $17
        `,
        [
          fields.firstName,
          fields.lastName,
          fields.email,
          fields.phone,
          fields.username,
          fields.notificationLeadMinutes,
          fields.notificationChannels.email,
          fields.notificationChannels.telegram,
          fields.notificationChannels.sms,
          fields.notificationChannels.push,
          fields.notificationCategories.reminders,
          fields.notificationCategories.scheduleChanges,
          fields.notificationCategories.announcements,
          fields.notificationCategories.volunteerOpportunities,
          fields.smsTransactionalConsentAccepted,
          fields.appearanceTheme,
          context.user.id,
        ]
      )
      await queueKlaviyoProfileSync(client, context.user.id)

      const before = beforeResult.rows[0]
      await client.query(
        `
          INSERT INTO ministry_audit_log (
            actor_user_id,
            active_profile_user_id,
            action,
            entity_type,
            entity_id,
            before_data,
            after_data,
            metadata
          )
          VALUES ($1, $2, 'profile.notification_preferences_updated', 'user', $2,
            $3::JSONB, $4::JSONB, $5::JSONB)
        `,
        [
          context.actor.id,
          context.user.id,
          JSON.stringify({
            notificationLeadMinutes: Number(before?.notification_lead_minutes || 60),
            notificationChannels: {
              email: Boolean(before?.notification_email_enabled),
              telegram: Boolean(before?.notification_telegram_enabled),
              sms: Boolean(before?.notification_sms_enabled),
              push: Boolean(before?.notification_push_enabled),
            },
            notificationCategories: {
              reminders: Boolean(before?.notification_reminders_enabled),
              scheduleChanges: Boolean(
                before?.notification_schedule_changes_enabled
              ),
              announcements: Boolean(
                before?.notification_announcements_enabled
              ),
              volunteerOpportunities: Boolean(
                before?.notification_volunteer_opportunities_enabled
              ),
            },
            smsTransactionalConsentAt:
              before?.sms_transactional_consent_at || null,
            appearanceTheme: before?.appearance_theme || "light",
          }),
          JSON.stringify({
            notificationLeadMinutes: fields.notificationLeadMinutes,
            notificationChannels: fields.notificationChannels,
            notificationCategories: fields.notificationCategories,
            smsTransactionalConsentAccepted:
              fields.smsTransactionalConsentAccepted,
            appearanceTheme: fields.appearanceTheme,
          }),
          JSON.stringify({ authenticationMethod: context.authMethod || "password" }),
        ]
      )
    }

    const profile = await loadProfile(client, context)
    return jsonResponse(200, { profile })
  } catch (error) {
    console.error("Unable to manage ministry profile:", error)
    if (error.code === "23505") {
      return jsonResponse(409, { message: "Username is already in use" })
    }
    return jsonResponse(500, { message: "Unable to save profile" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
