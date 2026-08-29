import type { PoolClient } from "pg"
import { createHash } from "node:crypto"
import { getPool } from "../database"
import { json } from "../request"
import {
  getIdentityContext,
  getMinistryAccess,
  requireMinistryAccess,
  writeSchedulingAudit,
} from "./authorization"
import { updateEvent } from "./events"
import { sendTemplateAssignmentCancellationNotifications } from "../notifications/assignment-notifications"

const RESPONSIBILITY_TYPES = new Set(["position", "food", "task", "time_slot"])

type MinistryBlockInput = {
  ministryId: string
  isRequired?: boolean
  instructions?: string
  sortOrder?: number
  groupIds?: string[]
}

type ResponsibilityInput = {
  id?: string
  ministryId: string
  name: string
  description?: string
  responsibilityType?: string
  assignmentMode?: "standard" | "all_available_members"
  quantityNeeded?: number
  approvalRequired?: boolean
  substitutionAllowed?: boolean
  isRequired?: boolean
  requiredLevelId?: string
  requiredGroupId?: string
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

const normalizeResponsibilities = (
  value: unknown,
  forcedMinistryId = "",
): ResponsibilityInput[] =>
  (Array.isArray(value) ? value : [])
    .map((responsibility: any, index: number) => {
      const assignmentMode: ResponsibilityInput["assignmentMode"] =
        responsibility.assignmentMode === "all_available_members"
          ? "all_available_members"
          : "standard"
      return {
        id:
          cleanText(responsibility.id || responsibility.clientId, 100) ||
          undefined,
        ministryId:
          forcedMinistryId || cleanText(responsibility.ministryId, 100),
        name:
          assignmentMode === "all_available_members"
            ? "Expected ministry attendance"
            : cleanText(responsibility.name, 250),
        description: cleanText(responsibility.description),
        responsibilityType: RESPONSIBILITY_TYPES.has(
          responsibility.responsibilityType,
        )
          ? responsibility.responsibilityType
          : "position",
        assignmentMode,
        quantityNeeded:
          assignmentMode === "all_available_members"
            ? 1
            : positiveInteger(responsibility.quantityNeeded),
        approvalRequired: Boolean(responsibility.approvalRequired),
        substitutionAllowed:
          assignmentMode === "all_available_members"
            ? false
            : responsibility.substitutionAllowed !== false,
        isRequired:
          assignmentMode === "all_available_members"
            ? false
            : responsibility.isRequired !== false,
        requiredLevelId:
          cleanText(responsibility.requiredLevelId, 100) || undefined,
        requiredGroupId:
          cleanText(responsibility.requiredGroupId, 100) || undefined,
        relativeStartMinutes: integer(responsibility.relativeStartMinutes),
        instructions: cleanText(responsibility.instructions),
        sortOrder: integer(responsibility.sortOrder, index),
      }
    })
    .filter(
      (responsibility: ResponsibilityInput) =>
        responsibility.ministryId && responsibility.name,
    )

const normalizeTemplateInput = (body: any): TemplateInput => {
  const coordinatorMinistryId = cleanText(body.coordinatorMinistryId, 100)
  const blocks = Array.isArray(body.ministries) ? body.ministries : []
  const normalizedBlocks: MinistryBlockInput[] = blocks
    .map((block: any, index: number) => ({
      ministryId: cleanText(block.ministryId, 100),
      isRequired: block.isRequired !== false,
      instructions: cleanText(block.instructions),
      sortOrder: integer(block.sortOrder, index),
      groupIds: Array.isArray(block.groupIds)
        ? [...new Set(block.groupIds.map((id: unknown) => cleanText(id, 100)).filter(Boolean))]
        : [],
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

  const responsibilities = normalizeResponsibilities(body.responsibilities)

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

const hasTemplateGroupSchema = async (client: PoolClient) => {
  const result = await client.query(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'template_responsibilities'
            AND column_name = 'required_group_id'
        )
        AND to_regclass(current_schema() || '.template_ministry_groups') IS NOT NULL
          AS is_available
    `,
  )
  return Boolean(result.rows[0]?.is_available)
}

const loadAvailableMinistries = async (client: PoolClient) => {
  const supportsGroups = await hasTemplateGroupSchema(client)
  const result = await client.query(
    supportsGroups
      ? `
      SELECT ministry.id, ministry.name, ministry.slug, ministry.description,
        COALESCE(json_agg(json_build_object('id', ministry_group.id, 'name', ministry_group.name)
          ORDER BY ministry_group.sort_order, ministry_group.name)
          FILTER (WHERE ministry_group.id IS NOT NULL), '[]'::JSON) AS groups
      FROM ministries ministry
      LEFT JOIN ministry_groups ministry_group ON ministry_group.ministry_id = ministry.id AND ministry_group.status = 'active'
      WHERE ministry.status = 'active'
        AND lower(COALESCE(ministry.slug, '')) NOT IN ('ceremony', 'sacred-music', 'choir')
        AND lower(ministry.name) NOT IN ('ceremony', 'sacred music', 'choir')
      GROUP BY ministry.id, ministry.name, ministry.slug, ministry.description
      ORDER BY lower(ministry.name)
    `
      : `
      SELECT ministry.id, ministry.name, ministry.slug, ministry.description,
        '[]'::JSON AS groups
      FROM ministries ministry
      WHERE ministry.status = 'active'
        AND lower(COALESCE(ministry.slug, '')) NOT IN ('ceremony', 'sacred-music', 'choir')
        AND lower(ministry.name) NOT IN ('ceremony', 'sacred music', 'choir')
      ORDER BY lower(ministry.name)
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
  const supportsGroups = await hasTemplateGroupSchema(client)
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
  const [blockResult, blockGroupResult, responsibilityResult] = await Promise.all([
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
    supportsGroups
      ? client.query(
          `SELECT scoped.template_ministry_id, scoped.group_id FROM template_ministry_groups scoped JOIN template_ministries block ON block.id = scoped.template_ministry_id WHERE block.template_id = ANY($1::UUID[])`,
          [ids],
        )
      : Promise.resolve({ rows: [] }),
    client.query(
      supportsGroups
        ? `
        SELECT
          responsibility.id,
          responsibility.template_id,
          block.ministry_id,
          responsibility.name,
          responsibility.description,
          responsibility.responsibility_type,
          responsibility.assignment_mode,
          responsibility.quantity_needed,
          responsibility.approval_required,
          responsibility.substitution_allowed,
          responsibility.is_required,
          responsibility.required_ministry_level_id,
          responsibility.required_group_id,
          required_group.name AS required_group_name,
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
        LEFT JOIN ministry_groups required_group ON required_group.id = responsibility.required_group_id
        WHERE responsibility.template_id = ANY($1::UUID[])
          AND responsibility.status = 'active'
        ORDER BY responsibility.sort_order, lower(responsibility.name)
      `
        : `
        SELECT
          responsibility.id,
          responsibility.template_id,
          block.ministry_id,
          responsibility.name,
          responsibility.description,
          responsibility.responsibility_type,
          responsibility.assignment_mode,
          responsibility.quantity_needed,
          responsibility.approval_required,
          responsibility.substitution_allowed,
          responsibility.is_required,
          responsibility.required_ministry_level_id,
          NULL::UUID AS required_group_id,
          NULL::STRING AS required_group_name,
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
            assignment_mode: "standard",
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
        groupIds: blockGroupResult.rows.filter((row) => row.template_ministry_id === block.id).map((row) => row.group_id),
      })),
      responsibilities: responsibilities.map((responsibility) => ({
        id: responsibility.id,
        ministryId: responsibility.ministry_id,
        name: responsibility.name,
        description: responsibility.description || "",
        responsibilityType: responsibility.responsibility_type,
        assignmentMode: responsibility.assignment_mode || "standard",
        quantityNeeded: Number(responsibility.quantity_needed),
        approvalRequired: responsibility.approval_required,
        substitutionAllowed: responsibility.substitution_allowed !== false,
        isRequired: responsibility.is_required,
        requiredLevelId:
          responsibility.required_ministry_level_id || "",
        requiredLevelName: responsibility.required_level_name || "",
        requiredLevelRank:
          Number(responsibility.required_level_rank) || null,
        requiredGroupId: responsibility.required_group_id || "",
        requiredGroupName: responsibility.required_group_name || "",
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

const ensureGroupsAreValid = async (
  client: PoolClient,
  responsibilities: ResponsibilityInput[],
  blocks: MinistryBlockInput[] = [],
) => {
  const restricted = responsibilities.filter((responsibility) => responsibility.requiredGroupId)
  if (!restricted.length) return
  const result = await client.query(
    `SELECT id, ministry_id FROM ministry_groups WHERE id = ANY($1::UUID[]) AND status = 'active'`,
    [restricted.map((responsibility) => responsibility.requiredGroupId)],
  )
  const ministryByGroup = new Map(result.rows.map((group) => [group.id, group.ministry_id]))
  if (restricted.some((responsibility) => ministryByGroup.get(responsibility.requiredGroupId) !== responsibility.ministryId)) {
    throw Object.assign(new Error("Every required group must belong to its responsibility ministry"), { status: 400 })
  }
  const scoped = blocks.flatMap((block) => (block.groupIds || []).map((groupId) => ({ groupId, ministryId: block.ministryId })))
  if (scoped.length) {
    const scopedResult = await client.query(`SELECT id, ministry_id FROM ministry_groups WHERE id = ANY($1::UUID[]) AND status = 'active'`, [scoped.map((item) => item.groupId)])
    const scopedMinistry = new Map(scopedResult.rows.map((group) => [group.id, group.ministry_id]))
    if (scoped.some((item) => scopedMinistry.get(item.groupId) !== item.ministryId)) {
      throw Object.assign(new Error("Every selected group must belong to its participating ministry"), { status: 400 })
    }
  }
}

const insertTemplateResponsibility = async (
  client: PoolClient,
  supportsGroups: boolean,
  templateId: string,
  templateMinistryId: string,
  responsibility: ResponsibilityInput,
) => {
  const result = await client.query(
    supportsGroups
      ? `
        INSERT INTO template_responsibilities (
          template_id, template_ministry_id, name, description,
          responsibility_type, quantity_needed, approval_required,
          substitution_allowed, assignment_mode, is_required, required_ministry_level_id,
          required_group_id, relative_start_minutes, instructions, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `
      : `
        INSERT INTO template_responsibilities (
          template_id, template_ministry_id, name, description,
          responsibility_type, quantity_needed, approval_required,
          substitution_allowed, assignment_mode, is_required, required_ministry_level_id,
          relative_start_minutes, instructions, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `,
    supportsGroups
      ? [
          templateId,
          templateMinistryId,
          responsibility.name,
          responsibility.description || null,
          responsibility.responsibilityType || "position",
          responsibility.quantityNeeded || 1,
          Boolean(responsibility.approvalRequired),
          responsibility.substitutionAllowed !== false,
          responsibility.assignmentMode || "standard",
          responsibility.isRequired !== false,
          responsibility.requiredLevelId || null,
          responsibility.requiredGroupId || null,
          responsibility.relativeStartMinutes || 0,
          responsibility.instructions || null,
          responsibility.sortOrder || 0,
        ]
      : [
          templateId,
          templateMinistryId,
          responsibility.name,
          responsibility.description || null,
          responsibility.responsibilityType || "position",
          responsibility.quantityNeeded || 1,
          Boolean(responsibility.approvalRequired),
          responsibility.substitutionAllowed !== false,
          responsibility.assignmentMode || "standard",
          responsibility.isRequired !== false,
          responsibility.requiredLevelId || null,
          responsibility.relativeStartMinutes || 0,
          responsibility.instructions || null,
          responsibility.sortOrder || 0,
        ],
  )
  responsibility.id = result.rows[0].id
  return result.rows[0].id
}

const insertTemplateStructure = async (
  client: PoolClient,
  templateId: string,
  input: TemplateInput,
) => {
  const supportsGroups = await hasTemplateGroupSchema(client)
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
    if (supportsGroups) {
      for (const groupId of block.groupIds || []) {
        await client.query(`INSERT INTO template_ministry_groups (template_ministry_id, group_id) VALUES ($1, $2)`, [result.rows[0].id, groupId])
      }
    }
  }

  for (const responsibility of input.responsibilities || []) {
    const templateMinistryId = blockIds.get(responsibility.ministryId)
    if (!templateMinistryId) continue
    await insertTemplateResponsibility(
      client,
      supportsGroups,
      templateId,
      templateMinistryId,
      responsibility,
    )
  }
}

const syncTemplateStructure = async (
  client: PoolClient,
  templateId: string,
  input: TemplateInput,
  ministryScope: string | null = null,
) => {
  const supportsGroups = await hasTemplateGroupSchema(client)
  const existingBlocks = await client.query(
    `SELECT id, ministry_id FROM template_ministries WHERE template_id = $1 FOR UPDATE`,
    [templateId],
  )
  const blockIds = new Map(
    existingBlocks.rows.map((block) => [block.ministry_id, block.id]),
  )
  const blocks = (input.ministries || []).filter(
    (block) => !ministryScope || block.ministryId === ministryScope,
  )
  for (const block of blocks) {
    let blockId = blockIds.get(block.ministryId)
    if (blockId) {
      await client.query(
        `UPDATE template_ministries
         SET is_required = $3, instructions = $4, sort_order = $5,
             updated_at = now()
         WHERE template_id = $1 AND ministry_id = $2`,
        [
          templateId,
          block.ministryId,
          block.isRequired !== false,
          block.instructions || null,
          block.sortOrder || 0,
        ],
      )
    } else {
      const created = await client.query(
        `INSERT INTO template_ministries (
           template_id, ministry_id, is_required, instructions, sort_order
         ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          templateId,
          block.ministryId,
          block.isRequired !== false,
          block.instructions || null,
          block.sortOrder || 0,
        ],
      )
      blockId = created.rows[0].id
      blockIds.set(block.ministryId, blockId)
    }
    if (supportsGroups) {
      await client.query(
        `DELETE FROM template_ministry_groups WHERE template_ministry_id = $1`,
        [blockId],
      )
      for (const groupId of block.groupIds || []) {
        await client.query(
          `INSERT INTO template_ministry_groups (template_ministry_id, group_id) VALUES ($1, $2)`,
          [blockId, groupId],
        )
      }
    }
  }

  const existingResponsibilities = await client.query(
    `SELECT responsibility.id, block.ministry_id
     FROM template_responsibilities responsibility
     JOIN template_ministries block ON block.id = responsibility.template_ministry_id
     WHERE responsibility.template_id = $1
       AND ($2::UUID IS NULL OR block.ministry_id = $2)
     FOR UPDATE`,
    [templateId, ministryScope],
  )
  const existingById = new Map(
    existingResponsibilities.rows.map((responsibility) => [
      responsibility.id,
      responsibility,
    ]),
  )
  const retainedIds: string[] = []
  const responsibilities = (input.responsibilities || []).filter(
    (responsibility) =>
      !ministryScope || responsibility.ministryId === ministryScope,
  )
  for (const responsibility of responsibilities) {
    const templateMinistryId = blockIds.get(responsibility.ministryId)
    if (!templateMinistryId) continue
    const existing = responsibility.id
      ? existingById.get(responsibility.id)
      : null
    if (!existing) {
      responsibility.id = await insertTemplateResponsibility(
        client,
        supportsGroups,
        templateId,
        templateMinistryId,
        responsibility,
      )
    } else {
      await client.query(
        supportsGroups
          ? `UPDATE template_responsibilities
             SET template_ministry_id = $2, name = $3, description = $4,
                 responsibility_type = $5, quantity_needed = $6,
                 approval_required = $7, substitution_allowed = $8,
                 assignment_mode = $9, is_required = $10,
                 required_ministry_level_id = $11, required_group_id = $12,
                 relative_start_minutes = $13, instructions = $14,
                 sort_order = $15, updated_at = now()
             WHERE id = $1`
          : `UPDATE template_responsibilities
             SET template_ministry_id = $2, name = $3, description = $4,
                 responsibility_type = $5, quantity_needed = $6,
                 approval_required = $7, substitution_allowed = $8,
                 assignment_mode = $9, is_required = $10,
                 required_ministry_level_id = $11,
                 relative_start_minutes = $12, instructions = $13,
                 sort_order = $14, updated_at = now()
             WHERE id = $1`,
        supportsGroups
          ? [
              responsibility.id,
              templateMinistryId,
              responsibility.name,
              responsibility.description || null,
              responsibility.responsibilityType || "position",
              responsibility.quantityNeeded || 1,
              Boolean(responsibility.approvalRequired),
              responsibility.substitutionAllowed !== false,
              responsibility.assignmentMode || "standard",
              responsibility.isRequired !== false,
              responsibility.requiredLevelId || null,
              responsibility.requiredGroupId || null,
              responsibility.relativeStartMinutes || 0,
              responsibility.instructions || null,
              responsibility.sortOrder || 0,
            ]
          : [
              responsibility.id,
              templateMinistryId,
              responsibility.name,
              responsibility.description || null,
              responsibility.responsibilityType || "position",
              responsibility.quantityNeeded || 1,
              Boolean(responsibility.approvalRequired),
              responsibility.substitutionAllowed !== false,
              responsibility.assignmentMode || "standard",
              responsibility.isRequired !== false,
              responsibility.requiredLevelId || null,
              responsibility.relativeStartMinutes || 0,
              responsibility.instructions || null,
              responsibility.sortOrder || 0,
            ],
      )
    }
    retainedIds.push(responsibility.id!)
  }
  await client.query(
    `DELETE FROM template_responsibilities
     WHERE template_id = $1
       AND ($2::UUID IS NULL OR template_ministry_id IN (
         SELECT id FROM template_ministries WHERE template_id = $1 AND ministry_id = $2
       ))
       AND NOT (id = ANY($3::UUID[]))`,
    [templateId, ministryScope, retainedIds],
  )
  if (!ministryScope) {
    const retainedMinistryIds = (input.ministries || []).map(
      (block) => block.ministryId,
    )
    await client.query(
      `DELETE FROM template_ministries
       WHERE template_id = $1 AND NOT (ministry_id = ANY($2::UUID[]))`,
      [templateId, retainedMinistryIds],
    )
  }
}

type TemplatePropagationImpact = {
  fingerprint: string
  affectedEventCount: number
  removedPositionCount: number
  cancelledAssignmentCount: number
  removedPositions: Array<{
    eventId: string
    eventTitle: string
    eventStartTime: string
    responsibilityId: string
    responsibilityName: string
    reason: "removed" | "assignment_mode_changed"
    assignments: Array<{
      assignmentId: string
      userId: string
      memberName: string
    }>
  }>
}

const previewTemplatePropagation = async (
  client: PoolClient,
  templateId: string,
  input: TemplateInput,
  ministryScope: string | null = null,
  lockEvents = false,
): Promise<TemplatePropagationImpact> => {
  const events = await client.query(
    `SELECT id FROM events
     WHERE template_id = $1
       AND start_time > now()
       AND status IN ('draft', 'published')
     ${lockEvents ? "FOR UPDATE" : ""}`,
    [templateId],
  )
  const rows = await client.query(
    `SELECT event.id AS event_id, event.title AS event_title,
       event.start_time AS event_start_time,
       responsibility.id AS responsibility_id,
       responsibility.template_responsibility_id,
       responsibility.ministry_id,
       responsibility.name AS responsibility_name,
       responsibility.responsibility_type,
       responsibility.assignment_mode,
       responsibility.sort_order,
       assignment.id AS assignment_id,
       assignment.user_id,
       trim(concat(account.first_name, ' ', COALESCE(account.last_name, ''))) AS member_name
     FROM events event
     JOIN event_responsibilities responsibility
       ON responsibility.event_id = event.id
     LEFT JOIN responsibility_assignments assignment
       ON assignment.responsibility_id = responsibility.id
      AND assignment.status IN (
        'interested', 'pending', 'assigned', 'confirmed', 'change_requested'
      )
     LEFT JOIN ministry_accounts account ON account.id = assignment.user_id
     WHERE event.template_id = $1
       AND event.start_time > now()
       AND event.status IN ('draft', 'published')
       AND responsibility.status <> 'cancelled'
       AND responsibility.template_responsibility_id IS NOT NULL
       AND ($2::UUID IS NULL OR responsibility.ministry_id = $2)
     ORDER BY event.start_time, responsibility.sort_order, responsibility.id`,
    [templateId, ministryScope],
  )
  const proposed = (input.responsibilities || []).filter(
    (responsibility) =>
      !ministryScope || responsibility.ministryId === ministryScope,
  )
  const proposedById = new Map(
    proposed
      .filter((responsibility) => responsibility.id)
      .map((responsibility) => [responsibility.id, responsibility]),
  )
  const proposedByKey = new Map(
    proposed.map((responsibility) => [
      [
        responsibility.ministryId,
        responsibility.name.toLowerCase(),
        responsibility.responsibilityType || "position",
      ].join("|"),
      responsibility,
    ]),
  )
  const removedById = new Map<string, TemplatePropagationImpact["removedPositions"][number]>()
  for (const row of rows.rows) {
    const key = [
      row.ministry_id,
      String(row.responsibility_name || "").toLowerCase(),
      row.responsibility_type,
    ].join("|")
    const matching =
      proposedById.get(row.template_responsibility_id) ||
      proposedByKey.get(key)
    const nextAssignmentMode = matching?.assignmentMode || "standard"
    if (matching && nextAssignmentMode === row.assignment_mode) {
      continue
    }
    let removed = removedById.get(row.responsibility_id)
    if (!removed) {
      removed = {
        eventId: row.event_id,
        eventTitle: row.event_title,
        eventStartTime: row.event_start_time,
        responsibilityId: row.responsibility_id,
        responsibilityName: row.responsibility_name,
        reason: matching ? "assignment_mode_changed" : "removed",
        assignments: [],
      }
      removedById.set(row.responsibility_id, removed)
    }
    if (row.assignment_id) {
      removed.assignments.push({
        assignmentId: row.assignment_id,
        userId: row.user_id,
        memberName: row.member_name || "Ministry member",
      })
    }
  }
  const removedPositions = [...removedById.values()]
  const fingerprint = createHash("sha256")
    .update(
      removedPositions
        .flatMap((position) => [
          `position:${position.responsibilityId}:${position.reason}`,
          ...position.assignments.map(
            (assignment) => `assignment:${assignment.assignmentId}`,
          ),
        ])
        .sort()
        .join("|"),
    )
    .digest("hex")
  return {
    fingerprint,
    affectedEventCount: events.rowCount || 0,
    removedPositionCount: removedPositions.length,
    cancelledAssignmentCount: removedPositions.reduce(
      (count, position) => count + position.assignments.length,
      0,
    ),
    removedPositions,
  }
}

const propagateTemplateToFutureEvents = async (
  client: PoolClient,
  context: any,
  templateId: string,
) => {
  const futureEvents = await client.query(
    `SELECT id FROM events
     WHERE template_id = $1
       AND start_time > now()
       AND status IN ('draft', 'published')
     ORDER BY start_time, id
     FOR UPDATE`,
    [templateId],
  )
  const cancelledAssignmentIds: string[] = []
  let removedPositionCount = 0
  for (const event of futureEvents.rows) {
    const result: any = await updateEvent(
      client,
      context,
      {
        action: "replace_template",
        eventId: event.id,
        templateId,
        updateScope: "this_event",
      },
      { templatePropagation: true },
    )
    cancelledAssignmentIds.push(...(result?.cancelledAssignmentIds || []))
    removedPositionCount += Number(result?.removedPositionCount || 0)
  }
  return {
    affectedEventCount: futureEvents.rowCount || 0,
    removedPositionCount,
    cancelledAssignmentIds,
    cancelledAssignmentCount: cancelledAssignmentIds.length,
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
  await ensureGroupsAreValid(client, input.responsibilities || [], input.ministries || [])

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
  await ensureGroupsAreValid(client, input.responsibilities || [], input.ministries || [])

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
  await syncTemplateStructure(client, templateId, input)
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

const updateTemplateMinistryBlock = async (
  client: PoolClient,
  context: any,
  templateId: string,
  body: any,
) => {
  const ministryId = cleanText(body.ministryId, 100)
  if (!ministryId) {
    throw Object.assign(new Error("Ministry is required"), { status: 400 })
  }
  await requireMinistryAccess(client, context.user, ministryId, true)

  const blockResult = await client.query(
    `
      SELECT
        block.id,
        block.is_required,
        block.instructions,
        block.sort_order,
        template.ministry_id AS coordinator_ministry_id,
        template.version
      FROM template_ministries block
      JOIN templates template ON template.id = block.template_id
      WHERE block.template_id = $1
        AND block.ministry_id = $2
        AND template.status = 'active'
      FOR UPDATE
    `,
    [templateId, ministryId],
  )
  const existing = blockResult.rows[0]
  if (!existing) {
    throw Object.assign(
      new Error("This ministry is not connected to the template"),
      { status: 404 },
    )
  }

  const blockBody = body.block || {}
  const block: MinistryBlockInput = {
    ministryId,
    isRequired: blockBody.isRequired !== false,
    instructions: cleanText(blockBody.instructions),
    sortOrder: Number(existing.sort_order) || 0,
    groupIds: Array.isArray(blockBody.groupIds)
      ? Array.from(
          new Set<string>(
            blockBody.groupIds
              .map((id: unknown) => cleanText(id, 100))
              .filter(Boolean) as string[],
          ),
        )
      : [],
  }
  const responsibilities = normalizeResponsibilities(
    body.responsibilities,
    ministryId,
  )
  await ensureResponsibilityLevelsExist(client, responsibilities)
  await ensureGroupsAreValid(client, responsibilities, [block])

  await syncTemplateStructure(
    client,
    templateId,
    { ministries: [block], responsibilities } as TemplateInput,
    ministryId,
  )

  const nextVersion = Number(existing.version) + 1
  const snapshot = {
    action: "ministry_block_updated",
    ministryId,
    block,
    responsibilities,
  }
  await client.query(
    `
      UPDATE templates
      SET responsibilities = '[]'::JSONB,
          version = $2,
          updated_at = now()
      WHERE id = $1
    `,
    [templateId, nextVersion],
  )
  await client.query(
    `
      INSERT INTO template_versions (template_id, version, snapshot, created_by)
      VALUES ($1, $2, $3::JSONB, $4)
    `,
    [templateId, nextVersion, JSON.stringify(snapshot), context.user.id],
  )
  await writeSchedulingAudit(client, context, {
    action: "template.ministry_block_updated",
    entityType: "template",
    entityId: templateId,
    ministryId,
    beforeData: existing,
    afterData: { ...snapshot, version: nextVersion },
    metadata: { coordinatorMinistryId: existing.coordinator_ministry_id },
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

const normalizeTemplateUpdateProposal = (body: any) => {
  const ministryScope = cleanText(body.ministryId, 100) || null
  if (!ministryScope) {
    return {
      input: normalizeTemplateInput(body),
      ministryScope: null,
    }
  }
  const blockBody = body.block || {}
  return {
    input: {
      ministries: [
        {
          ministryId: ministryScope,
          isRequired: blockBody.isRequired !== false,
          instructions: cleanText(blockBody.instructions),
          groupIds: Array.isArray(blockBody.groupIds)
            ? blockBody.groupIds
                .map((id: unknown) => cleanText(id, 100))
                .filter(Boolean)
            : [],
        },
      ],
      responsibilities: normalizeResponsibilities(
        body.responsibilities,
        ministryScope,
      ),
    } as TemplateInput,
    ministryScope,
  }
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
        loadedTemplates.map(async (template) => {
          const coordinatorAccess = await getMinistryAccess(
            client,
            context.user,
            template.coordinatorMinistryId,
          )
          const blockAccess = await Promise.all(
            template.ministries.map(async (block: any) => ({
              ministryId: block.ministryId,
              canManage: (
                await getMinistryAccess(
                  client,
                  context.user,
                  block.ministryId,
                )
              ).canManage,
            })),
          )
          const editableMinistryIds = blockAccess
            .filter((access) => access.canManage)
            .map((access) => access.ministryId)
          return {
            ...template,
            canEditTemplate: coordinatorAccess.canManage,
            editableMinistryIds,
            canEdit:
              coordinatorAccess.canManage || editableMinistryIds.length > 0,
          }
        }),
      )
      return json({ templates, ministries, levels, canManage: true })
    }

    if (request.method === "POST") {
      await client.query("BEGIN")
      try {
        if (body.action === "preview_update") {
          const templateId = cleanText(body.templateId, 100)
          if (!templateId) {
            throw Object.assign(new Error("Template is required"), {
              status: 400,
            })
          }
          const { input, ministryScope } =
            normalizeTemplateUpdateProposal(body)
          const template = await client.query(
            `SELECT ministry_id FROM templates WHERE id = $1`,
            [templateId],
          )
          if (!template.rowCount) {
            throw Object.assign(new Error("Template not found"), {
              status: 404,
            })
          }
          await requireMinistryAccess(
            client,
            context.user,
            ministryScope || template.rows[0].ministry_id,
            true,
          )
          const impact = await previewTemplatePropagation(
            client,
            templateId,
            input,
            ministryScope,
            true,
          )
          await client.query("COMMIT")
          return json(impact)
        }
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
        let propagation: any = null
        if (body.action === "set_status") {
          await setTemplateStatus(
            client,
            context,
            templateId,
            cleanText(body.status, 30),
          )
        } else if (body.action === "update_ministry_block") {
          const { input, ministryScope } =
            normalizeTemplateUpdateProposal(body)
          const impact = await previewTemplatePropagation(
            client,
            templateId,
            input,
            ministryScope,
            true,
          )
          if (
            impact.cancelledAssignmentCount > 0 &&
            (body.confirmAssignmentCancellations !== true ||
              body.confirmedTemplateImpact !== impact.fingerprint)
          ) {
            throw Object.assign(
              new Error(
                "Confirm the assigned positions that will be removed",
              ),
              { status: 409, templateImpact: impact },
            )
          }
          await updateTemplateMinistryBlock(
            client,
            context,
            templateId,
            body,
          )
          propagation = await propagateTemplateToFutureEvents(
            client,
            context,
            templateId,
          )
        } else {
          const input = normalizeTemplateInput(body)
          const impact = await previewTemplatePropagation(
            client,
            templateId,
            input,
            null,
            true,
          )
          if (
            impact.cancelledAssignmentCount > 0 &&
            (body.confirmAssignmentCancellations !== true ||
              body.confirmedTemplateImpact !== impact.fingerprint)
          ) {
            throw Object.assign(
              new Error(
                "Confirm the assigned positions that will be removed",
              ),
              { status: 409, templateImpact: impact },
            )
          }
          await updateTemplate(
            client,
            context,
            templateId,
            input,
          )
          propagation = await propagateTemplateToFutureEvents(
            client,
            context,
            templateId,
          )
        }
        await client.query("COMMIT")
        if (propagation?.cancelledAssignmentIds?.length) {
          await sendTemplateAssignmentCancellationNotifications(
            propagation.cancelledAssignmentIds,
            templateId,
            request.url,
          ).catch((notificationError) => {
            console.error(
              "Template updated but cancellation notifications could not be prepared:",
              notificationError,
            )
          })
        }
        return json({
          message: "Template updated",
          templateId,
          affectedEventCount: propagation?.affectedEventCount || 0,
          removedPositionCount: propagation?.removedPositionCount || 0,
          cancelledAssignmentCount:
            propagation?.cancelledAssignmentCount || 0,
        })
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    }

    return json({ message: "Method not allowed" }, 405)
  } catch (error: any) {
    const status = error?.status || (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    if (status === 500) console.error("Unable to manage templates:", error)
    return json(
      {
        message: error?.message || "Unable to manage templates",
        ...(error?.templateImpact
          ? { templateImpact: error.templateImpact }
          : {}),
      },
      status,
    )
  } finally {
    client.release()
  }
}
