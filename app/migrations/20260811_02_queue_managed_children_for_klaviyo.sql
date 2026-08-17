-- Represent managed children in Klaviyo by their stable Ministry user ID only.
-- Contact delivery remains attached to the guardian, so a guardian email or
-- phone number is never copied onto multiple Klaviyo profiles.

INSERT INTO klaviyo_profile_syncs (account_user_id)
SELECT DISTINCT managed_account.account_user_id
FROM (
  SELECT managed_profile.child_user_id AS account_user_id
  FROM managed_profiles managed_profile
  JOIN ministry_accounts child ON child.id = managed_profile.child_user_id
  WHERE managed_profile.status IN ('active', 'separation_pending')
    AND child.status = 'active'
  UNION
  SELECT managed_profile.guardian_user_id AS account_user_id
  FROM managed_profiles managed_profile
  JOIN ministry_accounts guardian ON guardian.id = managed_profile.guardian_user_id
  WHERE managed_profile.status IN ('active', 'separation_pending')
    AND guardian.status = 'active'
) managed_account
ON CONFLICT (account_user_id)
DO UPDATE SET
  status = 'pending',
  attempt_count = 0,
  next_attempt_at = NULL,
  claimed_at = NULL,
  synced_at = NULL,
  last_error = NULL,
  updated_at = now();
