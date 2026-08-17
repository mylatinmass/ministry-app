import crypto from "node:crypto"
import nodemailer from "nodemailer"
import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import klaviyoProfileSync from "../legacy/helper/klaviyo-profile-sync.js"

const { queueKlaviyoProfileSync } = klaviyoProfileSync

const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ACTIVE_ASSIGNMENT_STATUSES = [
  "interested",
  "pending",
  "assigned",
  "confirmed",
  "change_requested",
  "completed",
]

const cleanText = (value: unknown, maximum = 500) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const normalizeCode = (value: unknown) => cleanText(value, 64).toLowerCase()

const splitName = (name: string) => {
  const parts = name.replace(/\s+/g, " ").trim().split(" ")
  return {
    firstName: parts.shift() || "Volunteer",
    lastName: parts.join(" ") || "Volunteer",
  }
}

const availableUsername = async (client: PoolClient, name: string) => {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "").slice(0, 28) || "volunteer"
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString("hex")
    const candidate = `${base}.${suffix}`
    const exists = await client.query(
      `SELECT 1 FROM ministry_accounts WHERE lower(username) = $1 LIMIT 1`,
      [candidate],
    )
    if (!exists.rowCount) return candidate
  }
  throw new Error("Unable to create a volunteer username")
}

const invitationToken = () => crypto.randomBytes(32).toString("base64url")
const invitationTokenHash = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex")

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;")

const sendAccountInvitation = async (request: Request, invitation: any) => {
  const deliveryAllowed =
    process.env.VERCEL_ENV === "production" ||
    process.env.ALLOW_LOCAL_INVITATION_DELIVERY === "true"
  if (!deliveryAllowed || !process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.warn("Volunteer account invitation created but email delivery is unavailable")
    return false
  }
  const origin = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "")
  const activationUrl = `${origin}/volunteer-account#${new URLSearchParams({ token: invitation.token })}`
  const expiration = new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric",
  }).format(new Date(invitation.expiresAt))
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
  await transporter.sendMail({
    from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
    replyTo: process.env.GMAIL_USER,
    to: invitation.email,
    subject: "Finish setting up your volunteer account",
    text: [
      `Hello ${invitation.firstName},`, "",
      `You signed up for ${invitation.responsibilityName} at ${invitation.eventTitle}.`,
      "We already saved your information. Add a password to activate your account:",
      activationUrl, "",
      "Your account lets you manage reminders and future assignments without joining a ministry.",
      `This one-time invitation expires ${expiration}.`,
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:28px;border:1px solid #e5e7eb"><h1 style="color:#6f4f34">Finish setting up your volunteer account</h1><p>Hello ${escapeHtml(invitation.firstName)},</p><p>You signed up for <strong>${escapeHtml(invitation.responsibilityName)}</strong> at ${escapeHtml(invitation.eventTitle)}.</p><p>We already saved your information. You only need to add a password.</p><p style="margin:28px 0;text-align:center"><a href="${escapeHtml(activationUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#896542;color:white;font-weight:700;text-decoration:none">Create my password</a></p><p>Your account lets you manage reminders and future assignments without joining a ministry.</p><p style="color:#6b7280;font-size:14px">This invitation expires ${escapeHtml(expiration)}.</p></div>`,
  })
  return true
}

const loadPublicEvent = async (
  client: PoolClient,
  code: string,
) => {
  if (!CODE_PATTERN.test(code)) return null
  const eventResult = await client.query(
    `
      SELECT
        event.id,
        event.title,
        event.description,
        event.location,
        event.start_time,
        event.end_time,
        event.participation_type,
        event.signup_open,
        COALESCE(coordinator.name, 'Volunteer Event') AS ministry_name
      FROM events event
      LEFT JOIN ministries coordinator ON coordinator.id = event.ministry_id
      WHERE event.signup_code = $1
        AND event.signup_open = true
        AND event.status = 'published'
        AND event.participation_type IN ('volunteers', 'both')
        AND event.end_time > now()
      LIMIT 1
    `,
    [code],
  )
  const event = eventResult.rows[0]
  if (!event) return null

  const responsibilityResult = await client.query(
    `
      SELECT
        responsibility.id,
        responsibility.name,
        responsibility.description,
        responsibility.responsibility_type,
        responsibility.quantity_needed,
        responsibility.unlimited_capacity,
        responsibility.approval_required,
        responsibility.relative_start_minutes,
        COALESCE(sum(
          CASE
            WHEN assignment.status = ANY($2) THEN assignment.quantity
            ELSE 0
          END
        ), 0)::INT AS assigned_quantity
      FROM event_responsibilities responsibility
      LEFT JOIN responsibility_assignments assignment
        ON assignment.responsibility_id = responsibility.id
      WHERE responsibility.event_id = $1
        AND responsibility.status <> 'cancelled'
        AND responsibility.is_public_assignment = true
      GROUP BY
        responsibility.id,
        responsibility.name,
        responsibility.description,
        responsibility.responsibility_type,
        responsibility.quantity_needed,
        responsibility.unlimited_capacity,
        responsibility.approval_required,
        responsibility.relative_start_minutes,
        responsibility.sort_order
      ORDER BY responsibility.sort_order, lower(responsibility.name)
    `,
    [event.id, ACTIVE_ASSIGNMENT_STATUSES],
  )

  return {
    code,
    title: event.title,
    description: event.description || "",
    location: event.location || "",
    startTime: event.start_time,
    endTime: event.end_time,
    ministryName: event.ministry_name,
    responsibilities: responsibilityResult.rows
      .map((responsibility) => ({
        id: responsibility.id,
        name: responsibility.name,
        description: responsibility.description || "",
        responsibilityType: responsibility.responsibility_type,
        approvalRequired: responsibility.approval_required,
        relativeStartMinutes: Number(responsibility.relative_start_minutes),
        unlimitedCapacity: Boolean(responsibility.unlimited_capacity),
        availableSlots: responsibility.unlimited_capacity
          ? null
          : Math.max(
              0,
              Number(responsibility.quantity_needed) -
                Number(responsibility.assigned_quantity),
            ),
      }))
      .filter(
        (responsibility) =>
          responsibility.unlimitedCapacity ||
          (responsibility.availableSlots ?? 0) > 0,
      ),
  }
}

