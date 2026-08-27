export const HOUSEHOLD_PROFILE_COLORS = [
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#0ea5e9",
  "#e11d48",
  "#14b8a6",
]

export const buildHouseholdProfileColors = (profiles = []) =>
  new Map(
    profiles.map((profile, index) => [
      profile.id,
      HOUSEHOLD_PROFILE_COLORS[index % HOUSEHOLD_PROFILE_COLORS.length],
    ]),
  )
