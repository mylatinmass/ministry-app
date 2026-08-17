-- Routine alerts remain available inside the Ministry app, but only the
-- approved schedule summaries and event reminders may use external channels.
UPDATE ministry_alerts
SET delivery_status = 'skipped',
    claimed_at = NULL,
    next_attempt_at = NULL,
    last_error = 'in_app_only_notification_policy',
    updated_at = now()
WHERE delivery_status IN ('pending', 'retry', 'processing')
  AND kind NOT IN (
    'weekly_schedule_summary',
    'daily_admin_summary',
    'final_schedule_reminder'
  );
