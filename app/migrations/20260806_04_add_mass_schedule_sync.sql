-- Treat the public MyLatinMass Mass Schedule as the source-managed base calendar.
-- Imported Masses remain normal Ministry App events, so authorized leaders can
-- add event-specific responsibilities and assignments without storing private
-- staffing data in the public schedule source.

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS system_key STRING NULL;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS system_managed BOOL NOT NULL DEFAULT false;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS definition_hash STRING NULL;

CREATE UNIQUE INDEX IF NOT EXISTS templates_system_key_key
  ON templates (system_key)
  WHERE system_key IS NOT NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_source STRING NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_source_key STRING NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_event_type STRING NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_source_payload JSONB NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_source_title STRING NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_source_start_time TIMESTAMPTZ NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_source_end_time TIMESTAMPTZ NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_source_location STRING NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_last_seen_at TIMESTAMPTZ NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS schedule_synced_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_schedule_source_key_key
  ON events (schedule_source, schedule_source_key)
  WHERE schedule_source IS NOT NULL
    AND schedule_source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_schedule_source_start_idx
  ON events (schedule_source, schedule_source_start_time);
