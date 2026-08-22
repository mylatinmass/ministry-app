const { Client } = require("pg")
const { hashPassword } = require("./passwords")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  createMinistryToken,
  normalizeUsername,
} = require("./helper/ministry-auth")
const {
  getInvitationByToken,
  getInvitationMinistries,
  toPublicInvitation,
} = require("./helper/ministry-invitations")
const {
  queueKlaviyoProfileSync,
} = require("./helper/klaviyo-profile-sync")

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
  if (username.includes("@") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
    return "Emails cannot be used as usernames. Try a simpler username, such as john.smith"
  }
  if (/\s/.test(username)) {
    return "Usernames cannot contain spaces. Try john.smith, john_smith, or john-smith"
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return "Use a simpler username with only letters, numbers, periods, underscores, or hyphens"
  }
  return ""
}

const isUsernameAvailable = async (client, username, excludedUserId = null) => {
  const result = await client.query(
    `
      SELECT 1
      FROM ministry_accounts
      WHERE lower(username) = $1
        AND ($2::UUID IS NULL OR id <> $2)
      LIMIT 1
    `,
    [username, excludedUserId]
  )
  return result.rowCount === 0
}

const loadInvitationResponse = async (client, token) => {
  const invitation = await getInvitationByToken(client, token)
  if (!invitation) return jsonResponse(404, { message: "Invitation not found" })
  const ministries = await getInvitationMinistries(client, invitation.id)
  return jsonResponse(200, {
    invitation: toPublicInvitation(invitation, ministries),
  })
}

const checkUsername = async (client, token, body) => {
  const invitation = await getInvitationByToken(client, token)
  if (!invitation) return jsonResponse(404, { message: "Invitation not found" })
  if (invitation.status !== "pending") {
    return jsonResponse(409, { message: "This invitation has already been answered" })
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return jsonResponse(410, { message: "This invitation has expired" })
  }

  const username = normalizeUsername(body.username)
  const validationMessage = usernameError(username)
  if (validationMessage) {
    return jsonResponse(200, { available: false, message: validationMessage })
  }

  const available = await isUsernameAvailable(
    client,
    username,
    invitation.invited_user_id
  )
  return jsonResponse(200, {
    available,
    message: available ? "Username is available" : "Username is already in use",
  })
}

const declineInvitation = async (client, token) => {
  await client.query("BEGIN")
  try {
    const invitation = await getInvitationByToken(client, token, {
      forUpdate: true,
    })
    if (!invitation) {
      await client.query("ROLLBACK")
      return jsonResponse(404, { message: "Invitation not found" })
    }
    if (invitation.status !== "pending") {
      await client.query("ROLLBACK")
      return jsonResponse(409, {
        message: "This invitation has already been answered",
        status: invitation.status,
      })
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await client.query(
        `UPDATE ministry_invitations SET status = 'expired', responded_at = now(), updated_at = now() WHERE id = $1`,
        [invitation.id]
      )
      await client.query("COMMIT")
      return jsonResponse(410, { message: "This invitation has expired" })
    }

    await client.query(
      `UPDATE ministry_invitations SET status = 'declined', responded_at = now(), updated_at = now() WHERE id = $1`,
      [invitation.id]
    )
    await client.query("COMMIT")
    return jsonResponse(200, {
      success: true,
      status: "declined",
      message: "The invitation has been declined",
    })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }
}

const validateAccountFields = (body) => {
  const username = normalizeUsername(body.username)
  const firstName = body.firstName?.toString().trim() || ""
  const lastName = body.lastName?.toString().trim() || ""
  const phone = body.phone?.toString().trim() || ""
  const password = body.password?.toString() || ""
  const validationMessage = usernameError(username)

  if (validationMessage) return { error: validationMessage, field: "username" }
  if (!firstName) return { error: "First name is required", field: "firstName" }
  if (!lastName) return { error: "Last name is required", field: "lastName" }
  if (!phone) return { error: "Phone is required", field: "phone" }
  if (!password) return { error: "Password is required", field: "password" }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters", field: "password" }
  }

  return { username, firstName, lastName, phone, password }
}

