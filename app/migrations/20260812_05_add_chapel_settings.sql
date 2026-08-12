-- Chapel-wide public information, scheduling defaults, and local observances.
-- Standard 1962-calendar feasts remain authoritative in the Ordo integration;
-- this table stores only local chapel exceptions.

CREATE TABLE IF NOT EXISTS chapel_settings (
  setting_key STRING PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_by UUID NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chapel_settings_object_check
    CHECK (jsonb_typeof(settings) = 'object')
);

INSERT INTO chapel_settings (setting_key, settings)
VALUES (
  'primary',
  '{
    "chapelName": "Our Lady of Victory Chapel",
    "publicPhone": "",
    "publicEmail": "",
    "streetAddress": "",
    "mailingAddress": "",
    "websiteUrl": "https://www.mylatinmass.com",
    "timeZone": "America/New_York",
    "defaultEventLocation": "",
    "mapUrl": "",
    "publicCalendarUrl": "https://www.mylatinmass.com/events/calendar.ics",
    "defaultMassTemplateId": "",
    "defaultEventTemplateId": "",
    "notificationSenderName": "Our Lady of Victory Chapel",
    "replyToEmail": "",
    "emergencyContact": "",
    "publicEventVisibility": "public",
    "schedulingHorizonDays": 60,
    "logoUrl": "",
    "facebookUrl": "",
    "instagramUrl": "",
    "youtubeUrl": ""
  }'::JSONB
)
ON CONFLICT (setting_key) DO NOTHING;

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
  created_by UUID NULL REFERENCES users(id),
  updated_by UUID NULL REFERENCES users(id),
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

INSERT INTO chapel_observances (name, month, day, notes)
VALUES
  ('Birth of Saint Philomena', 1, 10, 'Local shrine observance. Create the chapel Mass independently from the Ordo reference.'),
  ('Finding of the Body of Saint Philomena', 5, 25, 'Local shrine observance. Create the chapel Mass independently from the Ordo reference.'),
  ('Translation of the Body of Saint Philomena', 8, 10, 'Local shrine observance. Create the chapel Mass independently from the Ordo reference.'),
  ('Feast Day of Saint Philomena', 8, 11, 'Local shrine observance. Any External Solemnity is created manually on the selected Sunday.')
ON CONFLICT (month, day, name) DO NOTHING;

CREATE INDEX IF NOT EXISTS chapel_observances_date_idx
  ON chapel_observances (month, day, name);
