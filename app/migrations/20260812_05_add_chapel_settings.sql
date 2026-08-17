-- Chapel-wide public information, scheduling defaults, and local observances.
-- Standard 1962-calendar feasts remain authoritative in the Ordo integration;
-- this table stores only local chapel exceptions.

CREATE TABLE IF NOT EXISTS chapel_settings (
  setting_key STRING PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_by UUID NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chapel_settings_object_check
    CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE IF NOT EXISTS chapel_observances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name STRING NOT NULL,
  month INT NOT NULL,
  day INT NOT NULL,
  default_template_id UUID NULL REFERENCES templates(id) ON DELETE SET NULL,
  default_start_time TIME NULL,
  effective_start_year INT NULL,
  notes STRING NULL,
  status STRING NOT NULL DEFAULT 'active',
  created_by UUID NULL REFERENCES ministry_accounts(id),
  updated_by UUID NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chapel_observances_month_check CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT chapel_observances_day_check CHECK (day BETWEEN 1 AND 31),
  CONSTRAINT chapel_observances_year_check
    CHECK (effective_start_year IS NULL OR effective_start_year BETWEEN 1900 AND 2200),
  CONSTRAINT chapel_observances_status_check
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chapel_observances_date_name_key UNIQUE (month, day, name)
);

CREATE INDEX IF NOT EXISTS chapel_observances_date_idx
  ON chapel_observances (month, day, name);
