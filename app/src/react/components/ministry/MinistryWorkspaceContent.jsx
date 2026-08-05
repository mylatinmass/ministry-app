import * as React from "react"
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  FunnelIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline"
import MinistryMonthCalendar from "./MinistryMonthCalendar"
import MinistryWeekCalendar from "./MinistryWeekCalendar"
import MinistryTodayCalendar from "./MinistryTodayCalendar"
import MinistryCustomCalendar from "./MinistryCustomCalendar"
import MinistryEventDetails from "./MinistryEventDetails"
import MinistryEvents from "./MinistryEvents"
import MinistryMembers from "./MinistryMembers"
import MinistryProfile from "./MinistryProfile"
import MinistryTemplates from "./MinistryTemplates"
import MinistryAvailability from "./MinistryAvailability"
import MinistrySupport from "./MinistrySupport"

const formatEventDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const EmptyPanel = ({ title, text }) => (
  <div className="rounded-2xl border border-dashed border-[#d8c7b8] bg-white/70 p-8 text-center">
    <h3 className="century-font text-xl text-[#896542]">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
      {text}
    </p>
  </div>
)

const StatCard = ({ label, value, icon: Icon }) => (
  <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <Icon className="size-5 text-[#896542]" />
    </div>
    <p className="mt-5 text-3xl font-semibold text-gray-900">{value}</p>
  </article>
)

