-- Distinguish ordinary staffed positions from an expected all-member roster.

ALTER TABLE template_responsibilities
  ADD COLUMN IF NOT EXISTS assignment_mode STRING NOT NULL DEFAULT 'standard';

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS assignment_mode STRING NOT NULL DEFAULT 'standard';

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS preferred_assignee_user_id UUID NULL
    REFERENCES ministry_accounts(id) ON DELETE SET NULL;

ALTER TABLE template_responsibilities
  DROP CONSTRAINT IF EXISTS template_responsibilities_assignment_mode_check;

ALTER TABLE template_responsibilities
  ADD CONSTRAINT template_responsibilities_assignment_mode_check
  CHECK (assignment_mode IN ('standard', 'all_available_members'));

ALTER TABLE event_responsibilities
  DROP CONSTRAINT IF EXISTS event_responsibilities_assignment_mode_check;

ALTER TABLE event_responsibilities
  ADD CONSTRAINT event_responsibilities_assignment_mode_check
  CHECK (assignment_mode IN ('standard', 'all_available_members'));

CREATE INDEX IF NOT EXISTS event_responsibilities_assignment_mode_idx
  ON event_responsibilities (event_id, assignment_mode, status);

