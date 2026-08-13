import type { PoolClient } from "pg"
import { getMinistryAccess } from "./authorization"

export const getPriestPrivacyAccess = async (
  client: PoolClient,
  user: Record<string, any>,
  event: Record<string, any>,
) => {
  if (event.visibility !== "private") {
    return { canSeeEvent: true, canSeeProtectedDetails: false, isPriestMember: false }
  }
  const priestMinistry = await client.query(
    `SELECT id FROM ministries WHERE slug = 'priests' LIMIT 1`,
  )
  const priestMinistryId = priestMinistry.rows[0]?.id
  if (!priestMinistryId) {
    return { canSeeEvent: false, canSeeProtectedDetails: false, isPriestMember: false }
  }
  const access = await getMinistryAccess(client, user, priestMinistryId)
  const assigned = await client.query(
    `
      SELECT 1
      FROM responsibility_assignments assignment
      WHERE assignment.event_id = $1
        AND assignment.user_id = $2
        AND assignment.status NOT IN ('declined', 'cancelled')
      LIMIT 1
    `,
    [event.id, user.id],
  )
  const canSeeProtectedDetails =
    access.canManage || Number(assigned.rowCount || 0) > 0
  return {
    canSeeEvent: access.canView || canSeeProtectedDetails,
    canSeeProtectedDetails,
    isPriestMember: access.canView,
  }
}
