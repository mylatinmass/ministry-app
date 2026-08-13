export const normalizeMinistryTheme = (theme) =>
  theme === "dark" ? "dark" : "light"

export const applyMinistryTheme = (theme, profileId = "") => {
  if (typeof document === "undefined") return
  const normalized = normalizeMinistryTheme(theme)
  document.documentElement.dataset.ministryTheme = normalized
  document.documentElement.style.colorScheme = normalized
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", normalized === "dark" ? "#111827" : "#896542")
  if (typeof window !== "undefined") {
    window.localStorage.setItem("ministry_active_theme", normalized)
    if (profileId) {
      window.localStorage.setItem(`ministry_theme_${profileId}`, normalized)
    }
  }
}

export const getCachedMinistryTheme = (profileId = "") => {
  if (typeof window === "undefined") return "light"
  return normalizeMinistryTheme(
    (profileId && window.localStorage.getItem(`ministry_theme_${profileId}`)) ||
      window.localStorage.getItem("ministry_active_theme"),
  )
}
