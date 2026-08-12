-- One-way ministry announcements with an in-app inbox and durable delivery.
CREATE TABLE IF NOT EXISTS ministry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NULL REFERENCES ministries(id) ON DELETE SET NULL,
  audience_scope STRING NOT NULL,
  channel STRING NOT NULL,
  subject STRING NULL,
  body STRING NOT NULL,
  created_by_actor_id UUID NOT NULL REFERENCES users(id),
  created_by_profile_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_messages_audience_check
    CHECK (audience_scope IN ('ministry', 'all_members')),
  CONSTRAINT ministry_messages_channel_check
    CHECK (channel IN ('email', 'telegram')),
  CONSTRAINT ministry_messages_audience_ministry_check
    CHECK (
      (audience_scope = 'ministry' AND ministry_id IS NOT NULL)
      OR (audience_scope = 'all_members' AND ministry_id IS NULL)
    ),
  CONSTRAINT ministry_messages_subject_check
    CHECK (
      (channel = 'email' AND subject IS NOT NULL AND length(trim(subject)) > 0)
      OR (channel = 'telegram' AND subject IS NULL)
    ),
  CONSTRAINT ministry_messages_body_check
    CHECK (length(trim(body)) > 0),
  CONSTRAINT ministry_messages_telegram_length_check
    CHECK (channel <> 'telegram' OR length(body) <= 250)
);

CREATE INDEX IF NOT EXISTS ministry_messages_ministry_created_idx
  ON ministry_messages (ministry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ministry_messages_creator_created_idx
  ON ministry_messages (created_by_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ministry_message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES ministry_messages(id) ON DELETE CASCADE,
  profile_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_account_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_delivery_target BOOL NOT NULL DEFAULT true,
  delivery_status STRING NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  claimed_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  read_at TIMESTAMPTZ NULL,
  provider STRING NULL,
  provider_message_id STRING NULL,
  last_error STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_message_recipients_status_check
    CHECK (
      delivery_status IN (
        'pending', 'processing', 'retry', 'sent', 'failed', 'skipped'
      )
    ),
  CONSTRAINT ministry_message_recipients_attempt_check
    CHECK (attempt_count >= 0),
  CONSTRAINT ministry_message_recipients_message_profile_key
    UNIQUE (message_id, profile_user_id)
);

CREATE INDEX IF NOT EXISTS ministry_message_recipients_inbox_idx
  ON ministry_message_recipients (profile_user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS ministry_message_recipients_due_idx
  ON ministry_message_recipients (
    is_delivery_target, delivery_status, next_attempt_at, created_at
  );

CREATE INDEX IF NOT EXISTS ministry_message_recipients_message_idx
  ON ministry_message_recipients (message_id, delivery_status);
