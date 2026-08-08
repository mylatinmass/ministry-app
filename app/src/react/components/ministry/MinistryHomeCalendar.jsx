import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline"
import MinistryEventAgenda, { toDateKey } from "./MinistryEventAgenda"

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

const getMonthCells = (month) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

const MinistryHomeCalendar = ({
  events = [],
  onEventSelect,
}) => {
  const calendarViewportRef = React.useRef(null)
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = React.useState(null)
  const [mobileMonthIndex, setMobileMonthIndex] = React.useState(0)
  const [showsTwoMonths, setShowsTwoMonths] = React.useState(false)
  const visibleMonths = React.useMemo(
    () => [
      visibleMonth,
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
    ],
    [visibleMonth],
  )
  const validEvents = React.useMemo(
    () =>
      events.filter(
        (event) => !Number.isNaN(new Date(event.start_time).getTime()),
      ),
    [events],
  )
  const eventsByDate = React.useMemo(
    () =>
      validEvents.reduce((byDate, event) => {
        const key = toDateKey(event.start_time)
        if (!byDate[key]) byDate[key] = []
        byDate[key].push(event)
        return byDate
      }, {}),
    [validEvents],
  )
  const selectedKey = selectedDate ? toDateKey(selectedDate) : ""
  const agendaMonths = showsTwoMonths
    ? visibleMonths
    : [visibleMonths[mobileMonthIndex] || visibleMonth]
  const visibleMonthEvents = validEvents.filter((event) => {
    const eventDate = new Date(event.start_time)
    return agendaMonths.some(
      (month) =>
        eventDate.getFullYear() === month.getFullYear() &&
        eventDate.getMonth() === month.getMonth(),
    )
  })
  const agendaEvents = selectedKey
    ? eventsByDate[selectedKey] || []
    : visibleMonthEvents
  const todayKey = toDateKey(new Date())

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const updateMonthCount = () => setShowsTwoMonths(media.matches)
    updateMonthCount()
    media.addEventListener("change", updateMonthCount)
    return () => media.removeEventListener("change", updateMonthCount)
  }, [])

  const moveMonth = (amount) => {
    setSelectedDate(null)
    setMobileMonthIndex(0)
    calendarViewportRef.current?.scrollTo({ left: 0 })
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    )
  }

  const selectDay = (date) => {
    const key = toDateKey(date)
    setSelectedDate(key === selectedKey ? null : date)
  }

  const updateVisibleMobileMonth = (event) => {
    if (showsTwoMonths) return
    const viewport = event.currentTarget
    const nextIndex = Math.max(
      0,
      Math.min(
        visibleMonths.length - 1,
        Math.round(viewport.scrollLeft / viewport.clientWidth),
      ),
    )
    if (nextIndex !== mobileMonthIndex) {
      setMobileMonthIndex(nextIndex)
      setSelectedDate(null)
    }
  }

  const visibleMonthLabel = agendaMonths
    .map((month) =>
      new Intl.DateTimeFormat("en-US", { month: "long" }).format(month),
    )
    .join(" and ")
  const agendaLabel = selectedDate
    ? `Events on ${new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(selectedDate)}`
    : `Events in ${visibleMonthLabel}`

  return (
    <section className="">
      <div className="relative mt-4 xl:mx-12">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
          className="absolute left-2 top-1 z-10 rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 lg:top-1/2 lg:-translate-y-1/2 xl:-left-12"
        >
          <ChevronLeftIcon className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => moveMonth(1)}
          className="absolute right-2 top-1 z-10 rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 lg:top-1/2 lg:-translate-y-1/2 xl:-right-12"
        >
          <ChevronRightIcon className="size-5" />
        </button>

        <div
          ref={calendarViewportRef}
          onScroll={updateVisibleMobileMonth}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto overflow-y-hidden pb-3 pr-1 touch-pan-x"
        >
          {visibleMonths.map((month) => {
            const monthKey = `${month.getFullYear()}-${month.getMonth()}`
            const monthCells = getMonthCells(month)

            return (
              <section
                key={monthKey}
                aria-label={new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  year: "numeric",
                }).format(month)}
                className="w-full shrink-0 snap-start rounded-xl border border-gray-100 p-3 lg:w-[calc(50%-0.75rem)]"
              >
              <h3 className="text-center font-semibold text-gray-900">
                {new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  year: "numeric",
                }).format(month)}
              </h3>
              <div className="mt-2 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-[0.14em] text-gray-700 sm:text-sm">
                {WEEKDAYS.map((day, index) => (
                  <div key={`${day}-${index}`} className="py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-2 text-center sm:gap-y-3">
                {monthCells.map((date) => {
                  const key = toDateKey(date)
                  const inMonth =
                    date.getMonth() === month.getMonth() &&
                    date.getFullYear() === month.getFullYear()

                  if (!inMonth) {
                    return (
                      <span
                        key={`${monthKey}-${key}`}
                        aria-hidden="true"
                        className="mx-auto size-10 sm:size-12"
                      />
                    )
                  }

                  const dayEvents = eventsByDate[key] || []
                  const hasEvents = dayEvents.length > 0
                  const hasAssignment = dayEvents.some(
                    (event) => event.is_assigned,
                  )
                  const selected = key === selectedKey

                  return (
                    <button
                      key={`${monthKey}-${key}`}
                      type="button"
                      onClick={() => selectDay(date)}
                      aria-pressed={selected}
                      className={`mx-auto flex size-10 items-center justify-center rounded-2xl text-sm font-semibold text-gray-900 transition sm:size-12 sm:text-base ${
                        selected
                          ? `bg-[#eee2d5] text-[#6f4f34] ring-2 ${
                              key === todayKey
                                ? "ring-orange-400"
                                : "ring-[#C1A387]"
                            }`
                          : key === todayKey
                            ? "ring-2 ring-orange-400"
                          : hasAssignment
                            ? "ring-2 ring-orange-400"
                            : hasEvents
                              ? "ring-2 ring-gray-300"
                              : ""
                      } hover:bg-gray-50`}
                      aria-current={key === todayKey ? "date" : undefined}
                      aria-label={new Intl.DateTimeFormat("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }).format(date)}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
              </section>
            )
          })}
        </div>
      </div>

      {/* <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-full ring-2 ring-gray-300" /> Event
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-full ring-2 ring-orange-400" /> My
          event
        </span>
      </div> */}

      <MinistryEventAgenda
        events={agendaEvents}
        label={agendaLabel}
        emptyTitle={
          selectedDate ? "No events this day" : "No events this month"
        }
        emptyText={
          selectedDate
            ? "Select another day to see its events."
            : "Published ministry events will appear here."
        }
        onEventSelect={onEventSelect}
      />
    </section>
  )
}

export default MinistryHomeCalendar
