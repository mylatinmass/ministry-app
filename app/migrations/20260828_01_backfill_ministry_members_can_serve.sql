-- Membership creation paths explicitly set can_serve=true. Backfill active
-- memberships created before that rule was enforced. This is intentionally a
-- data-only migration because ministry_members is schema-locked for changefeeds.
UPDATE ministry_members
SET can_serve = true,
    updated_at = now()
WHERE status = 'active'
  AND can_serve = false;
