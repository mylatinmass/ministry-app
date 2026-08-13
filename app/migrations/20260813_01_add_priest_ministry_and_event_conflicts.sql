-- Add the Priest ministry and its initial appointment templates. Event-level
-- overlaps are warnings: an authorized ministry administrator may explicitly
-- keep an overlap, while person-level assignment conflicts remain enforced.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS conflict_override BOOL NOT NULL DEFAULT false;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS conflict_override_reason STRING NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS conflict_override_by UUID NULL REFERENCES users(id);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS conflict_override_at TIMESTAMPTZ NULL;

INSERT INTO ministries (name, slug, description, status, created_by)
SELECT
  'Priests',
  'priests',
  'Priest availability, Masses, Confessions, sick calls, private appointments, travel, and pastoral coverage.',
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
  definition.name,
  definition.description,
  'members',
  'active',
  definition.system_key,
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
CROSS JOIN (
  VALUES
    ('Priest Mass', 'Mass celebrated by an assigned priest.', 'priest_mass'),
    ('Confession', 'Scheduled Confession coverage or appointment.', 'priest_confession'),
    ('Sick Call', 'Restricted pastoral appointment. Keep personal details out of ordinary event notes.', 'priest_sick_call'),
    ('Private Appointment', 'Restricted appointment visible only through the Priest ministry.', 'priest_private_appointment'),
    ('Traveling', 'Travel or mission coverage that affects priest availability.', 'priest_travel')
) AS definition(name, description, system_key)
WHERE ministry.slug = 'priests'
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
  'Managed by priests and authorized Priest ministry administrators.',
  0
FROM templates template
JOIN ministries ministry ON ministry.id = template.ministry_id
WHERE ministry.slug = 'priests'
  AND template.system_key IN (
    'priest_mass', 'priest_confession', 'priest_sick_call',
    'priest_private_appointment', 'priest_travel'
  )
ON CONFLICT (template_id, ministry_id) DO UPDATE SET
  instructions = excluded.instructions,
  updated_at = now();

INSERT INTO template_responsibilities (
  template_id, template_ministry_id, name, responsibility_type,
  quantity_needed, approval_required, substitution_allowed, is_required,
  relative_start_minutes, instructions, sort_order, status
)
SELECT
  template.id,
  template_ministry.id,
  CASE template.system_key
    WHEN 'priest_mass' THEN 'Celebrant'
    WHEN 'priest_confession' THEN 'Confessor'
    WHEN 'priest_travel' THEN 'Traveling priest'
    ELSE 'Priest'
  END,
  'position',
  1,
  false,
  false,
  true,
  0,
  CASE
    WHEN template.system_key IN ('priest_sick_call', 'priest_private_appointment')
      THEN 'Keep names, addresses, medical details, and confidential notes out of ordinary event fields.'
    ELSE NULL
  END,
  0,
  'active'
FROM templates template
JOIN ministries ministry ON ministry.id = template.ministry_id
JOIN template_ministries template_ministry
  ON template_ministry.template_id = template.id
 AND template_ministry.ministry_id = template.ministry_id
WHERE ministry.slug = 'priests'
  AND template.system_key IN (
    'priest_mass', 'priest_confession', 'priest_sick_call',
    'priest_private_appointment', 'priest_travel'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM template_responsibilities existing
    WHERE existing.template_id = template.id
      AND existing.status = 'active'
  );

CREATE INDEX IF NOT EXISTS events_conflict_override_idx
  ON events (conflict_override, start_time)
  WHERE conflict_override = true;
