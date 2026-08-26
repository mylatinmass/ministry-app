ALTER TABLE availability_date_overrides
  ADD COLUMN IF NOT EXISTS start_time TIME NULL;

ALTER TABLE availability_date_overrides
  ADD COLUMN IF NOT EXISTS end_time TIME NULL;

ALTER TABLE availability_date_overrides
  ADD CONSTRAINT availability_date_overrides_time_check
  CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (
      preference = 'available'
      AND start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND end_time > start_time
    )
  );
