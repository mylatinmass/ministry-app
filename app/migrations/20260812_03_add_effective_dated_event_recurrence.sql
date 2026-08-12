-- Preserve each generated occurrence's original schedule position so a single
-- exception never changes where a later "this and future" rule begins.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_anchor_at TIMESTAMPTZ NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_parent_group_id UUID NULL;

UPDATE events
SET recurrence_anchor_at = start_time
WHERE recurrence_group_id IS NOT NULL
  AND recurrence_anchor_at IS NULL;

CREATE INDEX IF NOT EXISTS events_recurrence_effective_date_idx
  ON events (recurrence_group_id, recurrence_anchor_at)
  WHERE recurrence_group_id IS NOT NULL;
