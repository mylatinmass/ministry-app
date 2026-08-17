-- Allow one reusable event template to coordinate several independent ministries.
-- The original templates.ministry_id and events.ministry_id columns remain as the
-- coordinating ministry for backward compatibility with existing records.

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS template_version INT NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS source_event_id UUID NULL REFERENCES events(id);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB NULL;

CREATE TABLE IF NOT EXISTS template_ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  is_required BOOL NOT NULL DEFAULT true,
  instructions STRING NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT template_ministries_template_ministry_key
    UNIQUE (template_id, ministry_id)
);

CREATE TABLE IF NOT EXISTS template_responsibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  template_ministry_id UUID NOT NULL
    REFERENCES template_ministries(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  description STRING NULL,
  responsibility_type STRING NOT NULL DEFAULT 'position',
  quantity_needed INT NOT NULL DEFAULT 1,
  approval_required BOOL NOT NULL DEFAULT false,
  is_required BOOL NOT NULL DEFAULT true,
  required_qualification STRING NULL,
  relative_start_minutes INT NOT NULL DEFAULT 0,
  instructions STRING NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status STRING NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT template_responsibilities_type_check
    CHECK (responsibility_type IN ('position', 'food', 'task', 'time_slot')),
  CONSTRAINT template_responsibilities_quantity_check
    CHECK (quantity_needed > 0),
  CONSTRAINT template_responsibilities_status_check
    CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT template_versions_template_version_key
    UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS event_ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  template_ministry_id UUID NULL
    REFERENCES template_ministries(id) ON DELETE SET NULL,
  is_required BOOL NOT NULL DEFAULT true,
  schedule_status STRING NOT NULL DEFAULT 'generated',
  reviewed_by UUID NULL REFERENCES ministry_accounts(id),
  reviewed_at TIMESTAMPTZ NULL,
  published_by UUID NULL REFERENCES ministry_accounts(id),
  published_at TIMESTAMPTZ NULL,
  instructions STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_ministries_status_check
    CHECK (
      schedule_status IN (
        'generated',
        'under_review',
        'ready',
        'published',
        'incomplete',
        'cancelled',
        'completed'
      )
    ),
  CONSTRAINT event_ministries_event_ministry_key
    UNIQUE (event_id, ministry_id)
);

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS ministry_id UUID NULL REFERENCES ministries(id);

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS template_responsibility_id UUID NULL
    REFERENCES template_responsibilities(id) ON DELETE SET NULL;

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS is_required BOOL NOT NULL DEFAULT true;

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS required_qualification STRING NULL;

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS relative_start_minutes INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ministry_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES ministry_accounts(id),
  active_profile_user_id UUID NOT NULL REFERENCES ministry_accounts(id),
  action STRING NOT NULL,
  entity_type STRING NOT NULL,
  entity_id UUID NULL,
  ministry_id UUID NULL REFERENCES ministries(id),
  before_data JSONB NULL,
  after_data JSONB NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO template_ministries (
  template_id,
  ministry_id,
  is_required,
  sort_order
)
SELECT
  template.id,
  template.ministry_id,
  true,
  0
FROM templates template
ON CONFLICT (template_id, ministry_id) DO NOTHING;

INSERT INTO event_ministries (
  event_id,
  ministry_id,
  is_required,
  schedule_status
)
SELECT
  event.id,
  event.ministry_id,
  true,
  CASE
    WHEN event.status = 'published' THEN 'published'
    WHEN event.status = 'cancelled' THEN 'cancelled'
    WHEN event.status = 'completed' THEN 'completed'
    ELSE 'generated'
  END
FROM events event
ON CONFLICT (event_id, ministry_id) DO NOTHING;

UPDATE event_responsibilities responsibility
SET ministry_id = event.ministry_id
FROM events event
WHERE responsibility.event_id = event.id
  AND responsibility.ministry_id IS NULL;

CREATE INDEX IF NOT EXISTS template_ministries_ministry_idx
  ON template_ministries (ministry_id, template_id);

CREATE INDEX IF NOT EXISTS template_responsibilities_template_sort_idx
  ON template_responsibilities (template_id, sort_order);

CREATE INDEX IF NOT EXISTS event_ministries_ministry_status_idx
  ON event_ministries (ministry_id, schedule_status);

CREATE INDEX IF NOT EXISTS events_recurrence_group_idx
  ON events (recurrence_group_id, start_time);

CREATE INDEX IF NOT EXISTS event_responsibilities_ministry_status_idx
  ON event_responsibilities (ministry_id, status);

CREATE INDEX IF NOT EXISTS ministry_audit_log_entity_created_idx
  ON ministry_audit_log (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ministry_audit_log_ministry_created_idx
  ON ministry_audit_log (ministry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ministry_audit_log_actor_created_idx
  ON ministry_audit_log (actor_user_id, created_at DESC);
