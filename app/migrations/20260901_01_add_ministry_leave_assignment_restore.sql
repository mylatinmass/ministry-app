-- Track substitution requests created by a voluntary ministry departure so
-- untouched assignments can be restored if the membership is reactivated.

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS request_source STRING NOT NULL DEFAULT 'member';

ALTER TABLE assignment_change_requests
  ADD COLUMN IF NOT EXISTS previous_assignment_status STRING NULL;

ALTER TABLE assignment_change_requests
  DROP CONSTRAINT IF EXISTS assignment_change_requests_source_check;

ALTER TABLE assignment_change_requests
  ADD CONSTRAINT assignment_change_requests_source_check
  CHECK (request_source IN ('member', 'availability', 'ministry_leave'));

ALTER TABLE assignment_change_requests
  DROP CONSTRAINT IF EXISTS assignment_change_requests_previous_status_check;

ALTER TABLE assignment_change_requests
  ADD CONSTRAINT assignment_change_requests_previous_status_check
  CHECK (
    previous_assignment_status IS NULL
    OR previous_assignment_status IN ('pending', 'assigned', 'confirmed')
  );

CREATE INDEX IF NOT EXISTS assignment_change_requests_leave_restore_idx
  ON assignment_change_requests (
    subject_user_id, ministry_id, request_source, status, created_at DESC
  );
