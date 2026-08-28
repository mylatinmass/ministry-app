import * as React from "react"
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
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
import MinistryReports from "./MinistryReports"
import { MinistryOpenRolesSkeleton } from "./MinistryLoadingSkeleton"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import {
  downloadEventSchedulePdf,
  eventsWithinRange,
  getEventRange,
} from "./downloadEventSchedulePdf"

const LEAVE_OPEN_VALUE = "__leave_open__"

const formatEventDate = (value) => {
  const date = new Date(value)
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(date)
  const monthAndDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
    .format(date)
    .replace(/\s/g, "")

  return `${weekday} • ${monthAndDay}, ${time}`.toUpperCase()
}

const EmptyPanel = ({ title, text }) => (
  <div className="rounded-2xl border border-dashed border-[#d8c7b8] bg-white/70 p-8 text-center">
    <h3 className="century-font text-xl text-[#896542]">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
      {text}
    </p>
  </div>
)

const StatCard = ({ label, value, icon: Icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C1A387] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#896542] ${
      active
        ? "border-[#896542] bg-[#f7f3ef] ring-1 ring-[#896542]"
        : "border-gray-100 bg-white"
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <p
        className={`text-sm font-medium ${
          active ? "text-[#6f4f34]" : "text-gray-600"
        }`}
      >
        {label}
      </p>
      <Icon className="size-5 text-[#896542]" />
    </div>
    <div className="mt-5 flex items-end justify-between gap-3">
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      <ChevronRightIcon
        aria-hidden="true"
        className={`size-5 transition ${
          active ? "translate-x-0 text-[#896542]" : "-translate-x-1 text-gray-300"
        }`}
      />
    </div>
  </button>
)

