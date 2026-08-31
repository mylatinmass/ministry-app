export const CHILD_PROFILE_COLOR_SWATCHES = [
  { name: "Crimson", value: "#D32F2F", foreground: "#FFFFFF" },
  { name: "Rose", value: "#EC407A", foreground: "#FFFFFF" },
  { name: "Purple", value: "#8E24AA", foreground: "#FFFFFF" },
  { name: "Indigo", value: "#3949AB", foreground: "#FFFFFF" },
  { name: "Blue", value: "#1E88E5", foreground: "#FFFFFF" },
  { name: "Cyan", value: "#00BCD4", foreground: "#111827" },
  { name: "Teal", value: "#00897B", foreground: "#FFFFFF" },
  { name: "Green", value: "#43A047", foreground: "#111827" },
  { name: "Lime", value: "#C0CA33", foreground: "#111827" },
  { name: "Yellow", value: "#FDD835", foreground: "#111827" },
  { name: "Mustard", value: "#C49A00", foreground: "#111827" },
  { name: "Olive", value: "#827717", foreground: "#FFFFFF" },
  { name: "Brown", value: "#6D4C41", foreground: "#FFFFFF" },
  { name: "Gray", value: "#9E9E9E", foreground: "#111827" },
  { name: "Charcoal", value: "#455A64", foreground: "#FFFFFF" },
  { name: "Black", value: "#000000", foreground: "#FFFFFF" },
]

export const HOUSEHOLD_PROFILE_COLORS = CHILD_PROFILE_COLOR_SWATCHES.map(
  (swatch) => swatch.value,
)

export const GUARDIAN_PROFILE_COLOR = "#f97316"

const childColorValues = new Set(HOUSEHOLD_PROFILE_COLORS)

export const isChildProfileColor = (value) => childColorValues.has(value)

export const buildHouseholdProfileColors = (profiles = []) => {
  let childIndex = 0
  return new Map(
    profiles.map((profile) => {
      if (profile.isGuardian) return [profile.id, GUARDIAN_PROFILE_COLOR]
      const fallback =
        HOUSEHOLD_PROFILE_COLORS[
          childIndex % HOUSEHOLD_PROFILE_COLORS.length
        ]
      childIndex += 1
      return [
        profile.id,
        isChildProfileColor(profile.calendarColor)
          ? profile.calendarColor
          : fallback,
      ]
    }),
  )
}
