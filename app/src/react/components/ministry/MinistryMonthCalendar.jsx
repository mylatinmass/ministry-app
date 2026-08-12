import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import MinistryEventAgenda, { toDateKey } from "./MinistryEventAgenda"

const getMonthCells = (month) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate()
  const cellCount = firstDay.getDay() + daysInMonth > 35 ? 42 : 35
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

const MinistryMonthCalendar = ({
  events,
  selectedDate,
  onSelectedDateChange,
  onEventSelect,
  onVisibleRangeChange,
}) => {
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const startingDate = selectedDate || new Date()
    return new Date(startingDate.getFullYear(), startingDate.getMonth(), 1)
  })
  const monthCells = React.useMemo(
    () => getMonthCells(visibleMonth),
    [visibleMonth],
  )
  const monthEvents = React.useMemo(
    () =>
      events.filter((event) => {
        const eventDate = new Date(event.start_time)
        return (
          eventDate.getFullYear() === visibleMonth.getFullYear() &&
          eventDate.getMonth() === visibleMonth.getMonth()
        )
      }),
    [events, visibleMonth],
  )
  const selectedKey = selectedDate ? toDateKey(selectedDate) : null
  const agendaEvents = selectedKey
    ? monthEvents.filter((event) => toDateKey(event.start_time) === selectedKey)
    : monthEvents
  const eventsByDate = monthEvents.reduce((byDate, event) => {
    const key = toDateKey(event.start_time)
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(event)
    return byDate
  }, {})
  const todayKey = toDateKey(new Date())

  React.useEffect(() => {
    if (!selectedDate) return
    setVisibleMonth(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    )
  }, [selectedDate])

  React.useEffect(() => {
    const start = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const end = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
    onVisibleRangeChange?.(toDateKey(start), toDateKey(end))
  }, [onVisibleRangeChange, visibleMonth])

  const moveMonth = (amount) => {
    onSelectedDateChange(null)
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    )
  }

  const selectDay = (date) => {
    const key = toDateKey(date)
    if (key === selectedKey) {
      onSelectedDateChange(null)
      return
    }

    if (date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
    onSelectedDateChange(date)
  }

  const agendaLabel = selectedDate
    ? `Events on ${new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(selectedDate)}`
    : `Events in ${new Intl.DateTimeFormat("en-US", {
        month: "long",
      }).format(visibleMonth)}`

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <section
        aria-label="Monthly calendar"
        className="shrink-0 bg-white px-1 sm:px-4 lg:px-0"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex w-full items-center gap-2">
            <div className="grid grid-cols-[auto_1fr_auto] w-full justify-center items-center text-gray-300 gap-3 ">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
                className="w-max p-2 rounded-xl transition hover:bg-gray-100"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
              <h3 className="mx-auto text-black ">
                {new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  year: "numeric",
                }).format(visibleMonth)}
              </h3>

              <button
                type="button"
                aria-label="Next week"
                onClick={() => moveMonth(1)}
                className="w-max p-2 rounded-xl transition hover:bg-gray-100"
              >
                <ChevronRightIcon className="size-5" />
              </button>
            </div>
            {/* <div className="flex items-center text-gray-300">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => moveMonth(-1)}
                  className="rounded-full p-1.5 transition hover:bg-gray-50 hover:text-gray-700"
                >
                  <ChevronLeftIcon className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => moveMonth(1)}
                  className="rounded-full p-1.5 transition hover:bg-gray-50 hover:text-gray-700"
                >
                  <ChevronRightIcon className="size-5" />
                </button>
              </div> */}
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-[0.14em] text-gray-700 sm:text-sm">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div key={`${day}-${index}`} className="py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-2 text-center sm:gap-y-3">
          {monthCells.map((date) => {
            const key = toDateKey(date)
            const inMonth = date.getMonth() === visibleMonth.getMonth()
            const dayEvents = eventsByDate[key] || []
            const hasEvents = dayEvents.length > 0
            const hasAssignment = dayEvents.some((event) => event.is_assigned)
            const selected = key === selectedKey
            const isToday = key === todayKey

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(date)}
                aria-pressed={selected}
                className={`mx-auto flex size-10 items-center justify-center rounded-2xl text-sm font-semibold transition sm:size-12 sm:text-base ${
                  inMonth ? "text-gray-900" : "text-gray-300"
                } ${
                  selected
                    ? "bg-[#eee2d5] text-[#6f4f34] ring-2 ring-[#C1A387]"
                    : hasEvents
                      ? hasAssignment
                        ? "ring-2 ring-orange-400"
                        : "ring-2 ring-gray-300"
                      : isToday
                        ? "ring-1 ring-gray-300"
                        : ""
                } hover:bg-gray-50`}
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

      <MinistryEventAgenda
        events={agendaEvents}
        label={agendaLabel}
        emptyTitle={
          selectedDate ? "No events this day" : "No events this month"
        }
        emptyText={
          selectedDate
            ? "Tap the selected day again to return to every event in this month."
            : "Events scheduled for this month will appear here in chronological order."
        }
        onEventSelect={onEventSelect}
      />
    </div>
  )
}

export default MinistryMonthCalendar
