const crypto = require("crypto")

const INVITATION_LIFETIME_DAYS = 14

const normalizeEmail = (value = "") =>
  value.toString().trim().toLowerCase()

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))

const createInvitationToken = () => crypto.randomBytes(32).toString("base64url")

const hashInvitationToken = (token = "") =>
  crypto.createHash("sha256").update(token.toString()).digest("hex")

const getInvitationOrigin = (event = {}) => {
  const configuredOrigin =
    process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL

  if (configuredOrigin) return configuredOrigin.replace(/\/$/, "")

  const headers = event.headers || {}
  const host = headers["x-forwarded-host"] || headers.host
  const protocol = headers["x-forwarded-proto"] || "https"

  return host ? `${protocol}://${host}` : "https://mylatinmass.com"
}

const buildInvitationUrl = (event, token, intent) => {
  const url = new URL("/ministry/invite", getInvitationOrigin(event))
  const fragment = new URLSearchParams({ token })
  if (intent) fragment.set("intent", intent)
  url.hash = fragment.toString()
  return url.toString()
}

const getInvitationByToken = async (client, token, options = {}) => {
  if (!token || token.length < 32) return null

  const lockClause = options.forUpdate ? "FOR UPDATE" : ""
  const result = await client.query(
    `
      SELECT
        invitation.id,
        invitation.email,
        invitation.invited_user_id,
        invitation.status,
        invitation.expires_at,
        invitation.responded_at,
        invitation.created_at,
        (
          SELECT u.username FROM users u
          WHERE u.id = invitation.invited_user_id
        ) AS username,
        coalesce(
          (
            SELECT u.username IS NULL OR u.password_hash IS NULL
            FROM users u
            WHERE u.id = invitation.invited_user_id
          ),
          true
        ) AS account_required
      FROM ministry_invitations invitation
      WHERE invitation.token_hash = $1
      LIMIT 1
      ${lockClause}
    `,
    [hashInvitationToken(token)]
  )

  return result.rows[0] || null
}

const getInvitationMinistries = async (client, invitationId) => {
  const result = await client.query(
    `
      SELECT m.id, m.name, m.slug
      FROM ministry_invitation_items item
      JOIN ministries m ON m.id = item.ministry_id
      WHERE item.invitation_id = $1
      ORDER BY m.name
    `,
    [invitationId]
  )

  return result.rows
}

const toPublicInvitation = (invitation, ministries) => ({
  email: invitation.email,
  status: invitation.status,
  expired:
    invitation.status === "pending" &&
    new Date(invitation.expires_at).getTime() <= Date.now(),
  accountRequired: Boolean(invitation.account_required),
  username: invitation.username || null,
  expiresAt: invitation.expires_at,
  respondedAt: invitation.responded_at,
  ministries: ministries.map(({ id, name, slug }) => ({ id, name, slug })),
})

module.exports = {
  INVITATION_LIFETIME_DAYS,
  buildInvitationUrl,
  createInvitationToken,
  getInvitationByToken,
  getInvitationMinistries,
  hashInvitationToken,
  isValidEmail,
  normalizeEmail,
  toPublicInvitation,
}
