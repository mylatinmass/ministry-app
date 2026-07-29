-- Stable, human-readable URLs for individual ministry workspaces.

ALTER TABLE ministries
  ADD COLUMN IF NOT EXISTS slug STRING NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ministries_slug_key
  ON ministries (lower(slug))
  WHERE slug IS NOT NULL;
