-- Public volunteer assignments can be shown outside a ministry, and an
-- unlimited assignment remains open regardless of how many people sign up.

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS is_public_assignment BOOL NOT NULL DEFAULT false;

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS unlimited_capacity BOOL NOT NULL DEFAULT false;

-- Data backfill follows in the next migration so CockroachDB can finish making
-- these new columns public before they are referenced.
