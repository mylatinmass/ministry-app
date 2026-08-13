import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import MinistryEventAgenda, { toDateKey } from "./MinistryEventAgenda"

const getWeekStart = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - date.getDay())
  return date
}

const getWeekDays = (weekStart) =>
  Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })

const formatWeekRange = (weekDays) => {
  const first = weekDays[0]
  const last = weekDays[weekDays.length - 1]
  const firstMonth = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(first)
  const lastMonth = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(last)

  if (
    first.getFullYear() === last.getFullYear() &&
    first.getMonth() === last.getMonth()
  ) {
    return `${firstMonth} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}, ${last.getFullYear()}`
  }
  return `${firstMonth} ${first.getDate()}, ${first.getFullYear()} – ${lastMonth} ${last.getDate()}, ${last.getFullYear()}`
}

const MinistryWeekCalendar = ({
  events,
  focusDate,
  onFocusDateChange,
  mode = "week",
  onEventSelect,
  onVisibleRangeChange,
}) => {
  const today = new Date()
  const effectiveFocusDate = mode === "today" ? today : focusDate || today
  const focusKey = toDateKey(effectiveFocusDate)
  const [weekStart, setWeekStart] = React.useState(() =>
    getWeekStart(effectiveFocusDate),
  )
  const [selectedDate, setSelectedDate] = React.useState(effectiveFocusDate)
  const weekDays = React.useMemo(() => getWeekDays(weekStart), [weekStart])
  const visibleWeekEvents = React.useMemo(() => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    return events.filter((event) => {
      const eventDate = new Date(event.start_time)
      return eventDate >= weekStart && eventDate < weekEnd
    })
  }, [events, weekStart])
  const eventsByDate = visibleWeekEvents.reduce((byDate, event) => {
    const key = toDateKey(event.start_time)
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(event)
    return byDate
  }, {})
  const selectedKey = toDateKey(selectedDate)
  const agendaEvents =
    mode === "today"
      ? events.filter(
          (event) => toDateKey(event.start_time) === toDateKey(today),
        )
      : visibleWeekEvents.filter(
          (event) => toDateKey(event.start_time) === selectedKey,
        )
  const selectedDayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(selectedDate)

  React.useEffect(() => {
    setWeekStart(getWeekStart(effectiveFocusDate))
    setSelectedDate(effectiveFocusDate)
  }, [focusKey, mode])

  React.useEffect(() => {
    const end = new Date(weekStart)
    end.setDate(weekStart.getDate() + 6)
    onVisibleRangeChange?.(toDateKey(weekStart), toDateKey(end))
  }, [onVisibleRangeChange, weekStart])

  const moveWeek = (amount) => {
    const nextSunday = new Date(weekStart)
    nextSunday.setDate(weekStart.getDate() + amount * 7)
    const nextSelected = new Date(selectedDate)
    nextSelected.setDate(selectedDate.getDate() + amount * 7)
    setWeekStart(nextSunday)
    setSelectedDate(nextSelected)
    onFocusDateChange?.(nextSelected)
  }

  const selectWeekDay = (date) => {
    if (mode === "today") return
    setSelectedDate(date)
    onFocusDateChange?.(date)
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <section aria-label="Weekly calendar" className="shrink-0">
        <div className="flex items-center gap-3">
          <div className=" w-full items-center justify-center gap-2">
            {mode === "week" && (
              <div className="grid grid-cols-[auto_1fr_auto] w-full justify-center items-center text-gray-300 gap-3 ">
                <button
                  type="button"
                  aria-label="Previous week"
                  onClick={() => moveWeek(-1)}
                  className="w-max p-2 rounded-xl transition hover:bg-gray-100"
                >
                  <ChevronLeftIcon className="size-5" />
                </button>
                <h3 className="mx-auto text-black ">
                  {formatWeekRange(weekDays)}
                </h3>

                <button
                  type="button"
                  aria-label="Next week"
                  onClick={() => moveWeek(1)}
                  className="w-max p-2 rounded-xl transition hover:bg-gray-100"
                >
                  <ChevronRightIcon className="size-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="-mx-3 mt-6 px-3 pb-3 sm:mx-0 sm:px-0">
          <div className="grid grid-cols-7 gap-1 sm:gap-3">
            {weekDays.map((date) => {
              const key = toDateKey(date)
              const selected = key === selectedKey
              const dayEvents = eventsByDate[key] || []
              const hasEvents = dayEvents.length > 0
              const hasAssignment = dayEvents.some((event) => event.is_assigned)

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectWeekDay(date)}
                  aria-pressed={selected}
                  aria-label={`${new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }).format(date)}, ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}${hasAssignment ? ", includes your assignment" : ""}`}
                  className={`flex  min-w-0 flex-col gap-y-1 pt-1 items-center rounded-xl border  transition  ${
                    selected
                      ? "bg-[#eee2d5] shadow-sm scale-105 border-[#C1A387]"
                      : hasAssignment
                        ? "border-orange-400 hover:border-orange-500 bg-white"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <span
                    className={`text-xs sm:text-lg ${
                      selected ? "font-semibold text-gray-950" : "text-gray-500"
                    }`}
                  >
                    {new Intl.DateTimeFormat("en-US", {
                      weekday: "short",
                    }).format(date)}
                  </span>
                  <span
                    className={`flex w-full aspect-square rounded-xl flex-col items-center justify-center  sm:text-2xl ${
                      selected
                        ? " bg-[#eee2d5] font-semibold text-[#6f4f34]"
                        : ""
                    }`}
                  >
                    {date.getDate()}
                    {hasEvents && !selected && (
                      <span
                        className={`mt-1 size-1.5 rounded-full ${
                          hasAssignment ? "bg-orange-500" : "bg-gray-400"
                        }`}
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <MinistryEventAgenda
        events={agendaEvents}
        label={mode === "today" ? "Events today" : `Events on ${selectedDayLabel}`}
        emptyTitle={
          mode === "today" ? "No events today" : "No events this day"
        }
        emptyText={
          mode === "today"
            ? "There are no ministry events scheduled for today."
            : "Choose another day to see its events."
        }
        onEventSelect={onEventSelect}
      />
    </div>
  )
}

export default MinistryWeekCalendar
