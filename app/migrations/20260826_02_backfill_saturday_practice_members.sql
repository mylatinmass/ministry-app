-- Add the expected-member roster to the existing Saturday Practice series.

INSERT INTO event_responsibilities (
  event_id, ministry_id, name, description, responsibility_type,
  quantity_needed, approval_required, substitution_allowed, is_required,
  relative_start_minutes, sort_order, status, unlimited_capacity,
  assignment_mode
)
SELECT
  event.id, event.ministry_id, 'Open to all members',
  'All available serving members are expected to attend.', 'position',
  1, false, false, false, 0, -90, 'open', true,
  'all_available_members'
FROM events event
JOIN ministries ministry ON ministry.id = event.ministry_id
WHERE event.recurrence_group_id = 'db55364b-63a0-4445-a50d-439f46c3bef0'
  AND event.start_time >= now()
  AND event.status NOT IN ('cancelled', 'archived')
  AND ministry.slug = 'schola'
  AND NOT EXISTS (
    SELECT 1
    FROM event_responsibilities existing
    WHERE existing.event_id = event.id
      AND existing.assignment_mode = 'all_available_members'
      AND existing.status <> 'cancelled'
  );

INSERT INTO responsibility_assignments (
  event_id, responsibility_id, user_id, quantity, status,
  assigned_by, signup_source, notify_email, confirmed_at
)
SELECT
  event.id, responsibility.id, account.id, 1, 'confirmed',
  event.created_by, 'admin_assignment', true, now()
FROM events event
JOIN event_responsibilities responsibility
  ON responsibility.event_id = event.id
 AND responsibility.assignment_mode = 'all_available_members'
 AND responsibility.status <> 'cancelled'
JOIN ministry_members membership
  ON membership.ministry_id = COALESCE(responsibility.ministry_id, event.ministry_id)
 AND membership.status = 'active'
 AND membership.can_serve = true
 AND membership.serving_preference <> 'cannot_serve'
JOIN ministry_accounts account
  ON account.id = membership.user_id
 AND account.status = 'active'
 AND COALESCE(account.is_volunteer_profile, false) = false
WHERE event.recurrence_group_id = 'db55364b-63a0-4445-a50d-439f46c3bef0'
  AND event.start_time >= now()
  AND event.status NOT IN ('cancelled', 'archived')
  AND NOT EXISTS (
    SELECT 1
    FROM availability_blocks block
    WHERE block.user_id = account.id
      AND block.status = 'active'
      AND (block.ministry_id IS NULL OR block.ministry_id = event.ministry_id)
      AND block.start_date <= (event.start_time AT TIME ZONE 'America/New_York')::DATE
      AND block.end_date >= (event.start_time AT TIME ZONE 'America/New_York')::DATE
  )
  AND NOT EXISTS (
    SELECT 1
    FROM responsibility_assignments existing
    WHERE existing.responsibility_id = responsibility.id
      AND existing.user_id = account.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM responsibility_assignments conflicting
    JOIN events conflicting_event
      ON conflicting_event.id = conflicting.event_id
    JOIN event_responsibilities conflicting_responsibility
      ON conflicting_responsibility.id = conflicting.responsibility_id
    WHERE conflicting.user_id = account.id
      AND conflicting.event_id <> event.id
      AND conflicting.status IN (
        'interested', 'pending', 'assigned', 'confirmed',
        'change_requested', 'completed'
      )
      AND conflicting_event.status NOT IN ('cancelled', 'archived')
      AND conflicting_event.start_time
        + COALESCE(conflicting_responsibility.relative_start_minutes, 0)
          * INTERVAL '1 minute' < event.end_time
      AND conflicting_event.end_time > event.start_time
  );
