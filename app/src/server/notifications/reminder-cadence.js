const SEPARATE_EVENT_MS = 3 * 60 * 60 * 1000

// A group is measured from its first event, so successive close events cannot
// merge an entire day's schedule. Each recipient has their own groups.
export const finalReminderEventIds = (assignments) => {
  const earliestEventsByRecipient = new Map()
  for (const assignment of assignments) {
    const events = earliestEventsByRecipient.get(assignment.recipient_user_id) || new Map()
    events.set(assignment.event_id, new Date(assignment.start_time).getTime())
    earliestEventsByRecipient.set(assignment.recipient_user_id, events)
  }
  return new Map([...earliestEventsByRecipient].map(([recipient, events]) => {
    const sorted = [...events].sort(([leftId, leftTime], [rightId, rightTime]) =>
      leftTime - rightTime || leftId.localeCompare(rightId),
    )
    let firstTime = -Infinity
    const selected = new Set()
    for (const [id, time] of sorted) {
      if (time - firstTime < SEPARATE_EVENT_MS) continue
      selected.add(id)
      firstTime = time
    }
    return [recipient, selected]
  }))
}

export const shortReminder = ({ name, period, count = 0, alerts = 0, title = "" }) => {
  const eventLabel = count === 1 ? "event" : "events"
  const alertLabel = alerts === 1 ? "alert" : "alerts"
  if (period === "soon" && title) {
    return `Hello ${name}. Coming up: ${title}. Check the app or email for details.`
  }
  const items = [
    count ? `${count} ${period === "this week" ? "upcoming " : ""}${eventLabel}` : "",
    alerts ? `${alerts} ${alertLabel}` : "",
  ].filter(Boolean)
  const eventName = title && count === 1 && !alerts ? ` (${title})` : ""
  return `Hello ${name}. You have ${items.join(" and ")} ${period}${eventName}. Check the app or email for details.`
}
