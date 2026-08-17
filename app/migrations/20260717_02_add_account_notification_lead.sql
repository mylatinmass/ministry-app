-- Account-wide reminder timing for every ministry event.

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_lead_minutes INT NOT NULL DEFAULT 60
  CHECK (notification_lead_minutes IN (15, 30, 45, 60, 120, 180, 240));
