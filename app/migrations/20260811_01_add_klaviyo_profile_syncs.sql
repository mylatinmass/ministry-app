-- Keep Klaviyo profile creation durable and separate from communication consent.
-- Managed children are intentionally excluded while they remain attached to a
-- guardian; notifications and external contact data belong to the guardian.

CREATE TABLE IF NOT EXISTS klaviyo_profile_syncs (
  account_user_id UUID PRIMARY KEY REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  status STRING NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  claimed_at TIMESTAMPTZ NULL,
  klaviyo_profile_id STRING NULL,
  synced_at TIMESTAMPTZ NULL,
  last_error STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT klaviyo_profile_syncs_status_check
    CHECK (status IN ('pending', 'processing', 'synced', 'retry', 'failed', 'skipped')),
  CONSTRAINT klaviyo_profile_syncs_attempt_count_check
    CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS klaviyo_profile_syncs_due_idx
  ON klaviyo_profile_syncs (status, next_attempt_at, updated_at);

-- Queue existing independent Ministry accounts and registered volunteers.
INSERT INTO klaviyo_profile_syncs (account_user_id)
SELECT user_account.id
FROM ministry_accounts user_account
WHERE user_account.status = 'active'
  AND (
    user_account.global_role IN ('owner', 'super_admin')
    OR user_account.is_volunteer_profile = true
    OR EXISTS (
      SELECT 1
      FROM ministry_members membership
      WHERE membership.user_id = user_account.id
        AND membership.status = 'active'
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM managed_profiles managed_profile
    WHERE managed_profile.child_user_id = user_account.id
      AND managed_profile.status IN ('active', 'separation_pending')
  )
  AND (
    NULLIF(btrim(user_account.email), '') IS NOT NULL
    OR NULLIF(
      btrim(COALESCE(NULLIF(user_account.phone, ''), user_account.telephone)),
      ''
    ) IS NOT NULL
  )
ON CONFLICT (account_user_id) DO NOTHING;
