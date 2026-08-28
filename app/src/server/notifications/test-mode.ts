import { getPool } from "../database"

export type NotificationTestMode = {
  enabled: boolean
  targetUserId: string | null
  targetName: string | null
}

export const getNotificationTestMode = async (
  queryable: { query: (text: string, values?: any[]) => Promise<any> } = getPool(),
): Promise<NotificationTestMode> => {
  const result = await queryable.query(
    `
      SELECT settings
      FROM chapel_settings
      WHERE setting_key = 'primary'
      LIMIT 1
    `,
  )
  const settings = result.rows[0]?.settings || {}
  if (settings.notificationTestModeEnabled !== true) {
    return { enabled: false, targetUserId: null, targetName: null }
  }

  const targetUserId = String(
    settings.notificationTestAccountUserId || "",
  ).trim()
  if (!targetUserId) {
    throw Object.assign(
      new Error("Notification Test Mode is enabled without a testing profile"),
      { code: "notification_test_profile_missing" },
    )
  }
  const target = await queryable.query(
    `
      SELECT id, first_name, last_name
      FROM ministry_accounts
      WHERE id = $1
        AND status = 'active'
        AND global_role IN ('owner', 'super_admin')
      LIMIT 1
    `,
    [targetUserId],
  )
  if (!target.rowCount) {
    throw Object.assign(
      new Error("The Notification Test Mode profile is unavailable"),
      { code: "notification_test_profile_unavailable" },
    )
  }
  return {
    enabled: true,
    targetUserId: target.rows[0].id,
    targetName:
      [target.rows[0].first_name, target.rows[0].last_name]
        .filter(Boolean)
        .join(" ") || "Testing profile",
  }
}

export const applyNotificationTestMetadata = async (
  metadata: Record<string, any>,
  originalRecipientUserId: string,
) => {
  const testMode = await getNotificationTestMode()
  if (!testMode.enabled) return metadata
  return {
    ...metadata,
    notificationTestMode: true,
    notificationTestAccountUserId: testMode.targetUserId,
    notificationOriginalRecipientUserId: originalRecipientUserId,
  }
}
