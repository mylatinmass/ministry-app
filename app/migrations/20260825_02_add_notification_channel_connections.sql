-- Remember which email address and telephone number were successfully connected.
ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_email_connected_value STRING NULL;

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_email_connected_at TIMESTAMPTZ NULL;

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_sms_connected_value STRING NULL;

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_sms_connected_at TIMESTAMPTZ NULL;
