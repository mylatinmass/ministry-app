-- Per-session Ministries authentication credentials belong to the existing
-- user identity because one user may belong to several ministries.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username STRING NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash STRING NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_ministry_username_key
  ON users (lower(username))
  WHERE username IS NOT NULL;