const acceptInvitation = async (client, token, body, jwtSecret) => {
  const initialInvitation = await getInvitationByToken(client, token)
  if (!initialInvitation) return jsonResponse(404, { message: "Invitation not found" })
  if (initialInvitation.status !== "pending") {
    return jsonResponse(409, {
      message: "This invitation has already been answered",
      status: initialInvitation.status,
    })
  }

  let accountFields = null
  let passwordHash = null
  if (initialInvitation.account_required) {
    accountFields = validateAccountFields(body)
    if (accountFields.error) {
      return jsonResponse(400, {
        message: accountFields.error,
        field: accountFields.field,
      })
    }
    passwordHash = await hashPassword(accountFields.password)
  }

  await client.query("BEGIN")
  try {
    const invitation = await getInvitationByToken(client, token, {
      forUpdate: true,
    })
    if (!invitation) {
      await client.query("ROLLBACK")
      return jsonResponse(404, { message: "Invitation not found" })
    }
    if (invitation.status !== "pending") {
      await client.query("ROLLBACK")
      return jsonResponse(409, {
        message: "This invitation has already been answered",
        status: invitation.status,
      })
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await client.query(
        `UPDATE ministry_invitations SET status = 'expired', responded_at = now(), updated_at = now() WHERE id = $1`,
        [invitation.id]
      )
      await client.query("COMMIT")
      return jsonResponse(410, { message: "This invitation has expired" })
    }

    let userId = invitation.invited_user_id
    let user

    if (!userId) {
      const matchingUserResult = await client.query(
        `
          SELECT id, first_name, last_name, username, password_hash, global_role, status
          FROM ministry_accounts
          WHERE lower(btrim(email)) = $1
          ORDER BY
            CASE WHEN status = 'active' THEN 0 ELSE 1 END,
            CASE WHEN username IS NOT NULL AND password_hash IS NOT NULL THEN 0 ELSE 1 END,
            created_at
          LIMIT 1
        `,
        [invitation.email]
      )
      user = matchingUserResult.rows[0] || null
      userId = user?.id || null
    } else {
      const userResult = await client.query(
        `
          SELECT id, first_name, last_name, username, password_hash, global_role, status
          FROM ministry_accounts WHERE id = $1 LIMIT 1
        `,
        [userId]
      )
      user = userResult.rows[0] || null
    }

    const needsAccount = !user || !user.username || !user.password_hash
    if (needsAccount && !accountFields) {
      await client.query("ROLLBACK")
      return jsonResponse(409, {
        message: "Account details are required to accept this invitation",
        accountRequired: true,
      })
    }

    if (needsAccount) {
      const available = await isUsernameAvailable(client, accountFields.username, userId)
      if (!available) {
        await client.query("ROLLBACK")
        return jsonResponse(409, {
          message: "Username is already in use",
          field: "username",
        })
      }

      if (userId) {
        const updatedUser = await client.query(
          `
            UPDATE ministry_accounts
            SET
              first_name = $1,
              last_name = $2,
              phone = $3,
              telephone = $3,
              username = $4,
              password_hash = $5,
              updated_at = now()
            WHERE id = $6 AND status = 'active'
            RETURNING id, first_name, last_name, username, global_role, status
          `,
          [
            accountFields.firstName,
            accountFields.lastName,
            accountFields.phone,
            accountFields.username,
            passwordHash,
            userId,
          ]
        )
        if (!updatedUser.rowCount) {
          await client.query("ROLLBACK")
          return jsonResponse(403, { message: "This account is inactive" })
        }
        user = updatedUser.rows[0]
      } else {
        const insertedUser = await client.query(
          `
            INSERT INTO ministry_accounts (
              first_name, last_name, email, phone, telephone,
              username, password_hash, global_role, status,
              notification_email_enabled,
              notification_reminders_enabled,
              notification_schedule_changes_enabled,
              notification_announcements_enabled,
              notification_volunteer_opportunities_enabled
            )
            VALUES (
              $1, $2, $3, $4, $4, $5, $6, 'regular', 'active',
              true, true, true, true, true
            )
            RETURNING id, first_name, last_name, username, global_role, status
          `,
          [
            accountFields.firstName,
            accountFields.lastName,
            invitation.email,
            accountFields.phone,
            accountFields.username,
            passwordHash,
          ]
        )
        user = insertedUser.rows[0]
        userId = user.id
      }
    } else if (user.status !== "active") {
      await client.query("ROLLBACK")
      return jsonResponse(403, { message: "This account is inactive" })
    }

    const reactivatedSuppression = await client.query(
      `
        UPDATE ministry_profile_suppressions
        SET reactivated_by = $1,
            reactivated_at = now()
        WHERE user_id = $1
          AND reactivated_at IS NULL
        RETURNING id, suppressed_at, suppressed_by, reactivated_at
      `,
      [userId]
    )

    const ministries = await getInvitationMinistries(client, invitation.id)
    for (const ministry of ministries) {
      await client.query(
        `
          INSERT INTO ministry_members (
            ministry_id, user_id, level, status, can_serve, joined_at, updated_at
          )
          VALUES ($1, $2, 'member', 'active', false, now(), now())
          ON CONFLICT (ministry_id, user_id)
          DO UPDATE SET
            level = 'member',
            status = 'active',
            can_serve = false,
            joined_at = now(),
            updated_at = now()
        `,
        [ministry.id, userId]
      )
    }

    await client.query(
      `
        UPDATE ministry_invitations
        SET
          invited_user_id = $1,
          status = 'accepted',
          responded_at = now(),
          updated_at = now()
        WHERE id = $2
      `,
      [userId, invitation.id]
    )
    await queueKlaviyoProfileSync(client, userId)

    if (reactivatedSuppression.rowCount) {
      await client.query(
        `
          INSERT INTO ministry_audit_log (
            actor_user_id,
            active_profile_user_id,
            action,
            entity_type,
            entity_id,
            before_data,
            after_data
          )
          VALUES (
            $1, $1, 'ministry_profile.reactivated', 'user', $1,
            $2::JSONB, $3::JSONB
          )
        `,
        [
          userId,
          JSON.stringify({
            status: "suppressed",
            suppression: reactivatedSuppression.rows[0],
          }),
          JSON.stringify({
            status: "active",
            ministryIds: ministries.map((ministry) => ministry.id),
          }),
        ]
      )
    }
    await client.query("COMMIT")

    return jsonResponse(200, {
      success: true,
      status: "accepted",
      message: `Welcome! You joined ${ministries.length} ${
        ministries.length === 1 ? "ministry" : "ministries"
      }`,
      token: createMinistryToken(user, jwtSecret),
    })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    if (error.code === "23505") {
      return jsonResponse(409, {
        message: "Username is already in use",
        field: "username",
      })
    }
    throw error
  }
}

