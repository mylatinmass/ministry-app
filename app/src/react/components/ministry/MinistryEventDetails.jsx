import * as React from "react"
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const blankResponsibility = {
  responsibilityId: "",
  ministryId: "",
  name: "",
  responsibilityType: "position",
  quantityNeeded: 1,
  approvalRequired: false,
  isRequired: true,
  requiredQualification: "",
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
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

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

  if (!event) return null

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
      requiredQualification: responsibility.requiredQualification,
      relativeStartMinutes: responsibility.relativeStartMinutes,
      instructions: responsibility.instructions,
    })
  }

  const updateResponsibilityField = (field, value) =>
    setResponsibilityForm((current) => ({
      ...current,
      [field]: value,
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

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={onClose}
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
          onClick={onClose}
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
                  Required qualification
                  <input
                    value={responsibilityForm.requiredQualification}
                    onChange={(event) =>
                      updateResponsibilityField(
                        "requiredQualification",
                        event.target.value,
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3 font-normal"
                  />
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
                              {responsibility.requiredQualification
                                ? ` · ${responsibility.requiredQualification}`
                                : ""}
                            </p>
                            {responsibility.instructions && (
                              <p className="mt-1 text-sm text-gray-500">
                                {responsibility.instructions}
                              </p>
                            )}
                            {responsibility.assignments?.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {responsibility.assignments.map(
                                  (assignment) => (
                                    <span
                                      key={assignment.id}
                                      className="rounded-full bg-[#f4ede6] px-2 py-1 text-xs text-[#6f4f34]"
                                    >
                                      {assignment.firstName}{" "}
                                      {assignment.lastName} ·{" "}
                                      {assignment.status.replaceAll("_", " ")}
                                    </span>
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
