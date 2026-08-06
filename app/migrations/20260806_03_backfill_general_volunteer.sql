-- Responsibilities on standalone volunteer events were already public before
-- the visibility flag existed.
UPDATE event_responsibilities responsibility
SET is_public_assignment = true,
    updated_at = now()
FROM events event
WHERE event.id = responsibility.event_id
  AND event.ministry_id IS NULL
  AND event.participation_type = 'volunteers';

-- Every event that accepts public volunteers gets a catch-all assignment. A
-- quantity of one is retained as a storage placeholder while unlimited_capacity
-- controls whether the limit is enforced.
INSERT INTO event_responsibilities (
  event_id,
  ministry_id,
  name,
  description,
  responsibility_type,
  quantity_needed,
  approval_required,
  is_required,
  relative_start_minutes,
  sort_order,
  status,
  is_public_assignment,
  unlimited_capacity
)
SELECT
  event.id,
  NULL,
  'General Volunteer',
  'Sign up to help. Your specific task will be assigned by email or during the event.',
  'task',
  1,
  false,
  true,
  0,
  -100,
  'open',
  true,
  true
FROM events event
WHERE event.participation_type IN ('volunteers', 'both')
  AND event.status <> 'archived'
  AND NOT EXISTS (
    SELECT 1
    FROM event_responsibilities responsibility
    WHERE responsibility.event_id = event.id
      AND lower(btrim(responsibility.name)) = 'general volunteer'
      AND responsibility.status <> 'cancelled'
  );

UPDATE event_responsibilities
SET is_public_assignment = true,
    updated_at = now()
WHERE lower(btrim(name)) = 'general volunteer'
  AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS event_responsibilities_public_idx
  ON event_responsibilities (event_id, sort_order)
  WHERE is_public_assignment = true AND status <> 'cancelled';
