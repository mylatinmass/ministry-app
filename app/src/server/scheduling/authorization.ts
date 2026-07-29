import type { PoolClient } from "pg"
import { getLegacyAuth } from "../legacy-auth"

export type MinistryIdentityContext = {
  actor: Record<string, any>
  user: Record<string, any>
  isManagedProfile: boolean
  managedProfileId?: string
}

export const getIdentityContext = async (
  client: PoolClient,
  request: Request,
): Promise<MinistryIdentityContext> => {
  const jwtSecret = process.env.JWT_SECRET_KEY
  if (!jwtSecret) throw new Error("JWT_SECRET_KEY is not configured")
  const {
    getMinistryIdentityContext,
    getMinistryTokenPayload,
  } = await getLegacyAuth()

  const payload = getMinistryTokenPayload(
    { headers: Object.fromEntries(request.headers.entries()) },
    jwtSecret,
  )
  const context = await getMinistryIdentityContext(client, payload)
  if (!context) throw new Error("Ministry access is inactive")
  return context
}

export const getMinistryAccess = async (
  client: PoolClient,
  user: Record<string, any>,
  ministryId: string,
) => {
  const globalRole = user.global_role
  if (["owner", "super_admin"].includes(globalRole)) {
    return {
      canView: true,
      canManage: true,
      accessLevel: globalRole,
    }
  }

  const result = await client.query(
    `
      SELECT level, status
      FROM ministry_members
      WHERE ministry_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [ministryId, user.id],
  )
  const membership = result.rows[0]
  const active = membership?.status === "active"
  return {
    canView: active,
    canManage: active && ["owner", "admin"].includes(membership.level),
    accessLevel: membership?.level || null,
  }
}

export const requireMinistryAccess = async (
  client: PoolClient,
  user: Record<string, any>,
  ministryId: string,
  manage = false,
) => {
  const access = await getMinistryAccess(client, user, ministryId)
  if (!access.canView || (manage && !access.canManage)) {
    const error = new Error(
      manage
        ? "You do not have permission to manage this ministry"
        : "You do not have access to this ministry",
    )
    ;(error as Error & { status?: number }).status = 403
    throw error
  }
  return access
}

export const writeSchedulingAudit = (
  client: PoolClient,
  context: MinistryIdentityContext,
  {
    action,
    entityType,
    entityId = null,
    ministryId = null,
    beforeData = null,
    afterData = null,
    metadata = {},
  }: {
    action: string
    entityType: string
    entityId?: string | null
    ministryId?: string | null
    beforeData?: unknown
    afterData?: unknown
    metadata?: Record<string, unknown>
  },
) =>
  client.query(
    `
      INSERT INTO ministry_audit_log (
        actor_user_id,
        active_profile_user_id,
        action,
        entity_type,
        entity_id,
        ministry_id,
        before_data,
        after_data,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB, $8::JSONB, $9::JSONB)
    `,
    [
      context.actor.id,
      context.user.id,
      action,
      entityType,
      entityId,
      ministryId,
      beforeData == null ? null : JSON.stringify(beforeData),
      afterData == null ? null : JSON.stringify(afterData),
      JSON.stringify(metadata),
    ],
  )
