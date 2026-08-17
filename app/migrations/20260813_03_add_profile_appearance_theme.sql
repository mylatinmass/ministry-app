ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS appearance_theme STRING NOT NULL DEFAULT 'light';

ALTER TABLE ministry_accounts
  ADD CONSTRAINT ministry_accounts_appearance_theme_check
  CHECK (appearance_theme IN ('light', 'dark'));
