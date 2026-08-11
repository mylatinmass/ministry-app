-- Complete account notification preferences, reminder stages, and delivery logs.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_reminders_enabled BOOL NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_schedule_changes_enabled BOOL NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_announcements_enabled BOOL NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_volunteer_opportunities_enabled BOOL NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sms_transactional_consent_at TIMESTAMPTZ NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sms_transactional_consent_source STRING NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sms_transactional_consent_text_version STRING NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS confirmation_deadline_at TIMESTAMPTZ NULL;

UPDATE events
SET published_at = COALESCE(published_at, updated_at)
WHERE status IN ('published', 'completed', 'archived');

ALTER TABLE ministry_reminders
  ADD COLUMN IF NOT EXISTS reminder_type STRING NOT NULL DEFAULT 'event_offset';

ALTER TABLE ministry_reminders
  DROP CONSTRAINT IF EXISTS ministry_reminders_type_check;

ALTER TABLE ministry_reminders
  ADD CONSTRAINT ministry_reminders_type_check
    CHECK (
      reminder_type IN (
        'confirmation_midpoint',
        'confirmation_deadline',
        'confirmation_overdue',
        'one_week',
        'event_offset'
      )
    );

ALTER TABLE ministry_alerts
  DROP CONSTRAINT IF EXISTS ministry_alerts_delivery_status_check;

ALTER TABLE ministry_alerts
  ADD CONSTRAINT ministry_alerts_delivery_status_check
    CHECK (
      delivery_status IN (
        'pending', 'processing', 'retry', 'sent', 'failed', 'skipped'
      )
    );

CREATE TABLE IF NOT EXISTS ministry_alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES ministry_alerts(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel STRING NOT NULL,
  provider STRING NOT NULL,
  status STRING NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  provider_status INT NULL,
  provider_message_id STRING NULL,
  error_code STRING NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_alert_deliveries_channel_check
    CHECK (channel IN ('email', 'telegram', 'sms', 'push')),
  CONSTRAINT ministry_alert_deliveries_status_check
    CHECK (status IN ('accepted', 'sent', 'failed', 'skipped')),
  CONSTRAINT ministry_alert_deliveries_attempt_check CHECK (attempt_number > 0)
);

CREATE INDEX IF NOT EXISTS ministry_alert_deliveries_alert_idx
  ON ministry_alert_deliveries (alert_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS ministry_alert_deliveries_recipient_idx
  ON ministry_alert_deliveries (recipient_user_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS ministry_reminders_type_due_idx
  ON ministry_reminders (reminder_type, status, scheduled_for);
