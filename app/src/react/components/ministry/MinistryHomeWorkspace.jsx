import * as React from "react"
import { Link } from "../../compat/gatsby"
import {
  Bars3Icon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  HomeIcon,
  Squares2X2Icon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryAvailability from "./MinistryAvailability"
import MinistryEventAgenda from "./MinistryEventAgenda"
import MinistryEventDetails from "./MinistryEventDetails"
import MinistryHomeCalendar from "./MinistryHomeCalendar"
import MinistryProfile from "./MinistryProfile"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"

const accessLabels = {
  owner: "Global Owner",
  super_admin: "Super Admin",
  admin: "Leader",
  member: "Member",
}

const sections = [
  {
    id: "home",
    label: "Home",
    icon: HomeIcon,
    description: "Your assignments, calendar, and ministries.",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDaysIcon,
    description: "See every published ministry event.",
  },
  {
    id: "events",
    label: "My Events",
    icon: CheckCircleIcon,
    description: "Review the events and duties assigned to this profile.",
  },
  {
    id: "availability",
    label: "Availability",
    icon: ClockIcon,
    description: "Block dates when this profile cannot be scheduled.",
  },
  {
    id: "ministries",
    label: "My Ministries",
    icon: Squares2X2Icon,
    description: "Open the ministry workspaces available to this profile.",
  },
  {
    id: "profile",
    label: "My Profile",
    icon: UserCircleIcon,
    description: "Manage personal details and account-wide preferences.",
  },
]

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
          to={`/ministry/${ministry.slug}`}
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
  const [sectionId, setSectionId] = React.useState(() => {
    if (typeof window === "undefined") return "home"
    const requestedSection = new URLSearchParams(window.location.search).get(
      "section",
    )
    return sections.some((section) => section.id === requestedSection)
      ? requestedSection
      : "home"
  })
  const [currentUser, setCurrentUser] = React.useState(data.user)
  const [selectedEvent, setSelectedEvent] = React.useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false)
  const [familyData, setFamilyData] = React.useState(null)
  const activeSection =
    sections.find((section) => section.id === sectionId) || sections[0]
  const myEvents = React.useMemo(
    () => data.calendarEvents.filter((event) => event.is_assigned),
    [data.calendarEvents],
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

  const selectSection = (id) => {
    setSectionId(id)
    setMobileMenuOpen(false)
    setProfileMenuOpen(false)
    window.history.replaceState(
      {},
      "",
      id === "home" ? "/ministry" : `/ministry?section=${id}`,
    )
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
      JSON.stringify([profileId]),
    )
    window.location.assign("/ministry")
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
      <div className="space-y-10">
        <MinistryHomeCalendar
          title="My Calendar"
          events={myEvents}
          onEventSelect={setSelectedEvent}
        />
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="century-font text-2xl text-gray-950">
              My Ministries
            </h2>
            <button
              type="button"
              onClick={() => selectSection("ministries")}
              className="text-sm font-semibold text-[#896542]"
            >
              View all
            </button>
          </div>
          <MinistryCards
            ministries={data.ministries}
            isManagedProfile={data.isManagedProfile}
            actor={data.actor}
            onReturn={returnToGuardian}
          />
        </section>
      </div>
    )
  } else if (sectionId === "calendar") {
    content = (
      <MinistryHomeCalendar
        title="All Events"
        events={data.calendarEvents}
        onEventSelect={setSelectedEvent}
      />
    )
  } else if (sectionId === "events") {
    content = (
      <MinistryEventAgenda
        events={myEvents}
        label="My Events"
        emptyTitle="No assigned events"
        emptyText="Events and duties assigned to this profile will appear here."
        onEventSelect={setSelectedEvent}
      />
    )
  } else if (sectionId === "availability") {
    content = <MinistryAvailability />
  } else if (sectionId === "ministries") {
    content = (
      <MinistryCards
        ministries={data.ministries}
        isManagedProfile={data.isManagedProfile}
        actor={data.actor}
        onReturn={returnToGuardian}
      />
    )
  } else {
    content = (
      <MinistryProfile
        initialUser={currentUser}
        onUserUpdate={setCurrentUser}
      />
    )
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
                My Ministry
              </h1>
            </div>
            <nav aria-label="Ministry sections" className="space-y-1">
              {sections.map((section) => {
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
                My Ministry
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
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                              active
                                ? "font-semibold text-[#6f4f34]"
                                : "text-gray-700"
                            }`}
                          >
                            {profile.firstName} {profile.lastName}
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
                  My Ministry
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
              aria-label="Ministry sections"
            >
              {sections.map((section) => {
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
                    <span>{section.label}</span>
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
