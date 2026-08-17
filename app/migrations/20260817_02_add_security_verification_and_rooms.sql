-- Add profile-level background-check verification and chapel room reservations.
-- Sensitive screening records and reasons remain outside the Ministry App.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS background_check_verified BOOL NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS background_check_verified_at TIMESTAMPTZ NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS background_check_verified_by UUID NULL REFERENCES users(id);

CREATE TABLE IF NOT EXISTS chapel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name STRING NOT NULL UNIQUE,
  description STRING NULL,
  status STRING NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID NULL REFERENCES users(id),
  updated_by UUID NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chapel_rooms_status_check
    CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE TABLE IF NOT EXISTS event_room_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES chapel_rooms(id),
  created_by UUID NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_room_reservations_event_room_key UNIQUE (event_id, room_id)
);

CREATE INDEX IF NOT EXISTS event_room_reservations_room_idx
  ON event_room_reservations (room_id, event_id);

INSERT INTO ministries (name, slug, description, status, created_by)
SELECT
  definition.name,
  definition.slug,
  definition.description,
  'active',
  actor.id
FROM (
  SELECT id
  FROM users
  ORDER BY
    CASE global_role WHEN 'owner' THEN 0 WHEN 'super_admin' THEN 1 ELSE 2 END,
    created_at,
    id
  LIMIT 1
) actor
CROSS JOIN (
  VALUES
    ('Security', 'security', 'Background-check verification and chapel security coordination.'),
    ('Reservations', 'reservations', 'Room and facility reservations for chapel events and appointments.')
) AS definition(name, slug, description)
ON CONFLICT (name) DO UPDATE SET
  slug = COALESCE(ministries.slug, excluded.slug),
  description = excluded.description,
  status = 'active',
  updated_at = now();

INSERT INTO templates (
  ministry_id, name, description, participation_type, status,
  system_key, system_managed, created_by
)
SELECT
  ministry.id,
  'Room Reservation',
  'Reserve one or more chapel rooms for a specific period.',
  'members',
  'active',
  'room_reservation',
  false,
  actor.id
FROM ministries ministry
CROSS JOIN (
  SELECT id
  FROM users
  ORDER BY
    CASE global_role WHEN 'owner' THEN 0 WHEN 'super_admin' THEN 1 ELSE 2 END,
    created_at,
    id
  LIMIT 1
) actor
WHERE ministry.slug = 'reservations'
ON CONFLICT (ministry_id, name) DO UPDATE SET
  description = excluded.description,
  status = 'active',
  system_key = excluded.system_key,
  updated_at = now();

INSERT INTO template_ministries (
  template_id, ministry_id, is_required, instructions, sort_order
)
SELECT
  template.id,
  template.ministry_id,
  true,
  'Select every room covered by this reservation.',
  0
FROM templates template
JOIN ministries ministry ON ministry.id = template.ministry_id
WHERE ministry.slug = 'reservations'
  AND template.system_key = 'room_reservation'
ON CONFLICT (template_id, ministry_id) DO UPDATE SET
  instructions = excluded.instructions,
  updated_at = now();

INSERT INTO chapel_rooms (name, sort_order)
VALUES
  ('Main Chapel', 10),
  ('Overflow Side Chapel', 20),
  ('Padre Pio Hall', 30),
  ('Classroom', 40),
  ('Father''s Office', 50),
  ('Small Sacristy', 60),
  ('Large Sacristy', 70),
  ('Kitchen', 80),
  ('Side Patio', 90),
  ('Rectory', 100),
  ('Front Parking', 110),
  ('Side Parking', 120)
ON CONFLICT (name) DO UPDATE SET
  status = 'active',
  sort_order = excluded.sort_order,
  updated_at = now();
