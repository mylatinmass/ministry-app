-- Per-session Ministries authentication credentials belong to the existing
-- user identity because one user may belong to several ministries.

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS username STRING NULL;

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS password_hash STRING NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ministry_accounts_ministry_username_key
  ON ministry_accounts (lower(username))
  WHERE username IS NOT NULL;
