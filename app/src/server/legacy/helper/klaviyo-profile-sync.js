const queueKlaviyoProfileSync = (client, userId) =>
  client.query(
    `
      INSERT INTO klaviyo_profile_syncs (account_user_id)
      SELECT COALESCE(managed_profile.guardian_user_id, user_account.id)
      FROM users user_account
      LEFT JOIN managed_profiles managed_profile
        ON managed_profile.child_user_id = user_account.id
       AND managed_profile.status IN ('active', 'separation_pending')
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