const createVolunteerSignup = async (
  client: PoolClient,
  body: any,
) => {
  const code = normalizeCode(body.code)
  const responsibilityId = cleanText(body.responsibilityId, 100)
  const name = cleanText(body.name, 200)
  const email = cleanText(body.email, 320).toLowerCase()
  const phone = cleanText(body.phone, 50)
  const notes = cleanText(body.notes, 1000) || null
  const website = cleanText(body.website, 200)
  const emailConsent = body.emailConsent === true
  const smsConsent = body.smsConsent === true
  const termsAccepted = body.termsAccepted === true

  if (website) {
    return { message: "Your volunteer signup was received", status: "pending" }
  }
  if (!CODE_PATTERN.test(code)) {
    throw Object.assign(new Error("Volunteer signup link is invalid"), {
      status: 404,
    })
  }
  if (!name) throw Object.assign(new Error("Name is required"), { status: 400 })
  if (!EMAIL_PATTERN.test(email)) {
    throw Object.assign(new Error("Enter a valid email address"), { status: 400 })
  }
  if (phone.replace(/\D/g, "").length < 7) {
    throw Object.assign(new Error("Enter a valid telephone number"), {
      status: 400,
    })
  }
  if (!termsAccepted) {
    throw Object.assign(
      new Error("You must agree to submit this volunteer signup"),
      { status: 400 },
    )
  }

  const eventResult = await client.query(
    `
      SELECT id, title, participation_type
      FROM events
      WHERE signup_code = $1
        AND signup_open = true
        AND status = 'published'
        AND participation_type IN ('volunteers', 'both')
        AND end_time > now()
      LIMIT 1
      FOR UPDATE
    `,
    [code],
  )
  const event = eventResult.rows[0]
  if (!event) {
    throw Object.assign(new Error("This volunteer signup is closed or unavailable"), {
      status: 404,
    })
  }

  const responsibilityResult = await client.query(
    `
      SELECT id, name, quantity_needed, unlimited_capacity, approval_required
      FROM event_responsibilities
      WHERE id = $1
        AND event_id = $2
        AND status <> 'cancelled'
        AND is_public_assignment = true
      LIMIT 1
      FOR UPDATE
    `,
    [responsibilityId, event.id],
  )
  const responsibility = responsibilityResult.rows[0]
  if (!responsibility) {
    throw Object.assign(new Error("This volunteer assignment is unavailable"), {
      status: 404,
    })
  }

  const coverageResult = await client.query(
    `
      SELECT COALESCE(sum(quantity), 0)::INT AS assigned_quantity
      FROM responsibility_assignments
      WHERE responsibility_id = $1
        AND status = ANY($2)
    `,
    [responsibility.id, ACTIVE_ASSIGNMENT_STATUSES],
  )
  if (
    !responsibility.unlimited_capacity &&
    Number(coverageResult.rows[0].assigned_quantity) >=
    Number(responsibility.quantity_needed)
  ) {
    throw Object.assign(new Error("That volunteer assignment was just filled"), {
      status: 409,
    })
  }

  const status = responsibility.approval_required ? "pending" : "confirmed"
  const matchingUsers = await client.query(
    `SELECT id, first_name, last_name, username, password_hash, public_profile_id
     FROM ministry_accounts
     WHERE lower(btrim(email)) = $1 AND status = 'active'
     ORDER BY CASE WHEN password_hash IS NOT NULL THEN 0 ELSE 1 END, created_at
     LIMIT 1`,
    [email],
  )
  let user = matchingUsers.rows[0] || null
  if (!user) {
    const { firstName, lastName } = splitName(name)
    const username = await availableUsername(client, name)
    const created = await client.query(
      `INSERT INTO ministry_accounts (
         first_name, last_name, email, phone, telephone, username,
         global_role, status, notification_lead_minutes, is_volunteer_profile
       )
       VALUES ($1, $2, $3, $4, $4, $5, 'regular', 'active', 60, true)
       RETURNING id, first_name, last_name, username, password_hash, public_profile_id`,
      [firstName, lastName, email, phone, username],
    )
    user = created.rows[0]
  } else {
    await client.query(
      `UPDATE ministry_accounts
       SET phone = COALESCE(NULLIF(phone, ''), $2),
           telephone = COALESCE(NULLIF(telephone, ''), $2),
           is_volunteer_profile = true,
           updated_at = now()
       WHERE id = $1`,
      [user.id, phone],
    )
  }
  await queueKlaviyoProfileSync(client, user.id)
  let assignmentId
  try {
    const assignmentResult = await client.query(
      `
        INSERT INTO responsibility_assignments (
          event_id,
          responsibility_id,
          user_id,
          volunteer_name,
          volunteer_email,
          volunteer_phone,
          quantity,
          notes,
          status,
          signup_source,
          notify_email,
          notify_sms,
          confirmed_at,
          volunteer_email_consent_at,
          volunteer_sms_consent_at,
          volunteer_signup_terms_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 1, $7, $8, 'public_link',
          $9, $10,
          CASE WHEN $8 = 'confirmed' THEN now() ELSE NULL END,
          CASE WHEN $9 THEN now() ELSE NULL END,
          CASE WHEN $10 THEN now() ELSE NULL END,
          now()
        )
        RETURNING id
      `,
      [
        event.id,
        responsibility.id,
        user.id,
        name,
        email,
        phone,
        notes,
        status,
        emailConsent,
        smsConsent,
      ],
    )
    assignmentId = assignmentResult.rows[0].id
  } catch (error: any) {
    if (error?.code === "23505") {
      throw Object.assign(
        new Error("This email is already signed up for that assignment"),
        { status: 409 },
      )
    }
    throw error
  }

  await client.query(
    `
      UPDATE event_responsibilities responsibility
      SET status = CASE
            WHEN responsibility.unlimited_capacity THEN 'open'
            WHEN (
              SELECT COALESCE(sum(quantity), 0)
              FROM responsibility_assignments assignment
              WHERE assignment.responsibility_id = responsibility.id
                AND assignment.status = ANY($2)
            ) >= responsibility.quantity_needed THEN 'filled'
            ELSE 'open'
          END,
          updated_at = now()
      WHERE responsibility.id = $1
    `,
    [responsibility.id, ACTIVE_ASSIGNMENT_STATUSES],
  )

  let accountInvitation = null
  if (!user.password_hash) {
    const token = invitationToken()
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    await client.query(
      `UPDATE volunteer_account_invitations
       SET status = 'revoked', revoked_at = now(), updated_at = now()
       WHERE user_id = $1 AND status = 'pending'`,
      [user.id],
    )
    await client.query(
      `INSERT INTO volunteer_account_invitations (
         user_id, assignment_id, token_hash, expires_at
       ) VALUES ($1, $2, $3, $4)`,
      [user.id, assignmentId, invitationTokenHash(token), expiresAt],
    )
    accountInvitation = {
      token,
      expiresAt,
      email,
      firstName: user.first_name || splitName(name).firstName,
      eventTitle: event.title,
      responsibilityName: responsibility.name,
    }
  }

  return {
    message:
      status === "confirmed"
        ? `You are signed up for ${responsibility.name}`
        : `Your request for ${responsibility.name} was submitted for approval`,
    status,
    eventTitle: event.title,
    responsibilityName: responsibility.name,
    accountInvitation,
  }
}

