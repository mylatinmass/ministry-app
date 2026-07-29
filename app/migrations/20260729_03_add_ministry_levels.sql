-- Ministry-specific capability levels.
--
-- A member stores only the highest level granted in each ministry. Levels are
-- ordered from least to most capable, so a member may serve responsibilities
-- requiring their granted level or any lower level.

CREATE TABLE IF NOT EXISTS ministry_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  description STRING NULL,
  rank_order INT NOT NULL,
  status STRING NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_levels_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT ministry_levels_rank_check CHECK (rank_order > 0),
  CONSTRAINT ministry_levels_status_check
    CHECK (status IN ('active', 'archived')),
  CONSTRAINT ministry_levels_ministry_name_key
    UNIQUE (ministry_id, name)
);

ALTER TABLE ministry_members
  ADD COLUMN IF NOT EXISTS highest_level_id UUID NULL
  REFERENCES ministry_levels(id);

ALTER TABLE template_responsibilities
  ADD COLUMN IF NOT EXISTS required_ministry_level_id UUID NULL
  REFERENCES ministry_levels(id);

ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS required_ministry_level_id UUID NULL
  REFERENCES ministry_levels(id);

CREATE INDEX IF NOT EXISTS ministry_levels_ministry_status_rank_idx
  ON ministry_levels (ministry_id, status, rank_order);

CREATE UNIQUE INDEX IF NOT EXISTS ministry_levels_active_rank_key
  ON ministry_levels (ministry_id, rank_order)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ministry_members_highest_level_idx
  ON ministry_members (highest_level_id);

CREATE INDEX IF NOT EXISTS template_responsibilities_required_level_idx
  ON template_responsibilities (required_ministry_level_id);

CREATE INDEX IF NOT EXISTS event_responsibilities_required_level_idx
  ON event_responsibilities (required_ministry_level_id);
