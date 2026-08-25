CREATE TABLE IF NOT EXISTS ministry_event_pins (
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS ministry_event_pins_event_idx
  ON ministry_event_pins (event_id, user_id);
