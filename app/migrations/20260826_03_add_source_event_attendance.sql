-- Allow a cloned event to call the assigned roster from its source event.

ALTER TABLE template_responsibilities
  DROP CONSTRAINT IF EXISTS template_responsibilities_assignment_mode_check;

ALTER TABLE template_responsibilities
  ADD CONSTRAINT template_responsibilities_assignment_mode_check
  CHECK (assignment_mode IN (
    'standard',
    'all_available_members',
    'all_active_members',
    'source_event_assignees'
  ));

ALTER TABLE event_responsibilities
  DROP CONSTRAINT IF EXISTS event_responsibilities_assignment_mode_check;

ALTER TABLE event_responsibilities
  ADD CONSTRAINT event_responsibilities_assignment_mode_check
  CHECK (assignment_mode IN (
    'standard',
    'all_available_members',
    'all_active_members',
    'source_event_assignees'
  ));
