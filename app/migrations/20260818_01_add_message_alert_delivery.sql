-- Messages are long-form email. Alerts use every enabled immediate channel
-- except email and retain independent delivery/retry history per channel.
-- The existing ministry_messages.channel value `telegram` remains the internal
-- legacy storage value for Alert so applied message-table constraints and
-- history do not need to be rewritten.

CREATE TABLE IF NOT EXISTS ministry_message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL
    REFERENCES ministry_message_recipients(id) ON DELETE CASCADE,
  channel STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  claimed_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  provider STRING NULL,
  provider_message_id STRING NULL,
  last_error STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_message_deliveries_channel_check
    CHECK (channel IN ('email', 'telegram', 'sms', 'push')),
  CONSTRAINT ministry_message_deliveries_status_check
    CHECK (status IN ('pending', 'processing', 'retry', 'sent', 'failed', 'skipped')),
  CONSTRAINT ministry_message_deliveries_attempt_check
    CHECK (attempt_count >= 0),
  CONSTRAINT ministry_message_deliveries_recipient_channel_key
    UNIQUE (recipient_id, channel)
);

CREATE INDEX IF NOT EXISTS ministry_message_deliveries_due_idx
  ON ministry_message_deliveries (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS ministry_message_deliveries_recipient_idx
  ON ministry_message_deliveries (recipient_id, status);
