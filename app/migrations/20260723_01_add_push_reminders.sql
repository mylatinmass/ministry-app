-- Durable Web Push subscriptions and assignment reminders.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint STRING NOT NULL,
  endpoint_hash STRING NOT NULL UNIQUE,
  p256dh_key STRING NOT NULL,
  auth_key STRING NOT NULL,
  user_agent STRING NULL,
  status STRING NOT NULL DEFAULT 'active',
  last_success_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_status_check
    CHECK (status IN ('active', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS push_subscriptions_account_status_idx
  ON push_subscriptions (account_user_id, status);

CREATE TABLE IF NOT EXISTS ministry_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES responsibility_assignments(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  subject_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  event_updated_at TIMESTAMPTZ NOT NULL,
  status STRING NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  claimed_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  canceled_at TIMESTAMPTZ NULL,
  last_error STRING NULL,
  dedupe_key STRING NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_reminders_status_check
    CHECK (
      status IN (
        'pending', 'processing', 'sent', 'retry', 'failed', 'cancelled'
      )
    ),
  CONSTRAINT ministry_reminders_attempt_count_check CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS ministry_reminders_due_idx
  ON ministry_reminders (status, scheduled_for, next_attempt_at);

CREATE INDEX IF NOT EXISTS ministry_reminders_assignment_idx
  ON ministry_reminders (assignment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ministry_reminders_recipient_idx
  ON ministry_reminders (recipient_user_id, scheduled_for DESC);

CREATE TABLE IF NOT EXISTS ministry_reminder_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES ministry_reminders(id) ON DELETE CASCADE,
  subscription_id UUID NULL REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  channel STRING NOT NULL,
  status STRING NOT NULL,
  provider_status INT NULL,
  error_code STRING NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_reminder_deliveries_channel_check
    CHECK (channel IN ('push', 'email')),
  CONSTRAINT ministry_reminder_deliveries_status_check
    CHECK (status IN ('sent', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS ministry_reminder_deliveries_reminder_idx
  ON ministry_reminder_deliveries (reminder_id, attempted_at DESC);
