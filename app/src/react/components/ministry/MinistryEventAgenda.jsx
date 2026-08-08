import * as React from "react"
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"

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
  showAssignmentActions = false,
  onAssignmentResponse,
  savingAssignmentIds = new Set(),
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

                    const assignmentRows =
                      event.visibleProfileAssignments || []

                    return (
                      <article
                        key={event.id}
                        className={`relative w-full border border-l-8 transition hover:bg-gray-50 ${
                          event.is_assigned
                            ? "border-orange-400"
                            : "border-gray-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onEventSelect?.(event)}
                          className="flex w-full flex-col items-center gap-1 px-4 py-2"
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
                        {showAssignmentActions && assignmentRows.length > 0 && (
                          <div className="border-t border-gray-100 px-4 py-2">
                            {assignmentRows.map((assignment) => {
                              const pending = ["pending", "assigned"].includes(
                                assignment.status,
                              )
                              const saving = savingAssignmentIds.has(
                                assignment.id,
                              )
                              return (
                                <div
                                  key={assignment.id}
                                  className="flex items-center gap-3 py-1 text-left text-xs sm:text-sm"
                                >
                                  <span className="min-w-0 flex-1 font-semibold text-gray-600">
                                    {assignment.responsibilityName}
                                  </span>
                                  {pending ? (
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() =>
                                          onAssignmentResponse?.(
                                            assignment,
                                            "confirm",
                                            event,
                                          )
                                        }
                                        className="rounded-full p-1 text-green-600 transition hover:bg-green-50 disabled:opacity-50"
                                        aria-label={`Accept ${assignment.responsibilityName}`}
                                        title="Accept assignment"
                                      >
                                        <CheckCircleIcon className="size-6" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() =>
                                          onAssignmentResponse?.(
                                            assignment,
                                            "decline",
                                            event,
                                          )
                                        }
                                        className="rounded-full p-1 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                        aria-label={`Decline ${assignment.responsibilityName}`}
                                        title="Decline assignment"
                                      >
                                        <XCircleIcon className="size-6" />
                                      </button>
                                    </div>
                                  ) : assignment.status === "confirmed" ? (
                                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-green-700">
                                      <CheckCircleIcon className="size-5" /> Accepted
                                    </span>
                                  ) : assignment.status === "declined" ? (
                                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-red-700">
                                      <XCircleIcon className="size-5" /> Declined
                                    </span>
                                  ) : (
                                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-orange-600">
                                      <ExclamationTriangleIcon className="size-5" /> Pending
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </article>
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
