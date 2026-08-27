-- Add the required calendar-day reminder to the approved member cadence.
-- Weekly summaries and final profile-selected reminders remain account-level.

ALTER TABLE ministry_reminders
  DROP CONSTRAINT IF EXISTS ministry_reminders_type_check;

ALTER TABLE ministry_reminders
  ADD CONSTRAINT ministry_reminders_type_check
    CHECK (
      reminder_type IN (
        'confirmation_midpoint',
        'confirmation_deadline',
        'confirmation_overdue',
        'one_week',
        'day_before',
        'event_offset'
      )
    );

