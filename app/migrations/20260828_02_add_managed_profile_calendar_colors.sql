-- Store each guardian's calendar color choice for a managed child.
-- The relationship-level setting lets linked guardians organize their calendars independently.

ALTER TABLE managed_profiles
  ADD COLUMN IF NOT EXISTS calendar_color STRING NULL;

ALTER TABLE managed_profiles
  ADD CONSTRAINT managed_profiles_calendar_color_check
    CHECK (
      calendar_color IS NULL
      OR calendar_color IN (
        '#D32F2F', '#EC407A', '#8E24AA', '#3949AB',
        '#1E88E5', '#00BCD4', '#00897B', '#43A047',
        '#C0CA33', '#FDD835', '#C49A00', '#827717',
        '#6D4C41', '#9E9E9E', '#455A64', '#000000'
      )
    );
