CREATE TABLE IF NOT EXISTS ministry_login_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  token_hash STRING NOT NULL UNIQUE,
  requested_email STRING NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ministry_login_links_user_created_idx
  ON ministry_login_links (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ministry_login_links_expires_idx
  ON ministry_login_links (expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
