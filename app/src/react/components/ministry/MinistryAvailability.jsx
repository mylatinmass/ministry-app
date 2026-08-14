import * as React from "react"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  NoSymbolIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import useAccessibleDialog from "../../hooks/useAccessibleDialog"

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

const toDateKey = (value) => {
  if (typeof value === "string") {
    const dateKey = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (dateKey) return dateKey
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const toDate = (key) => {
  const dateKey = toDateKey(key)
  return dateKey ? new Date(`${dateKey}T12:00:00`) : null
}

const getMonthCells = (month) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

const formatDate = (key, options = {}) => {
  const date = toDate(key)
  if (!date || Number.isNaN(date.getTime())) return "Date unavailable"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(date)
}

const formatDutyTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Time unavailable"
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

const normalizeAvailability = (result) => ({
  ...result,
  blocks: (result.blocks || [])
    .map((block) => ({
      ...block,
      startDate: toDateKey(block.startDate),
      endDate: toDateKey(block.endDate),
    }))
    .filter((block) => block.startDate && block.endDate),
  assignments: (result.assignments || [])
    .map((assignment) => ({
      ...assignment,
      date: toDateKey(assignment.date || assignment.startTime),
    }))
    .filter((assignment) => assignment.date),
})

const sortedRange = (first, second) =>
  first <= second
    ? { startDate: first, endDate: second }
    : { startDate: second, endDate: first }

const MinistryAvailability = ({ ministryId = "", canManageMembers = false }) => {
  const [availability, setAvailability] = React.useState({
    user: null,
    blocks: [],
    assignments: [],
  })
  const [visibleMonth, setVisibleMonth] = React.useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [showsTwoMonths, setShowsTwoMonths] = React.useState(false)
  const [selectionStart, setSelectionStart] = React.useState("")
  const [selectionEnd, setSelectionEnd] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [scopeMinistryId, setScopeMinistryId] = React.useState("")
  const [selectedMemberIds, setSelectedMemberIds] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [pendingConflictRequest, setPendingConflictRequest] =
    React.useState(null)
  const closeConflictDialog = React.useCallback(
    () => setPendingConflictRequest(null),
    [],
  )
  const conflictDialogRef = useAccessibleDialog(
    Boolean(pendingConflictRequest),
    closeConflictDialog,
  )
  const dragStart = React.useRef("")
  const dragMoved = React.useRef(false)
  const dragging = React.useRef(false)

  const requestHeaders = React.useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${window.sessionStorage.getItem(
        MINISTRY_SESSION_KEY,
      )}`,
    }),
    [],
  )

  const loadAvailability = React.useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await fetch(
        (() => {
          const url = new URL(
            getFunctionEndpoint("scheduling/availability"),
            window.location.origin,
          )
          if (ministryId) url.searchParams.set("ministryId", ministryId)
          if (selectedMemberIds[0]) {
            url.searchParams.set("subjectUserId", selectedMemberIds[0])
          }
          return url
        })(),
        { headers: requestHeaders() },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to load availability")
      }
      setAvailability(normalizeAvailability(result))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [requestHeaders, ministryId, selectedMemberIds])

  React.useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const updateMonthCount = () => setShowsTwoMonths(media.matches)
    updateMonthCount()
    media.addEventListener("change", updateMonthCount)
    return () => media.removeEventListener("change", updateMonthCount)
  }, [])

  React.useEffect(() => {
    const stopDragging = () => {
      dragging.current = false
    }
    window.addEventListener("pointerup", stopDragging)
    window.addEventListener("pointercancel", stopDragging)
    return () => {
      window.removeEventListener("pointerup", stopDragging)
      window.removeEventListener("pointercancel", stopDragging)
    }
  }, [])

  const postAction = async (body) => {
    setIsSaving(true)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/availability"),
        {
          method: "POST",
          headers: requestHeaders(),
          body: JSON.stringify(body),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to update availability")
      }
      setMessage(result.message)
      await loadAvailability()
      window.dispatchEvent(new Event("ministry-conflicts-updated"))
      return result
    } catch (error) {
      setErrorMessage(error.message)
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const selection =
    selectionStart && selectionEnd
      ? sortedRange(selectionStart, selectionEnd)
      : null
  const selectedAssignments = selection
    ? availability.assignments.filter(
        (assignment) =>
      assignment.date >= selection.startDate &&
          assignment.date <= selection.endDate &&
          (!(canManageMembers && selectedMemberIds.length
            ? ministryId
            : scopeMinistryId) ||
            assignment.ministryId ===
              (canManageMembers && selectedMemberIds.length
                ? ministryId
                : scopeMinistryId)),
      )
    : []
  const todayKey = toDateKey(new Date())
  const visibleMonths = React.useMemo(
    () => [
      visibleMonth,
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
    ],
    [visibleMonth],
  )
  const displayedMonths = showsTwoMonths ? visibleMonths : [visibleMonth]

  const blocksForDate = (key) =>
    availability.blocks.filter(
      (block) => key >= block.startDate && key <= block.endDate,
    )
  const assignmentsForDate = (key) =>
    availability.assignments.filter(
      (assignment) => assignment.date === key,
    )
  const isSelected = (key) =>
    selection && key >= selection.startDate && key <= selection.endDate

  const selectByTap = (key) => {
    if (key < todayKey) return
    if (
      selectionStart &&
      selectionEnd === selectionStart &&
      selectionStart !== key
    ) {
      setSelectionEnd(key)
    } else {
      setSelectionStart(key)
      setSelectionEnd(key)
    }
    setMessage("")
    setErrorMessage("")
  }

  const beginDrag = (key) => {
    if (key < todayKey) return
    dragStart.current = key
    dragMoved.current = false
    dragging.current = true
  }

  const extendDrag = (key) => {
    if (!dragging.current || !dragStart.current || key < todayKey) return
    if (key !== dragStart.current) dragMoved.current = true
    setSelectionStart(dragStart.current)
    setSelectionEnd(key)
    setMessage("")
    setErrorMessage("")
  }

  const finishPointer = (key) => {
    const wasDrag = dragMoved.current
    dragging.current = false
    if (!wasDrag) selectByTap(key)
  }

  const blockSelection = async () => {
    if (!selection) return
    if (canManageMembers && selectedMemberIds.length) {
      const preview = await postAction({
        action: "preview_blocks",
        subjectUserIds: selectedMemberIds,
        ministryId,
        startDate: selection.startDate,
        endDate: selection.endDate,
        label,
      })
      if (preview?.conflicts?.length) {
        setMessage("")
        setPendingConflictRequest({
          selection,
          label,
          ministryId,
          subjectUserIds: selectedMemberIds,
          conflicts: preview.conflicts,
        })
        return
      }
      const result = await postAction({
        action: "create_blocks",
        subjectUserIds: selectedMemberIds,
        ministryId,
        startDate: selection.startDate,
        endDate: selection.endDate,
        label,
      })
      if (result?.updated) {
        setSelectionStart("")
        setSelectionEnd("")
        setLabel("")
      }
      return
    }
    const result = await postAction({
      action: "create_block",
      startDate: selection.startDate,
      endDate: selection.endDate,
      label,
      ministryId: scopeMinistryId,
      requireConflictFree: true,
    })
    if (result?.conflicts?.length) {
      setMessage("")
      setErrorMessage("")
      setPendingConflictRequest({
        selection,
        label,
        ministryId: scopeMinistryId,
        conflicts: result.conflicts,
      })
      return
    }
    if (result?.updated) {
      setSelectionStart("")
      setSelectionEnd("")
      setLabel("")
    }
  }

  const continueBlockSelection = async () => {
    if (!pendingConflictRequest) return
    if (pendingConflictRequest.subjectUserIds?.length) {
      const result = await postAction({
        action: "create_blocks",
        subjectUserIds: pendingConflictRequest.subjectUserIds,
        ministryId: pendingConflictRequest.ministryId,
        startDate: pendingConflictRequest.selection.startDate,
        endDate: pendingConflictRequest.selection.endDate,
        label: pendingConflictRequest.label,
        requestChanges: true,
      })
      if (result?.updated) {
        setSelectionStart("")
        setSelectionEnd("")
        setLabel("")
        setPendingConflictRequest(null)
      }
      return
    }
    const result = await postAction({
      action: "create_block",
      startDate: pendingConflictRequest.selection.startDate,
      endDate: pendingConflictRequest.selection.endDate,
      label: pendingConflictRequest.label,
      ministryId: pendingConflictRequest.ministryId,
      requireConflictFree: false,
      requestChanges: true,
    })
    if (result?.updated) {
      setSelectionStart("")
      setSelectionEnd("")
      setLabel("")
      setPendingConflictRequest(null)
    }
  }

  const removeBlock = async (block) => {
    await postAction({
      action: "cancel_block",
      blockId: block.id,
      subjectUserId: selectedMemberIds[0] || undefined,
      managedMinistryId:
        selectedMemberIds.length && canManageMembers ? ministryId : undefined,
    })
  }

  const requestChange = async (assignment) => {
    await postAction({
      action: "request_change",
      assignmentId: assignment.id,
    })
  }

  const moveMonth = (amount) =>
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    )

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
              {selectedMemberIds.length ? "Ministry availability" : "My availability"}
            </p>
            <h2 className="mt-2 century-font text-2xl text-gray-950">
              {selectedMemberIds.length
                ? "Block dates ministry members cannot serve"
                : "Block dates you cannot serve"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
              Tap the first and last date, or drag across the calendar. Dates
              with an assigned duty will ask you to continue before the date is
              blocked and a change request is sent. Use the previous and next
              buttons to move between months.
            </p>
          </div>
          {availability.user && (
            <span className="rounded-full bg-[#f4ede6] px-3 py-1 text-xs font-semibold text-[#896542]">
              {availability.user.firstName} {availability.user.lastName}
            </span>
          )}
        </div>

        {(message || errorMessage) && (
          <p
            role={errorMessage ? "alert" : "status"}
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              errorMessage
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {errorMessage || message}
          </p>
        )}

        {canManageMembers && availability.managedMembers?.length > 0 && (
          <label className="mt-5 block text-sm font-semibold text-gray-700">
            Manage ministry member availability
            <select
              multiple
              value={selectedMemberIds}
              onChange={(event) => {
                setSelectedMemberIds(
                  Array.from(event.target.selectedOptions, (option) => option.value),
                )
                setSelectionStart("")
                setSelectionEnd("")
                setPendingConflictRequest(null)
              }}
              className="mt-2 min-h-32 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#896542]"
            >
              {availability.managedMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs font-normal text-gray-500">
              Select one or several members. Changes apply only to this ministry.
              Leave everyone unselected to manage your own account.
            </span>
          </label>
        )}

        <div className="relative mt-6 xl:mx-12">
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

          {isLoading ? (
            <p className="py-14 text-center text-sm text-gray-500">
              Loading availability...
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {displayedMonths.map((month) => {
              const monthKey = `${month.getFullYear()}-${month.getMonth()}`
              const monthCells = getMonthCells(month)
              return (
                <section
                  key={monthKey}
                  className="w-full rounded-xl border border-gray-100 p-3"
                >
                  <h4 className="text-center font-semibold text-gray-900">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "long",
                      year: "numeric",
                    }).format(month)}
                  </h4>
                  <div className="mt-2 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-[0.14em] text-gray-700 sm:text-sm">
                    {WEEKDAYS.map((day, index) => (
                      <div key={`${day}-${index}`} className="py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-2 text-center sm:gap-y-3">
                    {monthCells.map((date) => {
                      const key = toDateKey(date)
                      const inMonth =
                        date.getMonth() === month.getMonth() &&
                        date.getFullYear() === month.getFullYear()
                      if (!inMonth) {
                        return (
                          <span
                            key={`${monthKey}-${key}`}
                            aria-hidden="true"
                            className="mx-auto size-8 sm:size-12"
                          />
                        )
                      }
                      const blocked = blocksForDate(key).length > 0
                      const duties = assignmentsForDate(key)
                      const assigned = duties.length > 0
                      const selected = isSelected(key)
                      const past = key < todayKey
                      const changeRequested = duties.some(
                        (duty) =>
                          duty.changeRequestStatus === "pending",
                      )

                      return (
                        <button
                          key={`${monthKey}-${key}`}
                          type="button"
                          disabled={past}
                          onPointerDown={() => beginDrag(key)}
                          onPointerEnter={() => extendDrag(key)}
                          onPointerUp={() => finishPointer(key)}
                          className={`relative mx-auto flex size-8 items-center justify-center rounded-full text-sm font-semibold text-gray-900 transition sm:size-12 md:text-base ${
                            selected
                              ? "bg-[#eee2d5] text-[#6f4f34] ring-2 ring-[#6f4f34]"
                              : key === todayKey
                                ? "bg-orange-500 text-white ring-2 ring-orange-500"
                              : assigned
                                ? "ring-2 ring-orange-500"
                                : blocked
                                  ? "bg-[#f4ede6] text-[#6f4f34]"
                                  : ""
                          } ${
                            past
                              ? "cursor-not-allowed opacity-40"
                              : "hover:bg-gray-50"
                          }`}
                          aria-label={`${formatDate(key, {
                            month: "long",
                          })}${assigned ? ", assigned duty" : blocked ? ", unavailable" : ""}`}
                        >
                          {date.getDate()}
                          {changeRequested && (
                            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-orange-500" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded bg-[#f4ede6]" /> Unavailable
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-full ring-2 ring-orange-500" />{" "}
            Assigned duty
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded bg-[#eee2d5] ring-1 ring-[#C1A387]" />{" "}
            Selected
          </span>
        </div>
      </section>

      {selection && (
        <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-[#f4ede6] p-2.5 text-[#896542]">
              <CalendarDaysIcon className="size-6" />
            </span>
            <div>
              <h3 className="font-semibold text-gray-900">
                {selection.startDate === selection.endDate
                  ? formatDate(selection.startDate)
                  : `${formatDate(selection.startDate)} – ${formatDate(
                      selection.endDate,
                    )}`}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Nothing is saved until you select UPDATE. Assigned dates
                will show a warning before change requests are sent.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Applies to
              <select
                value={
                  canManageMembers && selectedMemberIds.length
                    ? ministryId
                    : scopeMinistryId
                }
                onChange={(event) => setScopeMinistryId(event.target.value)}
                disabled={canManageMembers && selectedMemberIds.length > 0}
                className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal outline-none focus:border-[#896542]"
              >
                {canManageMembers && selectedMemberIds.length > 0 ? (
                  <option value={ministryId}>This ministry only</option>
                ) : (
                  <>
                <option value="">All ministries</option>
                {(availability.ministries || []).map((ministry) => (
                  <option key={ministry.id} value={ministry.id}>
                    {ministry.name} only
                  </option>
                ))}
                  </>
                )}
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Label
            <input
              type="text"
              maxLength="250"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Label, such as Winter trip (optional)"
              className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-normal outline-none focus:border-[#896542]"
            />
            </label>
            <button
              type="button"
              disabled={isSaving}
              onClick={blockSelection}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
            >
              <NoSymbolIcon className="size-5" />
              {isSaving ? "UPDATING..." : "UPDATE"}
            </button>
          </div>

          {selectedAssignments.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <h4 className="font-semibold text-gray-900">
                Assigned duties in this range
              </h4>
              <div className="mt-3 space-y-3">
                {selectedAssignments.map((assignment) => (
                  <article
                    key={assignment.id}
                    className="flex flex-col gap-3 rounded-xl border border-orange-200 p-4 sm:flex-row sm:items-center"
                  >
                    <ClockIcon className="size-5 shrink-0 text-orange-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">
                        {assignment.responsibilityName}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {formatDate(assignment.date)} at{" "}
                        {formatDutyTime(assignment.startTime)} ·{" "}
                        {assignment.eventTitle} · {assignment.ministryName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!selectedMemberIds.length && (
                        <button
                          type="button"
                          disabled={
                            isSaving ||
                            assignment.changeRequestStatus === "pending"
                          }
                          onClick={() => requestChange(assignment)}
                          className="rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700 disabled:bg-orange-50 disabled:opacity-70"
                        >
                          {assignment.changeRequestStatus === "pending"
                            ? "Change requested"
                            : "Request change"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="century-font text-xl text-gray-900">
          Unavailable date blocks
        </h3>
        {availability.blocks.length ? (
          <div className="mt-4 space-y-3">
            {availability.blocks.map((block) => (
              <article
                key={block.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 p-4"
              >
                <NoSymbolIcon className="size-5 shrink-0 text-[#896542]" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">
                    {block.startDate === block.endDate
                      ? formatDate(block.startDate)
                      : `${formatDate(block.startDate)} – ${formatDate(
                          block.endDate,
                        )}`}
                  </p>
                  {block.label && (
                    <p className="mt-1 text-sm text-gray-500">{block.label}</p>
                  )}
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#896542]">
                    {block.ministryName || "All ministries"}
                  </p>
                </div>
                {(!selectedMemberIds.length || block.ministryId === ministryId) && <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => removeBlock(block)}
                  aria-label="Remove availability block"
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-red-600 disabled:opacity-50"
                >
                  <TrashIcon className="size-5" />
                </button>
                }
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-[#d8c7b8] p-6 text-center text-sm text-gray-500">
            No unavailable dates have been added.
          </p>
        )}
      </section>

      {pendingConflictRequest && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
          <section
            ref={conflictDialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="availability-conflict-title"
            className="ministry-dialog-surface w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3
              id="availability-conflict-title"
              className="century-font text-2xl text-gray-950"
            >
              Assigned duties need a change request
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              This unavailable range contains the following assigned duties. If
              you continue, the dates will be marked unavailable and the
              ministry administrators will be alerted automatically.
            </p>
            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
              {pendingConflictRequest.conflicts.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-xl border border-orange-200 bg-orange-50/40 p-3"
                >
                  <p className="font-semibold text-gray-900">
                    {assignment.responsibilityName}
                  </p>
                  {assignment.subjectUserId && (
                    <p className="mt-1 text-xs font-semibold text-orange-800">
                      {(() => {
                        const member = availability.managedMembers?.find(
                          (item) => item.id === assignment.subjectUserId,
                        )
                        return member
                          ? `${member.firstName} ${member.lastName}`
                          : "Ministry member"
                      })()}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-600">
                    {formatDate(assignment.date)} · {assignment.eventTitle}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={closeConflictDialog}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={continueBlockSelection}
                className="rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? "Updating..." : "Continue"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default MinistryAvailability
