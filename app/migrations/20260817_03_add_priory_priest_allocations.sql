-- Optional shared Priory priest-allocation integration.
-- Each chapel keeps its own operational data. Only privacy-safe allocation
-- windows and requests are synchronized with the Priory Google Sheet.

CREATE TABLE IF NOT EXISTS priory_integration_settings (
  setting_key STRING PRIMARY KEY DEFAULT 'primary',
  enabled BOOL NOT NULL DEFAULT false,
  spreadsheet_id STRING NULL,
  mission_id STRING NULL,
  mission_name STRING NULL,
  time_zone STRING NOT NULL DEFAULT 'America/New_York',
  priests_tab STRING NOT NULL DEFAULT 'Priests',
  allocations_tab STRING NOT NULL DEFAULT 'Allocations',
  exceptions_tab STRING NOT NULL DEFAULT 'Exceptions',
  requests_tab STRING NOT NULL DEFAULT 'Requests',
  last_sync_started_at TIMESTAMPTZ NULL,
  last_sync_succeeded_at TIMESTAMPTZ NULL,
  last_sync_error STRING NULL,
  updated_by UUID NULL REFERENCES ministry_accounts(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT priory_integration_setting_key_check CHECK (setting_key = 'primary')
);

CREATE TABLE IF NOT EXISTS priory_priest_catalog (
  external_priest_id STRING PRIMARY KEY,
  display_name STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'active',
  source_hash STRING NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT priory_priest_catalog_status_check
    CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS priory_priest_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  external_priest_id STRING NOT NULL REFERENCES priory_priest_catalog(external_priest_id),
  status STRING NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES ministry_accounts(id),
  updated_by UUID NOT NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT priory_priest_mappings_status_check
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT priory_priest_mappings_user_key UNIQUE (user_id),
  CONSTRAINT priory_priest_mappings_external_key UNIQUE (external_priest_id)
);

CREATE TABLE IF NOT EXISTS priory_allocation_cache (
  source_allocation_id STRING PRIMARY KEY,
  external_priest_id STRING NOT NULL REFERENCES priory_priest_catalog(external_priest_id),
  mission_id STRING NOT NULL,
  mission_name STRING NULL,
  rule_type STRING NOT NULL,
  day_of_week INT NULL,
  specific_date DATE NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  effective_from DATE NULL,
  effective_to DATE NULL,
  time_zone STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'active',
  linked_request_id UUID NULL,
  source_hash STRING NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT priory_allocation_rule_check
    CHECK (rule_type IN ('weekly', 'one_time')),
  CONSTRAINT priory_allocation_status_check
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT priory_allocation_weekday_check
    CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  CONSTRAINT priory_allocation_time_check CHECK (end_time > start_time),
  CONSTRAINT priory_allocation_fields_check CHECK (
    (rule_type = 'weekly' AND day_of_week IS NOT NULL)
    OR (rule_type = 'one_time' AND specific_date IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS priory_allocation_mission_priest_idx
  ON priory_allocation_cache (mission_id, external_priest_id, status);

CREATE TABLE IF NOT EXISTS priory_allocation_exceptions (
  source_exception_id STRING PRIMARY KEY,
  source_allocation_id STRING NULL,
  external_priest_id STRING NOT NULL REFERENCES priory_priest_catalog(external_priest_id),
  exception_date DATE NOT NULL,
  action STRING NOT NULL,
  replacement_mission_id STRING NULL,
  replacement_mission_name STRING NULL,
  replacement_start_time TIME NULL,
  replacement_end_time TIME NULL,
  status STRING NOT NULL DEFAULT 'active',
  source_hash STRING NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT priory_exception_action_check
    CHECK (action IN ('cancel', 'replace')),
  CONSTRAINT priory_exception_status_check
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT priory_exception_replacement_check CHECK (
    action = 'cancel'
    OR (
      replacement_mission_id IS NOT NULL
      AND replacement_start_time IS NOT NULL
      AND replacement_end_time IS NOT NULL
      AND replacement_end_time > replacement_start_time
    )
  )
);

CREATE INDEX IF NOT EXISTS priory_exception_priest_date_idx
  ON priory_allocation_exceptions (external_priest_id, exception_date, status);

CREATE TABLE IF NOT EXISTS priory_allocation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NULL REFERENCES events(id) ON DELETE SET NULL,
  requested_priest_id STRING NULL,
  requested_start TIMESTAMPTZ NOT NULL,
  requested_end TIMESTAMPTZ NOT NULL,
  event_type STRING NOT NULL,
  urgency STRING NOT NULL DEFAULT 'normal',
  status STRING NOT NULL DEFAULT 'pending',
  sheet_row_reference STRING NULL,
  source_allocation_id STRING NULL,
  requested_by UUID NOT NULL REFERENCES ministry_accounts(id),
  resolved_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT priory_request_time_check CHECK (requested_end > requested_start),
  CONSTRAINT priory_request_urgency_check
    CHECK (urgency IN ('normal', 'urgent')),
  CONSTRAINT priory_request_status_check
    CHECK (status IN ('pending', 'approved', 'declined', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS priory_request_status_created_idx
  ON priory_allocation_requests (status, created_at);

CREATE TABLE IF NOT EXISTS priory_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'running',
  priests_seen INT NOT NULL DEFAULT 0,
  allocations_seen INT NOT NULL DEFAULT 0,
  exceptions_seen INT NOT NULL DEFAULT 0,
  requests_reconciled INT NOT NULL DEFAULT 0,
  validation_errors JSONB NOT NULL DEFAULT '[]'::JSONB,
  error_message STRING NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  CONSTRAINT priory_sync_trigger_check
    CHECK (trigger_type IN ('scheduled', 'manual', 'initial')),
  CONSTRAINT priory_sync_status_check
    CHECK (status IN ('running', 'succeeded', 'failed'))
);

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS priory_allocation_id STRING NULL;

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS priory_allocation_conflict BOOL NOT NULL DEFAULT false;

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS priory_allocation_checked_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS responsibility_assignments_priory_conflict_idx
  ON responsibility_assignments (priory_allocation_conflict, event_id)
  WHERE priory_allocation_conflict = true;
