-- A Mass event can celebrate a proper from a date other than the civil event
-- date (for example, an approved External Solemnity). Keep the selected Ordo
-- day attached to the event and record why an authorized administrator chose it.

ALTER TABLE event_ordo_selections
  ADD COLUMN IF NOT EXISTS celebration_type STRING NOT NULL DEFAULT 'event_date';

ALTER TABLE event_ordo_selections
  ADD COLUMN IF NOT EXISTS override_note STRING NULL;

