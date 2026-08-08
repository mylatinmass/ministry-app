-- In-app alerts remain attached to the affected profile while delivery is
-- grouped for the account contact (for example, a parent managing children).
CREATE TABLE IF NOT EXISTS ministry_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind STRING NOT NULL,
  title STRING NOT NULL,
  message STRING NOT NULL,
  assignment_id UUID NULL REFERENCES responsibility_assignments(id) ON DELETE CASCADE,
  event_id UUID NULL REFERENCES events(id) ON DELETE CASCADE,
  ministry_id UUID NULL REFERENCES ministries(id) ON DELETE CASCADE,
  dedupe_key STRING NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ NULL,
  delivery_status STRING NOT NULL DEFAULT 'pending',
  digest_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  last_error STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_alerts_delivery_status_check
    CHECK (delivery_status IN ('pending', 'processing', 'retry', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS ministry_alerts_subject_unread_idx
  ON ministry_alerts (subject_user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS ministry_alerts_digest_idx
  ON ministry_alerts (delivery_status, digest_after, recipient_user_id);
