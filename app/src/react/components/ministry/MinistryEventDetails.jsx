import * as React from "react"
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryOrdoReference from "./MinistryOrdoReference"

const blankResponsibility = {
  responsibilityId: "",
  ministryId: "",
  name: "",
  responsibilityType: "position",
  quantityNeeded: 1,
  approvalRequired: false,
  isRequired: true,
  requiredLevelId: "",
  relativeStartMinutes: 0,
  instructions: "",
}

const MinistryEventDetails = ({ event, ministryName, onClose }) => {
  const [details, setDetails] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSavingResponsibility, setIsSavingResponsibility] =
    React.useState(false)
  const [responsibilityForm, setResponsibilityForm] =
    React.useState(null)
  const [assignmentSelections, setAssignmentSelections] =
    React.useState({})
  const [savingAssignmentId, setSavingAssignmentId] =
    React.useState("")
  const [signupCode, setSignupCode] = React.useState("")
  const [isSavingSignup, setIsSavingSignup] = React.useState(false)
  const [isPresented, setIsPresented] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const closeTimer = React.useRef(null)

  const loadDetails = React.useCallback(async () => {
    if (!event?.id) {
      setDetails(null)
      return
    }
    setIsLoading(true)
    setErrorMessage("")
    try {
      const url = new URL(
        getFunctionEndpoint("scheduling/events"),
        window.location.origin,
      )
      url.searchParams.set("eventId", event.id)
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${window.sessionStorage.getItem(
            MINISTRY_SESSION_KEY,
          )}`,
        },
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to load event")
      }
      setDetails(result)
      setSignupCode(result.signup_code || "")
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [event?.id])

  React.useEffect(() => {
    setResponsibilityForm(null)
    setMessage("")
    loadDetails()
  }, [loadDetails])

  React.useEffect(() => {
    if (!event?.id) {
      setIsPresented(false)
      return undefined
    }
    const frame = window.requestAnimationFrame(() => setIsPresented(true))
    return () => window.cancelAnimationFrame(frame)
  }, [event?.id])

  React.useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    },
    [],
  )

  if (!event) return null

  const closeDetails = () => {
    setIsPresented(false)
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(onClose, 300)
  }

  const displayedEvent = details || event

  const start = new Date(displayedEvent.start_time)
  const end = new Date(displayedEvent.end_time)

  const setScheduleStatus = async (ministryId, status) => {
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.sessionStorage.getItem(
              MINISTRY_SESSION_KEY,
            )}`,
          },
          body: JSON.stringify({
            action: "set_schedule_status",
            eventId: displayedEvent.id,
            ministryId,
            status,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to update schedule")
      }
      setDetails((current) => ({
        ...current,
        ministries: current.ministries.map((ministry) =>
          ministry.ministryId === ministryId
            ? { ...ministry, scheduleStatus: status }
            : ministry,
        ),
      }))
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const manageableMinistries = (details?.ministries || []).filter(
    (ministry) => ministry.canManage,
  )
  const eventCanChange =
    !["cancelled", "completed", "archived"].includes(
      displayedEvent.status,
    ) && manageableMinistries.length > 0

  const startAddingResponsibility = () => {
    setMessage("")
    setErrorMessage("")
    setResponsibilityForm({
      ...blankResponsibility,
      ministryId: manageableMinistries[0]?.ministryId || "",
    })
  }

  const startEditingResponsibility = (responsibility) => {
    setMessage("")
    setErrorMessage("")
    setResponsibilityForm({
      responsibilityId: responsibility.id,
      ministryId: responsibility.ministryId,
      name: responsibility.name,
      responsibilityType: responsibility.responsibilityType,
      quantityNeeded: responsibility.quantityNeeded,
      approvalRequired: responsibility.approvalRequired,
      isRequired: responsibility.isRequired,
      requiredLevelId: responsibility.requiredLevelId || "",
      relativeStartMinutes: responsibility.relativeStartMinutes,
      instructions: responsibility.instructions,
    })
  }

  const updateResponsibilityField = (field, value) =>
    setResponsibilityForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "ministryId" ? { requiredLevelId: "" } : {}),
    }))

  const saveResponsibility = async (submitEvent) => {
    submitEvent.preventDefault()
    setIsSavingResponsibility(true)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.sessionStorage.getItem(
              MINISTRY_SESSION_KEY,
            )}`,
          },
          body: JSON.stringify({
            action: responsibilityForm.responsibilityId
              ? "update_responsibility"
              : "add_responsibility",
            eventId: displayedEvent.id,
            ...responsibilityForm,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to save responsibility")
      }
      setMessage(result.message)
      setResponsibilityForm(null)
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSavingResponsibility(false)
    }
  }

  const cancelResponsibility = async (responsibility) => {
    const confirmed = window.confirm(
      `Cancel "${responsibility.name}" for this event? Active assignments will also be cancelled, but history will be retained.`,
    )
    if (!confirmed) return

    setIsSavingResponsibility(true)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.sessionStorage.getItem(
              MINISTRY_SESSION_KEY,
            )}`,
          },
          body: JSON.stringify({
            action: "cancel_responsibility",
            eventId: displayedEvent.id,
            responsibilityId: responsibility.id,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to cancel responsibility")
      }
      setMessage(result.message)
      setResponsibilityForm(null)
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSavingResponsibility(false)
    }
  }

  const assignMember = async (responsibility) => {
    const userId = assignmentSelections[responsibility.id]
    if (!userId) return
    setSavingAssignmentId(responsibility.id)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.sessionStorage.getItem(
              MINISTRY_SESSION_KEY,
            )}`,
          },
          body: JSON.stringify({
            action: "assign_member",
            eventId: displayedEvent.id,
            responsibilityId: responsibility.id,
            userId,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to assign member")
      }
      setMessage(result.message)
      setAssignmentSelections((current) => ({
        ...current,
        [responsibility.id]: "",
      }))
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSavingAssignmentId("")
    }
  }

  const recordServiceOutcome = async (assignment, outcome) => {
    if (!outcome) return
    setSavingAssignmentId(assignment.id)
    setMessage("")
    setErrorMessage("")
    try {
      const note =
        outcome === "substitute_served"
          ? window.prompt("Who served as the informal substitute?", "") || ""
          : ""
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.sessionStorage.getItem(
              MINISTRY_SESSION_KEY,
            )}`,
          },
          body: JSON.stringify({
            action: "record_service_outcome",
            eventId: displayedEvent.id,
            assignmentId: assignment.id,
            outcome,
            note,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to record service outcome")
      }
      setMessage(result.message)
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSavingAssignmentId("")
    }
  }

  const recordAssignmentStatus = async (assignment, status) => {
    if (!status) return
    setSavingAssignmentId(assignment.id)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(getFunctionEndpoint("scheduling/events"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${window.sessionStorage.getItem(
            MINISTRY_SESSION_KEY,
          )}`,
        },
        body: JSON.stringify({
          action: "record_assignment_status",
          eventId: displayedEvent.id,
          assignmentId: assignment.id,
          status,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to update assignment")
      setMessage(result.message)
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSavingAssignmentId("")
    }
  }

  const configureVolunteerSignup = async (signupOpen) => {
    setIsSavingSignup(true)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(getFunctionEndpoint("scheduling/events"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${window.sessionStorage.getItem(
            MINISTRY_SESSION_KEY,
          )}`,
        },
        body: JSON.stringify({
          action: "configure_volunteer_signup",
          eventId: displayedEvent.id,
          signupCode,
          signupOpen,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to save volunteer link")
      setMessage(result.message)
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSavingSignup(false)
    }
  }

  const volunteerUrl = signupCode
    ? `${window.location.origin}/volunteer/${signupCode}`
    : ""

  const copyVolunteerUrl = async () => {
    if (!volunteerUrl) return
    await navigator.clipboard.writeText(volunteerUrl)
    setMessage("Volunteer link copied")
  }

  const groupedResponsibilities = (details?.responsibilities || []).reduce(
    (groups, responsibility) => {
      const key = responsibility.ministryId || "unassigned"
      if (!groups[key]) {
        groups[key] = {
          ministryName: responsibility.ministryName || ministryName,
          items: [],
        }
      }
      groups[key].items.push(responsibility)
      return groups
    },
    {},
  )
  const readiness = (details?.responsibilities || []).reduce(
    (summary, responsibility) => {
      if (responsibility.isRequired) {
        summary.shortages += Math.max(
          0,
          responsibility.quantityNeeded - responsibility.assignedQuantity,
        )
      }
      summary.backups += responsibility.availableMembers?.length || 0
      if (!responsibility.templateResponsibilityId) summary.overrides += 1
      for (const assignment of responsibility.assignments || []) {
        summary.conflicts += assignment.conflictCount || 0
        if (assignment.status === "change_requested") {
          summary.changeRequests += 1
        }
      }
      return summary
    },
    { shortages: 0, backups: 0, conflicts: 0, overrides: 0, changeRequests: 0 },
  )
  const eventHasStarted = start.getTime() <= Date.now()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${displayedEvent.title} event details`}
      className={`fixed inset-0 z-[90] overflow-y-auto bg-white transition-transform duration-300 ease-out lg:transition-none ${
        isPresented ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={closeDetails}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#6f4f34] hover:bg-gray-50"
        >
          <ArrowLeftIcon className="size-5" />
          Schedule
        </button>
        <p className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-[#896542] sm:block">
          {ministryName}
        </p>
        <button
          type="button"
          onClick={closeDetails}
          aria-label="Close event details"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-50"
        >
          <XMarkIcon className="size-5" />
        </button>
      </header>

      <main className="mx-auto w-11/12 max-w-3xl py-8 sm:py-12">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#f4ede6] px-3 py-1 text-xs font-semibold uppercase text-[#896542]">
            {displayedEvent.status}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-500">
            {displayedEvent.participation_type}
          </span>
        </div>
        <h1 className="mt-5 century-font text-4xl leading-tight text-gray-950 sm:text-5xl">
          {displayedEvent.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
          {displayedEvent.description ||
            "No event description has been added yet."}
        </p>

        {errorMessage && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {message}
          </p>
        )}

        <div className="mt-8">
          <MinistryOrdoReference
            eventId={displayedEvent.id}
            startTime={displayedEvent.start_time}
          />
        </div>

        {details?.canManageEvent &&
          ["volunteers", "both"].includes(displayedEvent.participation_type) && (
            <section className="mt-8 rounded-2xl border border-[#d8c7b8] bg-[#fbf8f4] p-5">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-white p-2 text-[#896542]">
                  <LinkIcon className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
                    Public volunteers
                  </p>
                  <h2 className="mt-1 century-font text-2xl text-gray-950">
                    Volunteer signup link
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Choose an available URL. Volunteers are recorded only for this event and do not become Ministry members.
                  </p>
                </div>
              </div>
              <label className="mt-5 block text-sm font-semibold text-gray-700">
                Public URL
                <div className="mt-2 flex rounded-xl border border-gray-200 bg-white focus-within:border-[#896542]">
                  <span className="hidden items-center border-r border-gray-100 px-3 text-sm text-gray-400 sm:flex">
                    {window.location.origin}/volunteer/
                  </span>
                  <input
                    value={signupCode}
                    onChange={(event) =>
                      setSignupCode(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-")
                          .replace(/-+/g, "-"),
                      )
                    }
                    minLength={4}
                    maxLength={64}
                    placeholder="parish-picnic-2026"
                    className="h-11 min-w-0 flex-1 rounded-xl px-3 font-normal outline-none"
                  />
                </div>
              </label>
              {displayedEvent.signup_code && (
                <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-600">
                  {`${window.location.origin}/volunteer/${displayedEvent.signup_code}`}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSavingSignup || signupCode.length < 4}
                  onClick={() => configureVolunteerSignup(false)}
                  className="rounded-lg border border-[#d8c7b8] bg-white px-3 py-2 text-sm font-semibold text-[#6f4f34] disabled:opacity-50"
                >
                  Save closed
                </button>
                <button
                  type="button"
                  disabled={isSavingSignup || signupCode.length < 4}
                  onClick={() => configureVolunteerSignup(!displayedEvent.signup_open)}
                  className="rounded-lg bg-[#896542] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {displayedEvent.signup_open ? "Close signups" : "Save and open signups"}
                </button>
                {displayedEvent.signup_code && (
                  <button
                    type="button"
                    onClick={copyVolunteerUrl}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    <ClipboardDocumentIcon className="size-4" /> Copy link
                  </button>
                )}
              </div>
              {displayedEvent.status !== "published" && (
                <p className="mt-3 text-xs font-semibold text-amber-700">
                  Save the URL now, then publish the event before opening signups.
                </p>
              )}
            </section>
          )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-2xl border border-gray-100 p-4">
            <CalendarDaysIcon className="size-6 shrink-0 text-[#896542]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Date
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }).format(start)}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-gray-100 p-4">
            <ClockIcon className="size-6 shrink-0 text-[#896542]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Time
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {new Intl.DateTimeFormat("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(start)}{" "}
                –{" "}
                {new Intl.DateTimeFormat("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(end)}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-gray-100 p-4 sm:col-span-2">
            <MapPinIcon className="size-6 shrink-0 text-[#896542]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Location
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {displayedEvent.location || "Location not set"}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-10 border-t border-gray-100 pt-8">
          {details?.canManageEvent && (
            <div className="mb-7 rounded-2xl border border-[#d8c7b8] bg-[#fbf8f4] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
                Pre-publication review
              </p>
              <h2 className="mt-2 century-font text-2xl text-gray-950">
                Schedule readiness
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["Shortages", readiness.shortages],
                  ["Backup options", readiness.backups],
                  ["Conflicts", readiness.conflicts],
                  ["Overrides", readiness.overrides],
                  ["Change requests", readiness.changeRequests],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white p-3 text-center">
                    <p className="text-2xl font-semibold text-gray-900">{value}</p>
                    <p className="mt-1 text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Review shortages, overlapping assignments, event-only overrides,
                and the available backup pool before publishing.
              </p>
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
            Participating ministries
          </p>
          <h2 className="mt-2 century-font text-2xl text-gray-950">
            One event, coordinated schedules
          </h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-gray-500">
              Loading responsibilities...
            </p>
          ) : details?.ministries?.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {details.ministries.map((ministry) => (
                <article
                  key={ministry.ministryId}
                  className="rounded-2xl border border-gray-100 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {ministry.ministryName}
                      </h3>
                      <p className="mt-1 text-xs uppercase text-gray-500">
                        {ministry.scheduleStatus.replaceAll("_", " ")}
                      </p>
                    </div>
                    {ministry.isRequired && (
                      <span className="rounded-full bg-[#f4ede6] px-2 py-1 text-[10px] font-semibold uppercase text-[#896542]">
                        Required
                      </span>
                    )}
                  </div>
                  {ministry.canManage && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setScheduleStatus(ministry.ministryId, "ready")
                        }
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-[#C1A387]"
                      >
                        Mark ready
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setScheduleStatus(
                            ministry.ministryId,
                            "published",
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-[#896542] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6f4f34]"
                      >
                        <CheckCircleIcon className="size-4" />
                        Publish schedule
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-10 border-t border-gray-100 pt-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
                Responsibilities
              </p>
              <h2 className="mt-2 century-font text-2xl text-gray-950">
                {details?.responsibilities?.length ||
                  displayedEvent.responsibility_count ||
                  0}{" "}
                responsibilities
              </h2>
            </div>
            {eventCanChange && !responsibilityForm && (
              <button
                type="button"
                onClick={startAddingResponsibility}
                className="inline-flex items-center gap-2 rounded-lg bg-[#896542] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34]"
              >
                <PlusIcon className="size-4" />
                Add responsibility
              </button>
            )}
          </div>

          {responsibilityForm && (
            <form
              onSubmit={saveResponsibility}
              className="mt-5 rounded-xl border border-gray-100 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">
                  Responsibility
                  <input
                    value={responsibilityForm.name}
                    onChange={(event) =>
                      updateResponsibilityField("name", event.target.value)
                    }
                    required
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3 font-normal outline-none focus:border-[#896542]"
                  />
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Ministry
                  <select
                    value={responsibilityForm.ministryId}
                    onChange={(event) =>
                      updateResponsibilityField(
                        "ministryId",
                        event.target.value,
                      )
                    }
                    required
                    disabled={Boolean(
                      responsibilityForm.responsibilityId,
                    )}
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal disabled:bg-gray-50"
                  >
                    {manageableMinistries.map((ministry) => (
                      <option
                        key={ministry.ministryId}
                        value={ministry.ministryId}
                      >
                        {ministry.ministryName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Type
                  <select
                    value={responsibilityForm.responsibilityType}
                    onChange={(event) =>
                      updateResponsibilityField(
                        "responsibilityType",
                        event.target.value,
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
                  >
                    <option value="position">Position</option>
                    <option value="task">Task</option>
                    <option value="food">Food or supply</option>
                    <option value="time_slot">Time slot</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={responsibilityForm.quantityNeeded}
                    onChange={(event) =>
                      updateResponsibilityField(
                        "quantityNeeded",
                        Number(event.target.value),
                      )
                    }
                    required
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Required ministry level
                  <select
                    value={responsibilityForm.requiredLevelId || ""}
                    onChange={(event) =>
                      updateResponsibilityField(
                        "requiredLevelId",
                        event.target.value,
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
                  >
                    <option value="">No level required</option>
                    {(details?.levels || [])
                      .filter(
                        (level) =>
                          level.ministryId ===
                          responsibilityForm.ministryId,
                      )
                      .map((level) => (
                        <option key={level.id} value={level.id}>
                          Level {level.rankOrder} · {level.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Minutes relative to event
                  <input
                    type="number"
                    value={responsibilityForm.relativeStartMinutes}
                    onChange={(event) =>
                      updateResponsibilityField(
                        "relativeStartMinutes",
                        Number(event.target.value),
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                  Instructions
                  <input
                    value={responsibilityForm.instructions}
                    onChange={(event) =>
                      updateResponsibilityField(
                        "instructions",
                        event.target.value,
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3 font-normal"
                  />
                </label>
                <div className="flex flex-wrap gap-4 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={responsibilityForm.isRequired}
                      onChange={(event) =>
                        updateResponsibilityField(
                          "isRequired",
                          event.target.checked,
                        )
                      }
                      className="size-4 accent-[#896542]"
                    />
                    Required responsibility
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={responsibilityForm.approvalRequired}
                      onChange={(event) =>
                        updateResponsibilityField(
                          "approvalRequired",
                          event.target.checked,
                        )
                      }
                      className="size-4 accent-[#896542]"
                    />
                    Leader approval required
                  </label>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSavingResponsibility}
                  className="rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34] disabled:opacity-50"
                >
                  {isSavingResponsibility
                    ? "Saving..."
                    : responsibilityForm.responsibilityId
                      ? "Update responsibility"
                      : "Add responsibility"}
                </button>
                <button
                  type="button"
                  onClick={() => setResponsibilityForm(null)}
                  disabled={isSavingResponsibility}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-[#C1A387]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-5 space-y-6">
            {Object.entries(groupedResponsibilities).map(
              ([ministryId, group]) => (
                <div key={ministryId}>
                  <h3 className="font-semibold text-[#6f4f34]">
                    {group.ministryName}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {group.items.map((responsibility) => {
                      const canManage = manageableMinistries.some(
                        (ministry) =>
                          ministry.ministryId ===
                          responsibility.ministryId,
                      )
                      const openSlots = Math.max(
                        0,
                        responsibility.quantityNeeded -
                          responsibility.assignedQuantity,
                      )
                      return (
                        <article
                          key={responsibility.id}
                          className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-gray-900">
                                {responsibility.name}
                              </p>
                              {!responsibility.templateResponsibilityId && (
                                <span className="rounded-full bg-[#f4ede6] px-2 py-1 text-[10px] font-semibold uppercase text-[#896542]">
                                  Event only
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              {responsibility.responsibilityType.replaceAll(
                                "_",
                                " ",
                              )}{" "}
                              · {responsibility.assignedQuantity}/
                              {responsibility.quantityNeeded} assigned
                              {responsibility.requiredLevelName
                                ? ` · Requires ${responsibility.requiredLevelName} or higher`
                                : ""}
                            </p>
                            {responsibility.instructions && (
                              <p className="mt-1 text-sm text-gray-500">
                                {responsibility.instructions}
                              </p>
                            )}
                            {responsibility.assignments?.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {responsibility.assignments.map(
                                  (assignment) => (
                                    <div
                                      key={assignment.id}
                                      className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f4ede6] px-3 py-2 text-xs text-[#6f4f34]"
                                    >
                                      <span className="font-semibold">
                                        {assignment.firstName} {assignment.lastName}
                                      </span>
                                      <span>· {assignment.status.replaceAll("_", " ")}</span>
                                      {assignment.isVolunteer && (
                                        <span className="w-full text-[11px] text-gray-600">
                                          Volunteer · {assignment.volunteerEmail} · {assignment.volunteerPhone}
                                          {assignment.notifyEmail ? " · Email updates allowed" : ""}
                                          {assignment.notifySms ? " · SMS updates allowed" : ""}
                                        </span>
                                      )}
                                      {assignment.conflictCount > 0 && (
                                        <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">
                                          Schedule conflict
                                        </span>
                                      )}
                                      {assignment.serviceOutcome && (
                                        <span className="rounded-full bg-white px-2 py-1">
                                          {assignment.serviceOutcome.replaceAll("_", " ")}
                                        </span>
                                      )}
                                      {canManage && !eventHasStarted && (
                                        <select
                                          aria-label={`Offline response for ${assignment.firstName} ${assignment.lastName}`}
                                          value={["confirmed", "declined"].includes(assignment.status) ? assignment.status : ""}
                                          disabled={savingAssignmentId === assignment.id}
                                          onChange={(event) => recordAssignmentStatus(assignment, event.target.value)}
                                          className="ml-auto h-8 rounded-lg border border-[#d8c7b8] bg-white px-2 text-xs"
                                        >
                                          <option value="">Record offline response</option>
                                          <option value="confirmed">Confirmed</option>
                                          <option value="declined">Declined</option>
                                        </select>
                                      )}
                                      {canManage && eventHasStarted && (
                                        <select
                                          aria-label={`Service outcome for ${assignment.firstName} ${assignment.lastName}`}
                                          value={assignment.serviceOutcome || ""}
                                          disabled={savingAssignmentId === assignment.id}
                                          onChange={(event) =>
                                            recordServiceOutcome(
                                              assignment,
                                              event.target.value,
                                            )
                                          }
                                          className="ml-auto h-8 rounded-lg border border-[#d8c7b8] bg-white px-2 text-xs"
                                        >
                                          <option value="">Record outcome</option>
                                          <option value="served">Served</option>
                                          <option value="no_show">No-show</option>
                                          <option value="substitute_served">Substitute served</option>
                                          <option value="excused">Excused</option>
                                        </select>
                                      )}
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                            {canManage &&
                              eventCanChange &&
                              responsibility.status !== "cancelled" &&
                              openSlots > 0 && (
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                  <select
                                    aria-label={`Available members for ${responsibility.name}`}
                                    value={
                                      assignmentSelections[
                                        responsibility.id
                                      ] || ""
                                    }
                                    onChange={(event) =>
                                      setAssignmentSelections((current) => ({
                                        ...current,
                                        [responsibility.id]:
                                          event.target.value,
                                      }))
                                    }
                                    className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                                  >
                                    <option value="">
                                      {responsibility.availableMembers?.length
                                        ? "Choose available member"
                                        : "No available members"}
                                    </option>
                                    {responsibility.availableMembers?.map(
                                      (member) => (
                                        <option
                                          key={member.userId}
                                          value={member.userId}
                                        >
                                          {member.firstName} {member.lastName}
                                          {member.highestLevelName
                                            ? ` · ${member.highestLevelName}`
                                            : ""}
                                          {member.sameTimeReliability?.recorded >= 2
                                            ? ` · ${member.sameTimeReliability.percent}% at ${member.sameTimeReliability.time}`
                                            : member.reliability?.recorded >= 3
                                              ? ` · ${member.reliability.percent}% reliable`
                                              : ""}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={
                                      !assignmentSelections[
                                        responsibility.id
                                      ] ||
                                      savingAssignmentId ===
                                        responsibility.id
                                    }
                                    onClick={() =>
                                      assignMember(responsibility)
                                    }
                                    className="rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34] disabled:opacity-50"
                                  >
                                    {savingAssignmentId ===
                                    responsibility.id
                                      ? "Assigning..."
                                      : "Assign"}
                                  </button>
                                </div>
                              )}
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {canManage &&
                              eventCanChange &&
                              responsibility.status !== "cancelled" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditingResponsibility(
                                        responsibility,
                                      )
                                    }
                                    aria-label={`Edit ${responsibility.name}`}
                                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-[#C1A387] hover:text-[#896542]"
                                  >
                                    <PencilSquareIcon className="size-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      cancelResponsibility(responsibility)
                                    }
                                    disabled={isSavingResponsibility}
                                    aria-label={`Cancel ${responsibility.name}`}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                  >
                                    <TrashIcon className="size-4" />
                                  </button>
                                </>
                              )}
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs uppercase text-gray-500">
                              {responsibility.status}
                            </span>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default MinistryEventDetails
