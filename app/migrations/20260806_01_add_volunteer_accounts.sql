-- Public volunteers receive ordinary application profiles without becoming
-- members of a ministry. Public profile IDs are opaque bearer identifiers used
-- only to prefill a volunteer form from a directly addressed event email.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_profile_id UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_volunteer_profile BOOL NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS users_public_profile_id_key
  ON users (public_profile_id);

CREATE TABLE IF NOT EXISTS volunteer_account_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL
    REFERENCES responsibility_assignments(id) ON DELETE CASCADE,
  token_hash STRING NOT NULL UNIQUE,
  status STRING NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT volunteer_account_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS volunteer_account_invitations_user_status_idx
  ON volunteer_account_invitations (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS volunteer_account_invitations_assignment_idx
  ON volunteer_account_invitations (assignment_id);
