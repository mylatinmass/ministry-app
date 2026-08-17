CREATE TABLE IF NOT EXISTS assignment_response_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES responsibility_assignments(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL
    REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  token_hash STRING NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  response STRING NULL,
  response_channel STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assignment_response_tokens_response_check
    CHECK (response IS NULL OR response IN ('confirmed', 'declined')),
  CONSTRAINT assignment_response_tokens_channel_check
    CHECK (response_channel IS NULL OR response_channel IN ('email', 'telegram'))
);

CREATE INDEX IF NOT EXISTS assignment_response_tokens_assignment_idx
  ON assignment_response_tokens (assignment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS assignment_response_tokens_expiry_idx
  ON assignment_response_tokens (expires_at, used_at);
