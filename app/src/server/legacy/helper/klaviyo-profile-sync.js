const queueKlaviyoProfileSync = (client, userId) =>
  client.query(
    `
      INSERT INTO klaviyo_profile_syncs (account_user_id)
      SELECT related_user.id
      FROM ministry_accounts user_account
      CROSS JOIN LATERAL (
        SELECT user_account.id
        UNION
        SELECT managed_profile.guardian_user_id
        FROM managed_profiles managed_profile
        WHERE managed_profile.child_user_id = user_account.id
          AND managed_profile.status IN ('active', 'separation_pending')
        UNION
        SELECT managed_profile.child_user_id
        FROM managed_profiles managed_profile
        WHERE managed_profile.guardian_user_id = user_account.id
          AND managed_profile.status IN ('active', 'separation_pending')
      ) related_user
      WHERE user_account.id = $1
      ON CONFLICT (account_user_id)
      DO UPDATE SET
        status = 'pending',
        attempt_count = 0,
        next_attempt_at = NULL,
        claimed_at = NULL,
        synced_at = NULL,
        last_error = NULL,
        updated_at = now()
    `,
    [userId]
  )

module.exports = { queueKlaviyoProfileSync }
