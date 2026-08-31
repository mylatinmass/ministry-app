import assert from "node:assert/strict"
import {
  buildHouseholdProfileColors,
  CHILD_PROFILE_COLOR_SWATCHES,
  GUARDIAN_PROFILE_COLOR,
} from "../src/react/utils/householdCalendar.js"

assert.equal(CHILD_PROFILE_COLOR_SWATCHES.length, 16)
assert.equal(
  new Set(CHILD_PROFILE_COLOR_SWATCHES.map((swatch) => swatch.value)).size,
  16,
)

const colors = buildHouseholdProfileColors([
  { id: "guardian", isGuardian: true },
  { id: "first-child", isGuardian: false },
  { id: "saved-child", isGuardian: false, calendarColor: "#000000" },
  { id: "invalid-child", isGuardian: false, calendarColor: "#FFFFFF" },
])

assert.equal(colors.get("guardian"), GUARDIAN_PROFILE_COLOR)
assert.equal(colors.get("first-child"), "#D32F2F")
assert.equal(colors.get("saved-child"), "#000000")
assert.equal(colors.get("invalid-child"), "#8E24AA")

console.log("Household calendar color tests passed")
