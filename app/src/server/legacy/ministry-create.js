const { Client } = require("pg")
const { createGatsbyHandler } = require("./helper/gatsby-function-adapter")
const {
  getMinistryIdentityContext,
  getMinistryTokenPayload,
} = require("./helper/ministry-auth")

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const createSlug = (name) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "ministry"

const handler = async (event) => {
  if (event.httpMethod !== "POST") {
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

  let body
  try {
    body = JSON.parse(event.body || "{}")
  } catch (error) {
    return jsonResponse(400, { message: "Invalid request" })
  }

  const name = body.name?.toString().trim()
  const description = body.description?.toString().trim() || null
  if (!name) {
    return jsonResponse(400, { message: "Ministry name is required" })
  }
  if (name.length > 120) {
    return jsonResponse(400, {
      message: "Ministry name must be 120 characters or fewer",
    })
  }
  if (description && description.length > 500) {
    return jsonResponse(400, {
      message: "Description must be 500 characters or fewer",
    })
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
    if (context.user.global_role !== "super_admin") {
      return jsonResponse(403, {
        message: "Only Super Admins can add ministries",
      })
    }

    const duplicateNameResult = await client.query(
      `SELECT id FROM ministries WHERE lower(name) = lower($1) LIMIT 1`,
      [name],
    )
    if (duplicateNameResult.rowCount) {
      return jsonResponse(409, {
        message: "A ministry with that name already exists",
      })
    }

    const baseSlug = createSlug(name)
    const slugResult = await client.query(
      `SELECT slug FROM ministries WHERE lower(slug) = $1 OR lower(slug) LIKE $2`,
      [baseSlug, `${baseSlug}-%`],
    )
    const usedSlugs = new Set(
      slugResult.rows.map((row) => row.slug.toLowerCase()),
    )
    let slug = baseSlug
    let suffix = 2
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`

    const result = await client.query(
      `
        INSERT INTO ministries (name, description, slug, status, created_by)
        VALUES ($1, $2, $3, 'active', $4)
        RETURNING id, slug, name, description, status
      `,
      [name, description, slug, context.user.id],
    )
    const ministry = result.rows[0]
    return jsonResponse(201, {
      ministry: {
        id: ministry.id,
        slug: ministry.slug,
        name: ministry.name,
        description: ministry.description,
        status: ministry.status,
        accessLevel: "super_admin",
        globalAccess: true,
        canServe: false,
        memberCount: 0,
        templateCount: 0,
      },
    })
  } catch (error) {
    if (error.code === "23505") {
      return jsonResponse(409, {
        message: "A ministry with that name already exists",
      })
    }
    console.error("Unable to create ministry:", error)
    return jsonResponse(500, { message: "Unable to add ministry" })
  } finally {
    await client.end().catch(() => {})
  }
}

exports.handler = handler
exports.default = createGatsbyHandler(handler)
