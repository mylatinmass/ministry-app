-- Optional member attendance responses for ministry events.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rsvp_enabled BOOL NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES ministry_accounts(id) ON DELETE CASCADE,
  response STRING NOT NULL,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id),
  CONSTRAINT event_rsvps_response_check
    CHECK (response IN ('attending', 'not_attending'))
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_response_idx
  ON event_rsvps (event_id, response);