const handler = async (event) => {
  if (!["GET", "POST"].includes(event.httpMethod)) {
    return jsonResponse(405, { message: "Method not allowed" })
  }
  const connectionString = process.env.MINISTRY_DATABASE_URL
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, { message: "Ministry invitations are not configured" })
  }

  const body = event.httpMethod === "POST" ? parseBody(event) : null
  if (event.httpMethod === "POST" && !body) {
    return jsonResponse(400, { message: "Invalid request" })
  }
  const token =
    event.httpMethod === "GET"
      ? event.queryStringParameters?.token?.toString()
      : body.token?.toString()
  if (!token) return jsonResponse(400, { message: "Invitation token is required" })

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  try {
    await client.connect()
    if (event.httpMethod === "GET") {
      return await loadInvitationResponse(client, token)
    }
    if (body.action === "inspect") {
      return await loadInvitationResponse(client, token)
    }
    if (body.action === "check_username") {
      return await checkUsername(client, token, body)
    }
    if (body.action === "decline") {
      return await declineInvitation(client, token)
    }
    if (body.action === "accept") {
      return await acceptInvitation(client, token, body, jwtSecret)
    }
    return jsonResponse(400, { message: "Choose accept or decline" })
  } catch (error) {
    console.error("Unable to answer ministry invitation:", error)
    return jsonResponse(500, { message: "Unable to answer this invitation" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
