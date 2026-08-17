-- Preserve assignment lifecycle separately from what happened at the service.
-- This lets a confirmed assignment later be recorded as served, no-show,
-- substituted, or excused without erasing the original confirmation history.

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS service_outcome STRING NULL;

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ NULL;

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS outcome_recorded_by UUID NULL REFERENCES ministry_accounts(id);

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS outcome_note STRING NULL;

ALTER TABLE responsibility_assignments
  DROP CONSTRAINT IF EXISTS responsibility_assignments_service_outcome_check;

ALTER TABLE responsibility_assignments
  ADD CONSTRAINT responsibility_assignments_service_outcome_check
  CHECK (
    service_outcome IS NULL
    OR service_outcome IN ('served', 'no_show', 'substitute_served', 'excused')
  );

CREATE INDEX IF NOT EXISTS responsibility_assignments_outcome_history_idx
  ON responsibility_assignments (user_id, service_outcome, outcome_recorded_at DESC);

-- NULL means the absence applies account-wide. A ministry id limits it to that
-- ministry while keeping the existing account-wide behavior as the default.
ALTER TABLE availability_blocks
  ADD COLUMN IF NOT EXISTS ministry_id UUID NULL REFERENCES ministries(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS availability_blocks_user_ministry_dates_idx
  ON availability_blocks (user_id, ministry_id, status, start_date, end_date);
