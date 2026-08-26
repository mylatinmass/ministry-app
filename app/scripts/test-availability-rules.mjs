import assert from "node:assert/strict"
import test from "node:test"
import {
  effectiveAvailabilityDay,
  eventFits,
  monthAvailabilityDays,
} from "../src/server/scheduling/availability-rules.ts"

const saturdayRule = {
  day_of_week: 6,
  start_time: "16:00",
  end_time: "17:00",
}

test("members are available all day when no rule applies to the weekday", () => {
  const day = effectiveAvailabilityDay({
    day: "2026-08-03",
    policy: "generally_available",
    rules: [],
    overrides: [],
    blocks: [],
  })
  assert.equal(day.status, "available")
  assert.equal(day.source, "default")
  assert.deepEqual(day.windows, [{ start: 0, end: 1440, allDay: true }])
})

test("a timed exclusion blocks only its matching time", () => {
  const configuration = {
    policy: "generally_available",
    timezone: "America/New_York",
    rules: [saturdayRule],
    overrides: [],
    blocks: [],
  }
  const days = monthAvailabilityDays("2026-08", configuration)
  assert.deepEqual(days[0].windows, [
    { start: 0, end: 960, allDay: false },
    { start: 1020, end: 1440, allDay: false },
  ])
  assert.deepEqual(days[0].exclusions, [{ start: 960, end: 1020, allDay: false }])
  assert.equal(days[0].source, "exclusion_rule")
  assert.equal(days[1].status, "available")
  assert.equal(days[1].source, "default")
  assert.deepEqual(days[1].windows, [{ start: 0, end: 1440, allDay: true }])
})

test("first weekday exclusions apply only to the first matching weekday", () => {
  const configuration = {
    policy: "generally_available",
    timezone: "America/New_York",
    rules: [
      {
        day_of_week: 5,
        week_of_month: "first",
        start_time: "18:00",
        end_time: "20:00",
      },
      {
        day_of_week: 6,
        week_of_month: "first",
        start_time: null,
        end_time: null,
      },
    ],
    overrides: [],
    blocks: [],
  }
  const days = monthAvailabilityDays("2026-08", configuration)
  assert.equal(days[0].status, "unavailable")
  assert.equal(days[0].source, "exclusion_rule")
  assert.deepEqual(days[6].windows, [
    { start: 0, end: 1080, allDay: false },
    { start: 1200, end: 1440, allDay: false },
  ])
  assert.equal(days[7].status, "available")
  assert.equal(days[7].source, "default")
  assert.equal(days[13].status, "available")
  assert.equal(days[1].status, "available")
  assert.equal(days[1].source, "default")
})

test("last weekday exclusions follow the actual final weekday of the month", () => {
  const configuration = {
    policy: "generally_available",
    timezone: "America/New_York",
    rules: [{ ...saturdayRule, week_of_month: "last" }],
    overrides: [],
    blocks: [],
  }
  const days = monthAvailabilityDays("2026-08", configuration)
  assert.equal(days[28].status, "available")
  assert.equal(days[28].source, "exclusion_rule")
  assert.equal(days[0].status, "available")
  assert.equal(days[0].source, "default")
})

test("exact date overrides outrank ranges and weekly rules", () => {
  const available = effectiveAvailabilityDay({
    day: "2026-08-08",
    policy: "generally_available",
    rules: [saturdayRule],
    overrides: [{ override_date: "2026-08-08", preference: "available" }],
    blocks: [{ start_date: "2026-08-01", end_date: "2026-08-31" }],
  })
  assert.equal(available.source, "override")
  assert.deepEqual(available.windows, [{ start: 0, end: 1440, allDay: true }])

  const unavailable = effectiveAvailabilityDay({
    day: "2026-08-08",
    policy: "generally_available",
    rules: [saturdayRule],
    overrides: [{ override_date: "2026-08-08", preference: "unavailable" }],
    blocks: [],
  })
  assert.equal(unavailable.status, "unavailable")
  assert.equal(unavailable.explicit, true)
})

test("a partial date override allows only its explicit time window", () => {
  const base = {
    timezone: "America/New_York",
    policy: "generally_available",
    rules: [{
      day_of_week: 6,
      start_time: null,
      end_time: null,
    }],
    overrides: [{
      override_date: "2026-08-08",
      preference: "available",
      start_time: "10:00",
      end_time: "13:00",
    }],
    blocks: [{ start_date: "2026-08-08", end_date: "2026-08-08" }],
  }
  const day = effectiveAvailabilityDay({ day: "2026-08-08", ...base })
  assert.equal(day.source, "override")
  assert.deepEqual(day.windows, [{ start: 600, end: 780, allDay: false }])
  assert.equal(eventFits({
    ...base,
    start: "2026-08-08T14:00:00Z",
    end: "2026-08-08T17:00:00Z",
  }), true)
  assert.equal(eventFits({
    ...base,
    start: "2026-08-08T13:30:00Z",
    end: "2026-08-08T14:30:00Z",
  }), false)
  assert.equal(eventFits({
    ...base,
    start: "2026-08-08T16:30:00Z",
    end: "2026-08-08T17:30:00Z",
  }), false)
})

test("events cannot overlap a timed exclusion", () => {
  const base = {
    timezone: "America/New_York",
    policy: "generally_available",
    rules: [saturdayRule],
    overrides: [],
    blocks: [],
  }
  assert.equal(eventFits({
    ...base,
    start: "2026-08-08T20:00:00Z",
    end: "2026-08-08T21:00:00Z",
  }), false)
  assert.equal(eventFits({
    ...base,
    start: "2026-08-08T19:00:00Z",
    end: "2026-08-08T20:00:00Z",
  }), true)
  assert.equal(eventFits({
    ...base,
    start: "2026-08-08T21:00:00Z",
    end: "2026-08-08T22:00:00Z",
  }), true)
})

test("a first Friday exclusion leaves other Fridays and other times available", () => {
  const base = {
    timezone: "America/New_York",
    policy: "generally_available",
    rules: [{
      day_of_week: 5,
      week_of_month: "first",
      start_time: "18:00",
      end_time: "20:00",
    }],
    overrides: [],
    blocks: [],
  }
  assert.equal(eventFits({
    ...base,
    start: "2026-08-07T22:00:00Z",
    end: "2026-08-08T00:00:00Z",
  }), false)
  assert.equal(eventFits({
    ...base,
    start: "2026-08-07T21:30:00Z",
    end: "2026-08-07T22:30:00Z",
  }), false)
  assert.equal(eventFits({
    ...base,
    start: "2026-08-14T22:00:00Z",
    end: "2026-08-15T00:00:00Z",
  }), true)
  assert.equal(eventFits({
    ...base,
    start: "2026-08-10T14:00:00Z",
    end: "2026-08-10T15:00:00Z",
  }), true)
})

test("timezone exclusion evaluation follows daylight-saving changes", () => {
  assert.equal(eventFits({
    start: "2026-03-08T20:00:00Z",
    end: "2026-03-08T21:00:00Z",
    timezone: "America/New_York",
    policy: "generally_available",
    rules: [{ day_of_week: 0, start_time: "16:00", end_time: "17:00" }],
    overrides: [],
    blocks: [],
  }), false)
})
