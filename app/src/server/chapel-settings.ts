import type { PoolClient } from "pg"
import { getPool } from "./database"
import { json } from "./request"
import {
  getIdentityContext,
  writeSchedulingAudit,
} from "./scheduling/authorization"

const DEFAULT_SETTINGS = {
  chapelName: "Our Lady of Victory Chapel",
  publicPhone: "",
  publicEmail: "",
  streetAddress: "",
  mailingAddress: "",
  websiteUrl: "https://www.mylatinmass.com",
  timeZone: "America/New_York",
  defaultEventLocation: "",
  mapUrl: "",
  publicCalendarUrl: "https://www.mylatinmass.com/events/calendar.ics",
  defaultMassTemplateId: "",
  defaultEventTemplateId: "",
  notificationSenderName: "Our Lady of Victory Chapel",
  replyToEmail: "",
  emergencyContact: "",
  publicEventVisibility: "public",
  schedulingHorizonDays: 60,
  logoUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
  notificationTestModeEnabled: false,
  notificationTestAccountUserId: "",
}

const textFields = new Set([
  "chapelName",
  "publicPhone",
  "publicEmail",
  "streetAddress",
  "mailingAddress",
  "websiteUrl",
  "timeZone",
  "defaultEventLocation",
  "mapUrl",
  "publicCalendarUrl",
  "defaultMassTemplateId",
  "defaultEventTemplateId",
  "notificationSenderName",
  "replyToEmail",
  "emergencyContact",
  "publicEventVisibility",
  "logoUrl",
  "facebookUrl",
  "instagramUrl",
  "youtubeUrl",
  "notificationTestAccountUserId",
])

const cleanText = (value: unknown, maximum = 5000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const requireGlobalAdministrator = (context: any) => {
  if (!["owner", "super_admin"].includes(context.user.global_role)) {
    throw Object.assign(
      new Error("Only a Super Admin can manage chapel settings"),
      { status: 403 },
    )
  }
}

const normalizeSettings = (value: any) => {
  const settings: Record<string, string | number | boolean> = { ...DEFAULT_SETTINGS }
  for (const key of textFields) {
    settings[key] = cleanText(value?.[key], key.includes("Address") ? 2000 : 500)
  }
  settings.publicEventVisibility = ["public", "private"].includes(
    String(settings.publicEventVisibility),
  )
    ? settings.publicEventVisibility
    : "public"
  settings.schedulingHorizonDays = Math.min(
    365,
    Math.max(1, Number(value?.schedulingHorizonDays) || 60),
  )
  settings.notificationTestModeEnabled =
    value?.notificationTestModeEnabled === true
  return settings
}

const validCalendarDate = (month: number, day: number) => {
  const date = new Date(Date.UTC(2024, month - 1, day))
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const normalizeObservance = (body: any) => {
  const month = Number(body.month)
  const day = Number(body.day)
  const effectiveStartYear = cleanText(body.effectiveStartYear, 4)
  if (!cleanText(body.name, 250)) {
    throw Object.assign(new Error("Observance name is required"), { status: 400 })
  }
  if (!validCalendarDate(month, day)) {
    throw Object.assign(new Error("Choose a valid fixed date"), { status: 400 })
  }
  return {
    id: cleanText(body.id, 100),
    name: cleanText(body.name, 250),
    month,
    day,
    defaultTemplateId: cleanText(body.defaultTemplateId, 100) || null,
    defaultStartTime: /^\d{2}:\d{2}$/.test(cleanText(body.defaultStartTime, 5))
      ? cleanText(body.defaultStartTime, 5)
      : null,
    effectiveStartYear: effectiveStartYear
      ? Math.min(2200, Math.max(1900, Number(effectiveStartYear)))
      : null,
    notes: cleanText(body.notes),
    status: body.status === "inactive" ? "inactive" : "active",
  }
}

const normalizeRoom = (body: any) => {
  const name = cleanText(body.name, 150)
  if (!name) {
    throw Object.assign(new Error("Room name is required"), { status: 400 })
  }
  return {
    id: cleanText(body.id, 100),
    name,
    description: cleanText(body.description, 1000) || null,
    status: ["active", "inactive"].includes(body.status)
      ? body.status
      : "active",
    sortOrder: Math.min(10000, Math.max(0, Number(body.sortOrder) || 0)),
  }
}

const loadSettings = async (client: PoolClient) => {
  const [settingsResult, observancesResult, roomsResult, templatesResult, ministriesResult, testingProfilesResult, auditResult] =
    await Promise.all([
      client.query(
        `SELECT settings, updated_at FROM chapel_settings WHERE setting_key = 'primary'`,
      ),
      client.query(
        `
          SELECT observance.*, template.name AS template_name
          FROM chapel_observances observance
          LEFT JOIN templates template ON template.id = observance.default_template_id
          ORDER BY observance.month, observance.day, lower(observance.name)
        `,
      ),
      client.query(
        `
          SELECT id, name, description, status, sort_order, updated_at
          FROM chapel_rooms
          WHERE status <> 'archived'
          ORDER BY sort_order, lower(name)
        `,
      ),
      client.query(
        `
          SELECT template.id, template.name, ministry.name AS ministry_name
          FROM templates template
          JOIN ministries ministry ON ministry.id = template.ministry_id
          WHERE template.status = 'active' AND ministry.status = 'active'
          ORDER BY lower(ministry.name), lower(template.name)
        `,
      ),
      client.query(
        `SELECT id, name, description, status FROM ministries ORDER BY lower(name)`,
      ),
      client.query(
        `
          SELECT id, first_name, last_name, email
          FROM ministry_accounts
          WHERE status = 'active'
            AND global_role IN ('owner', 'super_admin')
          ORDER BY lower(last_name), lower(first_name), lower(email)
        `,
      ),
      client.query(
        `
          SELECT audit.id, audit.action, audit.entity_type, audit.after_data,
            audit.created_at, actor.first_name, actor.last_name
          FROM ministry_audit_log audit
          JOIN ministry_accounts actor ON actor.id = audit.actor_user_id
          WHERE audit.entity_type IN ('chapel_settings', 'chapel_observance', 'chapel_room')
          ORDER BY audit.created_at DESC
          LIMIT 20
        `,
      ),
    ])

  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...(settingsResult.rows[0]?.settings || {}),
    },
    updatedAt: settingsResult.rows[0]?.updated_at || null,
    observances: observancesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      month: Number(row.month),
      day: Number(row.day),
      defaultTemplateId: row.default_template_id || "",
      templateName: row.template_name || "",
      defaultStartTime: row.default_start_time
        ? String(row.default_start_time).slice(0, 5)
        : "",
      effectiveStartYear: row.effective_start_year || "",
      notes: row.notes || "",
      status: row.status,
    })),
    rooms: roomsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || "",
      status: row.status,
      sortOrder: Number(row.sort_order) || 0,
      updatedAt: row.updated_at,
    })),
    templates: templatesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      ministryName: row.ministry_name,
    })),
    ministries: ministriesResult.rows,
    testingProfiles: testingProfilesResult.rows.map((row) => ({
      id: row.id,
      name:
        [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email,
      email: row.email || "",
    })),
    auditHistory: auditResult.rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      summary:
        row.after_data?.name || row.after_data?.chapelName || "Chapel settings",
      actorName:
        [row.first_name, row.last_name].filter(Boolean).join(" ") || "Administrator",
      createdAt: row.created_at,
    })),
  }
}

