import * as React from "react"
import { StarIcon } from "@heroicons/react/24/outline"

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

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
  showDateRail = false,
  onEventSelect,
  useAssignmentTime = false,
  dateKeys: requestedDateKeys,
  initialFocusDate,
  focusRequestKey,
  onPastStart,
  onFutureEnd,
  pinnedEventIds = [],
  pinUpdatingEventIds = [],
  onTogglePin,
}) => {
  const scrollContainerRef = React.useRef(null)
  const boundaryLockRef = React.useRef(false)
  const touchStartRef = React.useRef(null)
  const groupedEvents = events.reduce((groups, event) => {
    const displayTime = useAssignmentTime && event.assignment_start_time
      ? event.assignment_start_time
      : event.start_time
    const key = toDateKey(displayTime)
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
    return groups
  }, {})
  const eventDateKeys = Object.keys(groupedEvents).sort()
  const availableDateKeys = requestedDateKeys?.length
    ? [...new Set(requestedDateKeys)].sort()
    : eventDateKeys
  const dateKeys = showDateRail
    ? availableDateKeys.filter((key) => groupedEvents[key]?.length)
    : availableDateKeys
  const dateKeySignature = dateKeys.join("|")
  const focusKey = initialFocusDate ? toDateKey(initialFocusDate) : null
  const targetFocusKey = focusKey
    ? dateKeys.find((key) => key >= focusKey) || dateKeys.at(-1)
    : null

  useIsomorphicLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer || !targetFocusKey) return

    const target = scrollContainer.querySelector(
      `[data-agenda-date="${targetFocusKey}"]`,
    )
    if (!target) return

    const containerTop = scrollContainer.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    scrollContainer.scrollTop += targetTop - containerTop
  }, [targetFocusKey, dateKeySignature, focusRequestKey])

  React.useEffect(() => {
    boundaryLockRef.current = false
  }, [dateKeySignature])

  const showPreviousDates = () => {
    if (!onPastStart || boundaryLockRef.current) return
    boundaryLockRef.current = true
    onPastStart()
  }

  const showNextDates = () => {
    if (!onFutureEnd || boundaryLockRef.current) return
    boundaryLockRef.current = true
    onFutureEnd()
  }

  const handleWheel = (event) => {
    const target = event.currentTarget
    const isAtStart = target.scrollTop <= 1
    const isAtEnd =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 1

    if (isAtStart && event.deltaY < 0 && onPastStart) {
      event.preventDefault()
      showPreviousDates()
    } else if (isAtEnd && event.deltaY > 0 && onFutureEnd) {
      event.preventDefault()
      showNextDates()
    }
  }

  const handleTouchStart = (event) => {
    const target = event.currentTarget
    const startY = event.touches[0]?.clientY
    const isAtStart = target.scrollTop <= 1
    const isAtEnd =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 1

    touchStartRef.current = isAtStart
      ? { boundary: "start", y: startY }
      : isAtEnd
        ? { boundary: "end", y: startY }
        : null
  }

  const handleTouchMove = (event) => {
    const touchStart = touchStartRef.current
    const currentY = event.touches[0]?.clientY
    if (!touchStart || currentY == null) return

    const crossedStart =
      touchStart.boundary === "start" && currentY - touchStart.y >= 48
    const crossedEnd =
      touchStart.boundary === "end" && touchStart.y - currentY >= 48
    if (!crossedStart && !crossedEnd) return

    touchStartRef.current = null
    if (crossedStart) showPreviousDates()
    if (crossedEnd) showNextDates()
  }

  return (
    <section
      ref={scrollContainerRef}
      aria-label={label}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        touchStartRef.current = null
      }}
      className="ministry-scroll-region min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto"
    >
      {dateKeys.length ? (
        <div className={showDateRail ? "space-y-4" : "space-y-2"}>
          {dateKeys.map((key) => {
            const date = new Date(`${key}T12:00:00`)
            const dayEvents = groupedEvents[key] || []

            return (
              <section
                key={key}
                data-agenda-date={key}
                className={showDateRail ? "grid grid-cols-[4.25rem_minmax(0,1fr)] items-stretch gap-3 sm:grid-cols-[5rem_minmax(0,1fr)]" : ""}
              >
                {showDateRail && (
                  <div className="flex min-h-20 flex-col items-center justify-center rounded-xl bg-gray-100 px-2 py-3 text-gray-700">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                      }).format(date)}
                    </span>
                    <span className="mt-1 text-2xl font-bold leading-none text-gray-950 sm:text-3xl">
                      {date.getDate()}
                    </span>
                  </div>
                )}
                {showDateHeadings && !showDateRail && (
                  <div
                    className={`flex items-center gap-4 ${
                      dayEvents.length ? "mb-4" : ""
                    }`}
                  >
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
                {dayEvents.length > 0 && (
                  <div className="space-y-2">
                    {dayEvents.map((event) => {
                      const displayTime =
                        useAssignmentTime && event.assignment_start_time
                          ? event.assignment_start_time
                          : event.start_time
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
                      const isPinned = pinnedEventIds.includes(event.id)
                      const isPinUpdating = pinUpdatingEventIds.includes(event.id)
                      const assignmentProfiles = event.isHouseholdAccount
                        ? [...new Map(
                            (event.visibleProfileAssignments || []).map(
                              (assignment) => [assignment.profileId, assignment],
                            ),
                          ).values()]
                        : []

                      return (
                        <div
                          key={event.id}
                          className={`relative w-full transition hover:bg-gray-50 ${
                            showDateRail
                              ? `rounded-xl border ${
                                  event.is_assigned
                                    ? "border-l-8 border-orange-500 bg-orange-50/30"
                                    : "border-gray-100 bg-white"
                                }`
                              : `border border-l-8 ${
                                  event.is_assigned
                                    ? "border-orange-400"
                                    : "border-gray-200"
                                }`
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onEventSelect?.(event)}
                            aria-label={`${eventName || templateName || "Event"}, ${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(displayTime))}${event.is_assigned ? ", includes your assignment" : ""}`}
                            className={`flex w-full flex-col gap-1 px-4 py-3 text-left ${
                              onTogglePin ? "pr-14" : ""
                            } ${showDateRail ? "items-stretch" : "items-center py-2"}`}
                          >
                          <div className="flex w-full flex-row items-center gap-2 text-sm leading-relaxed text-gray-400">
                            {showDateRail && (
                              <span className="font-semibold uppercase text-gray-500">
                                {new Intl.DateTimeFormat("en-US", {
                                  weekday: "short",
                                }).format(new Date(displayTime))}
                              </span>
                            )}
                            <span>{formatTime(displayTime)}</span>
                            {assignmentProfiles.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1"
                                aria-label={`${assignmentProfiles.map((assignment) => `${assignment.firstName} ${assignment.lastName}`).join(", ")} ${assignmentProfiles.length === 1 ? "is" : "are"} assigned`}
                              >
                                {assignmentProfiles.map((assignment) => (
                                  <span
                                    key={assignment.profileId}
                                    title={`${assignment.firstName} ${assignment.lastName}`}
                                    className="size-2.5 rounded-full ring-1 ring-black/10"
                                    style={{ backgroundColor: assignment.profileColor }}
                                    aria-hidden="true"
                                  />
                                ))}
                              </span>
                            )}
                            {templateName && (
                              <h6 className="ml-1 font-semibold uppercase">
                                {templateName}
                              </h6>
                            )}
                          </div>
                          {eventName && eventName !== templateName && (
                            <p className="w-full text-left text-xs font-semibold uppercase leading-snug sm:text-sm">
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
                          {onTogglePin && (
                            <button
                              type="button"
                              onClick={() => onTogglePin(event)}
                              disabled={isPinUpdating}
                              aria-pressed={isPinned}
                              aria-label={`${isPinned ? "Unpin" : "Pin"} ${eventName || templateName || "event"}`}
                              className={`absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full transition disabled:opacity-50 ${
                                isPinned
                                  ? "bg-[#f4ede6] text-[#896542]"
                                  : "text-gray-400 hover:bg-[#f7f3ef] hover:text-[#896542]"
                              }`}
                            >
                              <StarIcon
                                className={`size-5 ${isPinned ? "fill-current" : ""}`}
                              />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
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
