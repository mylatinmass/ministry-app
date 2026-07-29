import * as React from "react"
import { MapPinIcon } from "@heroicons/react/24/outline"

const eventTones = [
  "bg-[#C1A387]",
  "bg-rose-400",
  "bg-violet-400",
  "bg-teal-400",
]

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const formatTime = (value) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const MinistryEventAgenda = ({
  events,
  label,
  emptyTitle,
  emptyText,
  showDateHeadings = true,
  onEventSelect,
}) => {
  const groupedEvents = events.reduce((groups, event) => {
    const key = toDateKey(event.start_time)
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
    return groups
  }, {})
  const dateKeys = Object.keys(groupedEvents).sort()

  return (
    <section
      aria-label={label}
      className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-gray-100 bg-white pb-6 pt-4 pr-1"
    >
      {dateKeys.length ? (
        <div className="space-y-7">
          {dateKeys.map((key, groupIndex) => {
            const date = new Date(`${key}T12:00:00`)

            return (
              <section key={key}>
                {showDateHeadings && (
                  <div className="mb-4 flex items-center gap-4">
                    <h5 className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-gray-700 sm:text-sm">
                      {new Intl.DateTimeFormat("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      }).format(date)}
                    </h5>
                    <span className="h-px flex-1 bg-gray-100" />
                  </div>
                )}
                <div className="space-y-2">
                  {groupedEvents[key].map((event, eventIndex) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventSelect?.(event)}
                      className={`grid w-full grid-cols-[4.5rem_0.75rem_1fr] items-start gap-3 rounded-xl border-2 px-2 py-3 text-left transition hover:bg-gray-50 sm:grid-cols-[5.5rem_0.75rem_1fr] ${
                        event.is_assigned
                          ? "border-orange-400"
                          : "border-gray-200"
                      }`}
                    >
                      <p className="text-sm leading-relaxed text-gray-400 sm:text-base">
                        {formatTime(event.start_time)}
                        <br />
                        {formatTime(event.end_time)}
                      </p>
                      <span
                        className={`mt-2 size-2.5 rounded-full ${
                          eventTones[
                            (groupIndex + eventIndex) % eventTones.length
                          ]
                        }`}
                      />
                      <div className="min-w-0">
                        <h6 className="font-semibold text-gray-950 sm:text-lg">
                          {event.title}
                        </h6>
                        {event.visibleProfileAssignments?.length > 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            {event.visibleProfileAssignments
                              .map(
                                (assignment) =>
                                  `${assignment.firstName} ${assignment.lastName}: ${assignment.responsibilityName}`,
                              )
                              .join(" · ")}
                          </p>
                        )}
                        <p className="mt-0.5 text-sm text-gray-600 sm:text-base">
                          {event.description || "Ministry event"}
                        </p>
                        {event.location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 sm:text-sm">
                            <MapPinIcon className="size-4" />
                            {event.location}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center py-10 text-center">
          <h4 className="century-font text-2xl text-gray-900">{emptyTitle}</h4>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
            {emptyText}
          </p>
        </div>
      )}
    </section>
  )
}

export { toDateKey }
export default MinistryEventAgenda
