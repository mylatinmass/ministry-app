-- Each authorized reviewer gets an individual private token. The request row is
-- locked when answered, so only the first accept or decline can win.

CREATE TABLE IF NOT EXISTS managed_profile_membership_request_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL
    REFERENCES managed_profile_membership_requests(id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  token_hash STRING NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  emailed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT managed_profile_request_reviewer_key
    UNIQUE (request_id, reviewer_user_id)
);

CREATE INDEX IF NOT EXISTS managed_profile_request_recipients_request_idx
  ON managed_profile_membership_request_recipients (request_id);
