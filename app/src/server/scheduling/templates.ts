import type { PoolClient } from "pg"
import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  getMinistryAccess,
  requireMinistryAccess,
  writeSchedulingAudit,
} from "./authorization"

const RESPONSIBILITY_TYPES = new Set(["position", "food", "task", "time_slot"])

type MinistryBlockInput = {
  ministryId: string
  isRequired?: boolean
  instructions?: string
  sortOrder?: number
}

type ResponsibilityInput = {
  id?: string
  ministryId: string
  name: string
  description?: string
  responsibilityType?: string
  quantityNeeded?: number
  approvalRequired?: boolean
  substitutionAllowed?: boolean
  isRequired?: boolean
  requiredLevelId?: string
  requiredQualification?: string
  relativeStartMinutes?: number
  instructions?: string
  sortOrder?: number
}

type TemplateInput = {
  name: string
  description?: string
  coordinatorMinistryId: string
  participationType?: string
  ministries?: MinistryBlockInput[]
  responsibilities?: ResponsibilityInput[]
}

const cleanText = (value: unknown, maximum = 5000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const positiveInteger = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const integer = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

const normalizeTemplateInput = (body: any): TemplateInput => {
  const coordinatorMinistryId = cleanText(body.coordinatorMinistryId, 100)
  const blocks = Array.isArray(body.ministries) ? body.ministries : []
  const normalizedBlocks: MinistryBlockInput[] = blocks
    .map((block: any, index: number) => ({
      ministryId: cleanText(block.ministryId, 100),
      isRequired: block.isRequired !== false,
      instructions: cleanText(block.instructions),
      sortOrder: integer(block.sortOrder, index),
    }))
    .filter((block: MinistryBlockInput) => block.ministryId)

  if (
    coordinatorMinistryId &&
    !normalizedBlocks.some((block) => block.ministryId === coordinatorMinistryId)
  ) {
    normalizedBlocks.unshift({
      ministryId: coordinatorMinistryId,
      isRequired: true,
      sortOrder: 0,
    })
  }

  const responsibilities = (
    Array.isArray(body.responsibilities) ? body.responsibilities : []
  )
    .map((responsibility: any, index: number) => ({
      ministryId: cleanText(responsibility.ministryId, 100),
      name: cleanText(responsibility.name, 250),
      description: cleanText(responsibility.description),
      responsibilityType: RESPONSIBILITY_TYPES.has(
        responsibility.responsibilityType,
      )
        ? responsibility.responsibilityType
        : "position",
      quantityNeeded: positiveInteger(responsibility.quantityNeeded),
      approvalRequired: Boolean(responsibility.approvalRequired),
      substitutionAllowed: responsibility.substitutionAllowed !== false,
      isRequired: responsibility.isRequired !== false,
      requiredLevelId:
        cleanText(responsibility.requiredLevelId, 100) || undefined,
      requiredQualification: cleanText(
        responsibility.requiredQualification,
        250,
      ),
      relativeStartMinutes: integer(responsibility.relativeStartMinutes),
      instructions: cleanText(responsibility.instructions),
      sortOrder: integer(responsibility.sortOrder, index),
    }))
    .filter(
      (responsibility: ResponsibilityInput) =>
        responsibility.ministryId && responsibility.name,
    )

  return {
    name: cleanText(body.name, 250),
    description: cleanText(body.description),
    coordinatorMinistryId,
    participationType: ["members", "volunteers", "both"].includes(
      body.participationType,
    )
      ? body.participationType
      : "members",
    ministries: normalizedBlocks,
    responsibilities,
  }
}

const validateTemplateInput = (input: TemplateInput) => {
  if (!input.name) throw Object.assign(new Error("Template name is required"), { status: 400 })
  if (!input.coordinatorMinistryId) {
    throw Object.assign(new Error("Coordinating ministry is required"), {
      status: 400,
    })
  }
  if (!input.ministries?.length) {
    throw Object.assign(new Error("Select at least one participating ministry"), {
      status: 400,
    })
  }
  const selected = new Set(input.ministries.map((block) => block.ministryId))
  if (selected.size !== input.ministries.length) {
    throw Object.assign(new Error("A ministry can appear only once"), {
      status: 400,
    })
  }
  if (
    input.responsibilities?.some(
      (responsibility) => !selected.has(responsibility.ministryId),
    )
  ) {
    throw Object.assign(
      new Error("Every responsibility must belong to a participating ministry"),
      { status: 400 },
    )
  }
  if (
    input.responsibilities?.some(
      (responsibility) =>
        ![0, -15, -30, -45, -60, -120].includes(
          Number(responsibility.relativeStartMinutes),
        ),
    )
  ) {
    throw Object.assign(
      new Error("Choose a valid responsibility time offset"),
      { status: 400 },
    )
  }
}

const loadAvailableMinistries = async (client: PoolClient) => {
  const result = await client.query(
    `
      SELECT id, name, slug, description
      FROM ministries
      WHERE status = 'active'
      ORDER BY lower(name)
    `,
  )
  return result.rows
}

const loadAvailableLevels = async (client: PoolClient) => {
  const result = await client.query(
    `
      SELECT id, ministry_id, name, description, rank_order
      FROM ministry_levels
      WHERE status = 'active'
      ORDER BY ministry_id, rank_order
    `,
  )
  return result.rows.map((level) => ({
    id: level.id,
    ministryId: level.ministry_id,
    name: level.name,
    description: level.description || "",
    rankOrder: Number(level.rank_order),
  }))
}

const loadTemplates = async (client: PoolClient, ministryId: string) => {
  const templateResult = await client.query(
    `
      SELECT
        template.id,
        template.ministry_id AS coordinator_ministry_id,
        coordinator.name AS coordinator_ministry_name,
        template.name,
        template.description,
        template.participation_type,
        template.responsibilities AS legacy_responsibilities,
        template.status,
        template.version,
        template.updated_at
      FROM templates template
      JOIN ministries coordinator ON coordinator.id = template.ministry_id
      WHERE template.ministry_id = $1
         OR EXISTS (
           SELECT 1
           FROM template_ministries block
           WHERE block.template_id = template.id
             AND block.ministry_id = $1
         )
      ORDER BY
        CASE template.status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END,
        lower(template.name)
    `,
    [ministryId],
  )
  if (!templateResult.rowCount) return []

  const ids = templateResult.rows.map((template) => template.id)
  const [blockResult, responsibilityResult] = await Promise.all([
    client.query(
      `
        SELECT
          block.id,
          block.template_id,
          block.ministry_id,
          ministry.name AS ministry_name,
          block.is_required,
          block.instructions,
          block.sort_order
        FROM template_ministries block
        JOIN ministries ministry ON ministry.id = block.ministry_id
        WHERE block.template_id = ANY($1::UUID[])
        ORDER BY block.sort_order, lower(ministry.name)
      `,
      [ids],
    ),
    client.query(
      `
        SELECT
          responsibility.id,
          responsibility.template_id,
          block.ministry_id,
          responsibility.name,
          responsibility.description,
          responsibility.responsibility_type,
          responsibility.quantity_needed,
          responsibility.approval_required,
          responsibility.substitution_allowed,
          responsibility.is_required,
          responsibility.required_ministry_level_id,
          ministry_level.name AS required_level_name,
          ministry_level.rank_order AS required_level_rank,
          responsibility.required_qualification,
          responsibility.relative_start_minutes,
          responsibility.instructions,
          responsibility.sort_order
        FROM template_responsibilities responsibility
        JOIN template_ministries block
          ON block.id = responsibility.template_ministry_id
        LEFT JOIN ministry_levels ministry_level
          ON ministry_level.id = responsibility.required_ministry_level_id
        WHERE responsibility.template_id = ANY($1::UUID[])
          AND responsibility.status = 'active'
        ORDER BY responsibility.sort_order, lower(responsibility.name)
      `,
      [ids],
    ),
  ])

  return templateResult.rows.map((template) => {
    const ministries = blockResult.rows.filter(
      (block) => block.template_id === template.id,
    )
    let responsibilities = responsibilityResult.rows.filter(
      (responsibility) => responsibility.template_id === template.id,
    )
    if (
      !responsibilities.length &&
      Array.isArray(template.legacy_responsibilities)
    ) {
      responsibilities = template.legacy_responsibilities
        .map((responsibility: any, index: number) => {
          const name =
            typeof responsibility === "string"
              ? responsibility
              : responsibility?.name || responsibility?.title
          if (!name) return null
          return {
            id: `legacy-${index}`,
            ministry_id: template.coordinator_ministry_id,
            name,
            description: responsibility?.description || "",
            responsibility_type:
              responsibility?.responsibility_type ||
              responsibility?.type ||
              "position",
            quantity_needed:
              Number(
                responsibility?.quantity_needed || responsibility?.quantity,
              ) || 1,
            approval_required: Boolean(
              responsibility?.approval_required,
            ),
            substitution_allowed:
              responsibility?.substitution_allowed !== false,
            is_required: responsibility?.is_required !== false,
            required_ministry_level_id: null,
            required_level_name: null,
            required_level_rank: null,
            required_qualification:
              responsibility?.required_qualification || "",
            relative_start_minutes:
              Number(responsibility?.relative_start_minutes) || 0,
            instructions: responsibility?.instructions || "",
            sort_order: index,
          }
        })
        .filter(Boolean)
    }
    return {
      id: template.id,
      coordinatorMinistryId: template.coordinator_ministry_id,
      coordinatorMinistryName: template.coordinator_ministry_name,
      name: template.name,
      description: template.description,
      participationType: template.participation_type,
      status: template.status,
      version: Number(template.version),
      updatedAt: template.updated_at,
      ministries: ministries.map((block) => ({
        id: block.id,
        ministryId: block.ministry_id,
        ministryName: block.ministry_name,
        isRequired: block.is_required,
        instructions: block.instructions || "",
        sortOrder: Number(block.sort_order),
      })),
      responsibilities: responsibilities.map((responsibility) => ({
        id: responsibility.id,
        ministryId: responsibility.ministry_id,
        name: responsibility.name,
        description: responsibility.description || "",
        responsibilityType: responsibility.responsibility_type,
        quantityNeeded: Number(responsibility.quantity_needed),
        approvalRequired: responsibility.approval_required,
        substitutionAllowed: responsibility.substitution_allowed !== false,
        isRequired: responsibility.is_required,
        requiredLevelId:
          responsibility.required_ministry_level_id || "",
        requiredLevelName: responsibility.required_level_name || "",
        requiredLevelRank:
          Number(responsibility.required_level_rank) || null,
        requiredQualification:
          responsibility.required_qualification || "",
        relativeStartMinutes: Number(
          responsibility.relative_start_minutes,
        ),
        instructions: responsibility.instructions || "",
        sortOrder: Number(responsibility.sort_order),
      })),
      responsibilityCount: responsibilities.length,
    }
  })
}

const ensureMinistriesExist = async (
  client: PoolClient,
  ministryIds: string[],
) => {
  const result = await client.query(
    `
      SELECT id
      FROM ministries
      WHERE id = ANY($1::UUID[])
        AND status = 'active'
    `,
    [ministryIds],
  )
  if (result.rowCount !== new Set(ministryIds).size) {
    throw Object.assign(
      new Error("One or more participating ministries are unavailable"),
      { status: 400 },
    )
  }
}

const ensureResponsibilityLevelsExist = async (
  client: PoolClient,
  responsibilities: ResponsibilityInput[],
) => {
  const selected = responsibilities.filter(
    (responsibility) => responsibility.requiredLevelId,
  )
  if (!selected.length) return

  const levelIds = Array.from(
    new Set(selected.map((responsibility) => responsibility.requiredLevelId)),
  )
  const result = await client.query(
    `
      SELECT id, ministry_id
      FROM ministry_levels
      WHERE id = ANY($1::UUID[])
        AND status = 'active'
    `,
    [levelIds],
  )
  const ministryByLevel = new Map(
    result.rows.map((level) => [level.id, level.ministry_id]),
  )
  if (
    selected.some(
      (responsibility) =>
        ministryByLevel.get(responsibility.requiredLevelId) !==
        responsibility.ministryId,
    )
  ) {
    throw Object.assign(
      new Error("Every required level must belong to its responsibility ministry"),
      { status: 400 },
    )
  }
}

const insertTemplateStructure = async (
  client: PoolClient,
  templateId: string,
  input: TemplateInput,
) => {
  const blockIds = new Map<string, string>()
  for (const block of input.ministries || []) {
    const result = await client.query(
      `
        INSERT INTO template_ministries (
          template_id,
          ministry_id,
          is_required,
          instructions,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        templateId,
        block.ministryId,
        block.isRequired !== false,
        block.instructions || null,
        block.sortOrder || 0,
      ],
    )
    blockIds.set(block.ministryId, result.rows[0].id)
  }

  for (const responsibility of input.responsibilities || []) {
    await client.query(
      `
        INSERT INTO template_responsibilities (
          template_id,
          template_ministry_id,
          name,
          description,
          responsibility_type,
          quantity_needed,
          approval_required,
          substitution_allowed,
          is_required,
          required_ministry_level_id,
          required_qualification,
          relative_start_minutes,
          instructions,
          sort_order
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
      `,
      [
        templateId,
        blockIds.get(responsibility.ministryId),
        responsibility.name,
        responsibility.description || null,
        responsibility.responsibilityType || "position",
        responsibility.quantityNeeded || 1,
        Boolean(responsibility.approvalRequired),
        responsibility.substitutionAllowed !== false,
        responsibility.isRequired !== false,
        responsibility.requiredLevelId || null,
        responsibility.requiredQualification || null,
        responsibility.relativeStartMinutes || 0,
        responsibility.instructions || null,
        responsibility.sortOrder || 0,
      ],
    )
  }
}

const createTemplate = async (
  client: PoolClient,
  context: any,
  input: TemplateInput,
) => {
  validateTemplateInput(input)
  await requireMinistryAccess(
    client,
    context.user,
    input.coordinatorMinistryId,
    true,
  )
  await ensureMinistriesExist(
    client,
    input.ministries!.map((block) => block.ministryId),
  )
  await ensureResponsibilityLevelsExist(
    client,
    input.responsibilities || [],
  )

  const templateResult = await client.query(
    `
      INSERT INTO templates (
        ministry_id,
        name,
        description,
        participation_type,
        responsibilities,
        status,
        version,
        created_by
      )
      VALUES ($1, $2, $3, $4, '[]'::JSONB, 'active', 1, $5)
      RETURNING id, version
    `,
    [
      input.coordinatorMinistryId,
      input.name,
      input.description || null,
      input.participationType,
      context.user.id,
    ],
  )
  const template = templateResult.rows[0]
  await insertTemplateStructure(client, template.id, input)
  await client.query(
    `
      INSERT INTO template_versions (
        template_id,
        version,
        snapshot,
        created_by
      )
      VALUES ($1, $2, $3::JSONB, $4)
    `,
    [template.id, template.version, JSON.stringify(input), context.user.id],
  )
  await writeSchedulingAudit(client, context, {
    action: "template.created",
    entityType: "template",
    entityId: template.id,
    ministryId: input.coordinatorMinistryId,
    afterData: input,
  })
  return template
}

const updateTemplate = async (
  client: PoolClient,
  context: any,
  templateId: string,
  input: TemplateInput,
) => {
  validateTemplateInput(input)
  const existingResult = await client.query(
    `
      SELECT id, ministry_id, name, description, participation_type, status, version
      FROM templates
      WHERE id = $1
      FOR UPDATE
    `,
    [templateId],
  )
  const existing = existingResult.rows[0]
  if (!existing) {
    throw Object.assign(new Error("Template not found"), { status: 404 })
  }
  await requireMinistryAccess(client, context.user, existing.ministry_id, true)
  await requireMinistryAccess(
    client,
    context.user,
    input.coordinatorMinistryId,
    true,
  )
  await ensureMinistriesExist(
    client,
    input.ministries!.map((block) => block.ministryId),
  )
  await ensureResponsibilityLevelsExist(
    client,
    input.responsibilities || [],
  )

  const nextVersion = Number(existing.version) + 1
  await client.query(
    `
      UPDATE templates
      SET ministry_id = $2,
          name = $3,
          description = $4,
          participation_type = $5,
          responsibilities = '[]'::JSONB,
          version = $6,
          updated_at = now()
      WHERE id = $1
    `,
    [
      templateId,
      input.coordinatorMinistryId,
      input.name,
      input.description || null,
      input.participationType,
      nextVersion,
    ],
  )
  await client.query(
    `DELETE FROM template_ministries WHERE template_id = $1`,
    [templateId],
  )
  await insertTemplateStructure(client, templateId, input)
  await client.query(
    `
      INSERT INTO template_versions (
        template_id,
        version,
        snapshot,
        created_by
      )
      VALUES ($1, $2, $3::JSONB, $4)
    `,
    [templateId, nextVersion, JSON.stringify(input), context.user.id],
  )
  await writeSchedulingAudit(client, context, {
    action: "template.updated",
    entityType: "template",
    entityId: templateId,
    ministryId: input.coordinatorMinistryId,
    beforeData: existing,
    afterData: { ...input, version: nextVersion },
  })
  return { id: templateId, version: nextVersion }
}

const setTemplateStatus = async (
  client: PoolClient,
  context: any,
  templateId: string,
  status: string,
) => {
  if (!["active", "inactive", "archived"].includes(status)) {
    throw Object.assign(new Error("Invalid template status"), { status: 400 })
  }
  const result = await client.query(
    `
      SELECT id, ministry_id, status
      FROM templates
      WHERE id = $1
      FOR UPDATE
    `,
    [templateId],
  )
  const template = result.rows[0]
  if (!template) {
    throw Object.assign(new Error("Template not found"), { status: 404 })
  }
  await requireMinistryAccess(client, context.user, template.ministry_id, true)
  await client.query(
    `UPDATE templates SET status = $2, updated_at = now() WHERE id = $1`,
    [templateId, status],
  )
  await writeSchedulingAudit(client, context, {
    action: `template.${status}`,
    entityType: "template",
    entityId: templateId,
    ministryId: template.ministry_id,
    beforeData: { status: template.status },
    afterData: { status },
  })
}

export const handleTemplates = async (request: Request) => {
  const client = await getPool().connect()
  try {
    const context = await getIdentityContext(client, request)
    const url = new URL(request.url)
    const body =
      request.method === "GET" ? null : await request.json().catch(() => ({}))
    const ministryId =
      url.searchParams.get("ministryId") || body?.coordinatorMinistryId

    if (request.method === "GET") {
      if (!ministryId) return json({ message: "Ministry is required" }, 400)
      await requireMinistryAccess(client, context.user, ministryId, true)
      const [loadedTemplates, ministries, levels] = await Promise.all([
        loadTemplates(client, ministryId),
        loadAvailableMinistries(client),
        loadAvailableLevels(client),
      ])
      const templates = await Promise.all(
        loadedTemplates.map(async (template) => ({
          ...template,
          canEdit: (
            await getMinistryAccess(
              client,
              context.user,
              template.coordinatorMinistryId,
            )
          ).canManage,
        })),
      )
      return json({ templates, ministries, levels, canManage: true })
    }

    if (request.method === "POST") {
      await client.query("BEGIN")
      try {
        const input = normalizeTemplateInput(body)
        if (body.action === "duplicate") {
          input.name = cleanText(body.name, 250) || `${input.name} Copy`
        }
        const created = await createTemplate(client, context, input)
        await client.query("COMMIT")
        return json(
          { message: "Template created", templateId: created.id },
          201,
        )
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    }

    if (request.method === "PATCH") {
      const templateId = cleanText(body.templateId, 100)
      if (!templateId) return json({ message: "Template is required" }, 400)
      await client.query("BEGIN")
      try {
        if (body.action === "set_status") {
          await setTemplateStatus(
            client,
            context,
            templateId,
            cleanText(body.status, 30),
          )
        } else {
          await updateTemplate(
            client,
            context,
            templateId,
            normalizeTemplateInput(body),
          )
        }
        await client.query("COMMIT")
        return json({ message: "Template updated", templateId })
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    }

    return json({ message: "Method not allowed" }, 405)
  } catch (error: any) {
    const status = error?.status || (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    if (status === 500) console.error("Unable to manage templates:", error)
    return json({ message: error?.message || "Unable to manage templates" }, status)
  } finally {
    client.release()
  }
}
