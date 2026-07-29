import * as React from "react"
import MinistryEventAgenda, { toDateKey } from "./MinistryEventAgenda"

const MinistryTodayCalendar = ({ events, onEventSelect }) => {
  const today = new Date()
  const todayKey = toDateKey(today)
  const todayEvents = events.filter(
    (event) => toDateKey(event.start_time) === todayKey,
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <section aria-label="Today's date" className="shrink-0 py-1 text-center">
        <h3 className="text-lg font-medium text-gray-950 sm:text-xl">
          {new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }).format(today)}
        </h3>
      </section>

      <MinistryEventAgenda
        events={todayEvents}
        label="Events today"
        emptyTitle="No events today"
        emptyText="There are no ministry events scheduled for today."
        showDateHeadings={false}
        onEventSelect={onEventSelect}
      />
    </div>
  )
}

export default MinistryTodayCalendar
