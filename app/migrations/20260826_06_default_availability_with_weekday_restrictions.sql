UPDATE ministry_members
SET availability_policy = 'generally_available', updated_at = now()
WHERE availability_policy = 'rules_only';
