-- Volunteer events belong to the standalone Ministry App even when no ministry
-- coordinates them. Their assignments remain event-scoped and are stored in
-- event_responsibilities / responsibility_assignments.

ALTER TABLE events
  ALTER COLUMN ministry_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS events_standalone_volunteer_start_idx
  ON events (start_time)
  WHERE ministry_id IS NULL AND participation_type = 'volunteers';
