-- Account-wide availability blocks and durable assignment change requests.
-- Blocks belong to the active profile, so a guardian can manage a child without
-- mixing the child's availability with the guardian's own schedule.

CREATE TABLE IF NOT EXISTS availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  label STRING NULL,
  status STRING NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES ministry_accounts(id),
  cancelled_by UUID NULL REFERENCES ministry_accounts(id),
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_blocks_date_order_check
    CHECK (end_date >= start_date),
  CONSTRAINT availability_blocks_status_check
    CHECK (status IN ('active', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS availability_blocks_user_dates_idx
  ON availability_blocks (user_id, status, start_date, end_date);

CREATE TABLE IF NOT EXISTS assignment_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES responsibility_assignments(id) ON DELETE CASCADE,
  subject_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  requested_by_user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  reason STRING NULL,
  status STRING NOT NULL DEFAULT 'pending',
  resolved_by_user_id UUID NULL REFERENCES ministry_accounts(id) ON DELETE RESTRICT,
  resolved_at TIMESTAMPTZ NULL,
  resolution_note STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assignment_change_requests_status_check
    CHECK (status IN ('pending', 'approved', 'declined', 'resolved', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS assignment_change_requests_pending_key
  ON assignment_change_requests (assignment_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS assignment_change_requests_subject_status_idx
  ON assignment_change_requests (subject_user_id, status, created_at DESC);
