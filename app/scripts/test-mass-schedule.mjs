import assert from "node:assert/strict"
import {
  buildMassTemplateDefinitions,
  classifyMassDescription,
  extractMassEvents,
  parseScheduleDateTime,
} from "./lib/mass-schedule-sync.mjs"

assert.equal(classifyMassDescription("Low Mass"), "low_mass")
assert.equal(classifyMassDescription("Sung Mass"), "high_mass")
assert.equal(classifyMassDescription("Solemn High Mass"), "high_mass")
assert.equal(
  classifyMassDescription("Low Mass with veneration of the relic"),
  "low_mass",
)
assert.equal(classifyMassDescription("Confessions | Rosary"), null)
assert.equal(classifyMassDescription("Holy Hour for Priests"), null)

assert.equal(
  parseScheduleDateTime("2026-08-07", "6:30 pm").instant.toISOString(),
  "2026-08-07T22:30:00.000Z",
)
assert.equal(
  parseScheduleDateTime("2027-01-08", "7:15 am").instant.toISOString(),
  "2027-01-08T12:15:00.000Z",
)

const extracted = extractMassEvents({
  massDays: [
    {
      dayYMD: "2026-08-07",
      day: "Friday - Aug 7",
      eventName: "St. Caietanus (First Friday)",
      masses: [
        { time: "5:30 pm", description: "Confessions | Rosary" },
        { time: "6:30 pm", description: "Low Mass" },
        { time: "7:30 pm", description: "Nocturnal Adoration" },
      ],
    },
    {
      dayYMD: "2026-08-09",
      day: "Sunday - Aug 9",
      masses: [
        { time: "7:00 am", description: "Low Mass" },
        { time: "11:00 am", description: "Sung Mass" },
      ],
    },
  ],
})
assert.equal(extracted.sourceRows, 5)
assert.equal(extracted.events.length, 3)
assert.equal(extracted.skippedRows, 2)
assert.equal(extracted.events[0].title, "St. Caietanus (First Friday)")
assert.deepEqual(
  extracted.events.map((event) => [event.sourceKey, event.eventType]),
  [
    ["2026-08-07|18:30", "low_mass"],
    ["2026-08-09|07:00", "low_mass"],
    ["2026-08-09|11:00", "high_mass"],
  ],
)

const templates = buildMassTemplateDefinitions({
  sacristansMinistryId: "sacristans-id",
  altarServersMinistryId: "altar-servers-id",
  ushersMinistryId: "ushers-id",
})
assert.equal(templates.low_mass.responsibilities.length, 4)
assert.equal(templates.high_mass.responsibilities.length, 12)
assert.deepEqual(
  templates.low_mass.responsibilities.map((item) => [
    item.ministryId,
    item.name,
  ]),
  [
    ["sacristans-id", "Sacristan"],
    ["altar-servers-id", "Acolyte 1"],
    ["altar-servers-id", "Acolyte 2"],
    ["ushers-id", "Usher"],
  ],
)
assert.deepEqual(
  templates.high_mass.responsibilities.map((item) => item.name),
  [
    "Sacristan",
    "Acolyte 1",
    "Acolyte 2",
    "Master of Ceremonies",
    "Thurifer",
    "Boat Bearer",
    "Cross Bearer",
    "Torchbearer 1",
    "Torchbearer 2",
    "Torchbearer 3",
    "Torchbearer 4",
    "Usher",
  ],
)

console.log("Mass Schedule parsing and template tests passed")
