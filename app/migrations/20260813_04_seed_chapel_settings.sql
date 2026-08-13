-- Seed chapel defaults separately from table creation because CockroachDB does
-- not permit writes to a table while its descriptor is being added in the same
-- transaction.

INSERT INTO chapel_settings (setting_key, settings)
VALUES (
  'primary',
  '{
    "chapelName": "Our Lady of Victory Chapel",
    "publicPhone": "",
    "publicEmail": "",
    "streetAddress": "",
    "mailingAddress": "",
    "websiteUrl": "https://www.mylatinmass.com",
    "timeZone": "America/New_York",
    "defaultEventLocation": "",
    "mapUrl": "",
    "publicCalendarUrl": "https://www.mylatinmass.com/events/calendar.ics",
    "defaultMassTemplateId": "",
    "defaultEventTemplateId": "",
    "notificationSenderName": "Our Lady of Victory Chapel",
    "replyToEmail": "",
    "emergencyContact": "",
    "publicEventVisibility": "public",
    "schedulingHorizonDays": 60,
    "logoUrl": "",
    "facebookUrl": "",
    "instagramUrl": "",
    "youtubeUrl": ""
  }'::JSONB
)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO chapel_observances (name, month, day, notes)
VALUES
  ('Birth of Saint Philomena', 1, 10, 'Local shrine observance. Create the chapel Mass independently from the Ordo reference.'),
  ('Finding of the Body of Saint Philomena', 5, 25, 'Local shrine observance. Create the chapel Mass independently from the Ordo reference.'),
  ('Translation of the Body of Saint Philomena', 8, 10, 'Local shrine observance. Create the chapel Mass independently from the Ordo reference.'),
  ('Feast Day of Saint Philomena', 8, 11, 'Local shrine observance. Any External Solemnity is created manually on the selected Sunday.')
ON CONFLICT (month, day, name) DO NOTHING;
