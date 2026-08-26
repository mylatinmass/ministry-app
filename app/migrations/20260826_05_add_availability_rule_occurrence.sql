ALTER TABLE availability_weekly_rules
  ADD COLUMN IF NOT EXISTS week_of_month STRING NOT NULL DEFAULT 'every';

ALTER TABLE availability_weekly_rules
  ADD CONSTRAINT availability_weekly_rules_occurrence_check
  CHECK (week_of_month IN ('every', 'first', 'second', 'third', 'fourth', 'last'));