export const handleVolunteerSignup = async (request: Request) => {
  const client = await getPool().connect()
  try {
    if (request.method === "GET") {
      const url = new URL(request.url)
      const code = normalizeCode(url.searchParams.get("code"))
      const event = await loadPublicEvent(client, code)
      return event
        ? json(event)
        : json({ message: "This volunteer signup is closed or unavailable" }, 404)
    }
    if (request.method !== "POST") {
      return json({ message: "Method not allowed" }, 405, {
        Allow: "GET, POST",
      })
    }
    const body = await request.json().catch(() => ({}))
    await client.query("BEGIN")
    try {
      const result = await createVolunteerSignup(client, body)
      await client.query("COMMIT")
      const accountInvitationSent = result.accountInvitation
        ? await sendAccountInvitation(request, result.accountInvitation).catch((error) => {
            console.error("Unable to send volunteer account invitation:", error)
            return false
          })
        : false
      const { accountInvitation, ...publicResult } = result
      return json({
        ...publicResult,
        accountInvitationSent,
        accountAlreadyActive: !accountInvitation,
      }, 201)
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    }
  } catch (error: any) {
    const status = Number(error?.status || 500)
    if (status === 500) console.error("Unable to manage volunteer signup:", error)
    return json(
      { message: status === 500 ? "Unable to submit volunteer signup" : error.message },
      status,
    )
  } finally {
    client.release()
  }
}
