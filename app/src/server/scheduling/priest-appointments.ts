import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  getMinistryAccess,
  writeSchedulingAudit,
} from "./authorization"
import { getPriestPrivacyAccess } from "./priest-privacy"

const clean = (value: unknown, maximum = 4000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

export const handlePriestAppointmentDetails = async (request: Request) => {
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    const url = new URL(request.url)
    const eventId = clean(
      request.method === "GET"
        ? url.searchParams.get("eventId")
        : (await request.clone().json().catch(() => ({}))).eventId,
      100,
    )
    if (!eventId) return json({ message: "Event is required" }, 400)
    const eventResult = await client.query(
      `SELECT id, ministry_id, title, visibility FROM events WHERE id = $1 LIMIT 1`,
      [eventId],
    )
    const event = eventResult.rows[0]
    if (!event) return json({ message: "Event not found" }, 404)
    const access = await getPriestPrivacyAccess(client, context.user, event)
    if (!access.canSeeProtectedDetails) {
      return json({ message: "Protected appointment details are restricted" }, 403)
    }

    if (request.method === "GET") {
      const details = await client.query(
        `
          SELECT person_name, phone, address, instructions, private_notes, updated_at
          FROM priest_appointment_details
          WHERE event_id = $1
          LIMIT 1
        `,
        [eventId],
      )
      return json({
        canManageProtectedDetails:
          access.canSeeProtectedDetails &&
          (await getMinistryAccess(client, context.user, event.ministry_id)).canManage,
        details: details.rows[0] || {
          person_name: "",
          phone: "",
          address: "",
          instructions: "",
          private_notes: "",
        },
      })
    }

    if (request.method !== "PATCH") {
      return json({ message: "Method not allowed" }, 405, { Allow: "GET, PATCH" })
    }
    const ministryAccess = await getMinistryAccess(
      client,
      context.user,
      event.ministry_id,
    )
    if (!ministryAccess.canManage) {
      return json({ message: "Only a Priest Ministry administrator can edit protected details" }, 403)
    }
    const body = await request.json().catch(() => ({}))
    const next = {
      personName: clean(body.personName, 250) || null,
      phone: clean(body.phone, 80) || null,
      address: clean(body.address, 750) || null,
      instructions: clean(body.instructions, 4000) || null,
      privateNotes: clean(body.privateNotes, 4000) || null,
    }
    await client.query("BEGIN")
    await client.query(
      `
        INSERT INTO priest_appointment_details (
          event_id, person_name, phone, address, instructions, private_notes,
          created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (event_id) DO UPDATE SET
          person_name = excluded.person_name,
          phone = excluded.phone,
          address = excluded.address,
          instructions = excluded.instructions,
          private_notes = excluded.private_notes,
          updated_by = excluded.updated_by,
          updated_at = now()
      `,
      [
        eventId,
        next.personName,
        next.phone,
        next.address,
        next.instructions,
        next.privateNotes,
        context.actor.id,
      ],
    )
    await writeSchedulingAudit(client, context, {
      action: "priest_appointment.protected_details_updated",
      entityType: "event",
      entityId: eventId,
      ministryId: event.ministry_id,
      afterData: null,
      metadata: {
        fieldsUpdated: Object.entries(next)
          .filter(([, value]) => Boolean(value))
          .map(([key]) => key),
        protectedValuesExcluded: true,
      },
    })
    await client.query("COMMIT")
    return json({ message: "Private appointment details updated" })
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {})
    return json({ message: error?.message || "Unable to manage private details" }, error?.status || 500)
  } finally {
    client.release()
  }
}
