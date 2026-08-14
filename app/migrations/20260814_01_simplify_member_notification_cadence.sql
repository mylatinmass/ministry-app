-- Retire the former per-action and confirmation reminder backlog. The app now
-- sends a Monday household summary, one tomorrow summary, and one final
-- profile-selected lead-time reminder. Urgent operational alerts are retained.

UPDATE ministry_reminders
SET status = 'cancelled',
    canceled_at = COALESCE(canceled_at, now()),
    claimed_at = NULL,
    updated_at = now()
WHERE status IN ('pending', 'retry', 'processing')
  AND reminder_type IN (
    'one_week',
    'confirmation_midpoint',
    'confirmation_deadline',
    'confirmation_overdue'
  );

UPDATE ministry_alerts
SET delivery_status = 'skipped',
    read_at = COALESCE(read_at, now()),
    claimed_at = NULL,
    last_error = 'retired_by_summary_notification_policy',
    updated_at = now()
WHERE delivery_status IN ('pending', 'processing', 'retry')
  AND kind IN (
    'assignment_created',
    'assignment_weekly_review',
    'assignment_one_week_reminder',
    'confirmation_midpoint',
    'confirmation_deadline',
    'confirmation_overdue',
    'confirmation_overdue_leader',
    'guardian_approval_overdue',
    'event_published',
    'event_changed'
  );
