-- Public access requests are intentionally not tied to a chapel or ministry.
-- A global administrator assigns the appropriate ministry while approving the
-- request, which creates the normal private invitation.

CREATE TABLE IF NOT EXISTS ministry_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name STRING NOT NULL,
  last_name STRING NOT NULL,
  email STRING NOT NULL,
  phone STRING NULL,
  message STRING NULL,
  status STRING NOT NULL DEFAULT 'pending',
  reviewed_by UUID NULL REFERENCES users(id),
  assigned_ministry_id UUID NULL REFERENCES ministries(id),
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_access_requests_status_check
    CHECK (status IN ('pending', 'approved', 'declined')),
  CONSTRAINT ministry_access_requests_review_check
    CHECK (
      (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ministry_access_requests_pending_email_key
  ON ministry_access_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ministry_access_requests_status_created_idx
  ON ministry_access_requests (status, created_at);