const EventList = ({ events, compact = false, onEventSelect }) => {
  if (!events.length) {
    return (
      <EmptyPanel
        title="No events yet"
        text="No ministry events are available in this view."
      />
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onEventSelect?.(event)}
          className={`flex w-full gap-4 rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition ${
            event.is_assigned
              ? "border-orange-400 hover:border-orange-500"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="w-1 rounded-full bg-[#C1A387]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#896542]">
                  {formatEventDate(event.start_time)}
                </p>
                <h3 className="mt-1 font-semibold text-gray-900">
                  {event.title}
                </h3>
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
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs uppercase text-gray-500">
                {event.status}
              </span>
            </div>
            {!compact && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                <span>{event.location || "Location not set"}</span>
                <span>
                  {event.responsibility_count}{" "}
                  {event.responsibility_count === 1
                    ? "responsibility"
                    : "responsibilities"}
                </span>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

const TemplateList = ({ templates }) => {
  if (!templates.length) {
    return (
      <EmptyPanel
        title="No templates yet"
        text="Templates will let you create repeat events without rebuilding every responsibility."
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((template) => (
        <article
          key={template.id}
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <DocumentDuplicateIcon className="size-6 text-[#896542]" />
            <span className="rounded-full bg-[#f4ede6] px-2 py-1 text-xs uppercase text-[#896542]">
              {template.status}
            </span>
          </div>
          <h3 className="mt-5 century-font text-xl text-gray-900">
            {template.name}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            {template.description || "No description has been added yet."}
          </p>
          <p className="mt-4 text-sm font-medium text-[#896542]">
            {template.responsibility_count}{" "}
            {template.responsibility_count === 1
              ? "responsibility"
              : "responsibilities"}
          </p>
        </article>
      ))}
    </div>
  )
}

const OverviewContent = ({ data, onEventSelect }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        label="Upcoming events"
        value={data.stats.upcomingEvents}
        icon={CalendarDaysIcon}
      />
      <StatCard
        label="Serving members"
        value={data.stats.servingMembers}
        icon={UserGroupIcon}
      />
      <StatCard
        label="Open roles"
        value={data.stats.openResponsibilities}
        icon={CheckCircleIcon}
      />
      <StatCard
        label="Templates"
        value={data.stats.activeTemplates}
        icon={DocumentDuplicateIcon}
      />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="century-font text-2xl text-gray-900">Upcoming</h2>
          <span className="text-sm text-gray-400">Next events</span>
        </div>
        <EventList
          events={data.events.slice(0, 4)}
          compact
          onEventSelect={onEventSelect}
        />
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="century-font text-2xl text-gray-900">Templates</h2>
          <span className="text-sm text-gray-400">Reusable plans</span>
        </div>
        <TemplateList templates={data.templates.slice(0, 2)} />
      </section>
    </div>
  </div>
)

const PlaceholderContent = ({ section, activeAction }) => (
  <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
    <EmptyPanel
      title={`${section.label}: ${activeAction.label}`}
      text={`${section.description} This modular workspace is ready for the next feature pass.`}
    />
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#896542]">
        Selected tool
      </p>
      <h3 className="mt-2 century-font text-xl text-gray-900">
        {activeAction.label}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">
        The desktop action buttons and mobile bottom bar point to this same tool
        state, so behavior will remain synchronized on every screen size.
      </p>
    </div>
  </div>
)

const MinistryWorkspaceContent = ({
  data,
  section,
  activeAction,
  currentUser,
  onUserUpdate,
}) => {
  const [calendarFocusDate, setCalendarFocusDate] = React.useState(null)
  const [selectedEvent, setSelectedEvent] = React.useState(null)
  const [showOnlyMyEvents, setShowOnlyMyEvents] = React.useState(false)
  let content

  if (section.id === "overview") {
    content = <OverviewContent data={data} onEventSelect={setSelectedEvent} />
  } else if (section.id === "schedule") {
    const calendarEvents = showOnlyMyEvents
      ? (data.calendarEvents || data.events).filter(
          (event) => event.is_assigned,
        )
      : data.calendarEvents || data.events
    let calendar
    if (activeAction.id === "month") {
      calendar = (
        <MinistryMonthCalendar
          events={calendarEvents}
          selectedDate={calendarFocusDate}
          onSelectedDateChange={setCalendarFocusDate}
          onEventSelect={setSelectedEvent}
        />
      )
    } else if (activeAction.id === "week") {
      calendar = (
        <MinistryWeekCalendar
          events={calendarEvents}
          focusDate={calendarFocusDate}
          onFocusDateChange={setCalendarFocusDate}
          onEventSelect={setSelectedEvent}
        />
      )
    } else if (activeAction.id === "today") {
      calendar = (
        <MinistryTodayCalendar
          events={calendarEvents}
          onEventSelect={setSelectedEvent}
        />
      )
    } else {
      calendar = (
        <MinistryCustomCalendar
          events={calendarEvents}
          onEventSelect={setSelectedEvent}
        />
      )
    }
    content = (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 justify-end py-2">
          <button
            type="button"
            aria-pressed={showOnlyMyEvents}
            onClick={() => setShowOnlyMyEvents((current) => !current)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              showOnlyMyEvents
                ? "bg-[#896542] text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-600 hover:border-[#C1A387] hover:text-[#896542]"
            }`}
          >
            <FunnelIcon className="size-4" />
            {showOnlyMyEvents ? "All Events" : "My Events"}
          </button>
        </div>
        <div className="min-h-0 flex-1">{calendar}</div>
      </div>
    )
  } else if (section.id === "events") {
    if (data.ministry.accessLevel === "member") {
      const calendarEvents = data.calendarEvents || data.events
      const visibleEvents =
        activeAction.id === "my-events"
          ? calendarEvents.filter((event) => event.is_assigned)
          : calendarEvents
      content = (
        <EventList events={visibleEvents} onEventSelect={setSelectedEvent} />
      )
    } else {
      content = (
        <MinistryEvents
          data={data}
          activeAction={activeAction}
          onEventSelect={setSelectedEvent}
        />
      )
    }
  } else if (section.id === "members") {
    content = <MinistryMembers data={data} activeAction={activeAction} />
  } else if (section.id === "templates") {
    content = <MinistryTemplates data={data} activeAction={activeAction} />
  } else if (
    section.id === "availability" &&
    activeAction.id === "my-availability"
  ) {
    content = <MinistryAvailability />
  } else if (section.id === "profile") {
    content = (
      <MinistryProfile
        initialUser={currentUser || data.user}
        onUserUpdate={onUserUpdate}
      />
    )
  } else if (section.id === "support") {
    content = <MinistrySupport ministryName={data.ministry.name} />
  } else {
    content = (
      <PlaceholderContent section={section} activeAction={activeAction} />
    )
  }

  return (
    <div className={section.id === "schedule" ? "h-full min-h-0" : ""}>
      {content}
      <MinistryEventDetails
        event={selectedEvent}
        ministryName={data.ministry.name}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}

export default MinistryWorkspaceContent
