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

const toMinistry = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  status: row.status,
  accessLevel: row.access_level,
  globalAccess: row.global_access,
  canServe: row.can_serve,
  memberCount: Number(row.member_count),
  templateCount: Number(row.template_count),
})

const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING
  const jwtSecret = process.env.JWT_SECRET_KEY

  if (!connectionString || !jwtSecret) {
    return jsonResponse(500, { message: "Ministries access is not configured" })
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

    const hasGlobalAccess = ["owner", "super_admin"].includes(user.global_role)
    const result = hasGlobalAccess
      ? await client.query(
          `
            SELECT
              m.id,
              m.slug,
              m.name,
              m.description,
              m.status,
              $1::STRING AS access_level,
              true AS global_access,
              coalesce(access.can_serve, false) AS can_serve,
              (
                SELECT count(*)
                FROM ministry_members members
                WHERE members.ministry_id = m.id
                  AND members.status = 'active'
                  AND members.can_serve = true
              ) AS member_count,
              (
                SELECT count(*)
                FROM templates t
                WHERE t.ministry_id = m.id
                  AND t.status = 'active'
              ) AS template_count
            FROM ministries m
            LEFT JOIN ministry_members access
              ON access.ministry_id = m.id
              AND access.user_id = $2
              AND access.status = 'active'
            ORDER BY
              CASE m.status
                WHEN 'active' THEN 0
                WHEN 'inactive' THEN 1
                ELSE 2
              END,
              m.name
          `,
          [user.global_role, user.id]
        )
      : await client.query(
          `
            SELECT
              m.id,
              m.slug,
              m.name,
              m.description,
              m.status,
              access.level AS access_level,
              false AS global_access,
              access.can_serve,
              (
                SELECT count(*)
                FROM ministry_members members
                WHERE members.ministry_id = m.id
                  AND members.status = 'active'
                  AND members.can_serve = true
              ) AS member_count,
              (
                SELECT count(*)
                FROM templates t
                WHERE t.ministry_id = m.id
                  AND t.status = 'active'
              ) AS template_count
            FROM ministry_members access
            JOIN ministries m ON m.id = access.ministry_id
            WHERE access.user_id = $1
              AND access.status = 'active'
              AND m.status = 'active'
            ORDER BY m.name
          `,
          [user.id]
        )

    const [calendarEventsResult, assignmentsResult] = await Promise.all([
      client.query(
        `
          SELECT
            e.id,
            e.ministry_id AS coordinator_ministry_id,
            COALESCE(coordinator.name, 'Volunteer Event') AS coordinator_ministry_name,
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
            ) AS responsibility_count
          FROM events e
          LEFT JOIN ministries coordinator ON coordinator.id = e.ministry_id
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
          SELECT
            ra.event_id,
            ra.status,
            er.name AS responsibility_name,
            er.relative_start_minutes
          FROM responsibility_assignments ra
          JOIN event_responsibilities er ON er.id = ra.responsibility_id
          WHERE ra.user_id = $1
            AND ra.status IN (
              'interested', 'pending', 'assigned', 'confirmed',
              'change_requested', 'completed'
            )
        `,
        [user.id]
      ),
    ])

    const assignmentsByEvent = assignmentsResult.rows.reduce(
      (byEvent, assignment) => {
        if (!byEvent[assignment.event_id]) byEvent[assignment.event_id] = []
        byEvent[assignment.event_id].push(assignment)
        return byEvent
      },
      {}
    )
    const calendarEvents = calendarEventsResult.rows.map((event) => {
      const assignments = assignmentsByEvent[event.id] || []
      const visibleProfileAssignments = assignments.map((assignment) => ({
        profileId: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        status: assignment.status,
        responsibilityName: assignment.responsibility_name,
        dutyStartTime: new Date(
          new Date(event.start_time).getTime() -
            Number(assignment.relative_start_minutes || 0) * 60_000
        ).toISOString(),
      }))
      const assignmentStartTime = visibleProfileAssignments
        .map((assignment) => assignment.dutyStartTime)
        .sort()[0] || null
      return {
        ...event,
        responsibility_count: Number(event.responsibility_count),
        is_assigned: assignments.length > 0,
        assignment_start_time: assignmentStartTime,
        visibleProfileAssignments,
      }
    })

    return jsonResponse(200, {
      actor: toPublicMinistryUser(context.actor),
      user: toPublicMinistryUser(user),
      isManagedProfile: context.isManagedProfile,
      ministries: result.rows.map(toMinistry),
      calendarEvents,
    })
  } catch (error) {
    console.error("Unable to list ministries:", error)
    return jsonResponse(500, { message: "Unable to load ministries" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
