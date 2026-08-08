import * as React from "react"
import { MapPinIcon } from "@heroicons/react/24/outline"

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
      aria-label={label} className="flex-1 overflow-y-auto w-full"
    >
      {dateKeys.length ? (
        <div className="space-y-7">
          {dateKeys.map((key) => {
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
                  {groupedEvents[key].map((event) => {
                    const isMassTemplate = /^(low|high) mass$/i.test(
                      event.template_name || "",
                    )
                    const templateName = isMassTemplate
                      ? event.template_name
                      : ""
                    const ordoName =
                      event.ordo_celebration || event.ordo_mass_name || ""
                    const isFirstFriday =
                      Array.isArray(event.ordo_general_information) &&
                      event.ordo_general_information.some((item) =>
                        /first friday/i.test(item),
                      )
                    const ordoEventName = ordoName
                      ? `${ordoName}${
                          isFirstFriday && !/first friday/i.test(ordoName)
                            ? " (First Friday)"
                            : ""
                        }`
                      : ""
                    const eventName = isMassTemplate
                      ? event.title && event.title !== templateName
                        ? event.title
                        : ordoEventName || event.title
                      : event.title

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onEventSelect?.(event)}
                        className={`relative w-full flex flex-col items-center gap-1 border border-l-8 px-4 py-2 transition hover:bg-gray-50 ${
                          event.is_assigned
                            ? "border-orange-400"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex flex-row items-center gap-3 w-full leading-relaxed text-gray-400 text-sm">
                          {formatTime(event.start_time)}
                          {templateName && (
                            <h6 className="font-semibold uppercase">
                              {templateName}
                            </h6>
                          )}
                        </div>
                        {eventName && eventName !== templateName && (
                          <p className="text-xs font-semibold uppercase sm:text-sm text-left w-full max-h-8 overflow-hidden text-ellipsis">
                            {eventName}
                          </p>
                        )}
                        <div className="min-w-0">


                        {/* {event.visibleProfileAssignments?.length > 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            {event.visibleProfileAssignments
                              .map(
                                (assignment) =>
                                  `${assignment.firstName} ${assignment.lastName}: ${assignment.responsibilityName}`,
                              )
                              .join(" · ")}
                          </p>
                        )} */}
                        {/* <p className="mt-0.5 text-sm text-gray-600 sm:text-base">
                          {event.description || "Parish event"}
                        </p> */}
                        {/* {event.location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 sm:text-sm">
                            <MapPinIcon className="size-4" />
                            {event.location}
                          </p>
                        )} */}
                        </div>
                      </button>
                    )
                  })}
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
