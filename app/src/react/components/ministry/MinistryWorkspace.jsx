import * as React from "react"
import { Link } from "gatsby"
import {
  ArrowLeftIcon,
  Bars3Icon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import MinistryWorkspaceContent from "./MinistryWorkspaceContent"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import {
  memberSections,
  ministrySections,
  profileSection,
} from "./ministryNavigation"

const accessLabels = {
  owner: "Global Owner",
  super_admin: "Super Admin",
  admin: "Leader",
  member: "Member",
}

const MinistryWorkspace = ({ data }) => {
  const isMember = data.ministry.accessLevel === "member"
  const availableSections = isMember ? memberSections : ministrySections
  const [currentUser, setCurrentUser] = React.useState(data.user)
  const [sectionId, setSectionId] = React.useState(() =>
    isMember ? "schedule" : "overview",
  )
  const [actionId, setActionId] = React.useState(() =>
    isMember ? "month" : "summary",
  )
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false)
  const [familyData, setFamilyData] = React.useState(null)
  const [visibleProfileIds, setVisibleProfileIds] = React.useState([])
  const activeSection =
    [...availableSections, profileSection].find(
      (section) => section.id === sectionId,
    ) || availableSections[0]
  const activeAction =
    activeSection.actions.find((item) => item.id === actionId) ||
    activeSection.actions[0]
  const isMobileCalendarView =
    activeSection.id === "schedule" &&
    ["month", "week", "today", "custom"].includes(activeAction.id)
  const isSchedule = activeSection.id === "schedule"
  const isProfile = activeSection.id === "profile"

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
        .then((result) => {
          setFamilyData(result)
          const stored = JSON.parse(
            window.sessionStorage.getItem("ministry_visible_profile_ids") || "[]",
          )
          const allowedIds = new Set(result.profiles.map((profile) => profile.id))
          const restored = stored.filter((id) => allowedIds.has(id))
          setVisibleProfileIds(
            restored.length ? restored : result.profiles.map((profile) => profile.id),
          )
        })
        .catch(() => {})
    }
    loadProfiles()
    window.addEventListener("ministry-profiles-updated", loadProfiles)
    return () =>
      window.removeEventListener("ministry-profiles-updated", loadProfiles)
  }, [])

  const saveVisibleProfiles = (ids) => {
    setVisibleProfileIds(ids)
    window.sessionStorage.setItem(
      "ministry_visible_profile_ids",
      JSON.stringify(ids),
    )
  }

  const toggleVisibleProfile = (profileId) => {
    saveVisibleProfiles(
      visibleProfileIds.includes(profileId)
        ? visibleProfileIds.filter((id) => id !== profileId)
        : [...visibleProfileIds, profileId],
    )
  }

  const switchProfile = async (profileId, showAll = false) => {
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
    saveVisibleProfiles(
      showAll ? familyData.profiles.map((profile) => profile.id) : [profileId],
    )
    const listResponse = await fetch(getFunctionEndpoint("ministry-list"), {
      headers: { Authorization: `Bearer ${result.token}` },
    })
    const listResult = await listResponse.json()
    const canOpenCurrent = listResponse.ok && listResult.ministries?.some(
      (ministry) => ministry.slug === data.ministry.slug,
    )
    window.location.assign(
      canOpenCurrent ? `/ministry/${data.ministry.slug}` : "/ministry",
    )
  }

  const visibleEvents = React.useMemo(() => {
    if (!data.familyProfiles?.length || data.familyProfiles.length === 1) {
      return data.events
    }
    return data.events
      .filter((event) =>
        event.profileAssignments?.some((assignment) =>
          visibleProfileIds.includes(assignment.profileId),
        ),
      )
      .map((event) => ({
        ...event,
        is_assigned: event.profileAssignments?.some((assignment) =>
          visibleProfileIds.includes(assignment.profileId),
        ),
        visibleProfileAssignments: event.profileAssignments?.filter(
          (assignment) => visibleProfileIds.includes(assignment.profileId),
        ),
      }))
  }, [data.events, data.familyProfiles, visibleProfileIds])

  const workspaceData = React.useMemo(
    () => ({ ...data, events: visibleEvents }),
    [data, visibleEvents],
  )

  const selectSection = (section) => {
    setSectionId(section.id)
    setActionId(section.actions[0].id)
    setMobileMenuOpen(false)
  }

  return (
    <div className="h-screen overflow-hidden bg-white text-gray-900">
      <div className="mx-auto flex h-full w-full max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-gray-100 bg-white lg:block">
          <div className="sticky top-0 flex max-h-screen flex-col overflow-y-auto px-4 py-6">
            <Link
              to="/ministry"
              className="mb-6 flex items-center gap-2 px-3 text-sm text-gray-500 hover:text-[#896542]"
            >
              <ArrowLeftIcon className="size-4" />
              {isMember ? "My ministries" : "All ministries"}
            </Link>
            <div className="mb-5 px-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387]">
                Ministry workspace
              </p>
              <h1 className="mt-2 bgcentury-font text-2xl leading-tight text-[#6f4f34]">
                {data.ministry.name}
              </h1>
            </div>
            <nav aria-label="Ministry sections" className="space-y-1">
              {availableSections.map((section) => {
                const Icon = section.icon
                const active = section.id === activeSection.id

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => selectSection(section)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-[#f7f3ef] font-semibold text-[#6f4f34]"
                        : "text-gray-600 hover:bg-white hover:text-gray-900"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="flex-1">
                      {section.shortLabel || section.label}
                    </span>
                    {active && <ChevronRightIcon className="size-4" />}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <main
          className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden lg:pb-0 ${
            isProfile ? "pb-0" : "pb-24"
          }`}
        >
          <header className="flex items-center border-b border-gray-100 px-4 py-2 bg-white">
            <div className="contents">
              <div className="order-1 min-w-0">
                <div className=" flex items-center gap-2 lg:hidden">
                  <Link
                    to="/ministry"
                    aria-label="Back to ministries"
                    className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600"
                  >
                    <ArrowLeftIcon className="size-5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#6f4f34]"
                  >
                    <Bars3Icon className="size-5 shrink-0" />
                    <span className="truncate">{activeSection.label}</span>
                  </button>
                </div>
                <p className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387] lg:block">
                  {data.ministry.name}
                </p>
                <h2
                  className={`hidden lg:block century-font text-3xl text-gray-900 lg:mt-1 lg:text-4xl ${
                    isMobileCalendarView ? "sr-only lg:not-sr-only" : ""
                  }`}
                >
                  {activeSection.label}
                </h2>
                <p
                  className={` hidden lg:block mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base ${
                    isMobileCalendarView ? "hidden lg:block" : ""
                  }`}
                >
                  {activeSection.description}
                </p>
              </div>
              <div className="relative order-3 ml-auto flex shrink-0 items-center gap-2">
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
                    {accessLabels[data.ministry.accessLevel] ||
                      data.ministry.accessLevel}
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
                {profileMenuOpen && familyData && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-xl">
                    <button
                      type="button"
                      onClick={() => switchProfile(familyData.actor.id, true)}
                      className="w-full border-b border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#6f4f34] hover:bg-[#f7f3ef]"
                    >
                      All Members
                    </button>
                    <div className="max-h-72 overflow-y-auto p-2">
                      {familyData.profiles.map((profile) => {
                        const visible = visibleProfileIds.includes(profile.id)
                        const active = familyData.activeProfile.id === profile.id
                        return (
                          <div key={profile.id} className="flex items-center gap-2 rounded-lg hover:bg-gray-50">
                            <button
                              type="button"
                              onClick={() => toggleVisibleProfile(profile.id)}
                              aria-label={`${visible ? "Hide" : "Show"} ${profile.firstName} ${profile.lastName} events`}
                              className="p-2 text-gray-500 hover:text-[#896542]"
                            >
                              {visible ? <EyeIcon className="size-5" /> : <EyeSlashIcon className="size-5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => switchProfile(profile.id)}
                              className={`min-w-0 flex-1 px-2 py-2 text-right text-sm ${
                                active ? "font-semibold text-[#6f4f34]" : "text-gray-700"
                              }`}
                            >
                              {profile.firstName} {profile.lastName}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    <Link
                      to="/ministry/availability"
                      onClick={() => setProfileMenuOpen(false)}
                      className="block w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#896542] hover:bg-[#f7f3ef]"
                    >
                      Availability
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false)
                        selectSection(profileSection)
                      }}
                      className="w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#896542] hover:bg-[#f7f3ef]"
                    >
                      Manage Profiles
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!isProfile && (
              <div className="order-2 mt-5 hidden flex-wrap gap-2 lg:flex">
                {activeSection.actions.map((item) => {
                  const Icon = item.icon
                  const active = item.id === activeAction.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActionId(item.id)}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-[#896542] text-white shadow-sm"
                          : "border border-gray-200 bg-white text-gray-600 hover:border-[#C1A387] hover:text-[#896542]"
                      }`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}
          </header>

          <div
            className={`min-h-0 flex-1 px-2 ${
              isSchedule ? "overflow-hidden" : "overflow-y-auto"
            }`}
          >
            <MinistryWorkspaceContent
              data={workspaceData}
              section={activeSection}
              activeAction={activeAction}
              currentUser={currentUser}
              onUserUpdate={setCurrentUser}
            />
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
                  Ministry
                </p>
                <h2 className="mt-1 century-font text-2xl text-[#6f4f34]">
                  {data.ministry.name}
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
              {isMember && (
                <Link
                  to="/ministry"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-gray-600"
                >
                  <ArrowLeftIcon className="size-5" />
                  <span>My Ministries</span>
                </Link>
              )}
              {availableSections.map((section) => {
                const Icon = section.icon
                const active = section.id === activeSection.id

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => selectSection(section)}
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

      {!isProfile && (
        <nav
          aria-label={`${activeSection.label} actions`}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(63,45,29,0.10)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-xl items-start justify-around gap-1">
            {activeSection.actions.map((item) => {
              const Icon = item.icon
              const active = item.id === activeAction.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActionId(item.id)}
                  className={`flex min-w-16 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition ${
                    active ? "bg-[#f7f3ef] text-[#6f4f34]" : "text-gray-500"
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="leading-tight">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}

export default MinistryWorkspace
