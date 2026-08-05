import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"

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

const loadPublicEvent = async (client: PoolClient, code: string) => {
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
      GROUP BY
        responsibility.id,
        responsibility.name,
        responsibility.description,
        responsibility.responsibility_type,
        responsibility.quantity_needed,
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
        availableSlots: Math.max(
          0,
          Number(responsibility.quantity_needed) -
            Number(responsibility.assigned_quantity),
        ),
      }))
      .filter((responsibility) => responsibility.availableSlots > 0),
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
      SELECT id, name, quantity_needed, approval_required
      FROM event_responsibilities
      WHERE id = $1
        AND event_id = $2
        AND status <> 'cancelled'
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
    Number(coverageResult.rows[0].assigned_quantity) >=
    Number(responsibility.quantity_needed)
  ) {
    throw Object.assign(new Error("That volunteer assignment was just filled"), {
      status: 409,
    })
  }

  const status = responsibility.approval_required ? "pending" : "confirmed"
  try {
    await client.query(
      `
        INSERT INTO responsibility_assignments (
          event_id,
          responsibility_id,
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
          $1, $2, $3, $4, $5, 1, $6, $7, 'public_link',
          $8, $9,
          CASE WHEN $7 = 'confirmed' THEN now() ELSE NULL END,
          CASE WHEN $8 THEN now() ELSE NULL END,
          CASE WHEN $9 THEN now() ELSE NULL END,
          now()
        )
      `,
      [
        event.id,
        responsibility.id,
        name,
        email,
        phone,
        notes,
        status,
        emailConsent,
        smsConsent,
      ],
    )
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

  return {
    message:
      status === "confirmed"
        ? `You are signed up for ${responsibility.name}`
        : `Your request for ${responsibility.name} was submitted for approval`,
    status,
    eventTitle: event.title,
    responsibilityName: responsibility.name,
  }
}

export const handleVolunteerSignup = async (request: Request) => {
  const client = await getPool().connect()
  try {
    if (request.method === "GET") {
      const code = normalizeCode(new URL(request.url).searchParams.get("code"))
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
      return json(result, 201)
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
