-- Allow leaders to decide which duties may use member-to-member substitution.
-- Existing and new responsibilities allow substitutes unless explicitly disabled.

ALTER TABLE template_responsibilities
  ADD COLUMN IF NOT EXISTS substitution_allowed BOOL NOT NULL DEFAULT true;

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS substitution_allowed BOOL NOT NULL DEFAULT true;

