-- Some ministries may not yet have an active ministry administrator. Use an
-- existing global administrator as the accountable creator for their levels.

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
  SELECT ministry_id, min(name) AS name
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
    ) AS rank_order
  FROM new_levels new_level
  WHERE NOT EXISTS (
    SELECT 1
    FROM ministry_levels existing_level
    WHERE existing_level.ministry_id = new_level.ministry_id
      AND lower(existing_level.name) = lower(new_level.name)
  )
),
global_administrator AS (
  SELECT id
  FROM ministry_accounts
  WHERE global_role IN ('owner', 'super_admin')
  ORDER BY CASE global_role WHEN 'owner' THEN 0 ELSE 1 END, id
  LIMIT 1
)
INSERT INTO ministry_levels (
  ministry_id,
  name,
  rank_order,
  created_by,
  updated_by
)
SELECT
  level.ministry_id,
  level.name,
  level.rank_order,
  administrator.id,
  administrator.id
FROM levels_to_insert level
CROSS JOIN global_administrator administrator
ON CONFLICT (ministry_id, name) DO NOTHING;
