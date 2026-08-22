-- Preserve notification behavior for existing accounts. New-account defaults
-- are explicit in every account creation query because this table is schema
-- locked for changefeed performance. Email is the default delivery channel.
-- Telegram, push, and SMS remain user-enabled because they require a
-- connection, device subscription, or SMS consent.

UPDATE ministry_accounts
SET notification_email_enabled = true,
    notification_reminders_enabled = true,
    notification_schedule_changes_enabled = true,
    notification_announcements_enabled = true,
    notification_volunteer_opportunities_enabled = true,
    updated_at = now();
