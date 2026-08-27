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
  directAccessLevel: row.direct_access_level || null,
  globalAccess: row.global_access,
  canServe: row.can_serve,
  memberCount: Number(row.member_count),
  templateCount: Number(row.template_count),
})

const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { message: "Method not allowed" })
  }

  const connectionString = process.env.MINISTRY_DATABASE_URL
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
              access.level AS direct_access_level,
              true AS global_access,
              coalesce(access.can_serve, false) AS can_serve,
              (
                SELECT count(*)
                FROM ministry_members members
                WHERE members.ministry_id = m.id
                  AND members.status = 'active'
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
            WHERE m.status = 'active'
              AND lower(COALESCE(m.slug, '')) NOT IN ('ceremony', 'sacred-music', 'choir')
              AND lower(m.name) NOT IN ('ceremony', 'sacred music', 'choir')
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
              access.level AS direct_access_level,
              false AS global_access,
              access.can_serve,
              (
                SELECT count(*)
                FROM ministry_members members
                WHERE members.ministry_id = m.id
                  AND members.status = 'active'
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
              AND lower(COALESCE(m.slug, '')) NOT IN ('ceremony', 'sacred-music', 'choir')
              AND lower(m.name) NOT IN ('ceremony', 'sacred music', 'choir')
            ORDER BY m.name
          `,
          [user.id]
        )

    const [
      calendarEventsResult,
      assignmentsResult,
      pendingSubRequestsResult,
      unfilledPositionsResult,
    ] = await Promise.all([
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
            CASE WHEN COALESCE(e.visibility, 'public') <> 'private'
              OR EXISTS (
                SELECT 1
                FROM responsibility_assignments private_assignment
                WHERE private_assignment.event_id = e.id
                  AND private_assignment.status NOT IN ('declined', 'cancelled')
                  AND (
                    private_assignment.user_id = $1
                    OR EXISTS (
                      SELECT 1
                      FROM managed_profiles managed
                      WHERE managed.guardian_user_id = $1
                        AND managed.child_user_id = private_assignment.user_id
                        AND managed.status IN ('active', 'separation_pending')
                    )
                  )
              )
              OR EXISTS (SELECT 1 FROM ministry_members private_access JOIN ministries private_ministry ON private_ministry.id = private_access.ministry_id WHERE private_access.user_id = $1 AND private_access.status = 'active' AND private_access.level IN ('owner', 'admin') AND private_ministry.slug = 'priests')
              OR EXISTS (SELECT 1 FROM ministry_accounts private_user WHERE private_user.id = $1 AND private_user.global_role IN ('owner', 'super_admin'))
              THEN e.description ELSE NULL END AS description,
            CASE WHEN COALESCE(e.visibility, 'public') <> 'private'
              OR EXISTS (
                SELECT 1
                FROM responsibility_assignments private_assignment
                WHERE private_assignment.event_id = e.id
                  AND private_assignment.status NOT IN ('declined', 'cancelled')
                  AND (
                    private_assignment.user_id = $1
                    OR EXISTS (
                      SELECT 1 FROM managed_profiles managed
                      WHERE managed.guardian_user_id = $1
                        AND managed.child_user_id = private_assignment.user_id
                        AND managed.status IN ('active', 'separation_pending')
                    )
                  )
              )
              OR EXISTS (SELECT 1 FROM ministry_members private_access JOIN ministries private_ministry ON private_ministry.id = private_access.ministry_id WHERE private_access.user_id = $1 AND private_access.status = 'active' AND private_access.level IN ('owner', 'admin') AND private_ministry.slug = 'priests')
              OR EXISTS (SELECT 1 FROM ministry_accounts private_user WHERE private_user.id = $1 AND private_user.global_role IN ('owner', 'super_admin'))
              THEN e.location ELSE NULL END AS location,
            e.start_time,
            e.end_time,
            e.status,
            e.participation_type,
            EXISTS (
              SELECT 1
              FROM ministry_event_pins pin
              WHERE pin.event_id = e.id
                AND pin.user_id = $1
            ) AS is_pinned,
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
            AND (
              COALESCE(e.visibility, 'public') <> 'private'
              OR EXISTS (
                SELECT 1
                FROM responsibility_assignments private_assignment
                WHERE private_assignment.event_id = e.id
                  AND private_assignment.status NOT IN ('declined', 'cancelled')
                  AND (
                    private_assignment.user_id = $1
                    OR EXISTS (
                      SELECT 1 FROM managed_profiles managed
                      WHERE managed.guardian_user_id = $1
                        AND managed.child_user_id = private_assignment.user_id
                        AND managed.status IN ('active', 'separation_pending')
                    )
                  )
              )
              OR EXISTS (SELECT 1 FROM ministry_members private_access JOIN ministries private_ministry ON private_ministry.id = private_access.ministry_id WHERE private_access.user_id = $1 AND private_access.status = 'active' AND private_ministry.slug = 'priests')
              OR EXISTS (SELECT 1 FROM ministry_accounts private_user WHERE private_user.id = $1 AND private_user.global_role IN ('owner', 'super_admin'))
            )
          ORDER BY e.start_time
        `,
        [context.actor.id]
      ),
      client.query(
        `
          SELECT
            ra.event_id,
            ra.user_id,
            subject.first_name,
            subject.last_name,
            ra.status,
            er.name AS responsibility_name,
            er.relative_start_minutes
          FROM responsibility_assignments ra
          JOIN event_responsibilities er ON er.id = ra.responsibility_id
          JOIN ministry_accounts subject ON subject.id = ra.user_id
          WHERE (
              ra.user_id = $1
              OR EXISTS (
                SELECT 1
                FROM managed_profiles managed
                WHERE managed.guardian_user_id = $1
                  AND managed.child_user_id = ra.user_id
                  AND managed.status IN ('active', 'separation_pending')
              )
            )
            AND ra.status IN (
              'interested', 'pending', 'assigned', 'confirmed',
              'change_requested', 'completed'
            )
        `,
        [context.actor.id]
      ),
      client.query(
        `
          SELECT request.event_id, count(DISTINCT request.id)::INT AS request_count
          FROM assignment_change_requests request
          JOIN events event ON event.id = request.event_id
          WHERE request.status = 'pending'
            AND request.request_type = 'substitute'
            AND (request.expires_at IS NULL OR request.expires_at > now())
            AND event.status = 'published'
            AND event.start_time > now()
            AND (
              $2::BOOL
              OR EXISTS (
                SELECT 1 FROM ministry_members membership
                WHERE membership.user_id = $1
                  AND membership.ministry_id = request.ministry_id
                  AND membership.status = 'active'
                  AND membership.level IN ('owner', 'admin')
              )
            )
          GROUP BY request.event_id
          ORDER BY min(event.start_time)
        `,
        [user.id, hasGlobalAccess]
      ),
      client.query(
        `
          SELECT responsibility.event_id,
            sum(GREATEST(
              responsibility.quantity_needed - COALESCE(assigned.assigned_quantity, 0),
              0
            ))::INT AS missing_count
          FROM event_responsibilities responsibility
          JOIN events event ON event.id = responsibility.event_id
          LEFT JOIN LATERAL (
            SELECT COALESCE(sum(assignment.quantity), 0)::INT AS assigned_quantity
            FROM responsibility_assignments assignment
            WHERE assignment.responsibility_id = responsibility.id
              AND assignment.status IN ('pending', 'assigned', 'confirmed', 'change_requested')
          ) assigned ON true
          WHERE event.status = 'published'
            AND event.start_time > now()
            AND responsibility.status <> 'cancelled'
            AND responsibility.is_required = true
            AND responsibility.unlimited_capacity = false
            AND (
              $2::BOOL
              OR EXISTS (
                SELECT 1 FROM ministry_members membership
                WHERE membership.user_id = $1
                  AND membership.ministry_id = COALESCE(responsibility.ministry_id, event.ministry_id)
                  AND membership.status = 'active'
                  AND membership.level IN ('owner', 'admin')
              )
            )
          GROUP BY responsibility.event_id
          HAVING sum(GREATEST(
            responsibility.quantity_needed - COALESCE(assigned.assigned_quantity, 0),
            0
          )) > 0
          ORDER BY min(event.start_time)
        `,
        [user.id, hasGlobalAccess]
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
        profileId: assignment.user_id,
        firstName: assignment.first_name,
        lastName: assignment.last_name,
        status: assignment.status,
        responsibilityName: assignment.responsibility_name,
        dutyStartTime: new Date(
          new Date(event.start_time).getTime() +
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
    const pendingSubRequestEventIds = pendingSubRequestsResult.rows.map(
      (row) => row.event_id
    )
    const unfilledPositionEventIds = unfilledPositionsResult.rows.map(
      (row) => row.event_id
    )

    return jsonResponse(200, {
      actor: toPublicMinistryUser(context.actor),
      user: {
        ...toPublicMinistryUser(user),
        appearanceTheme: context.actor.appearance_theme || "light",
      },
      isManagedProfile: context.isManagedProfile,
      ministries: result.rows.map(toMinistry),
      calendarEvents,
      attention: {
        pendingSubRequests: pendingSubRequestsResult.rows.reduce(
          (total, row) => total + Number(row.request_count || 0),
          0
        ),
        unfilledPositions: unfilledPositionsResult.rows.reduce(
          (total, row) => total + Number(row.missing_count || 0),
          0
        ),
        pendingSubRequestEventIds,
        unfilledPositionEventIds,
      },
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
