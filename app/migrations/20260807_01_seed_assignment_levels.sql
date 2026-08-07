-- Seed each ministry's level list from the assignment names it already uses.
-- Administrators can rename and reorder these levels in the app afterwards.

WITH assignment_names AS (
  SELECT
    template_ministry.ministry_id,
    btrim(responsibility.name) AS name
  FROM template_responsibilities responsibility
  JOIN template_ministries template_ministry
    ON template_ministry.id = responsibility.template_ministry_id
  WHERE responsibility.status = 'active'

  UNION

  SELECT
    responsibility.ministry_id,
    btrim(responsibility.name) AS name
  FROM event_responsibilities responsibility
  WHERE responsibility.ministry_id IS NOT NULL
    AND responsibility.status <> 'cancelled'
),
new_levels AS (
  SELECT
    ministry_id,
    min(name) AS name
  FROM assignment_names
  WHERE name <> ''
  GROUP BY ministry_id, lower(name)
),
levels_to_insert AS (
  SELECT
    new_level.ministry_id,
    new_level.name,
    (
      SELECT COALESCE(max(existing_level.rank_order), 0)
      FROM ministry_levels existing_level
      WHERE existing_level.ministry_id = new_level.ministry_id
        AND existing_level.status = 'active'
    ) + row_number() OVER (
      PARTITION BY new_level.ministry_id
      ORDER BY lower(new_level.name)
    ) AS rank_order,
    (
      SELECT membership.user_id
      FROM ministry_members membership
      WHERE membership.ministry_id = new_level.ministry_id
        AND membership.status = 'active'
        AND membership.level IN ('owner', 'admin')
      ORDER BY CASE membership.level WHEN 'owner' THEN 0 ELSE 1 END
      LIMIT 1
    ) AS manager_user_id
  FROM new_levels new_level
  WHERE NOT EXISTS (
    SELECT 1
    FROM ministry_levels existing_level
    WHERE existing_level.ministry_id = new_level.ministry_id
      AND lower(existing_level.name) = lower(new_level.name)
  )
)
INSERT INTO ministry_levels (
  ministry_id,
  name,
  rank_order,
  created_by,
  updated_by
)
SELECT
  ministry_id,
  name,
  rank_order,
  manager_user_id,
  manager_user_id
FROM levels_to_insert
WHERE manager_user_id IS NOT NULL
ON CONFLICT (ministry_id, name) DO NOTHING;
