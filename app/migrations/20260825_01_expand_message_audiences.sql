-- Explicit targeting for selected members, multiple ministries, and event participants.
ALTER TABLE ministry_messages
  ADD COLUMN IF NOT EXISTS event_id UUID NULL REFERENCES events(id) ON DELETE SET NULL;

ALTER TABLE ministry_messages
  DROP CONSTRAINT IF EXISTS ministry_messages_audience_check;
ALTER TABLE ministry_messages
  ADD CONSTRAINT ministry_messages_audience_check
  CHECK (audience_scope IN (
    'ministry', 'ministries', 'groups', 'members',
    'event_participants', 'all_members'
  ));

ALTER TABLE ministry_messages
  DROP CONSTRAINT IF EXISTS ministry_messages_audience_ministry_check;
ALTER TABLE ministry_messages
  ADD CONSTRAINT ministry_messages_audience_ministry_check
  CHECK (
    (audience_scope IN ('ministry', 'groups') AND ministry_id IS NOT NULL AND event_id IS NULL)
    OR (audience_scope IN ('ministries', 'members') AND event_id IS NULL)
    OR (audience_scope = 'event_participants' AND event_id IS NOT NULL)
    OR (audience_scope = 'all_members' AND ministry_id IS NULL AND event_id IS NULL)
  );

CREATE TABLE IF NOT EXISTS ministry_message_ministries (
  message_id UUID NOT NULL REFERENCES ministry_messages(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  PRIMARY KEY (message_id, ministry_id)
);

CREATE TABLE IF NOT EXISTS ministry_message_selected_members (
  message_id UUID NOT NULL REFERENCES ministry_messages(id) ON DELETE CASCADE,
  profile_user_id UUID NOT NULL REFERENCES ministry_accounts(id),
  PRIMARY KEY (message_id, profile_user_id)
);

CREATE INDEX IF NOT EXISTS ministry_messages_event_created_idx
  ON ministry_messages (event_id, created_at DESC);
