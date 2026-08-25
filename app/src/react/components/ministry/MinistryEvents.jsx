import * as React from "react"
import {
  CheckIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryOrdoReference from "./MinistryOrdoReference"
import useAccessibleDialog from "../../hooks/useAccessibleDialog"
import {
  downloadEventSchedulePdf,
  getEventRange,
} from "./downloadEventSchedulePdf"

const requestHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${window.sessionStorage.getItem(
    MINISTRY_SESSION_KEY,
  )}`,
})

const toInputValue = (value) => {
  if (!value) return ""
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const initialForm = () => ({
  eventId: "",
  sourceEventId: "",
  templateId: "",
  originalTemplateId: "",
  title: "",
  description: "",
  location: "",
  roomIds: [],
  startTime: "",
  endTime: "",
  confirmationDeadline: "",
  recurrenceFrequency: "none",
  recurrenceInterval: 1,
  recurrenceCount: 12,
  recurrenceWeekday: 5,
  recurrenceOrdinal: 1,
  updateScope: "this_event",
  participationType: "members",
  visibility: "public",
  rsvpEnabled: false,
})

const formatEventDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const previewRepeatingDates = (form) => {
  if (!form.startTime || form.recurrenceFrequency === "none") return []
  const start = new Date(form.startTime)
  if (Number.isNaN(start.getTime())) return []
  const count = Math.min(8, Math.max(2, Number(form.recurrenceCount) || 12))
  const interval = Math.min(12, Math.max(1, Number(form.recurrenceInterval) || 1))
  const nthWeekday = (monthOffset, weekday, ordinal) => {
    const candidate = new Date(start)
    candidate.setDate(1)
    candidate.setMonth(candidate.getMonth() + monthOffset)
    if (ordinal === -1) {
      candidate.setMonth(candidate.getMonth() + 1)
      candidate.setDate(0)
      candidate.setDate(candidate.getDate() - ((candidate.getDay() - weekday + 7) % 7))
    } else {
      candidate.setDate(1 + ((weekday - candidate.getDay() + 7) % 7) + (ordinal - 1) * 7)
    }
    return candidate
  }
  const monthlyRuleCandidate = (monthOffset) => {
    if (form.recurrenceFrequency === "first_friday") return nthWeekday(monthOffset, 5, 1)
    if (form.recurrenceFrequency === "first_saturday") return nthWeekday(monthOffset, 6, 1)
    if (form.recurrenceFrequency === "friday_before_first_saturday") {
      const saturday = nthWeekday(monthOffset, 6, 1)
      saturday.setDate(saturday.getDate() - 1)
      return saturday
    }
    return nthWeekday(
      monthOffset,
      Number(form.recurrenceWeekday),
      Number(form.recurrenceOrdinal),
    )
  }
  let firstRuleMonthOffset = 0
  const usesMonthlyWeekday = [
    "first_friday",
    "first_saturday",
    "friday_before_first_saturday",
    "monthly_nth_weekday",
  ].includes(form.recurrenceFrequency)
  while (
    usesMonthlyWeekday &&
    firstRuleMonthOffset < 24 &&
    monthlyRuleCandidate(firstRuleMonthOffset) < start
  ) {
    firstRuleMonthOffset += 1
  }
  return Array.from({ length: count }, (_, index) => {
    if (form.recurrenceFrequency === "weekly") {
      return new Date(start.getTime() + index * interval * 7 * 86_400_000)
    }
    if (form.recurrenceFrequency === "monthly") {
      const candidate = new Date(start)
      candidate.setMonth(candidate.getMonth() + index * interval)
      return candidate
    }
    return monthlyRuleCandidate(firstRuleMonthOffset + index * interval)
  })
}

const MinistryEvents = ({ data, activeAction, onEventSelect }) => {
  const canManageRecurrence = ["owner", "super_admin"].includes(
    data.user?.globalRole,
  )
  const [templates, setTemplates] = React.useState([])
  const [events, setEvents] = React.useState([])
  const [rooms, setRooms] = React.useState([])
  const [form, setForm] = React.useState(initialForm)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [templatePreview, setTemplatePreview] = React.useState(null)
  const [assignmentCandidates, setAssignmentCandidates] = React.useState({})
  const [assignmentSelections, setAssignmentSelections] = React.useState({})
  const [isLoadingCandidates, setIsLoadingCandidates] = React.useState(false)
  const [recurrencePreview, setRecurrencePreview] = React.useState(null)
  const [conflictPreview, setConflictPreview] = React.useState(null)
  const closeConflictPreview = React.useCallback(() => setConflictPreview(null), [])
  const conflictDialogRef = useAccessibleDialog(
    Boolean(conflictPreview),
    closeConflictPreview,
  )
  const [conflictReason, setConflictReason] = React.useState("")
  const [creatingRepeatingEvent, setCreatingRepeatingEvent] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [prioryOverview, setPrioryOverview] = React.useState(null)
  const [requestedPriestId, setRequestedPriestId] = React.useState("")
  const [priestRequestUrgency, setPriestRequestUrgency] = React.useState("normal")
  const [isRequestingPriest, setIsRequestingPriest] = React.useState(false)
  const repeatingDatePreview = React.useMemo(
    () => previewRepeatingDates(form),
    [form],
  )
  const selectedTemplate = React.useMemo(
    () => templates.find((template) => template.id === form.templateId) || null,
    [templates, form.templateId],
  )
  const priestPublishNeedsAssignment =
    data.ministry?.slug === "priests" &&
    prioryOverview?.settings?.enabled &&
    !Object.values(assignmentSelections).some(Boolean)
  const hasPendingPrioryRequest = Boolean(
    form.eventId && prioryOverview?.requests?.some(
      (request) => request.eventId === form.eventId && request.status === "pending",
    ),
  )

  const loadData = React.useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const templateUrl = new URL(
        getFunctionEndpoint("scheduling/templates"),
        window.location.origin,
      )
      const eventUrl = new URL(
        getFunctionEndpoint("scheduling/events"),
        window.location.origin,
      )
      templateUrl.searchParams.set("ministryId", data.ministry.id)
      eventUrl.searchParams.set("ministryId", data.ministry.id)
      const [templateResponse, eventResponse] = await Promise.all([
        fetch(templateUrl, { headers: requestHeaders() }),
        fetch(eventUrl, { headers: requestHeaders() }),
      ])
      const [templateResult, eventResult] = await Promise.all([
        templateResponse.json(),
        eventResponse.json(),
      ])
      if (!templateResponse.ok) {
        throw new Error(templateResult.message || "Unable to load templates")
      }
      if (!eventResponse.ok) {
        throw new Error(eventResult.message || "Unable to load events")
      }
      setTemplates(
        templateResult.templates.filter(
          (template) => template.status === "active" && template.canEdit,
        ),
      )
      setEvents(eventResult.events)
      setRooms(eventResult.rooms || [])
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [data.ministry.id])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  React.useEffect(() => {
    setForm(initialForm())
    setMessage("")
    setErrorMessage("")
  }, [activeAction.id])

  React.useEffect(() => {
    if (
      form.eventId ||
      form.sourceEventId ||
      !form.templateId ||
      !form.startTime ||
      !form.endTime ||
      creatingRepeatingEvent
    ) {
      setAssignmentCandidates({})
      return undefined
    }
    const start = new Date(form.startTime)
    const end = new Date(form.endTime)
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setAssignmentCandidates({})
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoadingCandidates(true)
      try {
        const response = await fetch(getFunctionEndpoint("scheduling/events"), {
          method: "POST",
          headers: requestHeaders(),
          signal: controller.signal,
          body: JSON.stringify({
            action: "preview_template_assignments",
            templateId: form.templateId,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.message || "Unable to load available members")
        }
        setAssignmentCandidates(
          Object.fromEntries(
            (result.responsibilities || []).map((responsibility) => [
              responsibility.templateResponsibilityId,
              responsibility.availableMembers || [],
            ]),
          ),
        )
      } catch (error) {
        if (error.name !== "AbortError") setErrorMessage(error.message)
      } finally {
        if (!controller.signal.aborted) setIsLoadingCandidates(false)
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    creatingRepeatingEvent,
    form.endTime,
    form.eventId,
    form.sourceEventId,
    form.startTime,
    form.templateId,
  ])

  React.useEffect(() => {
    if (
      data.ministry?.slug !== "priests" ||
      !form.startTime ||
      !form.endTime
    ) {
      setPrioryOverview(null)
      return undefined
    }
    const start = new Date(form.startTime)
    const end = new Date(form.endTime)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setPrioryOverview(null)
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const url = new URL(
          getFunctionEndpoint("scheduling/priory-allocations"),
          window.location.origin,
        )
        url.searchParams.set("start", start.toISOString())
        url.searchParams.set("end", end.toISOString())
        const response = await fetch(url, {
          headers: requestHeaders(),
          signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || "Unable to check Priory availability")
        setPrioryOverview(result)
      } catch (error) {
        if (error.name !== "AbortError") setErrorMessage(error.message)
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [data.ministry?.slug, form.endTime, form.startTime])

  const requestPriestAvailability = async () => {
    if (!form.eventId) {
      setErrorMessage("Open an existing event before requesting Priory availability.")
      return
    }
    setIsRequestingPriest(true)
    setErrorMessage("")
    setMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/priory-allocations"),
        {
          method: "POST",
          headers: requestHeaders(),
          body: JSON.stringify({
            action: "request_allocation",
            eventId: form.eventId,
            requestedPriestId,
            urgency: priestRequestUrgency,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to request Priest availability")
      setMessage(result.message)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsRequestingPriest(false)
    }
  }

  const updateField = (field, value) => {
    setRecurrencePreview(null)
    setConflictPreview(null)
    if (field !== "templateId") setTemplatePreview(null)
    if (["startTime", "endTime"].includes(field)) {
      setAssignmentSelections({})
    }
    if (field === "participationType" && value === "volunteers") {
      setAssignmentSelections({})
    }
    setForm((current) => ({ ...current, [field]: value }))
  }

  const selectTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId)
    const privateByDefault = /sick call|private appointment|travel/i.test(
      template?.name || "",
    )
    setForm((current) => ({
      ...current,
      templateId,
      title: template ? template.name : "",
      description: current.description || template?.description || "",
      participationType: template?.participationType || current.participationType,
      visibility: privateByDefault ? "private" : current.visibility,
      roomIds:
        data.ministry?.slug === "priests" && current.roomIds.length === 0
          ? (rooms.find((room) => room.name === "Father's Office")
              ? [rooms.find((room) => room.name === "Father's Office").id]
              : [])
          : current.roomIds,
    }))
    setAssignmentSelections({})
    setAssignmentCandidates({})
  }

  const updateAssignmentSelection = (slotKey, userId) => {
    setAssignmentSelections((current) => ({ ...current, [slotKey]: userId }))
  }

  const autoAssign = () => {
    const selected = new Set(
      Object.values(assignmentSelections).filter(Boolean),
    )
    const next = { ...assignmentSelections }
    for (const responsibility of selectedTemplate?.responsibilities || []) {
      const candidates = assignmentCandidates[responsibility.id] || []
      for (let index = 0; index < responsibility.quantityNeeded; index += 1) {
        const slotKey = `${responsibility.id}:${index}`
        if (next[slotKey]) continue
        const member = candidates.find(
          (candidate) => candidate.automaticEligible && !selected.has(candidate.userId),
        )
        if (member) {
          next[slotKey] = member.userId
          selected.add(member.userId)
        }
      }
    }
    setAssignmentSelections(next)
  }

  const editEvent = (event) => {
    const recurrence = event.recurrence_rule || {}
    setRecurrencePreview(null)
    setCreatingRepeatingEvent(false)
    setForm({
      ...initialForm(),
      eventId: event.id,
      templateId: event.template_id || "",
      originalTemplateId: event.template_id || "",
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      roomIds: event.room_ids || [],
      startTime: toInputValue(event.start_time),
      endTime: toInputValue(event.end_time),
      confirmationDeadline: toInputValue(event.confirmation_deadline_at),
      recurrenceFrequency: recurrence.frequency || "none",
      recurrenceInterval: Number(recurrence.interval || 1),
      recurrenceCount: Number(recurrence.count || 12),
      recurrenceWeekday: Number(recurrence.weekday ?? 5),
      recurrenceOrdinal: Number(recurrence.ordinal || 1),
      updateScope: "this_event",
      participationType: event.participation_type || "members",
      visibility: event.visibility || "public",
      rsvpEnabled: Boolean(event.rsvp_enabled),
    })
  }

  const prepareClone = (event) =>
    setForm({
      ...initialForm(),
      sourceEventId: event.id,
      templateId: event.template_id || "",
      title: event.template_id ? event.title : `${event.title} Copy`,
      description: event.description || "",
      location: event.location || "",
      roomIds: event.room_ids || [],
      startTime: "",
      endTime: "",
      participationType: event.participation_type || "members",
      visibility: event.visibility || "public",
      rsvpEnabled: Boolean(event.rsvp_enabled),
    })

  const persistEvent = async (body, { editing, cloning }) => {
    const response = await fetch(
      getFunctionEndpoint("scheduling/events"),
      {
        method: editing ? "PATCH" : "POST",
        headers: requestHeaders(),
        body: JSON.stringify(body),
      },
    )
    const result = await response.json()
    if (!response.ok) {
      if (result.conflicts?.length) {
        setConflictPreview({ body, editing, cloning, conflicts: result.conflicts })
        return false
      }
      throw new Error(result.message || "Unable to save event")
    }
    setMessage(result.message)
    setForm(initialForm())
    setRecurrencePreview(null)
    setConflictPreview(null)
    setConflictReason("")
    setCreatingRepeatingEvent(false)
    await loadData()
    return true
  }

  const saveEvent = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage("")
    setErrorMessage("")
    try {
      const editing = Boolean(form.eventId)
      const cloning = Boolean(form.sourceEventId)
      const body = {
        ...form,
        ministryId: data.ministry.id,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        confirmationDeadline: form.confirmationDeadline
          ? new Date(form.confirmationDeadline).toISOString()
          : null,
        recurrence: {
          frequency: form.recurrenceFrequency,
          interval: Number(form.recurrenceInterval),
          count: Number(form.recurrenceCount),
          weekday: Number(form.recurrenceWeekday),
          ordinal: Number(form.recurrenceOrdinal),
        },
        updateScope: form.updateScope,
        action: cloning ? "clone" : undefined,
        status: editing ? undefined : "published",
        assignments:
          !editing &&
          !cloning &&
          !creatingRepeatingEvent &&
          form.participationType !== "volunteers"
            ? Object.entries(assignmentSelections)
                .filter(([, userId]) => Boolean(userId))
                .map(([slotKey, userId]) => ({
                  templateResponsibilityId: slotKey.split(":")[0],
                  userId,
                }))
            : [],
      }
      if (
        editing &&
        form.updateScope === "this_and_future" &&
        !recurrencePreview
      ) {
        const previewResponse = await fetch(
          getFunctionEndpoint("scheduling/events"),
          {
            method: "POST",
            headers: requestHeaders(),
            body: JSON.stringify({
              ...body,
              action: "preview_recurrence_change",
            }),
          },
        )
        const previewResult = await previewResponse.json()
        if (!previewResponse.ok) {
          throw new Error(
            previewResult.message || "Unable to preview repeating-event changes",
          )
        }
        setRecurrencePreview(previewResult)
        return
      }
      if (
        editing &&
        form.updateScope === "this_and_future" &&
        recurrencePreview?.conflicts?.length
      ) {
        setConflictPreview({
          body,
          editing,
          cloning,
          conflicts: recurrencePreview.conflicts,
        })
        return
      }
      if (!(editing && form.updateScope === "this_and_future")) {
        const previewResponse = await fetch(
          getFunctionEndpoint("scheduling/events"),
          {
            method: "POST",
            headers: requestHeaders(),
            body: JSON.stringify({
              ...body,
              action: "preview_event_conflicts",
            }),
          },
        )
        const previewResult = await previewResponse.json()
        if (!previewResponse.ok) {
          throw new Error(previewResult.message || "Unable to check event conflicts")
        }
        if (previewResult.conflicts?.length) {
          setConflictPreview({
            body,
            editing,
            cloning,
            conflicts: previewResult.conflicts,
          })
          return
        }
      }
      await persistEvent(body, { editing, cloning })
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const ignoreEventConflicts = async () => {
    if (!conflictPreview) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      await persistEvent(
        {
          ...conflictPreview.body,
          conflictOverride: true,
          conflictOverrideReason:
            conflictReason.trim() || "Overlap reviewed by ministry administrator",
        },
        conflictPreview,
      )
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const previewTemplateChange = async (templateId) => {
    updateField("templateId", templateId)
    setTemplatePreview(null)
    if (!templateId || templateId === form.originalTemplateId) return
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "POST",
          headers: requestHeaders(),
          body: JSON.stringify({
            action: "preview_template_change",
            eventId: form.eventId,
            templateId,
            updateScope: form.updateScope,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(
          result.message || "Unable to preview template change",
        )
      }
      setTemplatePreview(result)
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const applyTemplateChange = async () => {
    setIsSaving(true)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "PATCH",
          headers: requestHeaders(),
          body: JSON.stringify({
            action: "replace_template",
            eventId: form.eventId,
            templateId: form.templateId,
            updateScope: form.updateScope,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to apply template")
      }
      setMessage(
        "Template applied. Compatible assignments were preserved and removed duties remain in history.",
      )
      setTemplatePreview(null)
      setForm((current) => ({
        ...current,
        originalTemplateId: current.templateId,
      }))
      await loadData()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const setEventStatus = async (event, status) => {
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "PATCH",
          headers: requestHeaders(),
          body: JSON.stringify({
            action: "set_status",
            eventId: event.id,
            status,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to update event")
      }
      setMessage(
        status === "cancelled"
          ? "Event cancelled and retained in history."
          : "Event published.",
      )
      await loadData()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const showForm =
    activeAction.id === "add-event" ||
    (activeAction.id === "modify" &&
      Boolean(form.eventId || form.sourceEventId))
  const selectedAssignmentUserIds = new Set(
    Object.values(assignmentSelections).filter(Boolean),
  )

  if (isLoading) {
    return <p className="p-6 text-center text-gray-500">Loading events...</p>
  }

  return (
    <div className="space-y-6">
      {(message || errorMessage) && (
        <div
          role={errorMessage ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            errorMessage
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {errorMessage || message}
        </div>
      )}

      {conflictPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div
            ref={conflictDialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="event-conflict-title"
            className="ministry-dialog-surface w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-orange-500 p-2.5 text-white">
                <ExclamationTriangleIcon className="size-6" />
              </span>
              <div>
                <h3 id="event-conflict-title" className="century-font text-2xl text-gray-950">
                  Event schedule conflict
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Fix the date or time, or keep the overlap with a visible warning.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {conflictPreview.conflicts.map((conflict) => (
                <div key={conflict.id} className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                  <span className="font-semibold">{conflict.title}</span>
                  <span> · {formatEventDate(conflict.startTime)}</span>
                  {conflict.roomNames && (
                    <span className="block text-xs">Rooms: {conflict.roomNames}</span>
                  )}
                </div>
              ))}
            </div>
            <label className="mt-4 block text-sm font-semibold text-gray-700">
              Override note (optional)
              <input
                value={conflictReason}
                maxLength={500}
                onChange={(event) => setConflictReason(event.target.value)}
                placeholder="Why this overlap is acceptable"
                className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConflictPreview}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Fix
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={ignoreEventConflicts}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Ignore and save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={saveEvent}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#896542]">
                {form.eventId
                  ? "Modify event"
                  : form.sourceEventId
                    ? "Copy event"
                    : "Create event"}
              </p>
              <h3 className="mt-2 century-font text-2xl text-gray-900">
                {form.sourceEventId
                  ? "Choose the new date and time"
                  : "Event details"}
              </h3>
            </div>
            {(form.eventId || form.sourceEventId) && (
              <button
                type="button"
                onClick={() => setForm(initialForm())}
                className="text-sm font-semibold text-gray-500 hover:text-[#896542]"
              >
                Back to events
              </button>
            )}
          </div>

          {!form.eventId && !form.sourceEventId && canManageRecurrence && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreatingRepeatingEvent(false)
                  updateField("recurrenceFrequency", "none")
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  !creatingRepeatingEvent
                    ? "bg-[#896542] text-white"
                    : "border border-gray-200 bg-white text-gray-600"
                }`}
              >
                Create one-time event
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingRepeatingEvent(true)
                  updateField("recurrenceFrequency", "weekly")
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  creatingRepeatingEvent
                    ? "bg-[#896542] text-white"
                    : "border border-gray-200 bg-white text-gray-600"
                }`}
              >
                Create repeating event
              </button>
            </div>
          )}

          {!form.eventId && !form.sourceEventId && (
            <label className="mt-6 block text-sm font-semibold text-gray-700">
              Event template <span className="font-normal text-gray-500">(optional)</span>
              <select
                value={form.templateId}
                onChange={(event) => selectTemplate(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 font-normal"
              >
                <option value="">No template — start with a blank event</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} —{" "}
                    {template.ministries
                      .map((ministry) => ministry.ministryName)
                      .join(", ")}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs font-normal text-gray-500">
                Templates are optional presets for events that reuse predetermined logistics and positions.
              </span>
            </label>
          )}

          {form.eventId && (
            <div className="mt-6 rounded-xl border border-gray-100 p-4">
              <label className="text-sm font-semibold text-gray-700">
                Event template
                <select
                  value={form.templateId}
                  onChange={(event) =>
                    previewTemplateChange(event.target.value)
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 font-normal"
                >
                  <option value="">No template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              {templatePreview && (
                <div className="mt-4 rounded-xl bg-[#f7f3ef] p-4 text-sm">
                  <p className="font-semibold text-[#6f4f34]">
                    Change to {templatePreview.nextTemplateName}
                  </p>
                  {templatePreview.affectedEvents > 1 && (
                    <p className="mt-1 text-xs text-gray-600">
                      Previewing {templatePreview.affectedEvents} events in this and future occurrences.
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {templatePreview.preserved.length}
                      </p>
                      <p className="text-xs text-gray-500">Preserved</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-green-700">
                        {templatePreview.added.length}
                      </p>
                      <p className="text-xs text-gray-500">Added</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-red-700">
                        {templatePreview.removed.length}
                      </p>
                      <p className="text-xs text-gray-500">Removed</p>
                    </div>
                  </div>
                  {templatePreview.affectedAssignments > 0 && (
                    <p className="mt-3 text-amber-800">
                      {templatePreview.affectedAssignments} assigned{" "}
                      {templatePreview.affectedAssignments === 1
                        ? "responsibility is"
                        : "responsibilities are"}{" "}
                      affected. The assignment history will be retained.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={applyTemplateChange}
                    disabled={isSaving}
                    className="mt-4 rounded-lg bg-[#896542] px-4 py-2 font-semibold text-white hover:bg-[#6f4f34] disabled:opacity-50"
                  >
                    Apply template changes
                  </button>
                </div>
              )}
            </div>
          )}

          {!templates.length && !form.eventId && !form.sourceEventId && (
            <p className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No templates are available for this ministry. You can still publish a blank event and add its logistics later.
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {data.ministry?.slug === "priests" && (
              <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                Visibility
                <select
                  value={form.visibility}
                  onChange={(event) => updateField("visibility", event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 font-normal"
                >
                  <option value="public">Public event</option>
                  <option value="ministry">Priest Ministry only</option>
                  <option value="private">Private appointment</option>
                </select>
                <span className="mt-2 block text-xs font-normal text-gray-500">
                  Private appointments show only the event type. Personal details are protected separately.
                </span>
              </label>
            )}
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Who can participate
              <select
                value={form.participationType}
                onChange={(event) =>
                  updateField("participationType", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 font-normal"
              >
                <option value="members">Ministry members only</option>
                <option value="volunteers">Public volunteers only</option>
                <option value="both">Members and public volunteers</option>
              </select>
              <span className="mt-2 block text-xs font-normal text-gray-500">
                Volunteer events can receive signups through a public link after the event is published.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 text-sm text-gray-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.rsvpEnabled}
                onChange={(event) => updateField("rsvpEnabled", event.target.checked)}
                className="mt-0.5 size-4 rounded border-gray-300 text-[#896542]"
              />
              <span>
                <span className="block font-semibold">Allow member RSVP</span>
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Ministry members can answer whether they can attend. This is separate from position assignments.
                </span>
              </span>
            </label>
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Event name
              <input
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                required
                disabled={Boolean(form.templateId)}
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/15 disabled:bg-gray-50 disabled:text-gray-600"
              />
              {form.templateId && (
                <span className="mt-2 block text-xs font-normal text-gray-500">
                  This event uses the template name. Remove the template to enter a different event name.
                </span>
              )}
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Starts
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(event) =>
                  updateField("startTime", event.target.value)
                }
                required
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Ends
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(event) =>
                  updateField("endTime", event.target.value)
                }
                required
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Assignment confirmation deadline
              <input
                type="datetime-local"
                value={form.confirmationDeadline}
                max={form.startTime || undefined}
                onChange={(event) =>
                  updateField("confirmationDeadline", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal"
              />
              <span className="mt-2 block text-xs font-normal text-gray-500">
                Optional. If left blank, the app chooses a deadline based on
                the publication date and event date.
              </span>
            </label>
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Location
              <input
                value={form.location}
                onChange={(event) =>
                  updateField("location", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal"
              />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold text-gray-700">
                Chapel rooms
              </legend>
              <div className="mt-2 rounded-xl border border-gray-200 p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={rooms.length > 0 && form.roomIds.length === rooms.length}
                    onChange={(event) =>
                      updateField(
                        "roomIds",
                        event.target.checked ? rooms.map((room) => room.id) : [],
                      )
                    }
                    className="size-4 accent-[#896542]"
                  />
                  Select all rooms
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((room) => (
                    <label key={room.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.roomIds.includes(room.id)}
                        onChange={() =>
                          updateField(
                            "roomIds",
                            form.roomIds.includes(room.id)
                              ? form.roomIds.filter((roomId) => roomId !== room.id)
                              : [...form.roomIds, room.id],
                          )
                        }
                        className="size-4 accent-[#896542]"
                      />
                      {room.name}
                    </label>
                  ))}
                </div>
                {!rooms.length && (
                  <p className="mt-2 text-sm text-gray-500">
                    A Super Admin can add rooms under Chapel Settings.
                  </p>
                )}
              </div>
            </fieldset>
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Description
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                rows={3}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal"
              />
            </label>
          </div>

          {data.ministry?.slug === "priests" && prioryOverview?.settings?.enabled && (
            <section className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">Priory allocation</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Only priests assigned to {prioryOverview.settings.missionName || "this mission"} for the complete appointment time can be selected.
                  </p>
                  {prioryOverview.stale && (
                    <p className="mt-2 text-sm font-semibold text-orange-800">
                      The app is using the last verified cached Priory schedule.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prioryOverview.priests
                      .filter((priest) => priest.availableToMission)
                      .map((priest) => (
                        <span key={priest.externalPriestId} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700">
                          {priest.displayName} available
                        </span>
                      ))}
                    {!prioryOverview.priests.some((priest) => priest.availableToMission) && (
                      <span className="text-sm font-semibold text-orange-800">No mapped priest is allocated for this complete time.</span>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <label className="text-sm font-semibold text-gray-700">
                      Request a specific priest or anyone available
                      <select
                        value={requestedPriestId}
                        onChange={(event) => setRequestedPriestId(event.target.value)}
                        className="mt-1 min-h-11 w-full rounded-lg border border-orange-200 bg-white px-3 font-normal"
                      >
                        <option value="">ANY available priest</option>
                        {prioryOverview.priests.map((priest) => (
                          <option key={priest.externalPriestId} value={priest.externalPriestId}>
                            {priest.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Urgency
                      <select
                        value={priestRequestUrgency}
                        onChange={(event) => setPriestRequestUrgency(event.target.value)}
                        className="mt-1 min-h-11 w-full rounded-lg border border-orange-200 bg-white px-3 font-normal"
                      >
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={isRequestingPriest || hasPendingPrioryRequest || !form.eventId || !prioryOverview.canManage}
                      onClick={requestPriestAvailability}
                      className="self-end rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {isRequestingPriest ? "Requesting..." : hasPendingPrioryRequest ? "Request Pending" : "Request Priest Availability"}
                    </button>
                  </div>
                  {!form.eventId && (
                    <p className="mt-2 text-xs text-gray-600">
                      Priory requests can be sent while editing an existing event. New events must select an allocated priest before publishing.
                    </p>
                  )}
                  {form.eventId && prioryOverview.requests
                    .filter((request) => request.eventId === form.eventId)
                    .slice(0, 3)
                    .map((request) => (
                      <div key={request.id} className="mt-3 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs text-gray-700">
                        <span className="font-semibold">Priory request: {request.status}</span>
                        <span className="ml-2">{request.requestedPriestId ? "Specific priest" : "ANY priest"} · {request.urgency}</span>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          )}

          {form.startTime && (
            <div className="mt-5">
              <MinistryOrdoReference startTime={form.startTime} />
            </div>
          )}

          {!form.eventId &&
            !form.sourceEventId &&
            selectedTemplate?.responsibilities?.length > 0 && (
              <section className="mt-5 rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Position assignments
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Choose every position now. Nothing is saved until you publish the event.
                    </p>
                  </div>
                  {form.participationType !== "volunteers" &&
                    !creatingRepeatingEvent && (
                      <button
                        type="button"
                        onClick={autoAssign}
                        disabled={isLoadingCandidates || !form.startTime || !form.endTime}
                        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {isLoadingCandidates ? "Checking members…" : "Auto Assignments"}
                      </button>
                    )}
                </div>
                {creatingRepeatingEvent ? (
                  <p className="mt-4 rounded-lg bg-[#f7f3ef] p-3 text-sm text-gray-600">
                    The app will fill each occurrence using eligible, available members. Any unfilled positions can be assigned after the events are published.
                  </p>
                ) : form.participationType === "volunteers" ? (
                  <p className="mt-4 rounded-lg bg-[#f7f3ef] p-3 text-sm text-gray-600">
                    Volunteer positions remain blank for public signup and cannot be auto-assigned.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {selectedTemplate.responsibilities.map((responsibility) => (
                      <div key={responsibility.id} className="rounded-xl border border-gray-100 p-4">
                        <p className="font-semibold text-gray-900">
                          {responsibility.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {responsibility.requiredLevelName
                            ? `${responsibility.requiredLevelName} or higher · `
                            : ""}
                          {responsibility.quantityNeeded} {responsibility.quantityNeeded === 1 ? "position" : "positions"}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {Array.from(
                            { length: responsibility.quantityNeeded },
                            (_, index) => {
                              const slotKey = `${responsibility.id}:${index}`
                              const selectedUserId = assignmentSelections[slotKey] || ""
                              const candidates = assignmentCandidates[responsibility.id] || []
                              return (
                                <label key={slotKey} className="text-xs font-semibold text-gray-600">
                                  Position {index + 1}
                                  <select
                                    value={selectedUserId}
                                    onChange={(event) =>
                                      updateAssignmentSelection(slotKey, event.target.value)
                                    }
                                    disabled={!form.startTime || !form.endTime || isLoadingCandidates}
                                    className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal"
                                  >
                                    <option value="">LEAVE BLANK</option>
                                    {candidates.map((member) => (
                                      <option
                                        key={member.userId}
                                        value={member.userId}
                                        disabled={
                                          member.userId !== selectedUserId &&
                                          selectedAssignmentUserIds.has(member.userId)
                                        }
                                      >
                                        {member.firstName} {member.lastName}
                                        {member.highestLevelName ? ` · ${member.highestLevelName}` : ""}
                                        {member.servingPreference && member.servingPreference !== "not_specified"
                                          ? ` · ${member.servingPreference.replaceAll("_", " ")}`
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )
                            },
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

          {canManageRecurrence &&
            ((creatingRepeatingEvent && !form.eventId && !form.sourceEventId) ||
              (form.eventId && form.recurrenceFrequency !== "none")) && (
            <fieldset className="mt-5 rounded-xl border border-gray-100 p-4">
              <legend className="px-2 text-sm font-semibold text-gray-700">
                Repeating-event rule
              </legend>
              {form.eventId && (
                <div className="mb-4 grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="updateScope"
                      checked={form.updateScope === "this_event"}
                      onChange={() => updateField("updateScope", "this_event")}
                    />
                    This event only
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="updateScope"
                      checked={form.updateScope === "this_and_future"}
                      onChange={() => updateField("updateScope", "this_and_future")}
                    />
                    This and future events
                  </label>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm text-gray-600">
                  Rule
                  <select
                    value={form.recurrenceFrequency}
                    onChange={(event) =>
                      updateField(
                        "recurrenceFrequency",
                        event.target.value,
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly on this date</option>
                    <option value="first_friday">First Friday</option>
                    <option value="friday_before_first_saturday">Friday before First Saturday</option>
                    <option value="first_saturday">First Saturday</option>
                    <option value="monthly_nth_weekday">Monthly weekday rule</option>
                  </select>
                </label>
                <>
                    <label className="text-sm text-gray-600">
                      Every
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={form.recurrenceInterval}
                          onChange={(event) =>
                            updateField(
                              "recurrenceInterval",
                              Number(event.target.value),
                            )
                          }
                          className="h-10 w-full rounded-lg border border-gray-200 px-3"
                        />
                        <span>
                          {form.recurrenceFrequency === "weekly" ? "week(s)" : "month(s)"}
                        </span>
                      </div>
                    </label>
                    {!form.eventId && (
                      <label className="text-sm text-gray-600">
                        Number of events
                        <input
                          type="number"
                          min="2"
                          max="52"
                          value={form.recurrenceCount}
                          onChange={(event) =>
                            updateField("recurrenceCount", Number(event.target.value))
                          }
                          className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3"
                        />
                      </label>
                    )}
                  </>
              </div>
              {form.recurrenceFrequency === "monthly_nth_weekday" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-gray-600">
                    Occurrence
                    <select
                      value={form.recurrenceOrdinal}
                      onChange={(event) => updateField("recurrenceOrdinal", Number(event.target.value))}
                      className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3"
                    >
                      <option value="1">First</option>
                      <option value="2">Second</option>
                      <option value="3">Third</option>
                      <option value="4">Fourth</option>
                      <option value="-1">Last</option>
                    </select>
                  </label>
                  <label className="text-sm text-gray-600">
                    Weekday
                    <select
                      value={form.recurrenceWeekday}
                      onChange={(event) => updateField("recurrenceWeekday", Number(event.target.value))}
                      className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3"
                    >
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                        <option key={day} value={index}>{day}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {form.eventId && form.updateScope === "this_and_future" && (
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  The existing rule ends before this event. A new effective-dated rule begins here; earlier events and history remain unchanged.
                </p>
              )}
              {!form.eventId && repeatingDatePreview.length > 0 && (
                <div className="mt-4 rounded-xl bg-[#f7f3ef] p-4 text-sm text-gray-700">
                  <p className="font-semibold text-[#6f4f34]">Date preview</p>
                  <ul className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                    {repeatingDatePreview.map((date) => (
                      <li key={date.toISOString()}>{formatEventDate(date)}</li>
                    ))}
                  </ul>
                  {Number(form.recurrenceCount) > repeatingDatePreview.length && (
                    <p className="mt-2 text-xs text-gray-500">
                      + {Number(form.recurrenceCount) - repeatingDatePreview.length} more dates
                    </p>
                  )}
                </div>
              )}
              {recurrencePreview && (
                <div className="mt-4 rounded-xl bg-[#f7f3ef] p-4 text-sm text-gray-700">
                  <p className="font-semibold text-[#6f4f34]">Change preview</p>
                  <p className="mt-1">
                    {recurrencePreview.affectedEvents} events and {recurrencePreview.affectedAssignments} assignments will be affected.
                  </p>
                  <p className="mt-1">
                    {recurrencePreview.peopleToNotify} people will receive change notices after published events are updated.
                  </p>
                  {recurrencePreview.conflicts?.length > 0 && (
                    <p className="mt-2 font-semibold text-amber-800">
                      {recurrencePreview.conflicts.length} schedule {recurrencePreview.conflicts.length === 1 ? "conflict needs" : "conflicts need"} review.
                    </p>
                  )}
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {recurrencePreview.dates.map((date) => (
                      <li key={date}>{formatEventDate(date)}</li>
                    ))}
                    {recurrencePreview.remainingDates > 0 && (
                      <li>+ {recurrencePreview.remainingDates} more dates</li>
                    )}
                  </ul>
                </div>
              )}
            </fieldset>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {form.eventId ? (
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white hover:bg-[#6f4f34] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckIcon className="size-5" />
                {isSaving
                  ? "Saving..."
                  : form.updateScope === "this_and_future" && !recurrencePreview
                    ? "Preview changes"
                    : form.updateScope === "this_and_future"
                      ? "Apply to this and future events"
                      : "Update event"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  isSaving ||
                  priestPublishNeedsAssignment
                }
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {form.sourceEventId ? (
                  <DocumentDuplicateIcon className="size-5" />
                ) : (
                  <CheckIcon className="size-5" />
                )}
                {isSaving
                  ? "Publishing..."
                  : form.sourceEventId
                    ? "PUBLISH COPY"
                    : "PUBLISH EVENT"}
              </button>
            )}
          </div>
          {priestPublishNeedsAssignment && !form.eventId && !form.sourceEventId && (
            <p className="mt-2 text-sm font-semibold text-orange-700">
              Select a priest covered by the Priory allocation before publishing.
            </p>
          )}
        </form>
      )}

      {activeAction.id !== "add-event" &&
        !form.eventId &&
        !form.sourceEventId && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  downloadEventSchedulePdf({
                    ministryName: data.ministry.name,
                    events,
                    ...getEventRange(events),
                    filterLabel: "All Events",
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600"
              >
                <DocumentArrowDownIcon className="size-4" /> Download PDF
              </button>
            </div>
            {events.length ? (
              events.map((event) => (
                <article
                  key={event.id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => onEventSelect?.(event)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#896542]">
                        {formatEventDate(event.start_time)}
                      </p>
                      <h3 className="mt-1 font-semibold text-gray-900">
                        {event.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {event.template_name || "Copied event"} ·{" "}
                        {event.responsibility_count} responsibilities
                        {event.recurrence_group_id ? " · Repeating" : ""}
                      </p>
                      {event.rooms?.length > 0 && (
                        <p className="mt-1 text-sm text-gray-500">
                          {event.rooms.map((room) => room.name).join(", ")}
                        </p>
                      )}
                      {event.conflict_override && (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 text-xs font-semibold text-white">
                          <ExclamationTriangleIcon className="size-3.5" /> Schedule overlap ignored
                        </p>
                      )}
                    </button>
                    <span className="self-start rounded-full bg-gray-100 px-2 py-1 text-xs uppercase text-gray-500 sm:self-auto">
                      {event.status}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {activeAction.id === "modify" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => editEvent(event)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-[#C1A387]"
                          >
                            <PencilSquareIcon className="size-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => prepareClone(event)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-[#C1A387]"
                          >
                            <DocumentDuplicateIcon className="size-4" />
                            Copy
                          </button>
                          {event.status === "draft" && (
                            <button
                              type="button"
                              onClick={() =>
                                setEventStatus(event, "published")
                              }
                              className="rounded-lg bg-[#896542] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34]"
                            >
                              Publish
                            </button>
                          )}
                        </>
                      ) : (
                        event.status !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() =>
                              setEventStatus(event, "cancelled")
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                          >
                            <NoSymbolIcon className="size-4" />
                            Cancel
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-[#d8c7b8] bg-white/70 p-8 text-center text-sm text-gray-500">
                No events are available in this view.
              </p>
            )}
          </div>
        )}
    </div>
  )
}

export default MinistryEvents
