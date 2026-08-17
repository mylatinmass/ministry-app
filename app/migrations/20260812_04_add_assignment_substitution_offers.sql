-- Durable, first-acceptance substitution requests for assigned members.

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS request_type STRING NOT NULL DEFAULT 'change';

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS ministry_id UUID NULL REFERENCES ministries(id);

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS event_id UUID NULL REFERENCES events(id);

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS responsibility_id UUID NULL
    REFERENCES event_responsibilities(id);

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS minimum_level_rank INT NOT NULL DEFAULT 0;

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS accepted_by_user_id UUID NULL REFERENCES ministry_accounts(id);

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS replacement_assignment_id UUID NULL
    REFERENCES responsibility_assignments(id);

ALTER TABLE assignment_change_requests
  DROP CONSTRAINT IF EXISTS assignment_change_requests_status_check;

ALTER TABLE assignment_change_requests
  ADD CONSTRAINT assignment_change_requests_status_check
  CHECK (status IN (
    'pending', 'approved', 'declined', 'resolved', 'cancelled',
    'accepted', 'expired'
  ));

ALTER TABLE assignment_change_requests
  ADD CONSTRAINT assignment_change_requests_type_check
  CHECK (request_type IN ('change', 'substitute'));

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS replaces_assignment_id UUID NULL
    REFERENCES responsibility_assignments(id);

ALTER TABLE responsibility_assignments
  DROP CONSTRAINT IF EXISTS responsibility_assignments_status_check;

ALTER TABLE responsibility_assignments
  ADD CONSTRAINT responsibility_assignments_status_check
  CHECK (status IN (
    'interested', 'pending', 'assigned', 'confirmed', 'declined',
    'change_requested', 'replaced', 'cancelled', 'completed'
  ));

CREATE TABLE IF NOT EXISTS assignment_substitution_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id UUID NOT NULL
    REFERENCES assignment_change_requests(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  status STRING NOT NULL DEFAULT 'offered',
  notified_at TIMESTAMPTZ NULL,
  responded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assignment_substitution_offers_status_check
    CHECK (status IN ('offered', 'accepted', 'closed', 'expired', 'ineligible')),
  CONSTRAINT assignment_substitution_offers_request_recipient_key
    UNIQUE (change_request_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS assignment_substitution_offers_recipient_status_idx
  ON assignment_substitution_offers (recipient_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS assignment_change_requests_substitute_status_idx
  ON assignment_change_requests (request_type, status, expires_at);