export const handleChapelSettings = async (request: Request) => {
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    requireGlobalAdministrator(context)

    if (request.method === "GET") {
      return json(await loadSettings(client))
    }
    if (request.method !== "PATCH") {
      return json({ message: "Method not allowed" }, 405)
    }

    const body = await request.json().catch(() => ({}))
    await client.query("BEGIN")
    try {
      if (body.action === "update_settings") {
        const currentResult = await client.query(
          `SELECT settings FROM chapel_settings WHERE setting_key = 'primary' FOR UPDATE`,
        )
        const beforeData = currentResult.rows[0]?.settings || DEFAULT_SETTINGS
        const settings = normalizeSettings(body.settings)
        await client.query(
          `
            INSERT INTO chapel_settings (setting_key, settings, updated_by)
            VALUES ('primary', $1::JSONB, $2)
            ON CONFLICT (setting_key) DO UPDATE SET
              settings = excluded.settings,
              updated_by = excluded.updated_by,
              updated_at = now()
          `,
          [JSON.stringify(settings), context.user.id],
        )
        await writeSchedulingAudit(client, context, {
          action: "chapel.settings_updated",
          entityType: "chapel_settings",
          beforeData,
          afterData: settings,
        })
      } else if (body.action === "update_notification_test_mode") {
        const enabled = body.enabled === true
        const targetUserId = cleanText(body.targetUserId, 100)
        let target: any = null
        if (enabled || targetUserId) {
          const targetResult = await client.query(
            `
              SELECT id, first_name, last_name, email
              FROM ministry_accounts
              WHERE id = $1
                AND status = 'active'
                AND global_role IN ('owner', 'super_admin')
              LIMIT 1
            `,
            [targetUserId],
          )
          target = targetResult.rows[0]
          if (!target) {
            throw Object.assign(
              new Error("Choose an active Super Admin testing profile"),
              { status: 400 },
            )
          }
        }
        const currentResult = await client.query(
          `SELECT settings FROM chapel_settings WHERE setting_key = 'primary' FOR UPDATE`,
        )
        const beforeData = {
          ...DEFAULT_SETTINGS,
          ...(currentResult.rows[0]?.settings || {}),
        }
        const settings = {
          ...beforeData,
          notificationTestModeEnabled: enabled,
          notificationTestAccountUserId: targetUserId,
        }
        await client.query(
          `
            INSERT INTO chapel_settings (setting_key, settings, updated_by)
            VALUES ('primary', $1::JSONB, $2)
            ON CONFLICT (setting_key) DO UPDATE SET
              settings = excluded.settings,
              updated_by = excluded.updated_by,
              updated_at = now()
          `,
          [JSON.stringify(settings), context.user.id],
        )
        await writeSchedulingAudit(client, context, {
          action: enabled
            ? "chapel.notification_test_mode_enabled"
            : "chapel.notification_test_mode_disabled",
          entityType: "chapel_settings",
          beforeData: {
            enabled: beforeData.notificationTestModeEnabled === true,
            targetUserId: beforeData.notificationTestAccountUserId || null,
          },
          afterData: {
            enabled,
            targetUserId: targetUserId || null,
            targetName: target
              ? [target.first_name, target.last_name].filter(Boolean).join(" ") || target.email
              : null,
          },
        })
      } else if (body.action === "save_observance") {
        const input = normalizeObservance(body.observance)
        const previousResult = input.id
          ? await client.query(
              `SELECT * FROM chapel_observances WHERE id = $1 FOR UPDATE`,
              [input.id],
            )
          : { rows: [] }
        const result = input.id
          ? await client.query(
              `
                UPDATE chapel_observances
                SET name = $2, month = $3, day = $4, default_template_id = $5,
                  default_start_time = $6::TIME, effective_start_year = $7,
                  notes = $8, status = $9, updated_by = $10, updated_at = now()
                WHERE id = $1
                RETURNING *
              `,
              [
                input.id, input.name, input.month, input.day,
                input.defaultTemplateId, input.defaultStartTime,
                input.effectiveStartYear, input.notes || null, input.status,
                context.user.id,
              ],
            )
          : await client.query(
              `
                INSERT INTO chapel_observances (
                  name, month, day, default_template_id, default_start_time,
                  effective_start_year, notes, status,
                  created_by, updated_by
                ) VALUES ($1, $2, $3, $4, $5::TIME, $6, $7, $8, $9, $9)
                RETURNING *
              `,
              [
                input.name, input.month, input.day, input.defaultTemplateId,
                input.defaultStartTime, input.effectiveStartYear,
                input.notes || null, input.status, context.user.id,
              ],
            )
        if (!result.rowCount) {
          throw Object.assign(new Error("Observance not found"), { status: 404 })
        }
        await writeSchedulingAudit(client, context, {
          action: input.id
            ? "chapel.observance_updated"
            : "chapel.observance_created",
          entityType: "chapel_observance",
          entityId: result.rows[0].id,
          beforeData: previousResult.rows[0] || null,
          afterData: result.rows[0],
        })
      } else if (body.action === "save_room") {
        const input = normalizeRoom(body.room)
        const previousResult = input.id
          ? await client.query(
              `SELECT * FROM chapel_rooms WHERE id = $1 FOR UPDATE`,
              [input.id],
            )
          : { rows: [] }
        const result = input.id
          ? await client.query(
              `
                UPDATE chapel_rooms
                SET name = $2, description = $3, status = $4,
                  sort_order = $5, updated_by = $6, updated_at = now()
                WHERE id = $1 AND status <> 'archived'
                RETURNING *
              `,
              [
                input.id, input.name, input.description, input.status,
                input.sortOrder, context.user.id,
              ],
            )
          : await client.query(
              `
                INSERT INTO chapel_rooms (
                  name, description, status, sort_order, created_by, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $5)
                RETURNING *
              `,
              [
                input.name, input.description, input.status,
                input.sortOrder, context.user.id,
              ],
            )
        if (!result.rowCount) {
          throw Object.assign(new Error("Room not found"), { status: 404 })
        }
        await writeSchedulingAudit(client, context, {
          action: input.id ? "chapel.room_updated" : "chapel.room_created",
          entityType: "chapel_room",
          entityId: result.rows[0].id,
          beforeData: previousResult.rows[0] || null,
          afterData: result.rows[0],
        })
      } else if (body.action === "archive_room") {
        const roomId = cleanText(body.roomId, 100)
        const previousResult = await client.query(
          `SELECT * FROM chapel_rooms WHERE id = $1 AND status <> 'archived' FOR UPDATE`,
          [roomId],
        )
        if (!previousResult.rowCount) {
          throw Object.assign(new Error("Room not found"), { status: 404 })
        }
        const result = await client.query(
          `
            UPDATE chapel_rooms
            SET status = 'archived', updated_by = $2, updated_at = now()
            WHERE id = $1
            RETURNING *
          `,
          [roomId, context.user.id],
        )
        await writeSchedulingAudit(client, context, {
          action: "chapel.room_archived",
          entityType: "chapel_room",
          entityId: roomId,
          beforeData: previousResult.rows[0],
          afterData: result.rows[0],
        })
      } else {
        throw Object.assign(new Error("Unknown chapel settings action"), {
          status: 400,
        })
      }

      await client.query("COMMIT")
      return json({ ...(await loadSettings(client)), message: "Chapel settings updated" })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  } catch (error: any) {
    const status =
      error?.status || (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    if (status === 500) console.error("Unable to manage chapel settings:", error)
    return json(
      { message: error?.message || "Unable to manage chapel settings" },
      status,
    )
  } finally {
    client.release()
  }
}
