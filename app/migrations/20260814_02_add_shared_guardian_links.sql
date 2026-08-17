-- Allow one managed child identity to be connected to multiple guardians.

DROP INDEX IF EXISTS managed_profiles_active_child_key;

CREATE UNIQUE INDEX IF NOT EXISTS managed_profiles_active_guardian_child_key
  ON managed_profiles (guardian_user_id, child_user_id)
  WHERE status IN ('active', 'separation_pending');

CREATE TABLE IF NOT EXISTS managed_profile_link_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  invited_by_guardian_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  invitee_email STRING NOT NULL,
  token_hash STRING NOT NULL UNIQUE,
  status STRING NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_guardian_user_id UUID NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  responded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT managed_profile_link_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS managed_profile_link_invitations_pending_key
  ON managed_profile_link_invitations (child_user_id, lower(invitee_email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS managed_profile_link_invitations_child_status_idx
  ON managed_profile_link_invitations (child_user_id, status, expires_at);

ALTER TABLE ministry_message_recipients
  DROP CONSTRAINT IF EXISTS ministry_message_recipients_message_profile_key;

CREATE UNIQUE INDEX IF NOT EXISTS ministry_message_recipients_message_profile_account_key
  ON ministry_message_recipients (
    message_id, profile_user_id, delivery_account_user_id
  );