const EventList = ({ events, onEventSelect }) => {
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
      {events.map((event) => {
        const openPositions = Number(event.open_position_count || 0)
        const now = Date.now()
        const startTime = new Date(event.start_time).getTime()
        const endTime = new Date(event.end_time || event.start_time).getTime()
        const urgent =
          openPositions > 0 &&
          endTime >= now &&
          startTime <= now + 48 * 60 * 60 * 1000
        const coverageLabel =
          openPositions === 0
            ? "All positions filled"
            : urgent
              ? `${openPositions} open position${openPositions === 1 ? "" : "s"}; event is within 2 days`
              : `${openPositions} open position${openPositions === 1 ? "" : "s"}`
        const CoverageIcon =
          openPositions === 0 ? CheckCircleIcon : ExclamationTriangleIcon

        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onEventSelect?.(event)}
            className={`flex w-full gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              event.is_assigned
                ? "border-orange-400 hover:border-orange-500"
                : "border-gray-200 hover:border-[#C1A387]"
            }`}
          >
            <div className="w-1 shrink-0 rounded-full bg-[#C1A387]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#896542]">
                    {formatEventDate(event.start_time)}
                  </p>
                  <h3 className="mt-0.5 truncate font-semibold text-gray-900">
                    {event.title}
                  </h3>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    Template: {event.template_name || "Custom event"}
                  </p>
                  {event.visibleProfileAssignments?.length > 0 && (
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {event.visibleProfileAssignments
                        .map(
                          (assignment) =>
                            `${assignment.firstName} ${assignment.lastName}: ${assignment.responsibilityName}`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <span
                  title={coverageLabel}
                  aria-label={coverageLabel}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    openPositions === 0
                      ? "bg-green-50 text-green-700"
                      : urgent
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <CoverageIcon aria-hidden="true" className="size-5" />
                </span>
              </div>
            </div>
          </button>
        )
      })}
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

const OverviewContent = ({
  data,
  activeAction,
  onEventSelect,
  onOpenWorkspaceArea,
}) => {
  const activeView = ["upcoming", "members", "roles", "templates"].includes(
    activeAction?.id,
  )
    ? activeAction.id
    : "upcoming"
  const [summaryData, setSummaryData] = React.useState(data)
  const [roleEventDetails, setRoleEventDetails] = React.useState({})
  const [roleLoadingEventIds, setRoleLoadingEventIds] = React.useState([])
  const [roleLoadErrors, setRoleLoadErrors] = React.useState({})
  const [roleDraftSelections, setRoleDraftSelections] = React.useState({})
  const [roleAssignmentState, setRoleAssignmentState] = React.useState({
    slotKey: "",
    isApprovingAll: false,
    message: "",
    error: "",
  })

  React.useEffect(() => setSummaryData(data), [data])

  const canManage = ["owner", "super_admin", "admin"].includes(
    data.ministry.accessLevel,
  )

  const upcomingEvents = (summaryData.events || []).filter(
    (event) =>
      new Date(event.end_time || event.start_time).getTime() >= Date.now() &&
      ["draft", "published"].includes(event.status),
  )

  const openRoleEvents = Array.from(
    (summaryData.openRoles || []).reduce((events, role) => {
      const current = events.get(role.eventId) || {
        eventId: role.eventId,
        eventTitle: role.eventTitle,
        startTime: role.startTime,
        eventStatus: role.eventStatus,
        roles: [],
      }
      current.roles.push(role)
      events.set(role.eventId, current)
      return events
    }, new Map()).values(),
  )
  const openRolesAreLoading =
    openRoleEvents.length > 0 &&
    (roleLoadingEventIds.length > 0 ||
      openRoleEvents.some(
        (event) =>
          !roleEventDetails[event.eventId] && !roleLoadErrors[event.eventId],
      ))

  const refreshSummary = async () => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const url = new URL(
      getFunctionEndpoint("ministry-detail"),
      window.location.origin,
    )
    url.searchParams.set("slug", data.ministry.slug)
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message || "Unable to refresh ministry")
    }
    setSummaryData(result)
  }

  const fetchEventDetails = React.useCallback(async (eventId) => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const url = new URL(
      getFunctionEndpoint("scheduling/events"),
      window.location.origin,
    )
    url.searchParams.set("eventId", eventId)
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message || "Unable to load eligible members")
    }
    return result
  }, [])

  React.useEffect(() => {
    if (activeView !== "roles") return undefined
    const eventIds = Array.from(
      new Set((summaryData.openRoles || []).map((role) => role.eventId)),
    )
    if (!eventIds.length) {
      setRoleEventDetails({})
      setRoleLoadingEventIds([])
      setRoleLoadErrors({})
      return undefined
    }

    let cancelled = false
    setRoleLoadingEventIds(eventIds)
    setRoleLoadErrors({})
    Promise.all(
      eventIds.map(async (eventId) => {
        try {
          return { eventId, details: await fetchEventDetails(eventId) }
        } catch (error) {
          return { eventId, error: error.message }
        }
      }),
    ).then((results) => {
      if (cancelled) return
      const details = {}
      const errors = {}
      for (const result of results) {
        if (result.details) details[result.eventId] = result.details
        if (result.error) errors[result.eventId] = result.error
      }
      setRoleEventDetails(details)
      setRoleLoadErrors(errors)
      setRoleLoadingEventIds([])
    })

    return () => {
      cancelled = true
    }
  }, [activeView, fetchEventDetails, summaryData.openRoles])

  const getRoleSlotKey = (eventId, responsibilityId, positionIndex) =>
    `${eventId}|${responsibilityId}|${positionIndex}`

  const commitRoleAssignment = async (eventId, role, userId) => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("scheduling/events"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "assign_member",
        eventId,
        responsibilityId: role.responsibilityId,
        userId,
      }),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message || "Unable to assign member")
    }
    return result
  }

  const autoSuggestOpenRoles = () => {
    const suggestions = {}
    let suggestedCount = 0
    let leftOpenCount = 0

    for (const event of openRoleEvents) {
      const usedMemberIds = new Set()
      for (const role of event.roles) {
        const responsibility = roleEventDetails[
          event.eventId
        ]?.responsibilities?.find(
          (item) => item.id === role.responsibilityId,
        )
        const candidates = responsibility?.availableMembers || []
        for (
          let positionIndex = 0;
          positionIndex < role.openQuantity;
          positionIndex += 1
        ) {
          const slotKey = getRoleSlotKey(
            event.eventId,
            role.responsibilityId,
            positionIndex,
          )
          const candidate = candidates.find(
            (member) =>
              member.automaticEligible !== false &&
              !usedMemberIds.has(member.userId),
          )
          if (candidate) {
            suggestions[slotKey] = candidate.userId
            usedMemberIds.add(candidate.userId)
            suggestedCount += 1
          } else {
            suggestions[slotKey] = LEAVE_OPEN_VALUE
            leftOpenCount += 1
          }
        }
      }
    }

    setRoleDraftSelections(suggestions)
    setRoleAssignmentState({
      slotKey: "",
      isApprovingAll: false,
      message: `${suggestedCount} suggestion${suggestedCount === 1 ? "" : "s"} ready${
        leftOpenCount
          ? `; ${leftOpenCount} position${leftOpenCount === 1 ? "" : "s"} marked Leave open`
          : ""
      }. Review the choices before approving.`,
      error: "",
    })
  }

  const approveEventOpenRoles = async (event) => {
    const slots = event.roles.flatMap((role) =>
      Array.from({ length: role.openQuantity }, (_, positionIndex) => ({
        role,
        slotKey: getRoleSlotKey(
          event.eventId,
          role.responsibilityId,
          positionIndex,
        ),
      })),
    )
    const unreviewedCount = slots.filter(
      (slot) => !roleDraftSelections[slot.slotKey],
    ).length
    if (unreviewedCount) {
      setRoleAssignmentState({
        slotKey: "",
        isApprovingAll: false,
        message: "",
        error: `Review every position in ${event.eventTitle}. Choose a member or Leave open for ${unreviewedCount} remaining position${unreviewedCount === 1 ? "" : "s"}.`,
      })
      return
    }

    setRoleAssignmentState({
      slotKey: `event:${event.eventId}`,
      isApprovingAll: false,
      message: "",
      error: "",
    })
    let assignedCount = 0
    let leftOpenCount = 0
    const errors = []
    for (const slot of slots) {
      const userId = roleDraftSelections[slot.slotKey]
      if (userId === LEAVE_OPEN_VALUE) {
        leftOpenCount += 1
        continue
      }
      try {
        await commitRoleAssignment(event.eventId, slot.role, userId)
        assignedCount += 1
      } catch (error) {
        errors.push(`${slot.role.responsibilityName}: ${error.message}`)
      }
    }

    try {
      await refreshSummary()
      setRoleDraftSelections((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([key]) => !key.startsWith(`${event.eventId}|`),
          ),
        ),
      )
      setRoleAssignmentState({
        slotKey: "",
        isApprovingAll: false,
        message: errors.length
          ? ""
          : `${event.eventTitle}: ${assignedCount} assignment${assignedCount === 1 ? "" : "s"} approved${
              leftOpenCount
                ? `; ${leftOpenCount} position${leftOpenCount === 1 ? "" : "s"} left open`
                : ""
            }.`,
        error: errors.join(" "),
      })
    } catch (error) {
      setRoleAssignmentState({
        slotKey: "",
        isApprovingAll: false,
        message: "",
        error: error.message,
      })
    }
  }

  const approveAllOpenRoles = async () => {
    const slots = openRoleEvents.flatMap((event) =>
      event.roles.flatMap((role) =>
        Array.from({ length: role.openQuantity }, (_, positionIndex) => ({
          eventId: event.eventId,
          role,
          positionIndex,
          slotKey: getRoleSlotKey(
            event.eventId,
            role.responsibilityId,
            positionIndex,
          ),
        })),
      ),
    )
    const unreviewedCount = slots.filter(
      (slot) => !roleDraftSelections[slot.slotKey],
    ).length
    if (unreviewedCount) {
      setRoleAssignmentState({
        slotKey: "",
        isApprovingAll: false,
        message: "",
        error: `Review every position first. Choose a member or Leave open for ${unreviewedCount} remaining position${unreviewedCount === 1 ? "" : "s"}.`,
      })
      return
    }

    setRoleAssignmentState({
      slotKey: "",
      isApprovingAll: true,
      message: "",
      error: "",
    })
    let assignedCount = 0
    let leftOpenCount = 0
    const errors = []
    for (const slot of slots) {
      const userId = roleDraftSelections[slot.slotKey]
      if (userId === LEAVE_OPEN_VALUE) {
        leftOpenCount += 1
        continue
      }
      try {
        await commitRoleAssignment(slot.eventId, slot.role, userId)
        assignedCount += 1
      } catch (error) {
        errors.push(`${slot.role.responsibilityName}: ${error.message}`)
      }
    }

    try {
      await refreshSummary()
      setRoleDraftSelections({})
      setRoleAssignmentState({
        slotKey: "",
        isApprovingAll: false,
        message: errors.length
          ? ""
          : `${assignedCount} assignment${assignedCount === 1 ? "" : "s"} approved${
              leftOpenCount
                ? `; ${leftOpenCount} position${leftOpenCount === 1 ? "" : "s"} left open`
                : ""
            }.`,
        error: errors.join(" "),
      })
    } catch (error) {
      setRoleAssignmentState({
        slotKey: "",
        isApprovingAll: false,
        message: "",
        error: error.message,
      })
    }
  }

  const filters = [
    {
      id: "upcoming",
      label: "Upcoming events",
      value: summaryData.stats.upcomingEvents,
      icon: CalendarDaysIcon,
    },
    {
      id: "members",
      label: "Serving members",
      value: summaryData.stats.servingMembers,
      icon: UserGroupIcon,
    },
    {
      id: "roles",
      label: "Open roles",
      value: summaryData.stats.openResponsibilities,
      icon: CheckCircleIcon,
    },
    {
      id: "templates",
      label: "Templates",
      value: summaryData.stats.activeTemplates,
      icon: DocumentDuplicateIcon,
    },
  ]

  if (!canManage) return null

  return (
    <div className="space-y-6 ">
      <div
        className="hidden grid-cols-2 gap-3 lg:grid xl:grid-cols-4"
        aria-label="Ministry overview filters"
      >
        {filters.map((filter) => (
          <StatCard
            key={filter.id}
            {...filter}
            active={activeView === filter.id}
            onClick={() => onOpenWorkspaceArea?.("overview", filter.id)}
          />
        ))}
      </div>

      {activeView === "upcoming" && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="century-font text-2xl text-gray-900">
                Upcoming events
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Select an event to review its schedule and assignments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenWorkspaceArea?.("events", "add-event")}
              className="rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34]"
            >
              Create event
            </button>
          </div>
          <EventList events={upcomingEvents} onEventSelect={onEventSelect} />
        </section>
      )}

      {activeView === "members" && (
        <section>
          <div className="mb-3">
            <h2 className="century-font text-2xl text-gray-900">
              Members and pending access
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Active members, pending requests, and outstanding invitations.
            </p>
          </div>
          <MinistryMembers
            data={summaryData}
            activeAction={{ id: "roster", label: "Roster" }}
          />
        </section>
      )}

      {activeView === "roles" && (
        <section className="relative">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="w-full flex flex-row items-center justify-between gap-3 h-12 bg-white lg:sticky lg:top-0">
              <h2 className="w-full century-font text-2xl text-gray-900">Open roles</h2>
              {/* <p className="mt-1 text-sm text-gray-500">
                Auto Suggest prepares a draft using levels, availability, limits, and service history. Review it before approving.
              </p> */}

              <button
                type="button"
                onClick={autoSuggestOpenRoles}
                disabled={
                  !openRoleEvents.length ||
                  roleLoadingEventIds.length > 0 ||
                  roleAssignmentState.isApprovingAll
                }
                className="rounded-lg border border-[#C1A387] bg-white p-2 text-sm font-semibold text-[#6f4f34] hover:bg-[#f7f3ef] disabled:cursor-not-allowed disabled:opacity-50 min-w-max"
              >
                Auto Suggest
              </button>
              <button
                type="button"
                onClick={approveAllOpenRoles}
                disabled={
                  !openRoleEvents.length ||
                  roleLoadingEventIds.length > 0 ||
                  roleAssignmentState.isApprovingAll
                }
                className="rounded-lg bg-orange-500 p-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 min-w-max"
              >
                {roleAssignmentState.isApprovingAll
                  ? "Updating…"
                  : "Update All"}
              </button>
            </div>
          </div>
          {(roleAssignmentState.message || roleAssignmentState.error) && (
            <p
              role={roleAssignmentState.error ? "alert" : "status"}
              className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
                roleAssignmentState.error
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-800"
              }`}
            >
              {roleAssignmentState.error || roleAssignmentState.message}
            </p>
          )}
          {openRolesAreLoading ? (
            <MinistryOpenRolesSkeleton
              count={Math.min(Math.max(openRoleEvents.length, 1), 3)}
            />
          ) : openRoleEvents.length ? (
            <div className="space-y-3">
              {openRoleEvents.map((event) => {
                const eventRecord = summaryData.events.find(
                  (item) => item.id === event.eventId,
                )
                const openingCount = event.roles.reduce(
                  (total, role) => total + role.openQuantity,
                  0,
                )
                const selectedMemberIds = new Set(
                  Object.entries(roleDraftSelections)
                    .filter(
                      ([key, value]) =>
                        key.startsWith(`${event.eventId}|`) &&
                        value &&
                        value !== LEAVE_OPEN_VALUE,
                    )
                    .map(([, value]) => value),
                )
                const isApprovingEvent =
                  roleAssignmentState.slotKey === `event:${event.eventId}`
                return (
                  <article
                    key={event.eventId}
                    className="rounded-2xl border border-gray-200 bg-white p-4 justify-center flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-start justify-between">
                      <div className="flex flex-row gap-2 justify-between items-center w-full">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#896542]">
                          {formatEventDate(event.startTime)}
                        </p>
                        <button
                          type="button"
                          onClick={() => approveEventOpenRoles(event)}
                          disabled={
                            isApprovingEvent ||
                            roleAssignmentState.isApprovingAll ||
                            roleLoadingEventIds.includes(event.eventId) ||
                            Boolean(roleLoadErrors[event.eventId])
                          }
                          className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isApprovingEvent ? "Updating..." : "Update"}
                        </button>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {event.eventTitle}
                        </h3>
                        {/* <p className="mt-1 text-sm text-gray-500">
                          {openingCount} open position{openingCount === 1 ? "" : "s"}
                        </p> */}


                    </div>
                    <div className="">
                      {event.roles.map((role) => {
                        const responsibility = roleEventDetails[
                          event.eventId
                        ]?.responsibilities?.find(
                          (item) => item.id === role.responsibilityId,
                        )
                        const availableMembers =
                          responsibility?.availableMembers || []
                        const isLoading = roleLoadingEventIds.includes(
                          event.eventId,
                        )
                        const loadError = roleLoadErrors[event.eventId]

                        return (

                            <div>
                              {Array.from(
                                { length: role.openQuantity },
                                (_, positionIndex) => {
                                  const slotKey = getRoleSlotKey(
                                    event.eventId,
                                    role.responsibilityId,
                                    positionIndex,
                                  )
                                  const selectedValue =
                                    roleDraftSelections[slotKey] || ""
                                  return (
                                    <div
                                      key={slotKey}
                                      className=""
                                    >
                                      <label className="grid grid-cols-[1fr_2fr] items-center gap-2 text-xs font-semibold text-gray-600 ">
                                        {role.responsibilityName}
                                        <select
                                          aria-label={`${role.responsibilityName}, open position ${positionIndex + 1}`}
                                          value={selectedValue}
                                          disabled={
                                            isLoading ||
                                            isApprovingEvent ||
                                            roleAssignmentState.isApprovingAll ||
                                            Boolean(loadError)
                                          }
                                          onChange={(changeEvent) =>
                                            setRoleDraftSelections((current) => ({
                                              ...current,
                                              [slotKey]: changeEvent.target.value,
                                            }))
                                          }
                                          className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                                        >
                                          <option value="">
                                            {isLoading
                                              ? "Loading members…"
                                              : loadError
                                                ? "Members unavailable"
                                                : "Select a member"}
                                          </option>
                                          <option value={LEAVE_OPEN_VALUE}>
                                            LEAVE OPEN
                                          </option>
                                          {availableMembers.map((member) => (
                                            <option
                                              key={member.userId}
                                              value={member.userId}
                                              disabled={
                                                selectedValue !== member.userId &&
                                                selectedMemberIds.has(member.userId)
                                              }
                                            >
                                              {member.firstName} {member.lastName}
                                              {member.highestLevelName
                                                ? ` · ${member.highestLevelName}`
                                                : ""}
                                              {member.reliability
                                                ? ` · Reliability ${member.reliability.score}${member.reliability.needsFollowUp ? " · FOLLOW UP" : ""}`
                                                : ""}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    </div>
                                  )
                                },
                              )}
                            </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <EmptyPanel
              title="All roles are covered"
              text="There are no open roles in upcoming draft or published events."
            />
          )}
        </section>
      )}

      {activeView === "templates" && (
        <section>
          <div className="mb-3">
            <h2 className="century-font text-2xl text-gray-900">
              Ministry templates
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Create a template or select an existing one to modify it.
            </p>
          </div>
          <MinistryTemplates
            data={summaryData}
            activeAction={{ id: "new-template", label: "New" }}
          />
        </section>
      )}
    </div>
  )
}

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
  onOpenWorkspaceArea,
}) => {
  const [calendarFocusDate, setCalendarFocusDate] = React.useState(null)
  const [selectedEvent, setSelectedEvent] = React.useState(null)
  const [showOnlyMyEvents, setShowOnlyMyEvents] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const requestedEventId = new URLSearchParams(window.location.search).get("event")
    if (!requestedEventId) return
    const requestedEvent = [...(data.events || []), ...(data.calendarEvents || [])]
      .find((item) => item.id === requestedEventId)
    if (requestedEvent) setSelectedEvent(requestedEvent)
  }, [data.events, data.calendarEvents])
  const [visibleScheduleRange, setVisibleScheduleRange] = React.useState(() => {
    const date = new Date()
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    const today = `${date.getFullYear()}-${month}-${day}`
    return { startDate: today, endDate: today }
  })
  const updateVisibleScheduleRange = React.useCallback((startDate, endDate) => {
    setVisibleScheduleRange((current) =>
      current.startDate === startDate && current.endDate === endDate
        ? current
        : { startDate, endDate },
    )
  }, [])
  let content

  const exportSchedule = (events) => {
    const rows = [
      ["Calendar", data.ministry.name],
      ["Event", "Start", "End", "Location", "Status", "Responsibilities"],
      ...events.map((event) => [
        event.title,
        event.start_time,
        event.end_time,
        event.location || "",
        event.status,
        event.responsibility_count || 0,
      ]),
    ]
    const escape = (value) => {
      const text = String(value ?? "")
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
    }
    const csv = rows.map((row) => row.map(escape).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${data.ministry.slug || "ministry"}-schedule.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (section.id === "overview") {
    content = (
      <OverviewContent
        data={data}
        activeAction={activeAction}
        onEventSelect={setSelectedEvent}
        onOpenWorkspaceArea={onOpenWorkspaceArea}
      />
    )
  } else if (section.id === "schedule") {
    const calendarEvents = showOnlyMyEvents
      ? (data.calendarEvents || data.events).filter(
          (event) => event.is_assigned,
        )
      : data.calendarEvents || data.events
    const printableScheduleEvents = eventsWithinRange(
      calendarEvents,
      visibleScheduleRange.startDate,
      visibleScheduleRange.endDate,
    )
    let calendar
    if (activeAction.id === "month") {
      calendar = (
        <MinistryMonthCalendar
          events={calendarEvents}
          selectedDate={calendarFocusDate}
          onSelectedDateChange={setCalendarFocusDate}
          onEventSelect={setSelectedEvent}
          onVisibleRangeChange={updateVisibleScheduleRange}
        />
      )
    } else if (activeAction.id === "week") {
      calendar = (
        <MinistryWeekCalendar
          events={calendarEvents}
          focusDate={calendarFocusDate}
          onFocusDateChange={setCalendarFocusDate}
          onEventSelect={setSelectedEvent}
          onVisibleRangeChange={updateVisibleScheduleRange}
        />
      )
    } else if (activeAction.id === "today") {
      calendar = (
        <MinistryTodayCalendar
          events={calendarEvents}
          onEventSelect={setSelectedEvent}
          onVisibleRangeChange={updateVisibleScheduleRange}
        />
      )
    } else {
      calendar = (
        <MinistryCustomCalendar
          events={calendarEvents}
          onEventSelect={setSelectedEvent}
          onVisibleRangeChange={updateVisibleScheduleRange}
        />
      )
    }
    content = (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 py-2 print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
              {data.ministry.name} · Internal calendar
            </p>
            <p className="text-xs text-gray-500">Visible only to approved ministry members.</p>
          </div>
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadEventSchedulePdf({
                ministryName: data.ministry.name,
                events: printableScheduleEvents,
                ...visibleScheduleRange,
                filterLabel: showOnlyMyEvents ? "My Events" : "All Events",
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600"
          >
            <DocumentArrowDownIcon className="size-4" /> Download PDF
          </button>
          <button type="button" onClick={() => exportSchedule(calendarEvents)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600">
            <ArrowDownTrayIcon className="size-4" /> Export
          </button>
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
      const eventRange = getEventRange(visibleEvents)
      content = (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                downloadEventSchedulePdf({
                  ministryName: data.ministry.name,
                  events: visibleEvents,
                  ...eventRange,
                  filterLabel:
                    activeAction.id === "my-events" ? "My Events" : "All Events",
                })
              }
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600"
            >
              <DocumentArrowDownIcon className="size-4" /> Download PDF
            </button>
          </div>
          <EventList events={visibleEvents} onEventSelect={setSelectedEvent} />
        </div>
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
    activeAction.id === "service-frequency"
  ) {
    content = <MinistryMembers data={data} activeAction={activeAction} />
  } else if (
    section.id === "availability" &&
    activeAction.id === "my-availability"
  ) {
    content = (
      <MinistryAvailability
        ministryId={data.ministry.id}
        canManageMembers={data.ministry.accessLevel !== "member"}
      />
    )
  } else if (section.id === "profile") {
    content = (
      <MinistryProfile
        initialUser={currentUser || data.user}
        onUserUpdate={onUserUpdate}
      />
    )
  } else if (section.id === "support") {
    content = (
      <MinistrySupport
        ministryName={data.ministry.name}
        initialView={
          activeAction.id === "contact-support" ? "contact" : "documentation"
        }
      />
    )
  } else if (section.id === "reports") {
    content = <MinistryReports ministry={data.ministry} activeAction={activeAction} currentUser={currentUser || data.user} />
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
