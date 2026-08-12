-- Complete confirmation-overdue, consolidated review, and urgent acknowledgment workflows.

ALTER TABLE responsibility_assignments
  ADD COLUMN IF NOT EXISTS confirmation_overdue_at TIMESTAMPTZ NULL;

ALTER TABLE ministry_alerts
  ADD COLUMN IF NOT EXISTS acknowledgment_required BOOL NOT NULL DEFAULT false;

ALTER TABLE ministry_alerts
  ADD COLUMN IF NOT EXISTS acknowledgment_deadline_at TIMESTAMPTZ NULL;

ALTER TABLE ministry_alerts
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ NULL;

ALTER TABLE ministry_alerts
  ADD COLUMN IF NOT EXISTS acknowledged_by_user_id UUID NULL REFERENCES users(id);

ALTER TABLE ministry_alerts
  ADD COLUMN IF NOT EXISTS escalation_sent_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS responsibility_assignments_confirmation_overdue_idx
  ON responsibility_assignments (confirmation_overdue_at, event_id)
  WHERE confirmation_overdue_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ministry_alerts_acknowledgment_due_idx
  ON ministry_alerts (
    acknowledgment_required,
    acknowledged_at,
    escalation_sent_at,
    acknowledgment_deadline_at
  );
