-- Secure, one-response invitations for one or more ministries.
-- Only the SHA-256 token digest is stored. The bearer token exists solely in
-- the recipient's email link.

CREATE TABLE IF NOT EXISTS ministry_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email STRING NOT NULL,
  invited_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  token_hash STRING NOT NULL UNIQUE,
  status STRING NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  CONSTRAINT ministry_invitations_response_check
    CHECK (
      (status = 'pending' AND responded_at IS NULL)
      OR (status <> 'pending' AND responded_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS ministry_invitation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL
    REFERENCES ministry_invitations(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_invitation_items_invitation_ministry_key
    UNIQUE (invitation_id, ministry_id)
);

CREATE INDEX IF NOT EXISTS ministry_invitations_email_status_idx
  ON ministry_invitations (lower(email), status);

CREATE INDEX IF NOT EXISTS ministry_invitations_requested_by_created_idx
  ON ministry_invitations (requested_by, created_at DESC);

CREATE INDEX IF NOT EXISTS ministry_invitation_items_ministry_idx
  ON ministry_invitation_items (ministry_id, invitation_id);
