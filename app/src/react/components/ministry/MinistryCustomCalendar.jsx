import * as React from "react"
import MinistryEventAgenda, { toDateKey } from "./MinistryEventAgenda"

const getDefaultRange = () => {
  const start = new Date()
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return { start: toDateKey(start), end: toDateKey(end) }
}

const MinistryCustomCalendar = ({ events, onEventSelect }) => {
  const defaults = React.useMemo(getDefaultRange, [])
  const [startDate, setStartDate] = React.useState(defaults.start)
  const [endDate, setEndDate] = React.useState(defaults.end)
  const rangeEvents = events.filter((event) => {
    const key = toDateKey(event.start_time)
    return startDate && endDate && key >= startDate && key <= endDate
  })

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <section className="shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
          Custom range
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xl">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Start date
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            End date
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-900"
            />
          </label>
        </div>
      </section>

      <MinistryEventAgenda
        events={rangeEvents}
        label="Events in this range"
        emptyTitle="No events in this range"
        emptyText="Choose another start and end date or add an event to this ministry schedule."
        onEventSelect={onEventSelect}
      />
    </div>
  )
}

export default MinistryCustomCalendar
