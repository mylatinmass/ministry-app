import pg from "pg"
import jwt from "jsonwebtoken"

const { Client } = pg
const connectionString = process.env.MINISTRY_DATABASE_URL
const jwtSecret = process.env.JWT_SECRET_KEY
if (!connectionString || !jwtSecret) {
  throw new Error("MINISTRY_DATABASE_URL and JWT_SECRET_KEY are required")
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

try {
  const user = (
    await client.query(
      `
        SELECT id, username, global_role
        FROM ministry_accounts
        WHERE status = 'active'
          AND global_role IN ('owner', 'super_admin')
        ORDER BY created_at
        LIMIT 1
      `,
    )
  ).rows[0]
  const ministry = (
    await client.query(
      `SELECT id, name FROM ministries WHERE status = 'active' ORDER BY created_at LIMIT 1`,
    )
  ).rows[0]
  if (!user || !ministry) throw new Error("Smoke-test identity or ministry is missing")

  const token = jwt.sign(
    {
      scope: "ministries",
      actorUserId: user.id,
      activeProfileUserId: user.id,
      userId: user.id,
      username: user.username,
      globalRole: user.global_role,
      authMethod: "password",
    },
    jwtSecret,
    { expiresIn: "5m" },
  )
  const headers = { Authorization: `Bearer ${token}` }
  const reportResponse = await fetch(
    `http://127.0.0.1:4321/api/scheduling/reports?ministryId=${encodeURIComponent(ministry.id)}`,
    { headers },
  )
  const report = await reportResponse.json()
  if (!reportResponse.ok) {
    throw new Error(`Reports smoke test failed: ${report.message || reportResponse.status}`)
  }

  const availabilityResponse = await fetch(
    "http://127.0.0.1:4321/api/scheduling/availability",
    { headers },
  )
  const availability = await availabilityResponse.json()
  if (!availabilityResponse.ok) {
    throw new Error(
      `Availability smoke test failed: ${availability.message || availabilityResponse.status}`,
    )
  }

  const volunteerEventsResponse = await fetch(
    "http://127.0.0.1:4321/api/scheduling/volunteer-events",
    { headers },
  )
  const volunteerEvents = await volunteerEventsResponse.json()
  if (!volunteerEventsResponse.ok) {
    throw new Error(
      `Standalone volunteer events smoke test failed: ${volunteerEvents.message || volunteerEventsResponse.status}`,
    )
  }

  const event = (
    await client.query(
      `
        SELECT event.id
        FROM events event
        WHERE event.status <> 'archived'
        ORDER BY event.start_time DESC
        LIMIT 1
      `,
    )
  ).rows[0]
  let eventChecked = false
  if (event) {
    const eventResponse = await fetch(
      `http://127.0.0.1:4321/api/scheduling/events?eventId=${encodeURIComponent(event.id)}`,
      { headers },
    )
    const eventDetails = await eventResponse.json()
    if (!eventResponse.ok) {
      throw new Error(
        `Event-detail smoke test failed: ${eventDetails.message || eventResponse.status}`,
      )
    }
    eventChecked = true
  }

  console.log(
    JSON.stringify({
      ministry: ministry.name,
      participationRows: report.participation.length,
      coverageRows: report.coverage.length,
      levelHistoryRows: report.levelHistory.length,
      availabilityMinistries: availability.ministries.length,
      standaloneVolunteerEvents: volunteerEvents.events.length,
      eventChecked,
    }),
  )
} finally {
  await client.end()
}
