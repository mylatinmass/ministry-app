-- Administrative access and eligibility to receive work assignments are
-- separate concepts. Global roles never imply serving eligibility.

ALTER TABLE ministry_members
  ADD COLUMN IF NOT EXISTS can_serve BOOL NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ministry_members_serving_roster_idx
  ON ministry_members (ministry_id, status, can_serve);
