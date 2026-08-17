-- Cache normalized 1962 Ordo reference data and preserve the Mass option
-- selected for each chapel event. The source remains advisory and does not
-- replace an authorized liturgical decision.

CREATE TABLE IF NOT EXISTS ordo_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgical_date DATE NOT NULL UNIQUE,
  celebration STRING NOT NULL,
  class_label STRING NULL,
  vestment_color STRING NULL,
  commemorations JSONB NOT NULL DEFAULT '[]'::JSONB,
  general_information JSONB NOT NULL DEFAULT '[]'::JSONB,
  mass_options JSONB NOT NULL DEFAULT '[]'::JSONB,
  breviary JSONB NOT NULL DEFAULT '{}'::JSONB,
  reminders JSONB NOT NULL DEFAULT '[]'::JSONB,
  source_url STRING NOT NULL,
  source_published_at TIMESTAMPTZ NULL,
  source_modified_at TIMESTAMPTZ NULL,
  source_hash STRING NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_ordo_selections (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  ordo_day_id UUID NOT NULL REFERENCES ordo_days(id),
  selected_mass_option_id STRING NULL,
  selected_mass_option_snapshot JSONB NULL,
  source_hash_at_selection STRING NULL,
  sacristy_notes STRING NULL,
  selected_by UUID NULL REFERENCES ministry_accounts(id),
  selected_at TIMESTAMPTZ NULL,
  updated_by UUID NOT NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ordo_days_fetched_idx
  ON ordo_days (fetched_at DESC);

CREATE INDEX IF NOT EXISTS event_ordo_selections_day_idx
  ON event_ordo_selections (ordo_day_id, updated_at DESC);
