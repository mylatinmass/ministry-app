-- A named ministry responsibility is restricted to the matching ministry level.
-- This repairs built-in and existing responsibilities that predate level linkage
-- without changing responsibilities that already have an explicit requirement.
UPDATE template_responsibilities responsibility
SET required_ministry_level_id = level.id,
    updated_at = now()
FROM template_ministries block,
     ministry_levels level
WHERE responsibility.template_ministry_id = block.id
  AND level.ministry_id = block.ministry_id
  AND lower(trim(level.name)) = lower(trim(responsibility.name))
  AND responsibility.required_ministry_level_id IS NULL;

UPDATE event_responsibilities responsibility
SET required_ministry_level_id = level.id,
    updated_at = now()
FROM ministry_levels level
WHERE level.ministry_id = responsibility.ministry_id
  AND lower(trim(level.name)) = lower(trim(responsibility.name))
  AND responsibility.required_ministry_level_id IS NULL;
