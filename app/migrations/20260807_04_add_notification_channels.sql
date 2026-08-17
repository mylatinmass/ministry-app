-- Account-wide notification channel preferences.

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_email_enabled BOOL NOT NULL DEFAULT false;

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_telegram_enabled BOOL NOT NULL DEFAULT false;

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_sms_enabled BOOL NOT NULL DEFAULT false;

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS notification_push_enabled BOOL NOT NULL DEFAULT false;

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ NULL;

ALTER TABLE ministry_reminder_deliveries
  DROP CONSTRAINT IF EXISTS ministry_reminder_deliveries_channel_check;

ALTER TABLE ministry_reminder_deliveries
  ADD CONSTRAINT ministry_reminder_deliveries_channel_check
    CHECK (channel IN ('email', 'telegram', 'sms', 'push'));
