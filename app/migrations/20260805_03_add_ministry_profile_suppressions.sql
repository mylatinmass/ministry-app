-- Soft-removal history for Ministry App profiles.
--
-- A suppression is intentionally separate from ministry_accounts.status because the shared
-- ministry_accounts row may still be used by other applications. Ministry memberships and
-- historical scheduling records remain intact.

CREATE TABLE IF NOT EXISTS ministry_profile_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ministry_accounts(id),
  suppressed_by UUID NOT NULL REFERENCES ministry_accounts(id),
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reactivated_by UUID NULL REFERENCES ministry_accounts(id),
  reactivated_at TIMESTAMPTZ NULL,
  reason STRING NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ministry_profile_suppressions_active_user_idx
  ON ministry_profile_suppressions (user_id)
  WHERE reactivated_at IS NULL;

CREATE INDEX IF NOT EXISTS ministry_profile_suppressions_user_history_idx
  ON ministry_profile_suppressions (user_id, suppressed_at DESC);
