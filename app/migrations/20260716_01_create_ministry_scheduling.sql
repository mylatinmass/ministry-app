-- Independent Ministry application schema for CockroachDB.
--
-- Ministry identities are owned by this database. The application must never
-- read from or reference the parish profile database.

CREATE TABLE IF NOT EXISTS ministry_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name STRING NOT NULL,
  last_name STRING NOT NULL,
  email STRING NULL,
  telephone STRING NULL,
  phone STRING NULL,
  global_role STRING NOT NULL DEFAULT 'regular',
  status STRING NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_accounts_global_role_check
    CHECK (global_role IN ('owner', 'super_admin', 'regular')),
  CONSTRAINT ministry_accounts_status_check
    CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ministry_accounts_email_key
  ON ministry_accounts (lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE TABLE IF NOT EXISTS ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name STRING NOT NULL UNIQUE,
  description STRING NULL,
  status STRING NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministries_status_check
    CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE TABLE IF NOT EXISTS ministry_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  level STRING NOT NULL DEFAULT 'member',
  status STRING NOT NULL DEFAULT 'active',
  notify_email BOOL NOT NULL DEFAULT false,
  notify_push BOOL NOT NULL DEFAULT false,
  notify_sms BOOL NOT NULL DEFAULT false,
  notify_telegram BOOL NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_members_level_check
    CHECK (level IN ('owner', 'admin', 'member')),
  CONSTRAINT ministry_members_status_check
    CHECK (status IN ('active', 'inactive', 'pending')),
  CONSTRAINT ministry_members_ministry_user_key
    UNIQUE (ministry_id, user_id)
);

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  description STRING NULL,
  participation_type STRING NOT NULL DEFAULT 'members',
  responsibilities JSONB NOT NULL DEFAULT '[]'::JSONB,
  status STRING NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT templates_participation_type_check
    CHECK (participation_type IN ('members', 'volunteers', 'both')),
  CONSTRAINT templates_status_check
    CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT templates_responsibilities_array_check
    CHECK (jsonb_typeof(responsibilities) = 'array'),
  CONSTRAINT templates_ministry_name_key UNIQUE (ministry_id, name)
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  template_id UUID NULL REFERENCES templates(id),
  title STRING NOT NULL,
  description STRING NULL,
  location STRING NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  participation_type STRING NOT NULL DEFAULT 'members',
  signup_code STRING NULL UNIQUE,
  signup_open BOOL NOT NULL DEFAULT false,
  status STRING NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_participation_type_check
    CHECK (participation_type IN ('members', 'volunteers', 'both')),
  CONSTRAINT events_status_check
    CHECK (status IN ('draft', 'published', 'cancelled', 'completed', 'archived')),
  CONSTRAINT events_time_order_check CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS event_responsibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  description STRING NULL,
  responsibility_type STRING NOT NULL DEFAULT 'position',
  quantity_needed INT NOT NULL DEFAULT 1,
  approval_required BOOL NOT NULL DEFAULT false,
  instructions STRING NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status STRING NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_responsibilities_type_check
    CHECK (responsibility_type IN ('position', 'food', 'task', 'time_slot')),
  CONSTRAINT event_responsibilities_status_check
    CHECK (status IN ('open', 'filled', 'closed', 'cancelled')),
  CONSTRAINT event_responsibilities_quantity_check CHECK (quantity_needed > 0)
);

CREATE TABLE IF NOT EXISTS responsibility_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  responsibility_id UUID NOT NULL
    REFERENCES event_responsibilities(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES ministry_accounts(id),
  volunteer_name STRING NULL,
  volunteer_email STRING NULL,
  volunteer_phone STRING NULL,
  quantity INT NOT NULL DEFAULT 1,
  notes STRING NULL,
  status STRING NOT NULL DEFAULT 'pending',
  assigned_by UUID NULL REFERENCES ministry_accounts(id),
  signup_source STRING NOT NULL,
  notify_email BOOL NOT NULL DEFAULT false,
  notify_push BOOL NOT NULL DEFAULT false,
  notify_sms BOOL NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT responsibility_assignments_quantity_check CHECK (quantity > 0),
  CONSTRAINT responsibility_assignments_status_check
    CHECK (
      status IN (
        'interested',
        'pending',
        'assigned',
        'confirmed',
        'declined',
        'change_requested',
        'cancelled',
        'completed'
      )
    ),
  CONSTRAINT responsibility_assignments_source_check
    CHECK (signup_source IN ('admin_assignment', 'member_signup', 'public_link')),
  CONSTRAINT responsibility_assignments_identity_check
    CHECK (
      user_id IS NOT NULL
      OR (
        volunteer_name IS NOT NULL
        AND btrim(volunteer_name) <> ''
        AND volunteer_email IS NOT NULL
        AND btrim(volunteer_email) <> ''
      )
    )
);

CREATE TABLE IF NOT EXISTS member_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  availability_type STRING NOT NULL,
  day_of_week INT NULL,
  specific_date DATE NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  preference STRING NOT NULL DEFAULT 'available',
  notes STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_availability_type_check
    CHECK (availability_type IN ('recurring', 'specific_date', 'absence')),
  CONSTRAINT member_availability_preference_check
    CHECK (preference IN ('preferred', 'available', 'unavailable')),
  CONSTRAINT member_availability_day_check
    CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  CONSTRAINT member_availability_time_check
    CHECK (
      (start_time IS NULL AND end_time IS NULL)
      OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
    ),
  CONSTRAINT member_availability_date_fields_check
    CHECK (
      (availability_type = 'recurring' AND day_of_week IS NOT NULL)
      OR (
        availability_type IN ('specific_date', 'absence')
        AND specific_date IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS ministry_members_ministry_level_status_idx
  ON ministry_members (ministry_id, level, status);
CREATE INDEX IF NOT EXISTS ministry_members_user_status_idx
  ON ministry_members (user_id, status);

CREATE INDEX IF NOT EXISTS templates_ministry_status_idx
  ON templates (ministry_id, status);

CREATE INDEX IF NOT EXISTS events_ministry_start_time_idx
  ON events (ministry_id, start_time);
CREATE INDEX IF NOT EXISTS events_status_start_time_idx
  ON events (status, start_time);

CREATE INDEX IF NOT EXISTS event_responsibilities_event_sort_order_idx
  ON event_responsibilities (event_id, sort_order);
CREATE INDEX IF NOT EXISTS event_responsibilities_event_status_idx
  ON event_responsibilities (event_id, status);

CREATE INDEX IF NOT EXISTS responsibility_assignments_event_status_idx
  ON responsibility_assignments (event_id, status);
CREATE INDEX IF NOT EXISTS responsibility_assignments_responsibility_status_idx
  ON responsibility_assignments (responsibility_id, status);
CREATE INDEX IF NOT EXISTS responsibility_assignments_user_status_idx
  ON responsibility_assignments (user_id, status);
CREATE INDEX IF NOT EXISTS responsibility_assignments_volunteer_email_idx
  ON responsibility_assignments (volunteer_email);

CREATE UNIQUE INDEX IF NOT EXISTS responsibility_assignments_user_once_idx
  ON responsibility_assignments (responsibility_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS responsibility_assignments_volunteer_once_idx
  ON responsibility_assignments (responsibility_id, lower(volunteer_email))
  WHERE user_id IS NULL AND volunteer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS member_availability_user_ministry_idx
  ON member_availability (user_id, ministry_id);
CREATE INDEX IF NOT EXISTS member_availability_ministry_date_idx
  ON member_availability (ministry_id, specific_date);
