import * as React from "react"
import { Link } from "../../compat/gatsby"
import {
  Bars3Icon,
  BellAlertIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  PlusIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryAvailability from "./MinistryAvailability"
import MinistryEventAgenda from "./MinistryEventAgenda"
import MinistryEventDetails from "./MinistryEventDetails"
import MinistryHomeCalendar from "./MinistryHomeCalendar"
import MinistryOrdoReference from "./MinistryOrdoReference"
import MinistryProfile from "./MinistryProfile"
import MinistryGlobalMembers from "./MinistryGlobalMembers"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import MinistrySupport from "./MinistrySupport"
import MinistryEvents from "./MinistryEvents"
import MinistryMessages from "./MinistryMessages"
import VolunteerEvents from "./VolunteerEvents"
import { accountSections } from "./accountNavigation"

const accessLabels = {
  owner: "Global Owner",
  super_admin: "Super Admin",
  admin: "Leader",
  member: "Member",
}

const EmptyDashboardBlock = ({ title, text }) => (
  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
    <p className="font-semibold text-gray-700">{title}</p>
    <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-gray-500">
      {text}
    </p>
  </div>
)

const DashboardBlock = ({ icon: Icon, title, children }) => (
  <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center gap-3">
      <span className="rounded-xl bg-[#f4ede6] p-2 text-[#896542]">
        <Icon className="size-5" />
      </span>
      <h2 className="century-font text-2xl text-gray-950">{title}</h2>
    </div>
    {children}
  </section>
)

const MinistryCards = ({ ministries, isManagedProfile, actor, onReturn }) => {
  if (!ministries.length) {
    return (
      <div className="rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        This profile does not have access to any ministries yet.
        {isManagedProfile && actor && (
          <button
            type="button"
            onClick={onReturn}
            className="mx-auto mt-4 block rounded-xl border border-[#d8c7b8] px-4 py-2 text-sm font-semibold text-[#6f4f34]"
          >
            Return to {actor.firstName} {actor.lastName}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {ministries.map((ministry) => (
        <Link
          key={ministry.id}
          to={`/${ministry.slug}`}
          className="flex min-h-56 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#C1A387] hover:shadow-md"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="century-font text-2xl text-[#896542]">
              {ministry.name}
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs uppercase text-gray-500">
              {ministry.status}
            </span>
          </div>
          <p className="flex-grow text-sm leading-relaxed text-gray-600">
            {ministry.description || "No description has been added yet."}
          </p>
          <div className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-500">
            <p className="font-semibold text-[#896542]">
              {accessLabels[ministry.accessLevel] || ministry.accessLevel}
            </p>
            {ministry.canServe && (
              <p className="font-semibold text-green-700">Serving member</p>
            )}
            <p>
              {ministry.memberCount} serving{" "}
              {ministry.memberCount === 1 ? "member" : "members"} ·{" "}
              {ministry.templateCount}{" "}
              {ministry.templateCount === 1 ? "template" : "templates"}
            </p>
          </div>
          <span className="mt-4 text-sm font-semibold text-[#896542]">
            Open ministry →
          </span>
        </Link>
      ))}
    </div>
  )
}

const MinistryHomeWorkspace = ({ data }) => {
  const hasGlobalAccess = ["owner", "super_admin"].includes(
    data.user.globalRole
  )
  const canManageMembers =
    hasGlobalAccess ||
    data.ministries.some((ministry) =>
      ["owner", "admin"].includes(ministry.accessLevel),
    )
  const availableSections = React.useMemo(
    () =>
      accountSections.filter(
        (section) => !section.managerOnly || canManageMembers,
      ),
    [canManageMembers]
  )
  const [sectionId, setSectionId] = React.useState(() => {
    if (typeof window === "undefined") return "home"
    const requestedSection = new URLSearchParams(window.location.search).get(
      "section"
    )
    return availableSections.some((section) => section.id === requestedSection)
      ? requestedSection
      : "home"
  })
  const [currentUser, setCurrentUser] = React.useState(data.user)
  const [selectedEvent, setSelectedEvent] = React.useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false)
  const [familyData, setFamilyData] = React.useState(null)
  const [alertsData, setAlertsData] = React.useState({ alerts: [], unreadCount: 0 })
  const [messageSummary, setMessageSummary] = React.useState({
    received: [],
    unreadCount: 0,
  })
  const [showCreateEvent, setShowCreateEvent] = React.useState(false)
  const manageableMinistries = React.useMemo(
    () =>
      data.ministries.filter(
        (ministry) =>
          hasGlobalAccess || ["owner", "admin"].includes(ministry.accessLevel),
      ),
    [data.ministries, hasGlobalAccess],
  )
  const [createMinistryId, setCreateMinistryId] = React.useState(
    () => manageableMinistries[0]?.id || "",
  )
  const activeSection =
    availableSections.find((section) => section.id === sectionId) ||
    availableSections[0]
  const myEvents = React.useMemo(
    () => data.calendarEvents.filter((event) => event.is_assigned),
    [data.calendarEvents]
  )
  const upcomingEvents = React.useMemo(() => {
    const now = Date.now()
    return data.calendarEvents.filter((event) => {
      const endTime = new Date(event.end_time || event.start_time).getTime()
      return !Number.isNaN(endTime) && endTime >= now
    })
  }, [data.calendarEvents])
  const upcomingAssignments = React.useMemo(() => {
    const now = Date.now()
    return myEvents
      .filter((event) => {
        const endTime = new Date(event.end_time || event.start_time).getTime()
        return (
          event.status === "published" &&
          !Number.isNaN(endTime) &&
          endTime >= now
        )
      })
      .sort(
        (first, second) =>
          new Date(first.assignment_start_time || first.start_time).getTime() -
          new Date(second.assignment_start_time || second.start_time).getTime()
      )
  }, [myEvents])
  const today = React.useMemo(() => new Date(), [])
  const todayLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(today),
    [today]
  )

  React.useEffect(() => {
    const loadProfiles = () => {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      fetch(getFunctionEndpoint("ministry-profiles"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (response) => {
          const result = await response.json()
          if (!response.ok) throw new Error(result.message)
          return result
        })
        .then(setFamilyData)
        .catch(() => {})
    }

    loadProfiles()
    window.addEventListener("ministry-profiles-updated", loadProfiles)
    return () =>
      window.removeEventListener("ministry-profiles-updated", loadProfiles)
  }, [])

  const loadAlerts = React.useCallback(() => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    return fetch(getFunctionEndpoint("notifications"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message)
        return result
      })
      .then(setAlertsData)
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    loadAlerts()
    const interval = window.setInterval(loadAlerts, 60_000)
    return () => window.clearInterval(interval)
  }, [loadAlerts, currentUser?.id])

  const loadMessageSummary = React.useCallback(() => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    return fetch(getFunctionEndpoint("messages"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message)
        return result
      })
      .then(setMessageSummary)
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    loadMessageSummary()
    const interval = window.setInterval(loadMessageSummary, 60_000)
    return () => window.clearInterval(interval)
  }, [loadMessageSummary, currentUser?.id])

  const handleMessageUnreadCount = React.useCallback((unreadCount) => {
    setMessageSummary((current) =>
      current.unreadCount === unreadCount
        ? current
        : { ...current, unreadCount },
    )
  }, [])

  const markAllAlertsRead = async () => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("notifications"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "mark_all_read" }),
    })
    if (!response.ok) return
    const result = await response.json()
    setAlertsData(result)
    setFamilyData((current) => current && ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === current.activeProfile.id
          ? { ...profile, alertCount: 0 }
          : profile
      ),
    }))
  }

  const acknowledgeAlert = async (alertId) => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("notifications"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "acknowledge", alertId }),
    })
    if (!response.ok) return
    const result = await response.json()
    setAlertsData(result)
  }

  const selectSection = (id) => {
    setSectionId(id)
    if (id === "events") setShowCreateEvent(false)
    setMobileMenuOpen(false)
    setProfileMenuOpen(false)
    window.history.replaceState({}, "", id === "home" ? "/" : `/?section=${id}`)
  }

  const switchProfile = async (profileId) => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("ministry-profiles"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "switch_profile", profileId }),
    })
    const result = await response.json()
    if (!response.ok) return

    window.sessionStorage.setItem(MINISTRY_SESSION_KEY, result.token)
    window.sessionStorage.setItem(
      "ministry_visible_profile_ids",
      JSON.stringify([profileId])
    )
    window.location.assign("/")
  }

  const signOut = () => {
    window.sessionStorage.removeItem(MINISTRY_SESSION_KEY)
    window.sessionStorage.removeItem("ministry_visible_profile_ids")
    window.dispatchEvent(new Event("ministry-session-expired"))
  }

  const returnToGuardian = () => {
    if (data.actor?.id) switchProfile(data.actor.id)
  }

  let content
  if (sectionId === "home") {
    content = (
      <div className="space-y-8">
        <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#896542]">
              Today
            </p>
            <h2 className="mt-2 century-font text-3xl leading-tight text-gray-950">
              {todayLabel}
            </h2>
            <p className="mt-4 text-sm text-gray-500">
              Schedule for {currentUser?.firstName || "this profile"}
            </p>
          </section>
          <MinistryOrdoReference compact startTime={today.toISOString()} />
        </div>
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="century-font text-2xl text-gray-950">
              My Upcoming Assignments
            </h2>
            <button
              type="button"
              onClick={() => selectSection("events")}
              className="text-sm font-semibold text-[#896542]"
            >
              View all
            </button>
          </div>
          <MinistryEventAgenda
            events={upcomingAssignments}
            label="My Upcoming Assignments"
            emptyTitle="No upcoming assignments"
            emptyText="New duties assigned to this profile will appear here."
            onEventSelect={setSelectedEvent}
            useAssignmentTime
          />
        </section>
        <div className="grid gap-5 lg:grid-cols-2">
          <DashboardBlock icon={BellAlertIcon} title="Alerts & Reminders">
            {alertsData.alerts.length ? (
              <div className="space-y-3">
                {alertsData.unreadCount > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={markAllAlertsRead}
                      className="text-xs font-semibold text-[#896542]"
                    >
                      Mark all read
                    </button>
                  </div>
                )}
                {alertsData.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl border px-4 py-3 ${
                      alert.read
                        ? "border-gray-100 bg-gray-50"
                        : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <p className="font-semibold text-gray-800">{alert.title}</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                      {alert.message}
                    </p>
                    {alert.acknowledgmentRequired && !alert.acknowledgedAt && (
                      <button
                        type="button"
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="mt-3 rounded-lg bg-[#896542] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6f4f34]"
                      >
                        Acknowledge
                      </button>
                    )}
                    {alert.acknowledgedAt && (
                      <p className="mt-2 text-xs font-semibold text-green-700">
                        Acknowledged
                      </p>
                    )}
                    {alert.escalatedAt && !alert.acknowledgedAt && (
                      <p className="mt-2 text-xs font-semibold text-orange-700">
                        Escalated to ministry leaders
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      Delivery: {alert.deliveryStatus.replaceAll("_", " ")}
                      {alert.deliveries?.length
                        ? ` · ${alert.deliveries
                            .map(
                              (delivery) =>
                                `${delivery.channel} ${delivery.status}`,
                            )
                            .join(" · ")}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyDashboardBlock
                title="No new alerts"
                text="Schedule changes, cancellations, conflicts, and assignment reminders will appear here."
              />
            )}
          </DashboardBlock>
          <DashboardBlock
            icon={ChatBubbleLeftRightIcon}
            title="Ministry Notices"
          >
            {messageSummary.received?.length ? (
              <div className="space-y-3">
                {messageSummary.received.slice(0, 3).map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => selectSection("messages")}
                    className={`w-full rounded-xl border px-4 py-3 text-left ${
                      message.read
                        ? "border-gray-100 bg-gray-50"
                        : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <p className="font-semibold text-gray-800">
                      {message.subject || "Telegram announcement"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">
                      {message.body}
                    </p>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => selectSection("messages")}
                  className="text-sm font-semibold text-[#896542]"
                >
                  View all messages
                </button>
              </div>
            ) : (
              <EmptyDashboardBlock
                title="No new notices"
                text="Announcements sent by your ministry leaders will appear here."
              />
            )}
          </DashboardBlock>
        </div>
      </div>
    )
  } else if (sectionId === "calendar") {
    content = (
      <MinistryHomeCalendar
        events={data.calendarEvents}
        onEventSelect={setSelectedEvent}
      />
    )
  } else if (sectionId === "events") {
    const createMinistry = manageableMinistries.find(
      (ministry) => ministry.id === createMinistryId,
    )
    content = showCreateEvent && hasGlobalAccess ? (
      <VolunteerEvents creating onBack={() => setShowCreateEvent(false)} />
    ) : showCreateEvent && createMinistry ? (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="min-w-64 text-sm font-semibold text-gray-700">
            Create for ministry
            <select
              value={createMinistryId}
              onChange={(event) => setCreateMinistryId(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal"
            >
              {manageableMinistries.map((ministry) => (
                <option key={ministry.id} value={ministry.id}>
                  {ministry.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowCreateEvent(false)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600"
          >
            Back to events
          </button>
        </div>
        <MinistryEvents
          key={createMinistry.id}
          data={{ ministry: createMinistry, user: currentUser }}
          activeAction={{ id: "add-event", label: "Create event" }}
          onEventSelect={setSelectedEvent}
        />
      </div>
    ) : (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="century-font text-3xl text-gray-950">Events</h2>
            <p className="mt-1 text-sm text-gray-500">
              Public events, ministry events visible to this profile, and assigned duties.
            </p>
          </div>
          {(hasGlobalAccess || manageableMinistries.length > 0) && (
            <button
              type="button"
              onClick={() => setShowCreateEvent(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6f4f34]"
            >
              <PlusIcon className="size-5" />
              Create event
            </button>
          )}
        </div>
        {hasGlobalAccess && <VolunteerEvents />}
        <MinistryEventAgenda
          events={upcomingEvents}
          label="Available events"
          emptyTitle="No available events"
          emptyText="Public events and events for this profile's ministries will appear here."
          onEventSelect={setSelectedEvent}
        />
      </div>
    )
  } else if (sectionId === "availability") {
    content = <MinistryAvailability />
  } else if (sectionId === "messages") {
    content = (
      <MinistryMessages
        onUnreadCountChange={handleMessageUnreadCount}
      />
    )
  } else if (sectionId === "ministries") {
    content = (
      <MinistryCards
        ministries={data.ministries}
        isManagedProfile={data.isManagedProfile}
        actor={data.actor}
        onReturn={returnToGuardian}
      />
    )
  } else if (sectionId === "members" && canManageMembers) {
    content = <MinistryGlobalMembers />
  } else if (sectionId === "profile") {
    content = (
      <MinistryProfile
        initialUser={currentUser}
        onUserUpdate={setCurrentUser}
      />
    )
  } else {
    content = <MinistrySupport />
  }

  return (
    <div className="h-screen overflow-hidden bg-white text-gray-900">
      <div className="mx-auto flex h-full w-full max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-gray-100 bg-white lg:block">
          <div className="sticky top-0 flex max-h-screen flex-col overflow-y-auto px-4 py-6">
            <div className="mb-5 px-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387]">
                Ministry workspace
              </p>
              <h1 className="mt-2 century-font text-2xl leading-tight text-[#6f4f34]">
                Ministries
              </h1>
            </div>
            <nav aria-label="Account sections" className="space-y-1">
              {availableSections.map((section) => {
                const Icon = section.icon
                const active = section.id === activeSection.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => selectSection(section.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-[#f7f3ef] font-semibold text-[#6f4f34]"
                        : "text-gray-600 hover:bg-white hover:text-gray-900"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="flex-1">{section.label}</span>
                    {section.id === "messages" && messageSummary.unreadCount > 0 && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-orange-400"
                        aria-label={`${messageSummary.unreadCount} unread messages`}
                      />
                    )}
                    {active && <ChevronRightIcon className="size-4" />}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex items-center border-b border-gray-100 bg-white px-4 py-2">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#6f4f34] lg:hidden"
              >
                <Bars3Icon className="size-5 shrink-0" />
                <span className="truncate">{activeSection.label}</span>
              </button>
              <p className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387] lg:block">
                Ministries
              </p>
              <h2 className="mt-1 hidden century-font text-4xl text-gray-900 lg:block">
                {activeSection.label}
              </h2>
              <p className="mt-2 hidden max-w-2xl text-base leading-relaxed text-gray-500 lg:block">
                {activeSection.description}
              </p>
            </div>

            <div className="relative ml-auto flex shrink-0 items-center gap-2">
              <div className="text-right">
                <p className="hidden text-sm font-semibold text-gray-900 sm:block">
                  {[currentUser?.firstName, currentUser?.lastName]
                    .filter(Boolean)
                    .join(" ") || currentUser?.username}
                </p>
                <div id="username" className="text-xs text-gray-500">
                  {currentUser?.username ||
                    [currentUser?.firstName, currentUser?.lastName]
                      .filter(Boolean)
                      .join(" ")}
                </div>
                <span className="mt-1 hidden rounded-full bg-[#f4ede6] px-2 py-0.5 text-[10px] font-semibold text-[#896542] sm:inline-flex">
                  {accessLabels[currentUser?.globalRole] ||
                    currentUser?.globalRole ||
                    "Member"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((open) => !open)}
                aria-label={`Choose profile for ${currentUser?.username || "current user"}`}
                aria-expanded={profileMenuOpen}
                className={`rounded-full transition ${
                  profileMenuOpen
                    ? "border-[#896542] bg-[#f4ede6] text-[#6f4f34]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-[#C1A387] hover:text-[#896542]"
                }`}
              >
                <UserCircleIcon className="size-7" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-xl">
                  {familyData?.profiles?.length > 0 && (
                    <div className="max-h-72 overflow-y-auto p-2">
                      {familyData.profiles.map((profile) => {
                        const active =
                          familyData.activeProfile.id === profile.id
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => switchProfile(profile.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                              active
                                ? "font-semibold text-[#6f4f34]"
                                : "text-gray-700"
                            }`}
                          >
                            <span
                              className={`size-2 shrink-0 rounded-full ${
                                profile.alertCount > 0
                                  ? "bg-orange-400"
                                  : "bg-gray-300"
                              }`}
                              aria-label={
                                profile.alertCount > 0
                                  ? `${profile.alertCount} unread alerts`
                                  : "No unread alerts"
                              }
                            />
                            <span>{profile.firstName} {profile.lastName}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => selectSection("profile")}
                    className="w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#896542] hover:bg-[#f7f3ef]"
                  >
                    Manage Profiles
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    className="w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#896542] hover:bg-[#f7f3ef]"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
            {content}
          </div>
        </main>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close ministry menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#e6ddd4] p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387]">
                  Ministry workspace
                </p>
                <h2 className="mt-1 century-font text-2xl text-[#6f4f34]">
                  Ministries
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600"
                aria-label="Close menu"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>
            <nav
              className="flex-1 overflow-y-auto p-3"
              aria-label="Account sections"
            >
              {availableSections.map((section) => {
                const Icon = section.icon
                const active = section.id === activeSection.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => selectSection(section.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${
                      active
                        ? "bg-[#f7f3ef] font-semibold text-[#6f4f34]"
                        : "text-gray-600"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="flex-1">{section.label}</span>
                    {section.id === "messages" && messageSummary.unreadCount > 0 && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-orange-400"
                        aria-label={`${messageSummary.unreadCount} unread messages`}
                      />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      <MinistryEventDetails
        event={selectedEvent}
        ministryName={selectedEvent?.coordinator_ministry_name || "Ministry"}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}

export default MinistryHomeWorkspace
