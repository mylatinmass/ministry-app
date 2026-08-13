BEGIN;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS visibility STRING NOT NULL DEFAULT 'public';

ALTER TABLE events
  ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'ministry', 'private'));

CREATE TABLE IF NOT EXISTS priest_appointment_details (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  person_name STRING NULL,
  phone STRING NULL,
  address STRING NULL,
  instructions STRING NULL,
  private_notes STRING NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telegram_event_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id UUID NOT NULL REFERENCES users(id),
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  template_id UUID NULL REFERENCES templates(id),
  chat_id STRING NOT NULL,
  source_type STRING NOT NULL DEFAULT 'text',
  parsed_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  status STRING NOT NULL DEFAULT 'pending',
  event_id UUID NULL REFERENCES events(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telegram_event_drafts_source_check
    CHECK (source_type IN ('text', 'voice')),
  CONSTRAINT telegram_event_drafts_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired'))
);

CREATE INDEX IF NOT EXISTS telegram_event_drafts_pending_idx
  ON telegram_event_drafts (account_user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS ministry_emergency_schedule_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  recipient_user_id UUID NOT NULL REFERENCES users(id),
  week_start DATE NOT NULL,
  status STRING NOT NULL DEFAULT 'sent',
  provider_results JSONB NOT NULL DEFAULT '[]'::JSONB,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ministry_id, recipient_user_id, week_start)
);

COMMIT;
