import crypto from "node:crypto"

export const MASS_SCHEDULE_SOURCE = "mylatinmass.mass_schedule"
export const DEFAULT_TIME_ZONE = "America/New_York"
export const DEFAULT_LOCATION =
  "Our Lady of Victory Church, 4580 SW 65th Avenue, Davie, FL 33314"

const SYSTEM_TEMPLATE_KEYS = {
  low_mass: "mass-schedule.low-mass",
  high_mass: "mass-schedule.high-mass",
}

const cleanText = (value, maximum = 5000) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : ""

const normalizeClock = (value) => {
  const match = cleanText(value, 30)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/)
  if (!match) throw new Error(`Unsupported Mass Schedule time: ${value}`)
  let hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new Error(`Invalid Mass Schedule time: ${value}`)
  }
  if (hour === 12) hour = 0
  if (match[3] === "pm") hour += 12
  return { hour, minute, key: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` }
}

const zonedParts = (instant, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  )
}

export const parseScheduleDateTime = (
  dayYMD,
  time,
  timeZone = DEFAULT_TIME_ZONE,
) => {
  const dateMatch = cleanText(dayYMD, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dateMatch) throw new Error(`Invalid Mass Schedule date: ${dayYMD}`)
  const { hour, minute, key } = normalizeClock(time)
  const desired = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour,
    minute,
    second: 0,
  }
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  )
  let candidate = desiredAsUtc
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timeZone)
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    )
    candidate -= actualAsUtc - desiredAsUtc
  }
  return { instant: new Date(candidate), timeKey: key }
}

export const classifyMassDescription = (description) => {
  const normalized = cleanText(description, 500).toLowerCase()
  if (!/\bmass\b/.test(normalized)) return null
  if (/\b(sung|high|solemn)\s+mass\b/.test(normalized)) {
    return "high_mass"
  }
  return "low_mass"
}

export const extractMassEvents = (
  payload,
  {
    location = DEFAULT_LOCATION,
    timeZone = DEFAULT_TIME_ZONE,
  } = {},
) => {
  if (!payload || !Array.isArray(payload.massDays)) {
    throw new Error("Mass Schedule response does not contain massDays")
  }
  const events = []
  let sourceRows = 0
  for (const day of payload.massDays) {
    if (!day?.dayYMD || !Array.isArray(day.masses)) continue
    for (const sourceEntry of day.masses) {
      sourceRows += 1
      const eventType = classifyMassDescription(sourceEntry?.description)
      if (!eventType) continue
      const { instant: start, timeKey } = parseScheduleDateTime(
        day.dayYMD,
        sourceEntry.time,
        timeZone,
      )
      const durationMinutes = eventType === "high_mass" ? 90 : 60
      const end = new Date(start.getTime() + durationMinutes * 60_000)
      events.push({
        sourceKey: `${day.dayYMD}|${timeKey}`,
        sourceDate: day.dayYMD,
        sourceTime: cleanText(sourceEntry.time, 30),
        eventType,
        title:
          cleanText(day.eventName, 250) ||
          cleanText(sourceEntry.description, 250) ||
          (eventType === "high_mass" ? "High Mass" : "Low Mass"),
        description:
          eventType === "high_mass"
            ? "Generated from the MyLatinMass Mass Schedule using the High Mass ministry template."
            : "Generated from the MyLatinMass Mass Schedule using the Low Mass ministry template.",
        location,
        start,
        end,
          sourcePayload: {
            dayYMD: day.dayYMD,
            day: day.day || null,
            eventName: day.eventName || null,
            dayTS: day.dayTS || null,
          time: sourceEntry.time || null,
          description: sourceEntry.description || null,
          skip: Boolean(sourceEntry.skip),
        },
      })
    }
  }
  const duplicates = events
    .map((event) => event.sourceKey)
    .filter((key, index, keys) => keys.indexOf(key) !== index)
  if (duplicates.length) {
    throw new Error(
      `Mass Schedule contains duplicate Mass date/time keys: ${Array.from(new Set(duplicates)).join(", ")}`,
    )
  }
  return { events, sourceRows, skippedRows: sourceRows - events.length }
}

export const buildMassTemplateDefinitions = ({
  sacristansMinistryId,
  altarServersMinistryId,
  ushersMinistryId,
}) => {
  const ministries = [
    {
      ministryId: sacristansMinistryId,
      isRequired: true,
      instructions: "Sacristan coverage is managed by the Sacristans ministry.",
      sortOrder: 0,
    },
    {
      ministryId: altarServersMinistryId,
      isRequired: true,
      instructions: "Server positions are managed by the Altar Servers ministry.",
      sortOrder: 1,
    },
    {
      ministryId: ushersMinistryId,
      isRequired: true,
      instructions: "At least one usher must be present for every Mass.",
      sortOrder: 2,
    },
  ]
  const responsibility = (
    ministryId,
    name,
    sortOrder,
    requiredLevelName = "",
  ) => ({
    ministryId,
    name,
    description: "",
    responsibilityType: "position",
    quantityNeeded: 1,
    approvalRequired: false,
    isRequired: true,
    requiredLevelName: requiredLevelName || name,
    requiredQualification: "",
    relativeStartMinutes: 0,
    instructions: "",
    sortOrder,
  })
  const shared = [
    responsibility(sacristansMinistryId, "Sacristan", 0),
    responsibility(altarServersMinistryId, "Acolyte 1", 10, "Acolyte 1"),
    responsibility(altarServersMinistryId, "Acolyte 2", 20, "Acolyte 2"),
  ]
  return {
    low_mass: {
      systemKey: SYSTEM_TEMPLATE_KEYS.low_mass,
      name: "Low Mass",
      description:
        "Source-managed base template: one Sacristan, two Acolytes, and at least one Usher.",
      coordinatorMinistryId: altarServersMinistryId,
      participationType: "members",
      ministries,
      responsibilities: [
        ...shared,
        responsibility(ushersMinistryId, "Usher", 100),
      ],
    },
    high_mass: {
      systemKey: SYSTEM_TEMPLATE_KEYS.high_mass,
      name: "High Mass",
      description:
        "Source-managed base template: the complete High Mass ceremonial team plus at least one Usher.",
      coordinatorMinistryId: altarServersMinistryId,
      participationType: "members",
      ministries,
      responsibilities: [
        ...shared,
        responsibility(
          altarServersMinistryId,
          "Master of Ceremonies",
          30,
        ),
        responsibility(altarServersMinistryId, "Thurifer", 40),
        responsibility(altarServersMinistryId, "Boat Bearer", 50),
        responsibility(altarServersMinistryId, "Cross Bearer", 60),
        responsibility(altarServersMinistryId, "Torchbearer 1", 70),
        responsibility(altarServersMinistryId, "Torchbearer 2", 80),
        responsibility(altarServersMinistryId, "Torchbearer 3", 90),
        responsibility(altarServersMinistryId, "Torchbearer 4", 100),
        responsibility(ushersMinistryId, "Usher", 200),
      ],
    },
  }
}

const definitionHash = (definition) =>
  crypto.createHash("sha256").update(JSON.stringify(definition)).digest("hex")

const ensureImportActor = async (client) => {
  const result = await client.query(
    `
      SELECT id
      FROM ministry_accounts
      WHERE status = 'active'
        AND global_role IN ('owner', 'super_admin')
      ORDER BY CASE global_role WHEN 'owner' THEN 0 ELSE 1 END, created_at
      LIMIT 1
    `,
  )
  if (!result.rowCount) {
    throw new Error(
      "Mass Schedule sync requires one active Owner or Super Admin to own imported records",
    )
  }
  return result.rows[0].id
}

const ensureMinistry = async (
  client,
  actorUserId,
  { slug, name, aliases, description },
) => {
  const lookup = Array.from(
    new Set([slug, name, ...(aliases || [])].map((value) => value.toLowerCase())),
  )
  const find = () =>
    client.query(
      `
        SELECT id, name, slug
        FROM ministries
        WHERE status = 'active'
          AND (
            lower(COALESCE(slug, '')) = ANY($1::STRING[])
            OR lower(name) = ANY($1::STRING[])
          )
        ORDER BY CASE WHEN lower(COALESCE(slug, '')) = $2 THEN 0 ELSE 1 END,
                 created_at
        LIMIT 1
      `,
      [lookup, slug.toLowerCase()],
    )
  let result = await find()
  if (result.rowCount) return result.rows[0]
  try {
    result = await client.query(
      `
        INSERT INTO ministries (
          name, slug, description, status, created_by
        )
        VALUES ($1, $2, $3, 'active', $4)
        RETURNING id, name, slug
      `,
      [name, slug, description, actorUserId],
    )
    return result.rows[0]
  } catch (error) {
    if (error?.code !== "23505") throw error
    result = await find()
    if (!result.rowCount) throw error
    return result.rows[0]
  }
}

const insertTemplateStructure = async (client, templateId, definition) => {
  const blockIds = new Map()
  for (const block of definition.ministries) {
    const result = await client.query(
      `
        INSERT INTO template_ministries (
          template_id, ministry_id, is_required, instructions, sort_order
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
  for (const item of definition.responsibilities) {
    await client.query(
      `
        INSERT INTO template_responsibilities (
          template_id, template_ministry_id, name, description,
          responsibility_type, quantity_needed, approval_required,
          is_required, required_ministry_level_id, required_qualification, relative_start_minutes,
          instructions, sort_order, status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          (
            SELECT level.id
            FROM ministry_levels level
            WHERE level.ministry_id = $13
              AND lower(level.name) = lower($14)
            LIMIT 1
          ),
          $9, $10, $11, $12, 'active'
        )
      `,
      [
        templateId,
        blockIds.get(item.ministryId),
        item.name,
        item.description || null,
        item.responsibilityType || "position",
        item.quantityNeeded || 1,
        Boolean(item.approvalRequired),
        item.isRequired !== false,
        item.requiredQualification || null,
        item.relativeStartMinutes || 0,
        item.instructions || null,
        item.sortOrder || 0,
        item.ministryId,
        item.requiredLevelName || "",
      ],
    )
  }
}

const ensureTemplate = async (client, actorUserId, definition) => {
  const hash = definitionHash(definition)
  const existingResult = await client.query(
    `
      SELECT id, ministry_id, name, status, version, definition_hash
      FROM templates
      WHERE system_key = $1
         OR (
           ministry_id = $2
           AND lower(name) = lower($3)
         )
      ORDER BY CASE WHEN system_key = $1 THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE
    `,
    [definition.systemKey, definition.coordinatorMinistryId, definition.name],
  )
  let template
  if (!existingResult.rowCount) {
    const created = await client.query(
      `
        INSERT INTO templates (
          ministry_id, name, description, participation_type,
          responsibilities, status, version, created_by,
          system_key, system_managed, definition_hash
        )
        VALUES (
          $1, $2, $3, $4, '[]'::JSONB, 'active', 1, $5,
          $6, true, $7
        )
        RETURNING id, version
      `,
      [
        definition.coordinatorMinistryId,
        definition.name,
        definition.description,
        definition.participationType,
        actorUserId,
        definition.systemKey,
        hash,
      ],
    )
    template = created.rows[0]
    await insertTemplateStructure(client, template.id, definition)
  } else {
    const existing = existingResult.rows[0]
    const changed = existing.definition_hash !== hash
    const nextVersion = changed ? Number(existing.version) + 1 : Number(existing.version)
    await client.query(
      `
        UPDATE templates
        SET ministry_id = $2,
            name = $3,
            description = $4,
            participation_type = $5,
            responsibilities = '[]'::JSONB,
            status = 'active',
            version = $6,
            system_key = $7,
            system_managed = true,
            definition_hash = $8,
            updated_at = CASE WHEN $9 THEN now() ELSE updated_at END
        WHERE id = $1
      `,
      [
        existing.id,
        definition.coordinatorMinistryId,
        definition.name,
        definition.description,
        definition.participationType,
        nextVersion,
        definition.systemKey,
        hash,
        changed,
      ],
    )
    if (changed) {
      await client.query(
        `DELETE FROM template_ministries WHERE template_id = $1`,
        [existing.id],
      )
      await insertTemplateStructure(client, existing.id, definition)
    }
    template = { id: existing.id, version: nextVersion }
  }
  await client.query(
    `
      INSERT INTO template_versions (template_id, version, snapshot, created_by)
      VALUES ($1, $2, $3::JSONB, $4)
      ON CONFLICT (template_id, version) DO NOTHING
    `,
    [template.id, template.version, JSON.stringify(definition), actorUserId],
  )
  return {
    id: template.id,
    version: Number(template.version),
    coordinatorMinistryId: definition.coordinatorMinistryId,
  }
}

const loadTemplateStructure = async (client, template) => {
  const [blocks, responsibilities] = await Promise.all([
    client.query(
      `
        SELECT id, ministry_id, is_required, instructions, sort_order
        FROM template_ministries
        WHERE template_id = $1
        ORDER BY sort_order
      `,
      [template.id],
    ),
    client.query(
      `
        SELECT
          responsibility.id,
          block.ministry_id,
          responsibility.name,
          responsibility.description,
          responsibility.responsibility_type,
          responsibility.quantity_needed,
          responsibility.approval_required,
          responsibility.is_required,
          responsibility.required_ministry_level_id,
          responsibility.required_qualification,
          responsibility.relative_start_minutes,
          responsibility.instructions,
          responsibility.sort_order
        FROM template_responsibilities responsibility
        JOIN template_ministries block
          ON block.id = responsibility.template_ministry_id
        WHERE responsibility.template_id = $1
          AND responsibility.status = 'active'
        ORDER BY responsibility.sort_order
      `,
      [template.id],
    ),
  ])
  return { template, blocks: blocks.rows, responsibilities: responsibilities.rows }
}

const materializeStructure = async (
  client,
  actorUserId,
  eventId,
  structure,
) => {
  for (const block of structure.blocks) {
    await client.query(
      `
        INSERT INTO event_ministries (
          event_id, ministry_id, template_ministry_id, is_required,
          schedule_status, published_by, published_at, instructions
        )
        VALUES ($1, $2, $3, $4, 'published', $5, now(), $6)
        ON CONFLICT (event_id, ministry_id) DO UPDATE
        SET template_ministry_id = excluded.template_ministry_id,
            is_required = excluded.is_required,
            instructions = excluded.instructions,
            updated_at = now()
      `,
      [
        eventId,
        block.ministry_id,
        block.id,
        block.is_required !== false,
        actorUserId,
        block.instructions || null,
      ],
    )
  }
  for (const item of structure.responsibilities) {
    await client.query(
      `
        INSERT INTO event_responsibilities (
          event_id, ministry_id, template_responsibility_id, name,
          description, responsibility_type, quantity_needed,
          approval_required, is_required, required_ministry_level_id,
          required_qualification, relative_start_minutes, instructions,
          sort_order, status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, 'open'
        )
      `,
      [
        eventId,
        item.ministry_id,
        item.id,
        item.name,
        item.description || null,
        item.responsibility_type || "position",
        Number(item.quantity_needed) || 1,
        Boolean(item.approval_required),
        item.is_required !== false,
        item.required_ministry_level_id || null,
        item.required_qualification || null,
        Number(item.relative_start_minutes) || 0,
        item.instructions || null,
        Number(item.sort_order) || 0,
      ],
    )
  }
}

const createImportedEvent = async (
  client,
  actorUserId,
  event,
  structure,
) => {
  const result = await client.query(
    `
      INSERT INTO events (
        ministry_id, template_id, template_version, title, description,
        location, start_time, end_time, participation_type, status, version,
        created_by, schedule_source, schedule_source_key,
        schedule_event_type, schedule_source_payload, schedule_source_title,
        schedule_source_start_time, schedule_source_end_time,
        schedule_source_location, schedule_last_seen_at, schedule_synced_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'members', 'published', 1,
        $9, $10, $11, $12, $13::JSONB, $4, $7, $8, $6, now(), now()
      )
      RETURNING id
    `,
    [
      structure.template.coordinatorMinistryId,
      structure.template.id,
      structure.template.version,
      event.title,
      event.description,
      event.location,
      event.start,
      event.end,
      actorUserId,
      MASS_SCHEDULE_SOURCE,
      event.sourceKey,
      event.eventType,
      JSON.stringify(event.sourcePayload),
    ],
  )
  const eventId = result.rows[0].id
  await materializeStructure(client, actorUserId, eventId, structure)
  await client.query(
    `
      INSERT INTO ministry_audit_log (
        actor_user_id, active_profile_user_id, action, entity_type,
        entity_id, ministry_id, after_data, metadata
      )
      VALUES ($1, $1, 'event.imported', 'event', $2, $3, $4::JSONB, $5::JSONB)
    `,
    [
      actorUserId,
      eventId,
      structure.template.coordinatorMinistryId,
      JSON.stringify({
        title: event.title,
        startTime: event.start.toISOString(),
        endTime: event.end.toISOString(),
        templateId: structure.template.id,
      }),
      JSON.stringify({
        source: MASS_SCHEDULE_SOURCE,
        sourceKey: event.sourceKey,
        automatic: true,
      }),
    ],
  )
  return eventId
}

const replaceTemplateIfSafe = async (
  client,
  actorUserId,
  existing,
  structure,
) => {
  if (existing.template_id === structure.template.id) return true
  const assignments = await client.query(
    `
      SELECT count(*)::INT AS count
      FROM responsibility_assignments assignment
      JOIN event_responsibilities responsibility
        ON responsibility.id = assignment.responsibility_id
      WHERE assignment.event_id = $1
        AND responsibility.template_responsibility_id IS NOT NULL
        AND assignment.status NOT IN ('declined', 'cancelled')
    `,
    [existing.id],
  )
  if (Number(assignments.rows[0].count) > 0) return false
  await client.query(
    `
      DELETE FROM event_responsibilities
      WHERE event_id = $1
        AND template_responsibility_id IS NOT NULL
    `,
    [existing.id],
  )
  await materializeStructure(client, actorUserId, existing.id, structure)
  await client.query(
    `
      UPDATE events
      SET ministry_id = $2,
          template_id = $3,
          template_version = $4,
          version = version + 1,
          updated_at = now()
      WHERE id = $1
    `,
    [
      existing.id,
      structure.template.coordinatorMinistryId,
      structure.template.id,
      structure.template.version,
    ],
  )
  return true
}

const updateImportedEvent = async (
  client,
  actorUserId,
  existing,
  event,
  structure,
) => {
  const templateReplaced = await replaceTemplateIfSafe(
    client,
    actorUserId,
    existing,
    structure,
  )
  await client.query(
    `
      UPDATE events
      SET schedule_source_key = $2,
          title = CASE
            WHEN schedule_source_title IS NULL OR title = schedule_source_title
              THEN $3
            ELSE title
          END,
          description = CASE
            WHEN description LIKE 'Generated from the MyLatinMass Mass Schedule%'
              THEN $4
            ELSE description
          END,
          location = CASE
            WHEN schedule_source_location IS NULL OR location = schedule_source_location
              THEN $5
            ELSE location
          END,
          start_time = CASE
            WHEN schedule_source_start_time IS NULL
              OR start_time = schedule_source_start_time
              THEN $6
            ELSE start_time
          END,
          end_time = CASE
            WHEN schedule_source_end_time IS NULL
              OR end_time = schedule_source_end_time
              THEN $7
            ELSE end_time
          END,
          schedule_event_type = $8,
          schedule_source_payload = $9::JSONB,
          schedule_source_title = $3,
          schedule_source_start_time = $6,
          schedule_source_end_time = $7,
          schedule_source_location = $5,
          schedule_last_seen_at = now(),
          schedule_synced_at = now(),
          updated_at = CASE
            WHEN schedule_source_key IS DISTINCT FROM $2
              OR CASE
                WHEN schedule_source_title IS NULL OR title = schedule_source_title
                  THEN $3
                ELSE title
              END IS DISTINCT FROM title
              OR CASE
                WHEN description LIKE 'Generated from the MyLatinMass Mass Schedule%'
                  THEN $4
                ELSE description
              END IS DISTINCT FROM description
              OR CASE
                WHEN schedule_source_location IS NULL OR location = schedule_source_location
                  THEN $5
                ELSE location
              END IS DISTINCT FROM location
              OR CASE
                WHEN schedule_source_start_time IS NULL
                  OR start_time = schedule_source_start_time
                  THEN $6
                ELSE start_time
              END IS DISTINCT FROM start_time
              OR CASE
                WHEN schedule_source_end_time IS NULL
                  OR end_time = schedule_source_end_time
                  THEN $7
                ELSE end_time
              END IS DISTINCT FROM end_time
              OR schedule_event_type IS DISTINCT FROM $8
            THEN now()
            ELSE updated_at
          END
      WHERE id = $1
    `,
    [
      existing.id,
      event.sourceKey,
      event.title,
      event.description,
      event.location,
      event.start,
      event.end,
      event.eventType,
      JSON.stringify(event.sourcePayload),
    ],
  )
  return { templateReplaced }
}

const sourceGroupKey = (sourceKey, eventType) =>
  `${sourceKey.split("|")[0]}|${eventType}`

export const syncMassSchedule = async (
  client,
  payload,
  {
    location = DEFAULT_LOCATION,
    timeZone = DEFAULT_TIME_ZONE,
    ministrySlugs = {},
  } = {},
) => {
  const extracted = extractMassEvents(payload, { location, timeZone })
  if (!extracted.events.length) {
    throw new Error("Mass Schedule contained no Mass events")
  }
  await client.query("BEGIN")
  try {
    const actorUserId = await ensureImportActor(client)
    const [sacristans, altarServers, ushers] = await Promise.all([
      ensureMinistry(client, actorUserId, {
        slug: ministrySlugs.sacristans || "sacristans",
        name: "Sacristans",
        aliases: ["sacristan"],
        description: "Sacristan preparation and Mass coverage.",
      }),
      ensureMinistry(client, actorUserId, {
        slug: ministrySlugs.altarServers || "altar-servers",
        name: "Altar Servers",
        aliases: ["altar server"],
        description: "Altar-server formation, positions, and Mass assignments.",
      }),
      ensureMinistry(client, actorUserId, {
        slug: ministrySlugs.ushers || "ushers",
        name: "Ushers",
        aliases: ["usher", "security", "ushers-security"],
        description: "Usher and security coverage for chapel services.",
      }),
    ])
    const definitions = buildMassTemplateDefinitions({
      sacristansMinistryId: sacristans.id,
      altarServersMinistryId: altarServers.id,
      ushersMinistryId: ushers.id,
    })
    const templates = {}
    for (const eventType of ["low_mass", "high_mass"]) {
      templates[eventType] = await ensureTemplate(
        client,
        actorUserId,
        definitions[eventType],
      )
    }
    const structures = {
      low_mass: await loadTemplateStructure(client, templates.low_mass),
      high_mass: await loadTemplateStructure(client, templates.high_mass),
    }

    const existingResult = await client.query(
      `
        SELECT
          id, template_id, schedule_source_key, schedule_event_type,
          schedule_source_start_time
        FROM events
        WHERE schedule_source = $1
        FOR UPDATE
      `,
      [MASS_SCHEDULE_SOURCE],
    )
    const existingByKey = new Map(
      existingResult.rows.map((item) => [item.schedule_source_key, item]),
    )
    const usedExistingIds = new Set()
    const pending = []
    let created = 0
    let updated = 0
    let remapped = 0
    let templateChangesHeld = 0

    for (const event of extracted.events) {
      const existing = existingByKey.get(event.sourceKey)
      if (!existing) {
        pending.push(event)
        continue
      }
      const result = await updateImportedEvent(
        client,
        actorUserId,
        existing,
        event,
        structures[event.eventType],
      )
      if (!result.templateReplaced) templateChangesHeld += 1
      usedExistingIds.add(existing.id)
      updated += 1
    }

    const remainingExistingByGroup = new Map()
    for (const existing of existingResult.rows) {
      if (usedExistingIds.has(existing.id)) continue
      const key = sourceGroupKey(
        existing.schedule_source_key,
        existing.schedule_event_type,
      )
      const items = remainingExistingByGroup.get(key) || []
      items.push(existing)
      remainingExistingByGroup.set(key, items)
    }
    const pendingByGroup = new Map()
    for (const event of pending) {
      const key = sourceGroupKey(event.sourceKey, event.eventType)
      const items = pendingByGroup.get(key) || []
      items.push(event)
      pendingByGroup.set(key, items)
    }

    for (const event of pending) {
      const groupKey = sourceGroupKey(event.sourceKey, event.eventType)
      const sourceGroup = pendingByGroup.get(groupKey) || []
      const existingGroup = remainingExistingByGroup.get(groupKey) || []
      if (sourceGroup.length === 1 && existingGroup.length === 1) {
        const existing = existingGroup[0]
        const result = await updateImportedEvent(
          client,
          actorUserId,
          existing,
          event,
          structures[event.eventType],
        )
        if (!result.templateReplaced) templateChangesHeld += 1
        usedExistingIds.add(existing.id)
        remainingExistingByGroup.set(groupKey, [])
        updated += 1
        remapped += 1
        continue
      }
      await createImportedEvent(
        client,
        actorUserId,
        event,
        structures[event.eventType],
      )
      created += 1
    }

    const firstDate = extracted.events[0].sourceDate
    const lastDate = extracted.events[extracted.events.length - 1].sourceDate
    const unseenInSourceRange = existingResult.rows.filter((existing) => {
      if (usedExistingIds.has(existing.id)) return false
      const sourceDate = existing.schedule_source_key?.split("|")[0] || ""
      return sourceDate >= firstDate && sourceDate <= lastDate
    }).length

    await client.query("COMMIT")
    return {
      sourceRows: extracted.sourceRows,
      skippedRows: extracted.skippedRows,
      massEvents: extracted.events.length,
      lowMassEvents: extracted.events.filter(
        (event) => event.eventType === "low_mass",
      ).length,
      highMassEvents: extracted.events.filter(
        (event) => event.eventType === "high_mass",
      ).length,
      created,
      updated,
      remapped,
      unseenInSourceRange,
      templateChangesHeld,
      templates: {
        lowMass: templates.low_mass.id,
        highMass: templates.high_mass.id,
      },
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}
