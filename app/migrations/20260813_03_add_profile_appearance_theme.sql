BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS appearance_theme STRING NOT NULL DEFAULT 'light';

ALTER TABLE users
  ADD CONSTRAINT users_appearance_theme_check
  CHECK (appearance_theme IN ('light', 'dark'));

COMMIT;
