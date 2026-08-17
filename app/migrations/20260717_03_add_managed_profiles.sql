-- Managed family profiles are real ministry_accounts whose history remains attached to the
-- same user ID when they later activate an independent login.

CREATE TABLE IF NOT EXISTS managed_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  child_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  status STRING NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL,
  CONSTRAINT managed_profiles_distinct_ministry_accounts_check
    CHECK (guardian_user_id <> child_user_id),
  CONSTRAINT managed_profiles_status_check
    CHECK (status IN ('active', 'separation_pending', 'separated', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS managed_profiles_active_child_key
  ON managed_profiles (child_user_id)
  WHERE status IN ('active', 'separation_pending');

CREATE INDEX IF NOT EXISTS managed_profiles_guardian_status_idx
  ON managed_profiles (guardian_user_id, status);

CREATE TABLE IF NOT EXISTS managed_profile_membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  child_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  status STRING NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID NULL REFERENCES ministry_accounts(id),
  reviewed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT managed_profile_requests_status_check
    CHECK (status IN ('pending', 'approved', 'declined', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS managed_profile_requests_pending_key
  ON managed_profile_membership_requests (child_user_id, ministry_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS managed_profile_requests_ministry_status_idx
  ON managed_profile_membership_requests (ministry_id, status);

CREATE TABLE IF NOT EXISTS managed_profile_separations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  managed_profile_id UUID NOT NULL REFERENCES managed_profiles(id) ON DELETE CASCADE,
  child_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  new_email STRING NOT NULL,
  token_hash STRING NOT NULL UNIQUE,
  status STRING NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT managed_profile_separations_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS managed_profile_separations_child_status_idx
  ON managed_profile_separations (child_user_id, status);

CREATE TABLE IF NOT EXISTS managed_profile_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  subject_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  action STRING NOT NULL,
  entity_type STRING NULL,
  entity_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS managed_profile_audit_subject_created_idx
  ON managed_profile_audit (subject_user_id, created_at DESC);
