-- Reusable subdivisions inside a ministry. Groups are independent of ordered
-- ministry levels: groups describe where a member belongs; levels describe
-- what responsibilities the member is qualified to serve.
CREATE TABLE IF NOT EXISTS ministry_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  description STRING NULL,
  sort_order INT NOT NULL DEFAULT 0,
  automatic_membership BOOL NOT NULL DEFAULT false,
  status STRING NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES ministry_accounts(id),
  updated_by UUID NOT NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_groups_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT ministry_groups_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT ministry_groups_ministry_name_key UNIQUE (ministry_id, name)
);

CREATE TABLE IF NOT EXISTS ministry_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES ministry_groups(id) ON DELETE CASCADE,
  ministry_member_id UUID NOT NULL REFERENCES ministry_members(id) ON DELETE CASCADE,
  added_by UUID NULL REFERENCES ministry_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ministry_group_members_key UNIQUE (group_id, ministry_member_id)
);

CREATE TABLE IF NOT EXISTS template_ministry_groups (
  template_ministry_id UUID NOT NULL REFERENCES template_ministries(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES ministry_groups(id),
  PRIMARY KEY (template_ministry_id, group_id)
);

CREATE TABLE IF NOT EXISTS event_ministry_groups (
  event_ministry_id UUID NOT NULL REFERENCES event_ministries(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES ministry_groups(id),
  PRIMARY KEY (event_ministry_id, group_id)
);

ALTER TABLE template_responsibilities
  ADD COLUMN IF NOT EXISTS required_group_id UUID NULL REFERENCES ministry_groups(id);
ALTER TABLE event_responsibilities
  ADD COLUMN IF NOT EXISTS required_group_id UUID NULL REFERENCES ministry_groups(id);

CREATE TABLE IF NOT EXISTS ministry_message_groups (
  message_id UUID NOT NULL REFERENCES ministry_messages(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES ministry_groups(id),
  PRIMARY KEY (message_id, group_id)
);

ALTER TABLE ministry_messages DROP CONSTRAINT IF EXISTS ministry_messages_audience_check;
ALTER TABLE ministry_messages ADD CONSTRAINT ministry_messages_audience_check
  CHECK (audience_scope IN ('ministry', 'groups', 'all_members'));
ALTER TABLE ministry_messages DROP CONSTRAINT IF EXISTS ministry_messages_audience_ministry_check;
ALTER TABLE ministry_messages ADD CONSTRAINT ministry_messages_audience_ministry_check
  CHECK (
    (audience_scope IN ('ministry', 'groups') AND ministry_id IS NOT NULL)
    OR (audience_scope = 'all_members' AND ministry_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS ministry_groups_ministry_status_idx
  ON ministry_groups (ministry_id, status, sort_order);
CREATE INDEX IF NOT EXISTS ministry_group_members_membership_idx
  ON ministry_group_members (ministry_member_id);

-- Retire abandoned coordinating ministries but preserve development history.
UPDATE ministry_members SET status = 'inactive', updated_at = now()
WHERE ministry_id IN (
  SELECT id FROM ministries
  WHERE lower(COALESCE(slug, '')) IN ('ceremony', 'sacred-music', 'choir')
     OR lower(name) IN ('ceremony', 'sacred music', 'choir')
);
UPDATE ministries SET status = 'archived', updated_at = now()
WHERE lower(COALESCE(slug, '')) IN ('ceremony', 'sacred-music', 'choir')
   OR lower(name) IN ('ceremony', 'sacred music', 'choir');

INSERT INTO ministries (name, slug, description, status, created_by)
SELECT 'Schola', 'schola', 'Choir and Schola sacred music ministry.', 'active', administrator.id
FROM ministry_accounts administrator
WHERE administrator.status = 'active'
  AND administrator.global_role IN ('owner', 'super_admin')
  AND NOT EXISTS (SELECT 1 FROM ministries WHERE lower(slug) = 'schola')
ORDER BY CASE administrator.global_role WHEN 'owner' THEN 0 ELSE 1 END, administrator.created_at
LIMIT 1;

INSERT INTO ministry_groups (
  ministry_id, name, description, sort_order, automatic_membership,
  created_by, updated_by
)
SELECT ministry.id, seed.name, seed.description, seed.sort_order,
  seed.automatic_membership, administrator.id, administrator.id
FROM ministries ministry
JOIN LATERAL (
  SELECT id FROM ministry_accounts
  WHERE status = 'active' AND global_role IN ('owner', 'super_admin')
  ORDER BY CASE global_role WHEN 'owner' THEN 0 ELSE 1 END, created_at LIMIT 1
) administrator ON true
JOIN (VALUES
  ('Choir', 'All members of the ministry sing in the Choir.', 1, true),
  ('Schola', 'Members additionally selected to sing in the Schola.', 2, false)
) seed(name, description, sort_order, automatic_membership) ON true
WHERE ministry.slug = 'schola'
  AND NOT EXISTS (
    SELECT 1 FROM ministry_groups existing
    WHERE existing.ministry_id = ministry.id AND lower(existing.name) = lower(seed.name)
  );

INSERT INTO ministry_group_members (group_id, ministry_member_id)
SELECT group_record.id, membership.id
FROM ministry_groups group_record
JOIN ministry_members membership ON membership.ministry_id = group_record.ministry_id
WHERE group_record.status = 'active'
  AND group_record.automatic_membership = true
  AND membership.status = 'active'
ON CONFLICT (group_id, ministry_member_id) DO NOTHING;
