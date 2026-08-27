-- Event assignments created before volunteer accounts were mandatory can still
-- contain a participant name and consented contact details without a linked
-- Ministry account. Preserve those people as durable message recipients.

ALTER TABLE ministry_message_recipients
  ALTER COLUMN profile_user_id DROP NOT NULL;

ALTER TABLE ministry_message_recipients
  ALTER COLUMN delivery_account_user_id DROP NOT NULL;

ALTER TABLE ministry_message_recipients
  ADD COLUMN IF NOT EXISTS external_name STRING NULL;

ALTER TABLE ministry_message_recipients
  ADD COLUMN IF NOT EXISTS external_email STRING NULL;

ALTER TABLE ministry_message_recipients
  ADD COLUMN IF NOT EXISTS external_phone STRING NULL;

ALTER TABLE ministry_message_recipients
  ADD COLUMN IF NOT EXISTS external_email_enabled BOOL NOT NULL DEFAULT false;

ALTER TABLE ministry_message_recipients
  ADD COLUMN IF NOT EXISTS external_sms_consent_at TIMESTAMPTZ NULL;

ALTER TABLE ministry_message_recipients
  ADD CONSTRAINT ministry_message_recipients_destination_check
  CHECK (
    delivery_account_user_id IS NOT NULL
    OR NULLIF(btrim(external_email), '') IS NOT NULL
    OR NULLIF(btrim(external_phone), '') IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS ministry_message_recipients_external_email_key
  ON ministry_message_recipients (message_id, lower(btrim(external_email)))
  WHERE profile_user_id IS NULL AND external_email IS NOT NULL;
