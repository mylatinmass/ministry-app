import * as React from "react"
import { Link } from "../../compat/gatsby"
import {
  Bars3Icon,
  BellAlertIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  AcademicCapIcon,
  BookOpenIcon,
  CameraIcon,
  HandRaisedIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  MusicalNoteIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Squares2X2Icon,
  StarIcon,
  UserGroupIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryAvailability from "./MinistryAvailability"
import MinistryEventAgenda from "./MinistryEventAgenda"
import MinistryEventDetails from "./MinistryEventDetails"
import MinistryHomeCalendar from "./MinistryHomeCalendar"
import MinistryOrdoReference from "./MinistryOrdoReference"
import MinistryProfile from "./MinistryProfile"
import { applyMinistryTheme } from "../../utils/ministryTheme"
import { buildHouseholdProfileColors } from "../../utils/householdCalendar"
import useAccessibleDialog from "../../hooks/useAccessibleDialog"
import MinistryGlobalMembers from "./MinistryGlobalMembers"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import MinistrySupport from "./MinistrySupport"
import MinistryEvents from "./MinistryEvents"
import MinistryMessages from "./MinistryMessages"
import ChapelSettings from "./ChapelSettings"
import MinistryConflictTicker from "./MinistryConflictTicker"
import { accountSections } from "./accountNavigation"
import MinistrySectionActions from "./MinistrySectionActions"

const accessLabels = {
  owner: "Global Owner",
  super_admin: "Super Admin",
  admin: "Leader",
  member: "Member",
}

const ministryIconRules = [
  { words: ["choir", "music", "schola", "organ"], Icon: MusicalNoteIcon },
  { words: ["altar", "sacrist", "acolyte", "server"], Icon: SparklesIcon },
  { words: ["usher", "hospitality", "greeter"], Icon: HandRaisedIcon },
  { words: ["school", "catech", "education", "class"], Icon: AcademicCapIcon },
  { words: ["book", "library", "liturgy", "lector"], Icon: BookOpenIcon },
  { words: ["charity", "outreach", "care", "mercy"], Icon: HeartIcon },
  { words: ["security", "safety"], Icon: ShieldCheckIcon },
  { words: ["communication", "bulletin", "announcement"], Icon: MegaphoneIcon },
  { words: ["photo", "video", "media"], Icon: CameraIcon },
  {
    words: ["maintenance", "grounds", "clean", "facility"],
    Icon: WrenchScrewdriverIcon,
  },
  { words: ["youth", "family", "men", "women"], Icon: UserGroupIcon },
]

const getMinistryIcon = (name = "") => {
  const normalizedName = name.toLowerCase()
  return (
    ministryIconRules.find(({ words }) =>
      words.some((word) => normalizedName.includes(word)),
    )?.Icon || StarIcon
  )
}

const ministrySortOptions = {
  name_asc: {
    label: "Name: A–Z",
    compare: (a, b) => a.name.localeCompare(b.name),
  },
  name_desc: {
    label: "Name: Z–A",
    compare: (a, b) => b.name.localeCompare(a.name),
  },
  members_desc: {
    label: "Most members",
    compare: (a, b) =>
      b.memberCount - a.memberCount || a.name.localeCompare(b.name),
  },
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

const DashboardAction = ({ icon: Icon, count, label, onClick, urgent = false }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${count} ${label}. Open ${label}.`}
    className={`group flex min-h-24 items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:min-h-28 sm:gap-4 sm:p-4 ${
      count > 0
        ? urgent
          ? "border-orange-200 bg-orange-50"
          : "border-gray-100 bg-white"
        : "border-gray-100 bg-gray-50"
    }`}
  >
    <span className={`rounded-xl p-2 sm:rounded-2xl sm:p-3 ${count > 0 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-500"}`}>
      <Icon className="size-6 sm:size-7" aria-hidden="true" />
    </span>
    <span className="min-w-0">
      <span className="block century-font text-3xl leading-none text-gray-950 sm:text-4xl">
        {count}
      </span>
      <span className="mt-2 block text-sm font-semibold leading-snug text-gray-600">
        {label}
      </span>
    </span>
    <ChevronRightIcon className="ml-auto hidden size-5 shrink-0 text-gray-300 transition group-hover:text-orange-500 sm:block" aria-hidden="true" />
  </button>
)

const PendingRequestList = ({ events, onEventSelect }) => {
  const severityClasses = {
    critical: "border-red-300 bg-red-50 text-red-800",
    high: "border-orange-300 bg-orange-50 text-orange-800",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
  }
  return events.length ? (
    <div className="ministry-scroll-region min-h-0 flex-1 space-y-2 overflow-y-auto">
      {events.map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onEventSelect(event)}
          className={`grid w-full grid-cols-[5.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 text-left ${severityClasses[event.severity] || severityClasses.medium}`}
        >
          <time className="text-xs font-bold uppercase tracking-wide" dateTime={event.start_time}>
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
            }).format(new Date(event.start_time))}
          </time>
          <span className="min-w-0 truncate font-semibold text-gray-950">
            {event.title}
          </span>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold">
            {event.issueCount} {event.issueCount === 1 ? "issue" : "issues"}
          </span>
        </button>
      ))}
    </div>
  ) : (
    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
      No pending requests.
    </p>
  )
}

