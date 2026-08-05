-- Public volunteers are not Ministry members. Keep evidence of the contact
-- permissions they selected when submitting an event signup.

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS volunteer_email_consent_at TIMESTAMPTZ NULL;

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS volunteer_sms_consent_at TIMESTAMPTZ NULL;

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS volunteer_signup_terms_at TIMESTAMPTZ NULL;
