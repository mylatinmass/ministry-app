const jwt = require("jsonwebtoken")

const MINISTRY_TOKEN_SCOPE = "ministries"

const normalizeUsername = (username = "") =>
  username.toString().trim().toLowerCase()

const hasMinistryAccess = (user) =>
  ["owner", "super_admin"].includes(user.global_role) ||
  Boolean(user.has_active_membership) ||
  Boolean(user.is_volunteer_profile)

const getMinistryUserById = async (client, userId) => {
  const result = await client.query(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.username,
        u.global_role,
        u.status,
        u.is_volunteer_profile,
        EXISTS (
          SELECT 1
          FROM ministry_members mm
          JOIN ministries m ON m.id = mm.ministry_id
          WHERE mm.user_id = u.id
            AND mm.status = 'active'
            AND m.status = 'active'
        ) AS has_active_membership
      FROM users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  )
  return result.rows[0] || null
}

const getMinistryUserByUsername = async (client, username) => {
  const result = await client.query(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.username,
        u.password_hash,
        u.global_role,
        u.status,
        u.is_volunteer_profile,
        EXISTS (
          SELECT 1
          FROM ministry_members mm
          JOIN ministries m ON m.id = mm.ministry_id
          WHERE mm.user_id = u.id
            AND mm.status = 'active'
            AND m.status = 'active'
        ) AS has_active_membership
      FROM users u
      WHERE lower(u.username) = $1 OR lower(btrim(u.email)) = $1
      ORDER BY CASE WHEN lower(u.username) = $1 THEN 0 ELSE 1 END, u.created_at
      LIMIT 1
    `,
    [normalizeUsername(username)]
  )

  return result.rows[0] || null
}

const getAuthorizedMinistryUserById = async (client, userId) => {
  const user = await getMinistryUserById(client, userId)

  if (!user || user.status !== "active" || !hasMinistryAccess(user)) {
    return null
  }

  return user
}

const createMinistryToken = (user, secret, options = {}) =>
  jwt.sign(
    {
      scope: MINISTRY_TOKEN_SCOPE,
      actorUserId: user.id,
      activeProfileUserId: options.activeProfileUserId || user.id,
      userId: user.id,
      username: user.username,
      globalRole: user.global_role,
      authMethod: options.authMethod || "password",
    },
    secret,
    { expiresIn: options.expiresIn || "12h" }
  )

const getMinistryTokenPayload = (event, secret) => {
  const authorization =
    event.headers?.authorization || event.headers?.Authorization || ""
  const [scheme, token] = authorization.split(" ")

  if (scheme !== "Bearer" || !token) {
    throw new Error("Missing ministry session token")
  }

  const payload = jwt.verify(token, secret)

  if (
    payload.scope !== MINISTRY_TOKEN_SCOPE ||
    !(payload.actorUserId || payload.userId)
  ) {
    throw new Error("Invalid ministry session token")
  }

  return {
    ...payload,
    actorUserId: payload.actorUserId || payload.userId,
    activeProfileUserId:
      payload.activeProfileUserId || payload.actorUserId || payload.userId,
  }
}

const getMinistryIdentityContext = async (client, payload) => {
  const actor = await getAuthorizedMinistryUserById(
    client,
    payload.actorUserId || payload.userId
  )
  if (!actor) return null
  const authMethod = payload.authMethod || "password"
  if (
    authMethod === "email_link" &&
    ["owner", "super_admin"].includes(actor.global_role)
  ) {
    return null
  }

  const activeProfileUserId =
    payload.activeProfileUserId || payload.actorUserId || payload.userId
  if (activeProfileUserId === actor.id) {
    return {
      actor,
      user: actor,
      isManagedProfile: false,
      authMethod,
      isEmailLinkSession: authMethod === "email_link",
    }
  }

  if (authMethod === "email_link") return null

  const relationshipResult = await client.query(
    `
      SELECT id
      FROM managed_profiles
      WHERE guardian_user_id = $1
        AND child_user_id = $2
        AND status IN ('active', 'separation_pending')
      LIMIT 1
    `,
    [actor.id, activeProfileUserId]
  )
  if (!relationshipResult.rowCount) return null

  const user = await getMinistryUserById(client, activeProfileUserId)
  if (!user || user.status !== "active") return null

  return {
    actor,
    user,
    isManagedProfile: true,
    managedProfileId: relationshipResult.rows[0].id,
    authMethod,
    isEmailLinkSession: false,
  }
}

const toPublicMinistryUser = (user) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  username: user.username,
  globalRole: user.global_role,
})

module.exports = {
  createMinistryToken,
  getAuthorizedMinistryUserById,
  getMinistryIdentityContext,
  getMinistryTokenPayload,
  getMinistryUserByUsername,
  getMinistryUserById,
  hasMinistryAccess,
  normalizeUsername,
  toPublicMinistryUser,
}
