import * as React from "react"
import { Link } from "../../compat/gatsby"
import {
  Bars3Icon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import MinistryWorkspaceContent from "./MinistryWorkspaceContent"
import MinistryConflictTicker from "./MinistryConflictTicker"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import { memberSections, ministrySections } from "./ministryNavigation"
import { accountSections, accountSectionUrl } from "./accountNavigation"
import { applyMinistryTheme } from "../../utils/ministryTheme"
import useAccessibleDialog from "../../hooks/useAccessibleDialog"

const accessLabels = {
  owner: "Global Owner",
  super_admin: "Super Admin",
  admin: "Leader",
  member: "Member",
}

const MinistryWorkspace = ({ data }) => {
  const isMember = data.ministry.accessLevel === "member"
  const hasGlobalAccess = ["owner", "super_admin"].includes(
    data.user.globalRole,
  )
  const canManageMembers =
    hasGlobalAccess || ["owner", "admin"].includes(data.ministry.accessLevel)
  const accountMenuSections = accountSections.filter(
    (section) =>
      (!section.managerOnly || canManageMembers) &&
      (!section.globalAdminOnly || hasGlobalAccess),
  )
  const availableSections = isMember ? memberSections : ministrySections
  const [currentUser, setCurrentUser] = React.useState(data.user)
  React.useLayoutEffect(() => {
    applyMinistryTheme(currentUser?.appearanceTheme, currentUser?.id)
  }, [currentUser?.appearanceTheme, currentUser?.id])
  const [sectionId, setSectionId] = React.useState(() =>
    isMember ? "schedule" : "overview",
  )
  const [actionId, setActionId] = React.useState(() =>
    isMember ? "month" : "upcoming",
  )
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const closeMobileMenu = React.useCallback(() => setMobileMenuOpen(false), [])
  const mobileMenuRef = useAccessibleDialog(mobileMenuOpen, closeMobileMenu)
  const [learnMoreOpen, setLearnMoreOpen] = React.useState(false)
  const closeLearnMore = React.useCallback(() => setLearnMoreOpen(false), [])
  const learnMoreRef = useAccessibleDialog(learnMoreOpen, closeLearnMore)
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false)
  const [familyData, setFamilyData] = React.useState(null)
  const [messageUnreadCount, setMessageUnreadCount] = React.useState(0)
  const [visibleProfileIds, setVisibleProfileIds] = React.useState([])
  const activeSection =
    availableSections.find((section) => section.id === sectionId) ||
    availableSections[0]
  const activeAction =
    activeSection.actions.find((item) => item.id === actionId) ||
    activeSection.actions[0]
  const isSchedule = activeSection.id === "schedule"

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

  React.useEffect(() => {
    const loadUnreadMessages = () => {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      fetch(getFunctionEndpoint("messages"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (response) => {
          const result = await response.json()
          if (!response.ok) throw new Error(result.message)
          return result
        })
        .then((result) => setMessageUnreadCount(result.unreadCount || 0))
        .catch(() => {})
    }
    loadUnreadMessages()
    const interval = window.setInterval(loadUnreadMessages, 60_000)
    return () => window.clearInterval(interval)
  }, [currentUser?.id])

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
    applyMinistryTheme(result.activeProfile?.appearanceTheme, profileId)
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
      canOpenCurrent ? `/${data.ministry.slug}` : "/",
    )
  }

  const visibleCalendarEvents = React.useMemo(() => {
    const selectedProfileIds = visibleProfileIds.length
      ? visibleProfileIds
      : [data.user.id]
    return (data.calendarEvents || data.events).map((event) => ({
      ...event,
      is_assigned: event.profileAssignments?.some((assignment) =>
        selectedProfileIds.includes(assignment.profileId),
      ),
      visibleProfileAssignments: event.profileAssignments?.filter(
        (assignment) => selectedProfileIds.includes(assignment.profileId),
      ),
    }))
  }, [
    data.calendarEvents,
    data.events,
    data.user.id,
    visibleProfileIds,
  ])

  const workspaceData = React.useMemo(
    () => ({ ...data, calendarEvents: visibleCalendarEvents }),
    [data, visibleCalendarEvents],
  )

  const openWorkspaceArea = (nextSectionId, nextActionId) => {
    const nextSection = availableSections.find(
      (section) => section.id === nextSectionId,
    )
    if (!nextSection) return
    setSectionId(nextSection.id)
    setActionId(nextActionId || nextSection.actions[0].id)
  }

  return (
    <div className="ministry-workspace-shell ministry-app-viewport overflow-hidden bg-white text-gray-900">
      <div className="mx-auto flex h-full w-full max-w-[1600px]">
        <aside className="ministry-workspace-navigation hidden w-72 shrink-0 border-r border-gray-100 bg-white lg:block">
          <div className="ministry-scroll-region sticky top-0 flex max-h-full flex-col overflow-y-auto px-4 py-6">
            <div className="mb-5 px-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387]">
                Ministry workspace
              </p>
              <h1 className="mt-2 bgcentury-font text-2xl leading-tight text-[#6f4f34]">
                Ministries
              </h1>
            </div>
            <nav aria-label="Account sections" className="space-y-1">
              {accountMenuSections.map((section) => {
                const Icon = section.icon
                const active = section.id === "ministries"

                return (
                  <Link
                    key={section.id}
                    to={accountSectionUrl(section.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-[#f7f3ef] font-semibold text-[#6f4f34]"
                        : "text-gray-600 hover:bg-white hover:text-gray-900"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="flex-1">{section.label}</span>
                    {section.id === "messages" && messageUnreadCount > 0 && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-orange-400"
                        aria-label={`${messageUnreadCount} unread messages`}
                      />
                    )}
                    {active && <ChevronRightIcon className="size-4" />}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <main
          className="ministry-workspace-main-with-actions flex h-full min-w-0 flex-1 flex-col overflow-hidden"
        >
          <header className="ministry-workspace-header ministry-responsive-header flex items-center border-b border-gray-100 px-4 py-2 bg-white">
            <div className="contents">
              <div className="order-1 min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    aria-label="Open account menu"
                    className="mt-0.5 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 lg:hidden"
                  >
                    <Bars3Icon className="size-5 shrink-0" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C1A387] sm:text-xs">
                      Ministry
                    </p>
                    <button
                      type="button"
                      onClick={() => openWorkspaceArea("overview", "upcoming")}
                      className="mt-0.5 block max-w-full truncate text-left century-font text-xl uppercase leading-tight text-gray-900 sm:text-2xl lg:mt-1 lg:text-4xl"
                    >
                      {data.ministry.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLearnMoreOpen(true)}
                      className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#896542] transition hover:text-[#6f4f34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#896542] sm:text-sm"
                    >
                      <InformationCircleIcon
                        aria-hidden="true"
                        className="size-4"
                      />
                      <span className="lg:hidden">Learn more</span>
                      <span className="hidden lg:inline">
                        Learn more about this ministry
                      </span>
                    </button>
                  </div>
                </div>
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
                  <div className="ministry-profile-menu absolute right-0 top-full z-50 mt-2 rounded-xl border border-gray-200 bg-white text-left shadow-xl">
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
                              className={`flex min-w-0 flex-1 items-center justify-end gap-2 px-2 py-2 text-right text-sm ${
                                active ? "font-semibold text-[#6f4f34]" : "text-gray-700"
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
                          </div>
                        )
                      })}
                    </div>
                    <Link
                      to="/?section=availability"
                      onClick={() => setProfileMenuOpen(false)}
                      className="block w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#896542] hover:bg-[#f7f3ef]"
                    >
                      Availability
                    </Link>
                    <Link
                      to="/?section=profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#896542] hover:bg-[#f7f3ef]"
                    >
                      Manage Profiles
                    </Link>
                  </div>
                )}
              </div>
            </div>

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
          </header>

          <MinistryConflictTicker
            profileId={currentUser?.id}
            onOpenAvailability={() =>
              openWorkspaceArea("availability", "my-availability")
            }
            onOpenPrioryConflicts={() =>
              openWorkspaceArea("events", "modify")
            }
          />

          <div
            className={`ministry-workspace-body ministry-scroll-region min-h-0 flex-1 px-2 ${
              isSchedule ? "overflow-hidden" : "overflow-y-auto"
            }`}
          >
            <MinistryWorkspaceContent
              data={workspaceData}
              section={activeSection}
              activeAction={activeAction}
              currentUser={currentUser}
              onUserUpdate={setCurrentUser}
              onOpenWorkspaceArea={openWorkspaceArea}
            />
          </div>
        </main>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close ministry menu"
            onClick={closeMobileMenu}
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          />
          <div ref={mobileMenuRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ministry-mobile-menu-title" className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#e6ddd4] p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387]">
                  Ministry
                </p>
                <h2 id="ministry-mobile-menu-title" className="mt-1 century-font text-2xl text-[#6f4f34]">
                  {data.ministry.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
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
              {accountMenuSections.map((section) => {
                const Icon = section.icon
                const active = section.id === "ministries"

                return (
                  <Link
                    key={section.id}
                    to={accountSectionUrl(section.id)}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${
                      active
                        ? "bg-[#f7f3ef] font-semibold text-[#6f4f34]"
                        : "text-gray-600"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="flex-1">{section.label}</span>
                    {section.id === "messages" && messageUnreadCount > 0 && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-orange-400"
                        aria-label={`${messageUnreadCount} unread messages`}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      <div
        className={`fixed inset-0 z-[80] transition ${
          learnMoreOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!learnMoreOpen}
      >
        <button
          type="button"
          aria-label="Close ministry information"
          onClick={closeLearnMore}
          tabIndex={learnMoreOpen ? 0 : -1}
          className={`absolute inset-0 bg-black/35 backdrop-blur-[1px] transition-opacity duration-300 ${
            learnMoreOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          ref={learnMoreRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ministry-learn-more-title"
          tabIndex={-1}
          className={`absolute inset-y-0 right-0 flex w-[92%] max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            learnMoreOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between border-b border-gray-100 p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387]">
                About this ministry
              </p>
              <h2
                id="ministry-learn-more-title"
                className="mt-1 century-font text-3xl uppercase leading-tight text-[#6f4f34]"
              >
                {data.ministry.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeLearnMore}
              tabIndex={learnMoreOpen ? 0 : -1}
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition hover:border-[#C1A387] hover:text-[#896542]"
              aria-label="Close ministry information"
            >
              <XMarkIcon aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="ministry-scroll-region flex-1 overflow-y-auto p-5 sm:p-6">
            <p className="text-base leading-7 text-gray-600">
              {data.ministry.description ||
                "No description has been added for this ministry yet."}
            </p>
          </div>
        </aside>
      </div>

      <nav
        aria-label={`${activeSection.label} actions`}
        className="ministry-mobile-actions fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(63,45,29,0.10)] backdrop-blur lg:hidden"
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
                aria-pressed={active}
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
    </div>
  )
}

export default MinistryWorkspace
