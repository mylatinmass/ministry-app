const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  getMinistryIdentityContext,
  getMinistryTokenPayload,
  normalizeUsername,
} = require("./helper/ministry-auth")

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
          contact.notification_lead_minutes
        FROM users profile
        JOIN users contact ON contact.id = $2
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
    isManagedProfile: context.isManagedProfile,
    inheritsGuardianContact: context.isManagedProfile,
    notificationLeadMinutes: Number(profile.notification_lead_minutes || 60),
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
  const usernameMessage = usernameError(username)

  if (!firstName || !lastName) return { error: "First and last name are required" }
  if (usernameMessage) return { error: usernameMessage }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" }
  }
  if (!REMINDER_OPTIONS.has(notificationLeadMinutes)) {
    return { error: "Choose a valid notification time" }
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    username,
    notificationLeadMinutes,
  }
}

const handler = async (event) => {
  if (!["GET", "PATCH"].includes(event.httpMethod)) {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
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
        await client.query(
          `UPDATE users SET first_name = $1, last_name = $2, updated_at = now() WHERE id = $3`,
          [firstName, lastName, context.user.id]
        )
        await client.query(
          `
            INSERT INTO managed_profile_audit (
              actor_user_id, subject_user_id, action, entity_type, entity_id
            ) VALUES ($1, $2, 'profile.updated', 'user', $2)
          `,
          [context.actor.id, context.user.id]
        )
        const profile = await loadProfile(client, context)
        return jsonResponse(200, { profile })
      }
      const fields = validateProfile(body)
      if (fields.error) return jsonResponse(400, { message: fields.error })

      const duplicateUsername = await client.query(
        `SELECT 1 FROM users WHERE lower(username) = $1 AND id <> $2 LIMIT 1`,
        [fields.username, context.user.id]
      )
      if (duplicateUsername.rowCount) {
        return jsonResponse(409, { message: "Username is already in use" })
      }

      await client.query(
        `
          UPDATE users
          SET
            first_name = $1,
            last_name = $2,
            email = $3,
            phone = $4,
            telephone = $4,
            username = $5,
            notification_lead_minutes = $6,
            updated_at = now()
          WHERE id = $7
        `,
        [
          fields.firstName,
          fields.lastName,
          fields.email,
          fields.phone,
          fields.username,
          fields.notificationLeadMinutes,
          context.user.id,
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
