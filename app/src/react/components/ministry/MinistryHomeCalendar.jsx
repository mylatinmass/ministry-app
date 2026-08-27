import * as React from "react";
import {
  CalendarIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
  ListBulletIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import MinistryEventAgenda, { toDateKey } from "./MinistryEventAgenda";
import MinistrySectionActions from "./MinistrySectionActions";
import {
  downloadEventSchedulePdf,
  eventsWithinRange,
  openEventSchedulePdf,
} from "./downloadEventSchedulePdf";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const getMonthCells = (month) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
};

const getMonthDateKeys = (month) => {
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();

  return Array.from({ length: daysInMonth }, (_, index) =>
    toDateKey(new Date(month.getFullYear(), month.getMonth(), index + 1)),
  );
};

const getWeekStart = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
};

const getWeekDays = (value) => {
  const weekStart = getWeekStart(value);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
};

const CALENDAR_VIEWS = [
  { id: "list", label: "List", icon: ListBulletIcon },
  { id: "week", label: "Week", icon: CalendarDaysIcon },
  { id: "month", label: "Month", icon: Squares2X2Icon },
  { id: "today", label: "Today", icon: CalendarIcon },
];

const MOBILE_WEEKDAYS = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];

const MinistryHomeCalendar = ({ events = [], onEventSelect }) => {
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = React.useState(null);
  const [agendaFocusDate, setAgendaFocusDate] = React.useState(
    () => new Date(),
  );
  const [agendaFocusRequest, setAgendaFocusRequest] = React.useState(0);
  const [showsTwoMonths, setShowsTwoMonths] = React.useState(false);
  const [calendarView, setCalendarView] = React.useState(() =>
    window.matchMedia("(max-width: 639px)").matches ? "week" : "month",
  );
  const [eventFilter, setEventFilter] = React.useState("all");
  const visibleMonths = React.useMemo(
    () => [
      visibleMonth,
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
    ],
    [visibleMonth],
  );
  const validEvents = React.useMemo(
    () =>
      events.filter(
        (event) => !Number.isNaN(new Date(event.start_time).getTime()),
      ),
    [events],
  );
  const eventsByDate = React.useMemo(
    () =>
      validEvents.reduce((byDate, event) => {
        const key = toDateKey(event.start_time);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(event);
        return byDate;
      }, {}),
    [validEvents],
  );
  const filteredEvents = React.useMemo(
    () =>
      eventFilter === "my"
        ? validEvents.filter((event) => event.is_assigned)
        : validEvents,
    [eventFilter, validEvents],
  );
  const filteredEventsByDate = React.useMemo(
    () =>
      filteredEvents.reduce((byDate, event) => {
        const key = toDateKey(event.start_time);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(event);
        return byDate;
      }, {}),
    [filteredEvents],
  );
  const selectedKey = selectedDate ? toDateKey(selectedDate) : "";
  const displayedMonths = showsTwoMonths ? visibleMonths : [visibleMonth];
  const agendaMonths = displayedMonths;
  const visibleMonthEvents = filteredEvents.filter((event) => {
    const eventDate = new Date(event.start_time);
    return agendaMonths.some(
      (month) =>
        eventDate.getFullYear() === month.getFullYear() &&
        eventDate.getMonth() === month.getMonth(),
    );
  });
  const visibleMonthStartKey = toDateKey(visibleMonth);
  const myEventsFromVisibleMonth = filteredEvents.filter(
    (event) => toDateKey(event.start_time) >= visibleMonthStartKey,
  );
  const today = new Date();
  const todayKey = toDateKey(today);
  const isCurrentMonthView =
    visibleMonth.getFullYear() === today.getFullYear() &&
    visibleMonth.getMonth() === today.getMonth();
  const agendaEvents = selectedKey
    ? filteredEventsByDate[selectedKey] || []
    : eventFilter === "my"
      ? myEventsFromVisibleMonth
      : visibleMonthEvents;
  const calendarDateKeys = selectedKey
    ? [selectedKey]
    : agendaMonths.flatMap(getMonthDateKeys);
  const visibleEventDateKeys = [
    ...new Set(agendaEvents.map((event) => toDateKey(event.start_time))),
  ].sort();
  const agendaDateKeys = selectedKey
    ? agendaEvents.length
      ? [selectedKey]
      : []
    : visibleEventDateKeys;
  const weekDays = React.useMemo(
    () => getWeekDays(selectedDate || agendaFocusDate),
    [selectedDate, agendaFocusDate],
  );
  const pdfDateKeys = selectedKey
    ? [selectedKey]
    : calendarView === "week"
      ? weekDays.map(toDateKey)
      : calendarView === "today"
        ? [todayKey]
        : calendarDateKeys;

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateMonthCount = () => setShowsTwoMonths(media.matches);
    updateMonthCount();
    media.addEventListener("change", updateMonthCount);
    return () => media.removeEventListener("change", updateMonthCount);
  }, []);

  const moveMonth = (amount) => {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + amount,
      1,
    );
    setSelectedDate(null);
    setVisibleMonth(nextMonth);
    setAgendaFocusDate(nextMonth);
  };

  const showPreviousMonthFromAgenda = () => {
    const previousMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() - 1,
      1,
    );
    const previousMonthEnd = new Date(
      previousMonth.getFullYear(),
      previousMonth.getMonth() + 1,
      0,
    );
    setSelectedDate(null);
    setVisibleMonth(previousMonth);
    setAgendaFocusDate(previousMonthEnd);
  };

  const showNextMonthFromAgenda = () => {
    const nextVisibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      1,
    );
    const lastAgendaMonth = agendaMonths.at(-1);
    const nextAgendaDate = new Date(
      lastAgendaMonth.getFullYear(),
      lastAgendaMonth.getMonth() + 1,
      1,
    );
    setSelectedDate(null);
    setVisibleMonth(nextVisibleMonth);
    setAgendaFocusDate(nextAgendaDate);
  };

  const selectDay = (date) => {
    const key = toDateKey(date);
    const isDeselecting = key === selectedKey;
    setSelectedDate(isDeselecting ? null : date);
    setAgendaFocusDate(
      isDeselecting ? (isCurrentMonthView ? today : visibleMonth) : date,
    );
  };

  const moveWeek = (amount) => {
    const nextDate = new Date(selectedDate || agendaFocusDate);
    nextDate.setDate(nextDate.getDate() + amount * 7);
    setSelectedDate(null);
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setAgendaFocusDate(nextDate);
  };

  const selectCalendarView = (view) => {
    if (view === "today") {
      const currentDate = new Date();
      setCalendarView("today");
      setSelectedDate(currentDate);
      setVisibleMonth(
        new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
      );
      setAgendaFocusDate(currentDate);
      setAgendaFocusRequest((request) => request + 1);
      return;
    }

    if (calendarView === "today") {
      const currentDate = new Date();
      setAgendaFocusDate(currentDate);
      setSelectedDate(null);
    }

    setCalendarView(view);
    if (calendarView !== "today" && view === "list" && selectedDate) {
      setAgendaFocusDate(selectedDate);
      setSelectedDate(null);
    }
  };

  const exportCurrentViewPdf = () => {
    const startDate = pdfDateKeys[0] || todayKey;
    const endDate = pdfDateKeys.at(-1) || startDate;
    const viewLabel =
      CALENDAR_VIEWS.find((view) => view.id === calendarView)?.label ||
      "Calendar";
    const options = {
      ministryName: "Ministries",
      events: eventsWithinRange(filteredEvents, startDate, endDate),
      startDate,
      endDate,
      filterLabel: `${eventFilter === "my" ? "My Events" : "All Events"} · ${viewLabel}`,
    };

    if (window.matchMedia("(min-width: 1024px)").matches) {
      openEventSchedulePdf(options);
    } else {
      downloadEventSchedulePdf(options);
    }
  };

  const visibleMonthLabel = agendaMonths
    .map((month) =>
      new Intl.DateTimeFormat("en-US", { month: "long" }).format(month),
    )
    .join(" and ");
  const agendaLabel =
    calendarView === "today"
      ? eventFilter === "my"
        ? "My events today"
        : "Events today"
      : selectedDate
        ? `Events on ${new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
          }).format(selectedDate)}`
        : eventFilter === "my"
          ? `My events from ${new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
            }).format(visibleMonth)}`
          : `Events in ${visibleMonthLabel}`;

  return (
    <section className="flex h-full min-h-0 flex-col pb-[calc(env(safe-area-inset-bottom)+4.75rem)] lg:pb-0">
      <div className="shrink-0 pb-4">
        <MinistrySectionActions
          label="Calendar view"
          actions={CALENDAR_VIEWS.map((view) => ({
            ...view,
            active: calendarView === view.id,
            onClick: () => selectCalendarView(view.id),
          }))}
        />
      </div>

      <div
        className={`relative shrink-0 xl:mx-12 ${
          calendarView === "month" ? "" : "hidden"
        }`}
      >
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

        <div className="grid gap-6 lg:grid-cols-2">
          {displayedMonths.map((month) => {
            const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
            const monthCells = getMonthCells(month);

            return (
              <section
                key={monthKey}
                aria-label={new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  year: "numeric",
                }).format(month)}
                className="w-full rounded-xl border border-gray-100 p-3"
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
                    const key = toDateKey(date);
                    const inMonth =
                      date.getMonth() === month.getMonth() &&
                      date.getFullYear() === month.getFullYear();

                    if (!inMonth) {
                      return (
                        <span
                          key={`${monthKey}-${key}`}
                          aria-hidden="true"
                          className="mx-auto size-8 sm:size-12"
                        />
                      );
                    }

                    const dayEvents = eventsByDate[key] || [];
                    const hasEvents = dayEvents.length > 0;
                    const hasAssignment = dayEvents.some(
                      (event) => event.is_assigned,
                    );
                    const selected = key === selectedKey;

                    return (
                      <button
                        key={`${monthKey}-${key}`}
                        type="button"
                        onClick={() => selectDay(date)}
                        aria-pressed={selected}
                        className={`mx-auto flex size-8 items-center justify-center rounded-full text-sm font-semibold text-gray-900 transition sm:size-12 md:text-base ${
                          selected
                            ? `  text-[#6f4f34] ring-2 ${
                                key === todayKey
                                  ? "ring-[#6f4f34] bg-[#eee2d5]"
                                  : "ring-[#6f4f34] bg-[#f0e0d0]"
                              }`
                            : key === todayKey
                              ? "ring-2 bg-orange-500 text-white ring-orange-500"
                              : hasAssignment
                                ? "ring-2 ring-orange-500"
                                : hasEvents
                                  ? "ring-2 ring-gray-300"
                                  : ""
                        } lg:hover:bg-gray-50`}
                        aria-current={key === todayKey ? "date" : undefined}
                        aria-label={new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }).format(date)}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <section
        aria-label="Weekly calendar"
        className={`relative mx-auto w-full max-w-3xl shrink-0 px-1 pb-4 ${
          calendarView === "week" ? "" : "hidden"
        }`}
      >
        <div className="mx-auto grid max-w-sm grid-cols-[auto_1fr_auto] items-center gap-2">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => moveWeek(-1)}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <h3 className="text-center text-base font-semibold text-gray-950">
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
            }).format(selectedDate || agendaFocusDate)}
          </h3>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => moveWeek(1)}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7">
          {weekDays.map((date, index) => {
            const key = toDateKey(date);
            const dayEvents = eventsByDate[key] || [];
            const selected = key === selectedKey;
            const focused = key === toDateKey(selectedDate || agendaFocusDate);
            const hasEvents = dayEvents.length > 0;
            const hasAssignment = dayEvents.some(
              (event) => event.is_assigned,
            );

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(date)}
                aria-pressed={selected}
                aria-label={`${new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }).format(
                  date,
                )}, ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}${hasAssignment ? ", includes a household assignment" : ""}`}
                className="flex min-w-0 flex-col items-center py-1 text-gray-800 transition"
              >
                <span className="text-[11px] font-medium text-gray-500">
                  {MOBILE_WEEKDAYS[index]}
                </span>
                <span
                  className={`mt-1 flex size-10 items-center justify-center rounded-xl text-base ${
                    focused ? "bg-[#e7e0f5] font-semibold text-gray-950" : ""
                  }`}
                >
                  {date.getDate()}
                </span>
                {hasEvents && (
                  <span
                    aria-hidden="true"
                    className={`mt-1 size-1.5 rounded-full ${
                      hasAssignment ? "bg-orange-500" : "bg-gray-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-full ring-2 ring-gray-300" /> Event
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-full ring-2 ring-orange-500" /> My
          event
        </span>
      </div> */}

      <div className="flex shrink-0 items-center justify-between gap-3 border-y border-gray-100 py-3">
        <div
          role="group"
          aria-label="Event filters"
          className="inline-flex rounded-xl bg-gray-50 p-1"
        >
          {[
            { id: "all", label: "All Events" },
            { id: "my", label: "My Events" },
          ].map((filter) => {
            const active = eventFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setEventFilter(filter.id)}
                aria-pressed={active}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  active
                    ? "bg-white text-[#6f4f34] shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={exportCurrentViewPdf}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#6f4f34] transition hover:bg-[#f7f3ef] sm:text-sm"
        >
          <DocumentArrowDownIcon className="size-5" />
          <span className="sm:hidden">PDF</span>
          <span className="hidden sm:inline">Download PDF</span>
        </button>
      </div>

      <MinistryEventAgenda
        events={agendaEvents}
        dateKeys={agendaDateKeys}
        showDateRail
        initialFocusDate={agendaFocusDate}
        focusRequestKey={agendaFocusRequest}
        onPastStart={
          selectedDate || eventFilter === "my"
            ? undefined
            : showPreviousMonthFromAgenda
        }
        onFutureEnd={
          selectedDate || eventFilter === "my"
            ? undefined
            : showNextMonthFromAgenda
        }
        label={agendaLabel}
        emptyTitle={
          calendarView === "today"
            ? eventFilter === "my"
              ? "No assigned events scheduled for today"
              : "No events scheduled for today"
            : selectedDate
              ? "No events this day"
              : eventFilter === "my"
                ? "No assigned events"
                : isCurrentMonthView
                  ? "No upcoming events"
                  : "No events this month"
        }
        emptyText={
          calendarView === "today"
            ? eventFilter === "my"
              ? "You have no assigned events scheduled for today."
              : "There are no events scheduled for today."
            : selectedDate
              ? "Select another day to see its events."
              : eventFilter === "my"
                ? "There are no assigned events from this month onward."
                : isCurrentMonthView
                  ? "Select an earlier calendar day to review past events."
                  : "Published ministry events will appear here."
        }
        onEventSelect={onEventSelect}
      />

    </section>
  );
};

export default MinistryHomeCalendar;
