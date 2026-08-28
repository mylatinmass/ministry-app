const COMMIT_PATTERN = /\b(save|send|submit|approve|delete|remove|cancel|publish|create|confirm|accept|decline|archive|assign|invite|request access|activate|generate)\b/i

const NAVIGATION_TARGETS = [
  ["chapel settings", "account-nav-chapel-settings"],
  ["my profile", "account-nav-profile"],
  ["profile", "account-nav-profile"],
  ["availability", "account-nav-availability"],
  ["calendar", "account-nav-calendar"],
  ["messages", "account-nav-messages"],
  ["ministries", "account-nav-ministries"],
  ["members", "account-nav-members"],
  ["events", "account-nav-events"],
  ["support", "account-nav-support"],
]

const ACTION_TARGETS = [
  ["contact support", "action-contact-support"],
  ["documentation", "action-documentation"],
  ["service frequency", "action-service-frequency"],
  ["my availability", "action-my-availability"],
  ["new template", "action-new-template"],
  ["add event", "action-add-event"],
  ["create event", "action-add-event"],
  ["add member", "action-add-member"],
  ["member access", "action-member-access"],
  ["open roles", "action-roles"],
  ["month", "action-month"],
  ["week", "action-week"],
  ["today", "action-today"],
  ["custom", "action-custom"],
  ["roster", "action-roster"],
  ["templates", "action-templates"],
  ["coverage", "action-coverage"],
  ["reports", "action-participation"],
]

const startsLikeNavigation = (text) =>
  /^(menu\b|open\b|go to\b|availability\.|calendar\.|events\.|messages\.|ministries\.|members\.|support\.|my profile\.|from .+ select\b|select the .+ (tab|section|view)\b|choose the .+ (tab|section|view)\b)/i.test(
    text,
  )

const inferTarget = (text) => {
  const normalized = text.toLowerCase()
  if (/^menu\.?$/i.test(text.trim())) return "account-menu"
  if (/open (a |the )?ministry\b/i.test(text)) return "ministry-card"

  if (startsLikeNavigation(text)) {
    const action = ACTION_TARGETS.find(([phrase]) => normalized.includes(phrase))
    if (action) return action[1]
    const navigation = NAVIGATION_TARGETS.find(([phrase]) =>
      normalized.includes(phrase),
    )
    if (navigation) return navigation[1]
  }
  return ""
}

const inferGuideStep = (text, index, total) => {
  const target = inferTarget(text)
  const isCommit = COMMIT_PATTERN.test(text)

  if (isCommit && index === total - 1) {
    return {
      id: `step-${index + 1}`,
      mode: "commit",
      instruction: text,
      event: "continue",
    }
  }

  if (target) {
    return {
      id: `step-${index + 1}`,
      mode: "target",
      target,
      instruction: text,
      event: "click",
    }
  }

  return {
    id: `step-${index + 1}`,
    mode: "information",
    instruction: text,
    event: "continue",
  }
}

const inferRequiredRole = (topic) => {
  const source = `${topic.note || ""} ${topic.steps.join(" ")}`
  if (/super[ -]?admin/i.test(source)) return "super_admin"
  if (/\badmin(istrator)? only\b/i.test(source)) return "admin"
  return "member"
}

const buildGuide = (topic) => ({
  id: topic.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, ""),
  title: topic.title,
  requiredRole: inferRequiredRole(topic),
  steps: topic.steps.map((step, index) => ({
    ...inferGuideStep(step, index, topic.steps.length),
    ...(topic.guideOverrides?.[index] || {}),
  })),
})

const GUIDE_TARGET_SELECTOR = (target) => `[data-guide-id="${target}"]`

export { GUIDE_TARGET_SELECTOR, buildGuide, inferGuideStep }
