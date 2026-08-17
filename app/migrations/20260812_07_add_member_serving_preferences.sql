-- Standing scheduling preferences belong to a person within a ministry.
-- The overall automatic-assignment limit follows the person across ministries.

ALTER TABLE ministry_members
  ADD COLUMN IF NOT EXISTS serving_preference STRING NOT NULL DEFAULT 'prefer';

ALTER TABLE ministry_members
  ALTER COLUMN serving_preference SET DEFAULT 'prefer';

-- This feature is new, so existing untouched memberships begin fully available.
UPDATE ministry_members
SET serving_preference = 'prefer'
WHERE serving_preference = 'not_specified';

ALTER TABLE ministry_members
  ADD COLUMN IF NOT EXISTS monthly_frequency_limit INT NULL;

ALTER TABLE ministry_members
  DROP CONSTRAINT IF EXISTS ministry_members_serving_preference_check;

ALTER TABLE ministry_members
  ADD CONSTRAINT ministry_members_serving_preference_check
  CHECK (serving_preference IN (
    'prefer', 'sometimes', 'if_necessary', 'cannot_serve', 'not_specified'
  ));

ALTER TABLE ministry_members
  DROP CONSTRAINT IF EXISTS ministry_members_monthly_frequency_limit_check;

ALTER TABLE ministry_members
  ADD CONSTRAINT ministry_members_monthly_frequency_limit_check
  CHECK (
    monthly_frequency_limit IS NULL
    OR monthly_frequency_limit BETWEEN 1 AND 100
  );

ALTER TABLE ministry_accounts
  ADD COLUMN IF NOT EXISTS automatic_assignment_monthly_limit INT NULL;

ALTER TABLE ministry_accounts
  DROP CONSTRAINT IF EXISTS ministry_accounts_automatic_assignment_monthly_limit_check;

ALTER TABLE ministry_accounts
  ADD CONSTRAINT ministry_accounts_automatic_assignment_monthly_limit_check
  CHECK (
    automatic_assignment_monthly_limit IS NULL
    OR automatic_assignment_monthly_limit BETWEEN 1 AND 100
  );
