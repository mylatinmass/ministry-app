const crypto = require("crypto")

const PARTICIPATION_TYPES = new Set(["members", "volunteers", "both"])
const RESPONSIBILITY_TYPES = new Set([
  "position",
  "food",
  "task",
  "time_slot",
])

const createSignupCode = () => crypto.randomBytes(24).toString("base64url")

const normalizeTemplateResponsibility = (responsibility, sortOrder) => {
  const name = String(responsibility?.name || "").trim()
  const responsibilityType = RESPONSIBILITY_TYPES.has(responsibility?.type)
    ? responsibility.type
    : "position"
  const quantityNeeded = Number.parseInt(responsibility?.quantity, 10)

  if (!name) {
    throw new Error("Every template responsibility must have a name")
  }

  if (!Number.isInteger(quantityNeeded) || quantityNeeded <= 0) {
    throw new Error(`Template responsibility '${name}' needs a positive quantity`)
  }

  return {
    name,
    description: responsibility.description || null,
    responsibilityType,
    quantityNeeded,
    approvalRequired: Boolean(responsibility.approvalRequired),
    instructions: responsibility.instructions || null,
    sortOrder,
  }
}

const createEventFromTemplate = async (
  client,
  {
    ministryId,
    templateId,
    title,
    description = null,
    location = null,
    startTime,
    endTime,
    participationType,
    signupOpen = false,
    status = "draft",
    createdBy,
  }
) => {
  await client.query("BEGIN")

  try {
    const templateResult = await client.query(
      `
        SELECT ministry_id, participation_type, responsibilities
        FROM templates
        WHERE id = $1 AND status = 'active'
      `,
      [templateId]
    )

    if (templateResult.rowCount !== 1) {
      throw new Error("Active ministry template not found")
    }

    const template = templateResult.rows[0]

    if (template.ministry_id !== ministryId) {
      throw new Error("Template does not belong to the selected ministry")
    }

    const selectedParticipationType =
      participationType || template.participation_type

    if (!PARTICIPATION_TYPES.has(selectedParticipationType)) {
      throw new Error("Invalid participation type")
    }

    const needsPublicSignup = ["volunteers", "both"].includes(
      selectedParticipationType
    )
    const signupCode = needsPublicSignup ? createSignupCode() : null

    const eventResult = await client.query(
      `
        INSERT INTO events (
          ministry_id,
          template_id,
          title,
          description,
          location,
          start_time,
          end_time,
          participation_type,
          signup_code,
          signup_open,
          status,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
        ministryId,
        templateId,
        title,
        description,
        location,
        startTime,
        endTime,
        selectedParticipationType,
        signupCode,
        signupOpen,
        status,
        createdBy,
      ]
    )

    const event = eventResult.rows[0]
    const templateResponsibilities = Array.isArray(template.responsibilities)
      ? template.responsibilities
      : []

    for (const [index, rawResponsibility] of templateResponsibilities.entries()) {
      const responsibility = normalizeTemplateResponsibility(
        rawResponsibility,
        index
      )

      await client.query(
        `
          INSERT INTO event_responsibilities (
            event_id,
            name,
            description,
            responsibility_type,
            quantity_needed,
            approval_required,
            instructions,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          event.id,
          responsibility.name,
          responsibility.description,
          responsibility.responsibilityType,
          responsibility.quantityNeeded,
          responsibility.approvalRequired,
          responsibility.instructions,
          responsibility.sortOrder,
        ]
      )
    }

    await client.query("COMMIT")
    return event
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }
}

const createResponsibilityAssignment = async (
  client,
  {
    eventId,
    responsibilityId,
    userId = null,
    volunteerName = null,
    volunteerEmail = null,
    volunteerPhone = null,
    quantity = 1,
    notes = null,
    status = "pending",
    assignedBy = null,
    signupSource,
    notifyEmail = true,
    notifyPush = false,
    notifySms = false,
  }
) => {
  const responsibilityResult = await client.query(
    `
      SELECT 1
      FROM event_responsibilities
      WHERE id = $1 AND event_id = $2
    `,
    [responsibilityId, eventId]
  )

  if (responsibilityResult.rowCount !== 1) {
    throw new Error("Responsibility does not belong to the selected event")
  }

  const normalizedVolunteerName = volunteerName?.trim() || null
  const normalizedVolunteerEmail = volunteerEmail?.trim().toLowerCase() || null
  const normalizedVolunteerPhone = volunteerPhone?.trim() || null

  if (!userId && (!normalizedVolunteerName || !normalizedVolunteerEmail)) {
    throw new Error("A volunteer name and email are required")
  }

  const result = await client.query(
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
        assigned_by,
        signup_source,
        notify_email,
        notify_push,
        notify_sms
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *
    `,
    [
      eventId,
      responsibilityId,
      userId,
      normalizedVolunteerName,
      normalizedVolunteerEmail,
      normalizedVolunteerPhone,
      quantity,
      notes,
      status,
      assignedBy,
      signupSource,
      notifyEmail,
      notifyPush,
      notifySms,
    ]
  )

  return result.rows[0]
}

module.exports = {
  createEventFromTemplate,
  createResponsibilityAssignment,
  createSignupCode,
  normalizeTemplateResponsibility,
}
