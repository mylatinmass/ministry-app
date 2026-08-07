-- Store a future-facing badge reference on each ministry level. The current
-- icon picker uses built-in icons; its selected key can later point to custom
-- chapel artwork without changing any member or assignment records.

ALTER TABLE ministry_levels
  ADD COLUMN IF NOT EXISTS icon_key STRING NULL;
