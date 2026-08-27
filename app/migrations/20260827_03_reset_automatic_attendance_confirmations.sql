-- Automatic attendance rosters were previously created as already confirmed.
-- Confirmation is now an explicit member response, so existing automatic rows
-- must return to the assigned state once when this feature is introduced.
UPDATE responsibility_assignments AS assignment
SET status = 'assigned',
    confirmed_at = NULL,
    confirmation_overdue_at = NULL,
    updated_at = now()
FROM event_responsibilities AS responsibility
WHERE responsibility.id = assignment.responsibility_id
  AND responsibility.assignment_mode IN (
    'all_available_members',
    'all_active_members',
    'source_event_assignees'
  )
  AND assignment.status = 'confirmed'
  AND assignment.signup_source = 'admin_assignment';
