ALTER TABLE ministries
  ADD COLUMN IF NOT EXISTS timezone STRING NOT NULL DEFAULT 'America/New_York';

ALTER TABLE ministry_members
  ADD COLUMN IF NOT EXISTS availability_policy STRING NOT NULL
  DEFAULT 'generally_available'
  CHECK (availability_policy IN ('generally_available', 'rules_only'));

CREATE TABLE IF NOT EXISTS availability_weekly_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  status STRING NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_weekly_rules_day_check
    CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT availability_weekly_rules_time_check
    CHECK (
      (start_time IS NULL AND end_time IS NULL)
      OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
    ),
  CONSTRAINT availability_weekly_rules_status_check
    CHECK (status IN ('active', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS availability_weekly_rules_member_idx
  ON availability_weekly_rules (user_id, ministry_id, status, day_of_week);

CREATE TABLE IF NOT EXISTS availability_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  preference STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_date_overrides_preference_check
    CHECK (preference IN ('available', 'unavailable')),
  CONSTRAINT availability_date_overrides_member_date_key
    UNIQUE (user_id, ministry_id, override_date)
);

CREATE INDEX IF NOT EXISTS availability_date_overrides_member_idx
  ON availability_date_overrides (user_id, ministry_id, override_date);
