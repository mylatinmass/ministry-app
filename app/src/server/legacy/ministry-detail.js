const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  getMinistryIdentityContext,
  getMinistryTokenPayload,
  toPublicMinistryUser,
} = require("./helper/ministry-auth")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.MINISTRY_DATABASE_URL
  const jwtSecret = process.env.JWT_SECRET_KEY
  const slug = event.queryStringParameters?.slug?.toString().trim().toLowerCase()

  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, { message: "Ministries access is not configured" })
  }

  if (!slug) {
    return jsonResponse(400, { message: "Ministry slug is required" })
  }

  let payload
  try {
    payload = getMinistryTokenPayload(event, jwtSecret)
  } catch (error) {
    return jsonResponse(401, { message: "Session expired" })
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    const context = await getMinistryIdentityContext(client, payload)

    if (!context) {
      return jsonResponse(401, { message: "Ministry access is inactive" })
    }
    const user = context.user

    const ministryResult = await client.query(
      `
        SELECT
          m.id,
          m.slug,
          m.name,
          m.description,
          m.status,
          access.level AS membership_level,
          access.status AS membership_status,
          coalesce(access.can_serve, false) AS can_serve
        FROM ministries m
        LEFT JOIN ministry_members access
          ON access.ministry_id = m.id
          AND access.user_id = $2
        WHERE lower(m.slug) = $1
        LIMIT 1
      `,
      [slug, user.id]
    )

    if (ministryResult.rowCount !== 1) {
      return jsonResponse(404, { message: "Ministry not found" })
    }

    const ministry = ministryResult.rows[0]
    const hasGlobalAccess = ["owner", "super_admin"].includes(user.global_role)
    const hasActiveMembership =
      ministry.membership_status === "active" && ministry.status === "active"
    const isRegularMember =
      !hasGlobalAccess && ministry.membership_level === "member"

    if (!hasGlobalAccess && !hasActiveMembership) {
      return jsonResponse(403, { message: "You do not have access to this ministry" })
    }

    const [
      statsResult,
      templatesResult,
      eventsResult,
      openRolesResult,
      calendarEventsResult,
      familyResult,
      familyAssignmentsResult,
    ] = await Promise.all([
      isRegularMember
        ? Promise.resolve({
            rows: [
              {
                serving_members: 0,
                upcoming_events: 0,
                open_responsibilities: 0,
                active_templates: 0,
              },
            ],
          })
        : client.query(
        `
          SELECT
            (
              SELECT count(*)
              FROM ministry_members mm
              WHERE mm.ministry_id = $1
                AND mm.status = 'active'
            ) AS serving_members,
            (
              SELECT count(*)
              FROM events e
              WHERE (
                  e.ministry_id = $1
                  OR EXISTS (
                    SELECT 1
                    FROM event_ministries em
                    WHERE em.event_id = e.id
                      AND em.ministry_id = $1
                  )
                )
                AND e.start_time >= now()
                AND e.status IN ('draft', 'published')
            ) AS upcoming_events,
            (
              SELECT coalesce(sum(greatest(
                er.quantity_needed - coalesce((
                  SELECT sum(ra.quantity)
                  FROM responsibility_assignments ra
                  WHERE ra.responsibility_id = er.id
                    AND ra.status NOT IN ('declined', 'cancelled')
                ), 0),
                0
              )), 0)
              FROM event_responsibilities er
              JOIN events e ON e.id = er.event_id
              WHERE coalesce(er.ministry_id, e.ministry_id) = $1
                AND er.status <> 'cancelled'
                AND coalesce(er.unlimited_capacity, false) = false
                AND e.status IN ('draft', 'published')
                AND e.end_time >= now()
            ) AS open_responsibilities,
            (
              SELECT count(*)
              FROM templates t
              WHERE (
                  t.ministry_id = $1
                  OR EXISTS (
                    SELECT 1
                    FROM template_ministries tm
                    WHERE tm.template_id = t.id
                      AND tm.ministry_id = $1
                  )
                )
                AND t.status = 'active'
            ) AS active_templates
        `,
        [ministry.id]
      ),
      isRegularMember
        ? Promise.resolve({ rows: [] })
        : client.query(
        `
          SELECT
            id,
            name,
            description,
            participation_type,
            greatest(
              jsonb_array_length(responsibilities),
              (
                SELECT count(*)
                FROM template_responsibilities tr
                WHERE tr.template_id = templates.id
                  AND tr.status = 'active'
              )
            ) AS responsibility_count,
            status,
            updated_at
          FROM templates
          WHERE (
              ministry_id = $1
              OR EXISTS (
                SELECT 1
                FROM template_ministries tm
                WHERE tm.template_id = templates.id
                  AND tm.ministry_id = $1
              )
            )
          ORDER BY
            CASE status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END,
            name
        `,
        [ministry.id]
      ),
      client.query(
        `
          SELECT
            e.id,
            template.name AS template_name,
            ordo_selection.selected_mass_option_snapshot->>'label' AS ordo_mass_name,
            ordo_day.celebration AS ordo_celebration,
            ordo_day.general_information AS ordo_general_information,
            e.title,
            e.description,
            e.location,
            e.start_time,
            e.end_time,
            e.status,
            e.participation_type,
            (
              SELECT count(*)
              FROM event_responsibilities er
              WHERE er.event_id = e.id
            ) AS responsibility_count,
            (
              SELECT coalesce(sum(greatest(
                er.quantity_needed - coalesce((
                  SELECT sum(ra.quantity)
                  FROM responsibility_assignments ra
                  WHERE ra.responsibility_id = er.id
                    AND ra.status NOT IN ('declined', 'cancelled')
                ), 0),
                0
              )), 0)
              FROM event_responsibilities er
              WHERE er.event_id = e.id
                AND er.status <> 'cancelled'
                AND er.is_required = true
                AND coalesce(er.unlimited_capacity, false) = false
            ) AS open_position_count,
            EXISTS (
              SELECT 1
              FROM responsibility_assignments ra
              WHERE ra.event_id = e.id
                AND ra.user_id = $2
                AND ra.status IN (
                  'interested',
                  'pending',
                  'assigned',
                  'confirmed',
                  'change_requested',
                  'completed'
                )
            ) AS is_assigned
          FROM events e
          LEFT JOIN templates template ON template.id = e.template_id
          LEFT JOIN event_ordo_selections ordo_selection
            ON ordo_selection.event_id = e.id
          LEFT JOIN ordo_days ordo_day
            ON ordo_day.liturgical_date =
              (e.start_time AT TIME ZONE 'America/New_York')::DATE
          WHERE (
              e.ministry_id = $1
              OR EXISTS (
                SELECT 1
                FROM event_ministries em
                WHERE em.event_id = e.id
                  AND em.ministry_id = $1
              )
            )
            AND (
              $3 = false
              OR e.status IN ('published', 'cancelled', 'completed')
            )
            AND ($3 = true OR e.status <> 'archived')
          ORDER BY e.start_time
        `,
        [ministry.id, user.id, isRegularMember]
      ),
      isRegularMember
        ? Promise.resolve({ rows: [] })
        : client.query(
        `
          SELECT
            e.id AS event_id,
            e.title AS event_title,
            e.start_time,
            e.status AS event_status,
            er.id AS responsibility_id,
            er.name AS responsibility_name,
            er.quantity_needed,
            greatest(
              er.quantity_needed - coalesce(sum(ra.quantity) FILTER (
                WHERE ra.status NOT IN ('declined', 'cancelled')
              ), 0),
              0
            )::INT AS open_quantity,
            level.name AS required_level_name
          FROM event_responsibilities er
          JOIN events e ON e.id = er.event_id
          LEFT JOIN responsibility_assignments ra
            ON ra.responsibility_id = er.id
          LEFT JOIN ministry_levels level
            ON level.id = er.required_ministry_level_id
          WHERE coalesce(er.ministry_id, e.ministry_id) = $1
            AND er.status <> 'cancelled'
            AND coalesce(er.unlimited_capacity, false) = false
            AND e.status IN ('draft', 'published')
            AND e.end_time >= now()
          GROUP BY
            e.id,
            e.title,
            e.start_time,
            e.status,
            er.id,
            er.name,
            er.quantity_needed,
            er.sort_order,
            level.name
          HAVING greatest(
            er.quantity_needed - coalesce(sum(ra.quantity) FILTER (
              WHERE ra.status NOT IN ('declined', 'cancelled')
            ), 0),
            0
          ) > 0
          ORDER BY e.start_time, lower(e.title), er.sort_order, lower(er.name)
        `,
        [ministry.id]
      ),
      client.query(
        `
          SELECT
            e.id,
            e.ministry_id AS coordinator_ministry_id,
            coordinator.name AS coordinator_ministry_name,
            template.name AS template_name,
            ordo_selection.selected_mass_option_snapshot->>'label' AS ordo_mass_name,
            ordo_day.celebration AS ordo_celebration,
            ordo_day.general_information AS ordo_general_information,
            e.title,
            e.description,
            e.location,
            e.start_time,
            e.end_time,
            e.status,
            e.participation_type,
            (
              SELECT count(*)
              FROM event_responsibilities er
              WHERE er.event_id = e.id
                AND er.status <> 'cancelled'
            ) AS responsibility_count,
            (
              SELECT coalesce(sum(greatest(
                er.quantity_needed - coalesce((
                  SELECT sum(ra.quantity)
                  FROM responsibility_assignments ra
                  WHERE ra.responsibility_id = er.id
                    AND ra.status NOT IN ('declined', 'cancelled')
                ), 0),
                0
              )), 0)
              FROM event_responsibilities er
              WHERE er.event_id = e.id
                AND er.status <> 'cancelled'
                AND er.is_required = true
                AND coalesce(er.unlimited_capacity, false) = false
            ) AS open_position_count
          FROM events e
          JOIN ministries coordinator ON coordinator.id = e.ministry_id
          LEFT JOIN templates template ON template.id = e.template_id
          LEFT JOIN event_ordo_selections ordo_selection
            ON ordo_selection.event_id = e.id
          LEFT JOIN ordo_days ordo_day
            ON ordo_day.liturgical_date =
              (e.start_time AT TIME ZONE 'America/New_York')::DATE
          WHERE e.status IN ('published', 'cancelled', 'completed')
          ORDER BY e.start_time
        `
      ),
      client.query(
        `
          SELECT u.id, u.first_name, u.last_name
          FROM ministry_accounts u
          WHERE u.id = $1
             OR EXISTS (
               SELECT 1 FROM managed_profiles mp
               WHERE mp.guardian_user_id = $1
                 AND mp.child_user_id = u.id
                 AND mp.status IN ('active', 'separation_pending')
             )
          ORDER BY CASE WHEN u.id = $1 THEN 0 ELSE 1 END,
            lower(u.first_name), lower(u.last_name)
        `,
        [context.actor.id]
      ),
      client.query(
        `
          SELECT
            ra.event_id,
            ra.user_id,
            u.first_name,
            u.last_name,
            ra.status,
            er.name AS responsibility_name
          FROM responsibility_assignments ra
          JOIN event_responsibilities er ON er.id = ra.responsibility_id
          JOIN ministry_accounts u ON u.id = ra.user_id
          WHERE (
              ra.user_id = $1
              OR EXISTS (
                SELECT 1 FROM managed_profiles mp
                WHERE mp.guardian_user_id = $1
                  AND mp.child_user_id = ra.user_id
                  AND mp.status IN ('active', 'separation_pending')
              )
            )
            AND ra.status IN (
              'interested', 'pending', 'assigned', 'confirmed',
              'change_requested', 'completed'
            )
        `,
        [context.actor.id]
      ),
    ])

    const stats = statsResult.rows[0]
    const memberUpcomingEvents = isRegularMember
      ? eventsResult.rows.filter(
          (event) =>
            new Date(event.start_time) >= new Date() &&
            event.status === "published",
        ).length
      : Number(stats.upcoming_events)

    const addProfileAssignments = (event) => {
      const profileAssignments = familyAssignmentsResult.rows
        .filter((assignment) => assignment.event_id === event.id)
        .map((assignment) => ({
          profileId: assignment.user_id,
          firstName: assignment.first_name,
          lastName: assignment.last_name,
          status: assignment.status,
          responsibilityName: assignment.responsibility_name,
        }))
      return {
        ...event,
        responsibility_count: Number(event.responsibility_count),
        open_position_count: Number(event.open_position_count),
        is_assigned: profileAssignments.some(
          (assignment) => assignment.profileId === user.id
        ),
        profileAssignments,
      }
    }
    const calendarEventMap = new Map(
      calendarEventsResult.rows.map((event) => [
        event.id,
        addProfileAssignments(event),
      ])
    )
    if (!isRegularMember) {
      for (const event of eventsResult.rows) {
        if (!calendarEventMap.has(event.id)) {
          calendarEventMap.set(event.id, addProfileAssignments(event))
        }
      }
    }

    return jsonResponse(200, {
      actor: toPublicMinistryUser(context.actor),
      user: {
        ...toPublicMinistryUser(user),
        appearanceTheme: context.actor.appearance_theme || "light",
      },
      isManagedProfile: context.isManagedProfile,
      familyProfiles: familyResult.rows.map((profile) => ({
        id: profile.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
      })),
      ministry: {
        id: ministry.id,
        slug: ministry.slug,
        name: ministry.name,
        description: ministry.description,
        status: ministry.status,
        accessLevel: hasGlobalAccess
          ? user.global_role
          : ministry.membership_level,
        membershipLevel: ministry.membership_level,
        canServe: ministry.can_serve,
      },
      stats: {
        servingMembers: Number(stats.serving_members),
        upcomingEvents: memberUpcomingEvents,
        openResponsibilities: Number(stats.open_responsibilities),
        activeTemplates: Number(stats.active_templates),
      },
      templates: templatesResult.rows.map((template) => ({
        ...template,
        responsibility_count: Number(template.responsibility_count),
      })),
      events: eventsResult.rows.map(addProfileAssignments),
      openRoles: openRolesResult.rows.map((role) => ({
        eventId: role.event_id,
        eventTitle: role.event_title,
        startTime: role.start_time,
        eventStatus: role.event_status,
        responsibilityId: role.responsibility_id,
        responsibilityName: role.responsibility_name,
        quantityNeeded: Number(role.quantity_needed),
        openQuantity: Number(role.open_quantity),
        requiredLevelName: role.required_level_name || "",
      })),
      calendarEvents: Array.from(calendarEventMap.values()).sort(
        (left, right) =>
          new Date(left.start_time).getTime() -
          new Date(right.start_time).getTime()
      ),
    })
  } catch (error) {
    console.error("Unable to load ministry workspace:", error)
    return jsonResponse(500, { message: "Unable to load ministry workspace" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
