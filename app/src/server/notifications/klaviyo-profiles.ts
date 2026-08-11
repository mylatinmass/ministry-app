import { getPool } from "../database"

const KLAVIYO_REVISION = "2026-07-15"
const MAX_ATTEMPTS = 5

const deliveryAllowed = () =>
  process.env.VERCEL_ENV === "production" ||
  process.env.ALLOW_PREVIEW_DELIVERY === "true"

const normalizePhone = (value: unknown) => {
  const raw = String(value || "").trim()
  const digits = raw.replace(/\D/g, "")
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`
  }
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return ""
}

const claimProfileSyncs = async () => {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(`
      UPDATE klaviyo_profile_syncs
      SET status = 'retry', next_attempt_at = now(), claimed_at = NULL,
          updated_at = now()
      WHERE status = 'processing'
        AND claimed_at < now() - INTERVAL '10 minutes'
    `)
    const result = await client.query(`
      WITH due AS (
        SELECT account_user_id
        FROM klaviyo_profile_syncs
        WHERE status IN ('pending', 'retry')
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        ORDER BY updated_at
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      )
      UPDATE klaviyo_profile_syncs sync
      SET status = 'processing',
          claimed_at = now(),
          attempt_count = attempt_count + 1,
          updated_at = now()
      FROM due
      WHERE sync.account_user_id = due.account_user_id
      RETURNING sync.*
    `)
    await client.query("COMMIT")
    return result.rows
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

const loadProfile = async (userId: string) => {
  const result = await getPool().query(
    `
      SELECT
        user_account.id,
        user_account.first_name,
        user_account.last_name,
        user_account.email,
        COALESCE(NULLIF(user_account.phone, ''), user_account.telephone) AS phone,
        user_account.global_role,
        user_account.status,
        user_account.is_volunteer_profile,
        EXISTS (
          SELECT 1
          FROM ministry_members membership
          WHERE membership.user_id = user_account.id
            AND membership.status = 'active'
        ) AS has_active_membership,
        EXISTS (
          SELECT 1
          FROM managed_profiles managed_profile
          WHERE managed_profile.child_user_id = user_account.id
            AND managed_profile.status IN ('active', 'separation_pending')
        ) AS is_managed_child
      FROM users user_account
      WHERE user_account.id = $1
      LIMIT 1
    `,
    [userId],
  )
  return result.rows[0] || null
}

const accountType = (profile: any) => {
  if (["owner", "super_admin"].includes(profile.global_role)) {
    return "administrator"
  }
  if (profile.has_active_membership && profile.is_volunteer_profile) {
    return "member_and_volunteer"
  }
  if (profile.has_active_membership) return "member"
  return "volunteer"
}

const updateSync = (
  userId: string,
  values: {
    status: "synced" | "retry" | "failed" | "skipped"
    profileId?: string | null
    nextAttemptMinutes?: number | null
    error?: string | null
  },
) =>
  getPool().query(
    `
      UPDATE klaviyo_profile_syncs
      SET status = $2,
          klaviyo_profile_id = COALESCE($3, klaviyo_profile_id),
          synced_at = CASE WHEN $2 = 'synced' THEN now() ELSE synced_at END,
          next_attempt_at = CASE
            WHEN $2 = 'retry' THEN now() + ($4 * INTERVAL '1 minute')
            ELSE NULL
          END,
          claimed_at = NULL,
          last_error = $5,
          updated_at = now()
      WHERE account_user_id = $1
    `,
    [
      userId,
      values.status,
      values.profileId || null,
      values.nextAttemptMinutes || null,
      values.error?.slice(0, 120) || null,
    ],
  )

const syncProfile = async (sync: any) => {
  const profile = await loadProfile(sync.account_user_id)
  if (
    !profile ||
    profile.status !== "active" ||
    profile.is_managed_child ||
    (!profile.has_active_membership &&
      !profile.is_volunteer_profile &&
      !["owner", "super_admin"].includes(profile.global_role))
  ) {
    await updateSync(sync.account_user_id, {
      status: "skipped",
      error: "profile_not_eligible",
    })
    return "skipped"
  }

  const email = String(profile.email || "").trim().toLowerCase()
  const phoneNumber = normalizePhone(profile.phone)
  if (!email && !phoneNumber) {
    await updateSync(sync.account_user_id, {
      status: "skipped",
      error: "profile_has_no_contact_identifier",
    })
    return "skipped"
  }

  const attributes: Record<string, unknown> = {
    external_id: `ministry:${profile.id}`,
    first_name: profile.first_name || undefined,
    last_name: profile.last_name || undefined,
    properties: {
      ministry_app_account: true,
      ministry_app_account_type: accountType(profile),
    },
  }
  if (email) attributes.email = email
  if (phoneNumber) attributes.phone_number = phoneNumber

  const response = await fetch("https://a.klaviyo.com/api/profile-import", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_API_KEY}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify({
      data: {
        type: "profile",
        attributes,
      },
    }),
  })

  if (![200, 201].includes(response.status)) {
    const result: any = await response.json().catch(() => ({}))
    const code = result?.errors?.[0]?.code || `klaviyo_http_${response.status}`
    throw Object.assign(new Error(code), { status: response.status, code })
  }

  const result: any = await response.json().catch(() => ({}))
  await updateSync(sync.account_user_id, {
    status: "synced",
    profileId: result?.data?.id || null,
  })
  return "synced"
}

export const processKlaviyoProfileSyncs = async () => {
  if (!deliveryAllowed()) return { claimed: 0, synced: 0, skipped: 0, failed: 0 }
  if (process.env.KLAVIYO_PROFILE_SYNC_ENABLED !== "true") {
    return { claimed: 0, synced: 0, skipped: 0, failed: 0 }
  }
  if (!(process.env.KLAVIYO_PRIVATE_API_KEY || "").trim()) {
    return { claimed: 0, synced: 0, skipped: 0, failed: 0 }
  }

  const syncs = await claimProfileSyncs()
  const result = { claimed: syncs.length, synced: 0, skipped: 0, failed: 0 }
  for (const sync of syncs) {
    try {
      const status = await syncProfile(sync)
      result[status as "synced" | "skipped"] += 1
    } catch (error: any) {
      result.failed += 1
      const retry = Number(sync.attempt_count) < MAX_ATTEMPTS
      await updateSync(sync.account_user_id, {
        status: retry ? "retry" : "failed",
        nextAttemptMinutes: Math.min(
          60,
          2 ** Math.max(0, Number(sync.attempt_count) - 1),
        ),
        error: error?.code || "klaviyo_profile_sync_failed",
      })
    }
  }
  return result
}