const MinistryCards = ({
  ministries,
  isManagedProfile,
  actor,
  onReturn,
  canAddMinistry,
}) => {
  const [ministryItems, setMinistryItems] = React.useState(ministries)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sortBy, setSortBy] = React.useState("name_asc")
  const [ministryView, setMinistryView] = React.useState("all")
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [newMinistry, setNewMinistry] = React.useState({
    name: "",
    description: "",
  })
  const [createError, setCreateError] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)
  const [isRequestOpen, setIsRequestOpen] = React.useState(false)
  const [requestableMinistries, setRequestableMinistries] = React.useState([])
  const [requestedMinistryIds, setRequestedMinistryIds] = React.useState([])
  const [requestStatus, setRequestStatus] = React.useState("idle")
  const [requestFeedback, setRequestFeedback] = React.useState("")
  const closeAddDialog = React.useCallback(() => setIsAddOpen(false), [])
  const addDialogRef = useAccessibleDialog(isAddOpen, closeAddDialog)
  const closeRequestDialog = React.useCallback(() => setIsRequestOpen(false), [])
  const requestDialogRef = useAccessibleDialog(isRequestOpen, closeRequestDialog)

  React.useEffect(() => setMinistryItems(ministries), [ministries])

  const visibleMinistries = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return ministryItems
      .filter(
        (ministry) =>
          (ministryView !== "mine" || Boolean(ministry.directAccessLevel)) &&
          (!query ||
            ministry.name.toLowerCase().includes(query) ||
            ministry.description?.toLowerCase().includes(query)),
      )
      .sort(ministrySortOptions[sortBy].compare)
  }, [ministryItems, ministryView, searchQuery, sortBy])

  const openAddDialog = () => {
    setCreateError("")
    setIsAddOpen(true)
  }

  const openRequestDialog = async () => {
    setRequestFeedback("")
    setRequestStatus("loading")
    setIsRequestOpen(true)
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("ministry-profiles"), {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to load ministries")
      setRequestableMinistries(result.requestableMinistries || [])
      setRequestedMinistryIds([])
      setRequestStatus("idle")
    } catch (error) {
      setRequestStatus("error")
      setRequestFeedback(error.message)
    }
  }

  const submitAccessRequest = async (event) => {
    event.preventDefault()
    setRequestStatus("submitting")
    setRequestFeedback("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("ministry-profiles"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "request_memberships",
          ministryIds: requestedMinistryIds,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to request access")
      setRequestStatus("success")
      setRequestFeedback(result.message)
      setRequestableMinistries((current) =>
        current.filter((ministry) => !requestedMinistryIds.includes(ministry.id)),
      )
      setRequestedMinistryIds([])
    } catch (error) {
      setRequestStatus("error")
      setRequestFeedback(error.message)
    }
  }

  const createMinistry = async (event) => {
    event.preventDefault()
    setCreateError("")
    setIsCreating(true)

    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("ministry-create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newMinistry),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to add ministry")
      }

      setMinistryItems((current) => [...current, result.ministry])
      setNewMinistry({ name: "", description: "" })
      setIsAddOpen(false)
    } catch (error) {
      setCreateError(error.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-0">
      <MinistrySectionActions
          label="Ministry actions"
          actions={[
            { id: "all", label: "All Ministries", icon: Squares2X2Icon, active: ministryView === "all", onClick: () => setMinistryView("all") },
            { id: "mine", label: "My Ministries", icon: CheckCircleIcon, active: ministryView === "mine", onClick: () => setMinistryView("mine") },
            { id: "request", label: "Request Access", icon: ShieldCheckIcon, active: isRequestOpen, onClick: openRequestDialog },
            { id: "new", label: "New Ministry", icon: PlusIcon, hidden: !canAddMinistry, onClick: openAddDialog },
          ]}
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center lg:mt-6">
        <label className="relative flex-1">
          <span className="sr-only">Search ministries</span>
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search ministries"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#C1A387] focus:ring-2 focus:ring-[#C1A387]/20"
          />
        </label>
        <label>
          <span className="sr-only">Sort ministries</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-gray-700 shadow-sm outline-none transition focus:border-[#C1A387] focus:ring-2 focus:ring-[#C1A387]/20 sm:w-auto"
          >
            {Object.entries(ministrySortOptions).map(([value, option]) => (
              <option key={value} value={value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibleMinistries.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleMinistries.map((ministry) => {
            const MinistryIcon = getMinistryIcon(ministry.name)
            return (
              <Link
                key={ministry.id}
                to={`/${ministry.slug}`}
                data-guide-id="ministry-card"
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-[#C1A387] hover:shadow-md"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#f4ede6] text-[#896542]">
                  <MinistryIcon aria-hidden="true" className="size-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate century-font text-xl text-[#896542]">
                    {ministry.name}
                  </h3>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden">
                    {["owner", "super_admin"].includes(ministry.accessLevel) && (
                      <span className="shrink-0 rounded-full bg-[#f4ede6] px-2 py-0.5 text-[10px] font-bold text-[#6f4f34]">
                        SuperAdmin
                      </span>
                    )}
                    {ministry.accessLevel === "admin" && (
                      <span className="shrink-0 rounded-full bg-[#f4ede6] px-2 py-0.5 text-[10px] font-bold text-[#6f4f34]">
                        Admin
                      </span>
                    )}
                    {ministry.directAccessLevel && (
                      <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        Active Member
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {ministry.memberCount} {ministry.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="font-semibold text-gray-700">
            {searchQuery ? "No ministries found" : "No ministries yet"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? "Try a different search."
              : ministryView === "mine"
                ? "You do not currently belong to a ministry."
                : "Request access to join a ministry."}
          </p>
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
      )}

      {isRequestOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
          <button type="button" aria-label="Close request access" onClick={closeRequestDialog} className="absolute inset-0" />
          <div ref={requestDialogRef} role="dialog" aria-modal="true" aria-labelledby="request-access-title" tabIndex={-1} className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 id="request-access-title" className="century-font text-2xl text-[#6f4f34]">Request Access</h2>
              <button type="button" onClick={closeRequestDialog} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <XMarkIcon className="size-5" />
              </button>
            </div>
            {requestStatus === "loading" ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading ministries…</p>
            ) : (
              <form onSubmit={submitAccessRequest} className="mt-5 space-y-4">
                {requestableMinistries.length ? (
                  <fieldset className="space-y-1">
                    <legend className="sr-only">Choose ministries</legend>
                    {requestableMinistries.map((ministry) => (
                      <label key={ministry.id} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={requestedMinistryIds.includes(ministry.id)}
                          onChange={(event) => setRequestedMinistryIds((current) =>
                            event.target.checked
                              ? [...current, ministry.id]
                              : current.filter((id) => id !== ministry.id),
                          )}
                          className="size-4 rounded border-gray-300 text-[#896542]"
                        />
                        <span className="min-w-0 truncate">{ministry.name}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">No additional ministries are available to request.</p>
                )}
                {requestFeedback && (
                  <p role={requestStatus === "error" ? "alert" : "status"} className={`text-sm ${requestStatus === "error" ? "text-red-700" : "text-green-700"}`}>
                    {requestFeedback}
                  </p>
                )}
                <button type="submit" disabled={!requestedMinistryIds.length || requestStatus === "submitting"} className="w-full rounded-xl bg-[#896542] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {requestStatus === "submitting" ? "Submitting…" : "Request Access"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {isAddOpen && canAddMinistry && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddDialog()
          }}
        >
          <div
            ref={addDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-ministry-title"
            tabIndex={-1}
            className="ministry-dialog-surface w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="add-ministry-title"
                  className="century-font text-3xl text-[#896542]"
                >
                  Add ministry
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create a new ministry workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddDialog}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close add ministry dialog"
              >
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>
            <form onSubmit={createMinistry} className="mt-6 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">
                  Ministry name
                </span>
                <input
                  required
                  maxLength={120}
                  value={newMinistry.name}
                  onChange={(event) =>
                    setNewMinistry((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-[#C1A387] focus:ring-2 focus:ring-[#C1A387]/20"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">
                  Description{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={newMinistry.description}
                  onChange={(event) =>
                    setNewMinistry((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#C1A387] focus:ring-2 focus:ring-[#C1A387]/20"
                />
              </label>
              {createError && (
                <p role="alert" className="text-sm text-red-600">
                  {createError}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAddDialog}
                  className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newMinistry.name.trim()}
                  className="rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white transition hover:bg-[#6f4f34] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? "Adding…" : "Add ministry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const MinistryHomeWorkspace = ({ data }) => {
  const hasGlobalAccess = ["owner", "super_admin"].includes(
    data.user.globalRole
  )
  const isSuperAdmin = data.user.globalRole === "super_admin"
  const canManageMembers =
    hasGlobalAccess ||
    data.ministries.some((ministry) =>
      ["owner", "admin"].includes(ministry.accessLevel),
    )
  const availableSections = React.useMemo(
    () =>
      accountSections.filter(
        (section) =>
          (!section.managerOnly || canManageMembers) &&
          (!section.globalAdminOnly || isSuperAdmin),
      ),
    [canManageMembers, isSuperAdmin]
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
  React.useLayoutEffect(() => {
    applyMinistryTheme(currentUser?.appearanceTheme)
  }, [currentUser?.appearanceTheme])
  const [selectedEvent, setSelectedEvent] = React.useState(null)
  const [resolvedIssueEventIds, setResolvedIssueEventIds] = React.useState([])
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const closeMobileMenu = React.useCallback(() => setMobileMenuOpen(false), [])
  const mobileMenuRef = useAccessibleDialog(mobileMenuOpen, closeMobileMenu)
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false)
  const [familyData, setFamilyData] = React.useState(null)
  const [visibleProfileIds, setVisibleProfileIds] = React.useState([])
  const householdProfileColors = React.useMemo(
    () => buildHouseholdProfileColors(familyData?.profiles || []),
    [familyData?.profiles],
  )
  const calendarEvents = React.useMemo(() => {
    const selectedProfileIds = visibleProfileIds.length
      ? visibleProfileIds
      : [data.user.id]
    return data.calendarEvents.map((event) => {
      const visibleAssignments = event.visibleProfileAssignments?.filter(
        (assignment) => selectedProfileIds.includes(assignment.profileId),
      ).map((assignment) => ({
        ...assignment,
        profileColor: householdProfileColors.get(assignment.profileId),
      })) || []
      return {
        ...event,
        isHouseholdAccount: (familyData?.profiles?.length || 0) > 1,
        is_assigned: visibleAssignments.length > 0,
        assignment_start_time:
          visibleAssignments
            .map((assignment) => assignment.dutyStartTime)
            .filter(Boolean)
            .sort()[0] || null,
        visibleProfileAssignments: visibleAssignments,
      }
    })
  }, [
    data.calendarEvents,
    data.user.id,
    familyData?.profiles?.length,
    householdProfileColors,
    visibleProfileIds,
  ])
  const [alertsData, setAlertsData] = React.useState({ alerts: [], unreadCount: 0 })
  const [messageSummary, setMessageSummary] = React.useState({
    received: [],
    unreadCount: 0,
  })
  const [showCreateEvent, setShowCreateEvent] = React.useState(false)
  const [cloneEventDraft, setCloneEventDraft] = React.useState(null)
  const [eventView, setEventView] = React.useState("all")
  const [pinnedEventIds, setPinnedEventIds] = React.useState(() =>
    data.calendarEvents.filter((event) => event.is_pinned).map((event) => event.id),
  )
  const [pinUpdatingEventIds, setPinUpdatingEventIds] = React.useState([])
  const [pinError, setPinError] = React.useState("")
  const alertsSectionRef = React.useRef(null)
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
    () => calendarEvents.filter((event) => event.is_assigned),
    [calendarEvents]
  )
  const upcomingEvents = React.useMemo(() => {
    const now = Date.now()
    return calendarEvents.filter((event) => {
      const endTime = new Date(event.end_time || event.start_time).getTime()
      return !Number.isNaN(endTime) && endTime >= now
    })
  }, [calendarEvents])
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
  const attention = data.attention || {
    pendingRequests: 0,
    events: [],
    pendingSubRequests: 0,
    unfilledPositions: 0,
    pendingSubRequestEventIds: [],
    unfilledPositionEventIds: [],
  }
  const activeAttentionEvents = (attention.events || []).filter(
    (event) => !resolvedIssueEventIds.includes(event.id),
  )
  const activePendingRequestCount = activeAttentionEvents.reduce(
    (total, event) => total + Number(event.issueCount || 0),
    0,
  )
  const eventSectionEvents = React.useMemo(() => {
    if (eventView === "mine") return upcomingAssignments
    if (eventView === "pinned") {
      const pinnedIds = new Set(pinnedEventIds)
      return upcomingEvents.filter((event) => pinnedIds.has(event.id))
    }
    const ids = eventView === "issues"
      ? activeAttentionEvents.map((event) => event.id)
      : eventView === "sub_requests"
        ? attention.pendingSubRequestEventIds
      : eventView === "unfilled"
        ? attention.unfilledPositionEventIds
        : null
    if (!ids) return upcomingEvents
    const idSet = new Set(ids)
    return upcomingEvents.filter((event) => idSet.has(event.id))
  }, [activeAttentionEvents, attention.pendingSubRequestEventIds, attention.unfilledPositionEventIds, eventView, pinnedEventIds, upcomingAssignments, upcomingEvents])
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
        .then((result) => {
          setFamilyData(result)
          const visibilityKey = `ministry_visible_profile_ids:${result.actor.id}`
          let stored = []
          try {
            stored = JSON.parse(window.localStorage.getItem(visibilityKey) || "[]")
          } catch (error) {
            stored = []
          }
          const allowedIds = new Set(result.profiles.map((profile) => profile.id))
          const restored = Array.isArray(stored)
            ? stored.filter((id) => allowedIds.has(id))
            : []
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

  const selectSection = (id, requestedEventView = "all") => {
    setSectionId(id)
    if (id === "events") {
      setShowCreateEvent(false)
      setEventView(requestedEventView)
    }
    setMobileMenuOpen(false)
    setProfileMenuOpen(false)
    window.history.replaceState({}, "", id === "home" ? "/" : `/?section=${id}`)
  }

  const cloneEventFromDetails = (event) => {
    const ministryId = event.ministry_id || event.coordinator_ministry_id
    if (ministryId) setCreateMinistryId(ministryId)
    setCloneEventDraft(event)
    setSelectedEvent(null)
    setSectionId("events")
    setShowCreateEvent(true)
    window.history.replaceState({}, "", "/?section=events")
  }

  const openAlerts = () => {
    alertsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => alertsSectionRef.current?.focus({ preventScroll: true }), 350)
  }

  const saveVisibleProfiles = (ids) => {
    setVisibleProfileIds(ids)
    const actorId = familyData?.actor?.id || data.actor?.id || data.user.id
    window.localStorage.setItem(
      `ministry_visible_profile_ids:${actorId}`,
      JSON.stringify(ids),
    )
  }

  const toggleVisibleProfile = (profileId) => {
    if (
      visibleProfileIds.includes(profileId) &&
      visibleProfileIds.length === 1
    ) return
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

    applyMinistryTheme(result.activeProfile?.appearanceTheme)

    window.sessionStorage.setItem(MINISTRY_SESSION_KEY, result.token)
    saveVisibleProfiles(
      showAll ? familyData.profiles.map((profile) => profile.id) : [profileId],
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

  const togglePinnedEvent = async (event) => {
    const wasPinned = pinnedEventIds.includes(event.id)
    const nextPinned = !wasPinned
    setPinError("")
    setPinUpdatingEventIds((current) => [...current, event.id])
    setPinnedEventIds((current) =>
      nextPinned
        ? [...new Set([...current, event.id])]
        : current.filter((eventId) => eventId !== event.id),
    )

    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("scheduling/events"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "set_pin",
          eventId: event.id,
          pinned: nextPinned,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to update this pin")
      }
    } catch (error) {
      setPinnedEventIds((current) =>
        wasPinned
          ? [...new Set([...current, event.id])]
          : current.filter((eventId) => eventId !== event.id),
      )
      setPinError(error.message)
    } finally {
      setPinUpdatingEventIds((current) =>
        current.filter((eventId) => eventId !== event.id),
      )
    }
  }

  const guardianProfileName =
    [data.actor?.firstName, data.actor?.lastName].filter(Boolean).join(" ") ||
    data.actor?.username ||
    "my profile"
  const isViewingManagedProfile = Boolean(
    data.isManagedProfile &&
      data.actor?.id &&
      currentUser?.id &&
      data.actor.id !== currentUser.id,
  )

  const renderProfileMenu = (positionClassName) => {
    if (!profileMenuOpen) return null

    return (
      <div
        className={`ministry-profile-menu absolute z-50 rounded-xl border border-gray-200 bg-white text-left shadow-xl ${positionClassName}`}
      >
        {isViewingManagedProfile && (
          <button
            type="button"
            onClick={returnToGuardian}
            className="w-full rounded-t-xl bg-[#f7f3ef] px-4 py-3 text-left text-sm font-semibold text-[#6f4f34] hover:bg-[#f1e8df]"
          >
            Return to {guardianProfileName}
          </button>
        )}
        {familyData?.profiles?.length > 0 && (
          <>
          <button
            type="button"
            onClick={() => switchProfile(familyData.actor.id, true)}
            className="w-full border-b border-gray-100 px-4 py-3 text-left text-sm font-semibold text-[#6f4f34] hover:bg-[#f7f3ef]"
          >
            All Members
          </button>
          <div className="max-h-72 overflow-y-auto p-2">
            {familyData.profiles.map((profile) => {
              const active = familyData.activeProfile.id === profile.id
              const visible = visibleProfileIds.includes(profile.id)
              return (
                <div key={profile.id} className="flex items-center gap-1 rounded-lg hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => toggleVisibleProfile(profile.id)}
                    aria-label={`${visible ? "Hide" : "Show"} ${profile.firstName} ${profile.lastName} assignments`}
                    className="p-2 text-gray-500 hover:text-[#896542]"
                  >
                    {visible ? <EyeIcon className="size-5" /> : <EyeSlashIcon className="size-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchProfile(profile.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm ${
                      active ? "font-semibold text-[#6f4f34]" : "text-gray-700"
                    }`}
                  >
                  {familyData.profiles.length > 1 && (
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: householdProfileColors.get(profile.id) }}
                      aria-hidden="true"
                    />
                  )}
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
                  <span className="min-w-0 flex-1 truncate">
                    {profile.firstName} {profile.lastName}
                  </span>
                  {active && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#896542]">
                      Active
                    </span>
                  )}
                  </button>
                </div>
              )
            })}
          </div>
          </>
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
    )
  }

  let content
  if (sectionId === "home") {
    content = (
      <div className="space-y-8">
        <section aria-labelledby="dashboard-actions-title">
          <h2 id="dashboard-actions-title" className="mb-3 century-font text-2xl text-gray-950">
            Your Ministry
          </h2>
          <div className={`grid grid-cols-2 gap-3 ${canManageMembers ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
            <DashboardAction
              icon={ChatBubbleLeftRightIcon}
              count={messageSummary.unreadCount || 0}
              label="Unread Messages"
              onClick={() => selectSection("messages")}
              urgent={messageSummary.unreadCount > 0}
            />
            <DashboardAction
              icon={CalendarDaysIcon}
              count={upcomingAssignments.length}
              label="My Assignments"
              onClick={() => selectSection("events", "mine")}
            />
            <DashboardAction
              icon={BellAlertIcon}
              count={alertsData.unreadCount || 0}
              label="Pending Alerts"
              onClick={openAlerts}
              urgent={alertsData.unreadCount > 0}
            />
            {canManageMembers && (
              <DashboardAction
                icon={ExclamationTriangleIcon}
                count={activePendingRequestCount}
                label="Pending Requests"
                onClick={() => selectSection("events", "issues")}
                urgent={activePendingRequestCount > 0}
              />
            )}
          </div>
        </section>
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
          <div ref={alertsSectionRef} tabIndex={-1} className="scroll-mt-4 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">
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
          </div>
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
        events={calendarEvents}
        onEventSelect={setSelectedEvent}
      />
    )
  } else if (sectionId === "events") {
    const createMinistry = manageableMinistries.find(
      (ministry) => ministry.id === createMinistryId,
    )
    const canCreateEvents = manageableMinistries.length > 0
    const eventActions = [
      {
        id: "all",
        label: "All Events",
        icon: CalendarDaysIcon,
        active: !showCreateEvent && eventView === "all",
        onClick: () => {
          setShowCreateEvent(false)
          setEventView("all")
        },
      },
      {
        id: "mine",
        label: "My Events",
        icon: CheckCircleIcon,
        active: !showCreateEvent && eventView === "mine",
        onClick: () => {
          setShowCreateEvent(false)
          setEventView("mine")
        },
      },
      {
        id: "pinned",
        label: "Pinned Events",
        icon: StarIcon,
        active: !showCreateEvent && eventView === "pinned",
        onClick: () => {
          setShowCreateEvent(false)
          setEventView("pinned")
        },
      },
      {
        id: "create",
        label: "Create Event",
        icon: PlusIcon,
        active: showCreateEvent,
        hidden: !canCreateEvents,
        onClick: () => {
          setCloneEventDraft(null)
          setShowCreateEvent(true)
        },
      },
    ]
    content = showCreateEvent && canCreateEvents && createMinistry ? (
      <div className="space-y-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-0">
        <MinistrySectionActions label="Event actions" actions={eventActions} />
        <MinistryEvents
          key={createMinistry.id}
          data={{ ministry: createMinistry, user: currentUser }}
          activeAction={
            cloneEventDraft
              ? { id: "clone-event", label: "Clone event", event: cloneEventDraft }
              : { id: "add-event", label: "Create event" }
          }
          onEventSelect={setSelectedEvent}
        />
      </div>
    ) : (
      <div className="flex h-full min-h-0 flex-col gap-5 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] lg:pb-0">
        <MinistrySectionActions
          label="Event actions"
          actions={eventActions}
        />
        {eventView === "issues" && (
          <div className="flex shrink-0 justify-center">
            <span className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
              Pending requests needing attention
            </span>
          </div>
        )}
        {pinError && (
          <p role="alert" className="shrink-0 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {pinError}
          </p>
        )}
        {eventView === "issues" ? (
          <PendingRequestList
            events={activeAttentionEvents}
            onEventSelect={setSelectedEvent}
          />
        ) : (
        <MinistryEventAgenda
          events={eventSectionEvents}
          label={eventView === "mine" ? "My events" : eventView === "pinned" ? "Pinned events" : "Available events"}
          emptyTitle={eventView === "mine" ? "No assigned events" : eventView === "pinned" ? "No pinned events" : "Nothing needs attention"}
          emptyText={eventView === "mine" ? "Upcoming duties assigned to this profile will appear here." : eventView === "pinned" ? "Use the star on an upcoming event to keep it in this profile's pinned list." : "There are no events matching this filter."}
          onEventSelect={setSelectedEvent}
          showDateRail
          useAssignmentTime={eventView === "mine"}
          pinnedEventIds={pinnedEventIds}
          pinUpdatingEventIds={pinUpdatingEventIds}
          onTogglePin={togglePinnedEvent}
        />
        )}
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
        canAddMinistry={currentUser.globalRole === "super_admin"}
      />
    )
  } else if (sectionId === "members") {
    content = <MinistryGlobalMembers />
  } else if (sectionId === "profile") {
    content = (
      <MinistryProfile
        initialUser={currentUser}
        onUserUpdate={setCurrentUser}
      />
    )
  } else if (sectionId === "chapel-settings" && isSuperAdmin) {
    content = <ChapelSettings />
  } else {
    content = <MinistrySupport />
  }

  return (
    <div className="ministry-app-viewport overflow-hidden bg-white text-gray-900">
      <div className="mx-auto flex h-full w-full max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-gray-100 bg-white lg:block">
          <div className="ministry-scroll-region sticky top-0 flex max-h-full flex-col overflow-y-auto px-4 py-6">
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
                    data-guide-id={`account-nav-${section.id}`}
                    onClick={() => selectSection(section.id)}
                    aria-current={active ? "page" : undefined}
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
          <header className="ministry-responsive-header flex shrink-0 items-center border-b border-gray-100 bg-white px-4 py-2 lg:px-6 lg:py-5">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                data-guide-id="account-menu"
                onClick={() => setMobileMenuOpen(true)}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#6f4f34] lg:hidden"
              >
                <Bars3Icon className="size-5 shrink-0" />
                <span className="text-left leading-tight">{activeSection.label}</span>
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

              {renderProfileMenu("right-0 top-full mt-2")}
            </div>
          </header>

          <MinistryConflictTicker
            profileId={currentUser?.id}
            onOpenAvailability={() => selectSection("availability")}
            onOpenPrioryConflicts={() => selectSection("events")}
          />

          <div
            className={`min-h-0 flex-1 px-4 pb-5 lg:px-6 ${
              ["calendar", "events", "messages", "ministries", "availability", "members"].includes(sectionId)
                ? "pt-0"
                : "pt-5"
            } ${
              sectionId === "calendar" ||
              (sectionId === "events" && !showCreateEvent)
                ? "overflow-hidden"
                : "ministry-scroll-region overflow-y-auto"
            }`}
          >
            {content}
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
          <div ref={mobileMenuRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="home-mobile-menu-title" className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#e6ddd4] p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C1A387]">
                  Ministry workspace
                </p>
                <h2 id="home-mobile-menu-title" className="mt-1 century-font text-2xl text-[#6f4f34]">
                  Ministries
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
              {availableSections.map((section) => {
                const Icon = section.icon
                const active = section.id === activeSection.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    data-guide-id={`account-nav-${section.id}`}
                    onClick={() => selectSection(section.id)}
                    aria-current={active ? "page" : undefined}
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
        onClone={cloneEventFromDetails}
        onIssuesResolved={(eventId) =>
          setResolvedIssueEventIds((current) => [...new Set([...current, eventId])])
        }
      />
    </div>
  )
}

export default MinistryHomeWorkspace
