-- Preserve the connection state of notification methods already in use.
-- This follows the column migration so CockroachDB can finish its schema change first.
UPDATE ministry_accounts
SET notification_email_connected_value = btrim(email),
    notification_email_connected_at = COALESCE(notification_email_connected_at, updated_at)
WHERE notification_email_enabled
  AND email IS NOT NULL
  AND btrim(email) <> ''
  AND notification_email_connected_value IS NULL;

UPDATE ministry_accounts
SET notification_sms_connected_value = COALESCE(NULLIF(btrim(phone), ''), NULLIF(btrim(telephone), '')),
    notification_sms_connected_at = COALESCE(notification_sms_connected_at, updated_at)
WHERE notification_sms_enabled
  AND sms_transactional_consent_at IS NOT NULL
  AND COALESCE(NULLIF(btrim(phone), ''), NULLIF(btrim(telephone), '')) IS NOT NULL
  AND notification_sms_connected_value IS NULL;
