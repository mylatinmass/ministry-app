import assert from "node:assert/strict"
import test from "node:test"
import {
  finalReminderEventIds,
  shortReminder,
} from "../src/server/notifications/reminder-cadence.js"

test("final reminders select the earliest event per group and per account", () => {
  const assignment = (recipient, event, time) => ({
    recipient_user_id: recipient,
    event_id: event,
    start_time: `2026-11-29T${time}:00Z`,
  })
  const groups = finalReminderEventIds([
    assignment("parent", "choir", "14:59"),
    assignment("parent", "mass", "12:00"),
    assignment("parent", "mass", "12:00"),
    assignment("parent", "practice", "15:00"),
    assignment("parent", "vespers", "17:59"),
    assignment("parent", "rosary", "18:00"),
    assignment("second-guardian", "choir", "14:59"),
    assignment("second-guardian", "mass", "12:00"),
    assignment("member", "choir", "14:59"),
  ])
  assert.deepEqual([...groups.get("parent")], ["mass", "practice", "rosary"])
  assert.deepEqual([...groups.get("second-guardian")], ["mass"])
  assert.deepEqual([...groups.get("member")], ["choir"])
})

test("short reminders name one event and summarize multiple events or staffing alerts", () => {
  const name = "Dennis Lindo"
  assert.equal(
    shortReminder({ name, period: "tomorrow", count: 1, title: "Schola Practice" }),
    "Hello Dennis Lindo. You have 1 event tomorrow (Schola Practice). Check the app or email for details.",
  )
  assert.equal(
    shortReminder({ name, period: "tomorrow", count: 2, title: "Schola Practice" }),
    "Hello Dennis Lindo. You have 2 events tomorrow. Check the app or email for details.",
  )
  assert.equal(
    shortReminder({ name, period: "this week", count: 2, alerts: 1 }),
    "Hello Dennis Lindo. You have 2 upcoming events and 1 alert this week. Check the app or email for details.",
  )
  assert.equal(
    shortReminder({ name, period: "this week", alerts: 3 }),
    "Hello Dennis Lindo. You have 3 alerts this week. Check the app or email for details.",
  )
  assert.equal(
    shortReminder({ name, period: "soon", count: 1, title: "Schola Practice" }),
    "Hello Dennis Lindo. Coming up: Schola Practice. Check the app or email for details.",
  )
})
