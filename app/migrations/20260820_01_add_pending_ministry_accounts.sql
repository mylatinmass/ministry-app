ALTER TABLE ministry_accounts
  DROP CONSTRAINT IF EXISTS ministry_accounts_status_check;

ALTER TABLE ministry_accounts
  ADD CONSTRAINT ministry_accounts_status_check
  CHECK (status IN ('active', 'inactive', 'pending'));

-- Profiles created before this workflow were marked active immediately.
UPDATE ministry_accounts account
SET status = 'pending', updated_at = now()
WHERE account.status = 'active'
  AND account.global_role = 'regular'
  AND EXISTS (
    SELECT 1 FROM managed_profiles profile
    WHERE profile.child_user_id = account.id
      AND profile.status IN ('active', 'separation_pending')
  )
  AND NOT EXISTS (
    SELECT 1 FROM ministry_members membership
    WHERE membership.user_id = account.id
      AND membership.status = 'active'
  );

CREATE INDEX IF NOT EXISTS ministry_accounts_status_created_at_idx
  ON ministry_accounts (status, created_at DESC);
