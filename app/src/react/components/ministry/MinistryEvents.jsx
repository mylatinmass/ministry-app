import * as React from "react"
import {
  CheckIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryOrdoReference from "./MinistryOrdoReference"
import MinistryTemplates from "./MinistryTemplates"
import useAccessibleDialog from "../../hooks/useAccessibleDialog"
import {
  downloadEventSchedulePdf,
  getEventRange,
} from "./downloadEventSchedulePdf"

const VENUE_FIELDS = [
  ["venueName", "Venue name"], ["address1", "Address line 1"],
  ["address2", "Address line 2"], ["city", "City"],
  ["region", "State or region"], ["postalCode", "Postal code"], ["country", "Country"],
]

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

const nextWeekInputValue = (value) => {
  if (!value) return ""
  const date = new Date(value)
  date.setDate(date.getDate() + 7)
  return toInputValue(date)
}

const padTimePart = (value) => String(value).padStart(2, "0")
const monthOptions = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(2020, index, 1))),
)
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()

const nextDate = (date) => {
  const noon = new Date(`${date}T12:00`)
  noon.setDate(noon.getDate() + 1)
  return toInputValue(noon).slice(0, 10)
}

const endAtClockTime = (startTime, clockTime) => {
  const [date, startClock] = startTime.split("T")
  return `${clockTime < startClock ? nextDate(date) : date}T${clockTime}`
}

const EventFormDropdown = ({ label, value, icon: Icon, disabled = false, fullWidth = false, highlight = false, children }) => {
  const [open, setOpen] = React.useState(false)
  const dropdownRef = React.useRef(null)
  const buttonRef = React.useRef(null)
  const panelId = React.useId()
  const expanded = open && !disabled

  React.useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  React.useEffect(() => {
    if (!expanded) return
    const dismissOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener("pointerdown", dismissOutside, true)
    return () => document.removeEventListener("pointerdown", dismissOutside, true)
  }, [expanded])

  const triggerClass = "flex min-h-11 w-full items-center gap-2 border px-2 py-2 text-left text-sm transition-colors sm:px-3"
  if (disabled) {
    return <button type="button" disabled aria-label={label}
      className={`${triggerClass} cursor-not-allowed rounded-lg border-gray-200 bg-gray-100 text-gray-400`}>{value}</button>
  }
  return (
    <div ref={dropdownRef} className={`relative min-w-0 ${expanded ? "z-30" : ""}`} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false)
      }
    }} onKeyDown={(event) => {
      if (event.key === "Escape" && expanded) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        buttonRef.current?.focus()
      }
    }}>
      <button ref={buttonRef} type="button" aria-label={`${label}, ${value}`}
        aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen((current) => !current)}
        className={`${triggerClass} rounded-t-lg ${expanded ? "rounded-b-none border-[#c1a387] bg-white" : "rounded-b-lg border-gray-200 bg-gray-50 hover:bg-white"} ${highlight ? "font-semibold text-orange-700" : "text-gray-900"}`}>
        {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
        <span>{value}</span>
        <ChevronDownIcon aria-hidden="true" className={`ml-auto size-4 shrink-0 text-gray-500 transition-transform duration-150 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div id={panelId} aria-hidden={!expanded} inert={expanded ? undefined : ""}
        className={`absolute top-full -mt-px origin-top rounded-b-lg border border-[#c1a387] bg-white p-3 shadow-lg transition-[opacity,translate,scale,visibility] duration-150 ease-out motion-reduce:transition-none ${fullWidth ? "inset-x-0" : `w-52 max-w-[calc(100vw-2rem)] ${Icon ? "left-0" : "right-0"}`} ${expanded ? "visible translate-y-0 scale-y-100 opacity-100" : "invisible pointer-events-none -translate-y-1 scale-y-95 opacity-0"}`}>
        {children}
      </div>
    </div>
  )
}

const EventDateSelect = ({ label, value, onChange, min, max, placeholder }) => {
  const [year, month, day] = value.split("-").map(Number)
  const currentYear = new Date().getFullYear()
  const updateDate = (year, month, day) => {
    const validDay = Math.min(day, daysInMonth(year, month))
    const date = `${year}-${padTimePart(month)}-${padTimePart(validDay)}`
    onChange(min && date < min ? min : max && date > max ? max : date)
  }
  const labelDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${value}T12:00`))
  return (
    <EventFormDropdown label={label} value={placeholder || labelDate} icon={CalendarDaysIcon}>
      <div role="group" aria-label={`${label} year`} className="mb-2 inline-flex rounded-xl bg-gray-50 p-1">
        {[currentYear, currentYear + 1].map((option) => (
          <button key={option} type="button" aria-pressed={year === option}
            onClick={() => updateDate(option, month, day)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${year === option ? "bg-white text-orange-700 shadow-sm" : "text-gray-600"}`}>
            {option}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <select aria-label={`${label} month`} value={month}
          onChange={(event) => updateDate(year, Number(event.target.value), day)}
          className="min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm">
          {monthOptions.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
        </select>
        <select aria-label={`${label} day`} value={day}
          onChange={(event) => updateDate(year, month, Number(event.target.value))}
          className="min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm">
          {Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1)
            .map((day) => <option key={day} value={day}>{day}</option>)}
        </select>
      </div>
      {placeholder && <button type="button" onClick={() => onChange(value)}
        className="mt-2 rounded-md px-2 py-1 text-sm font-semibold text-[#6f4f34] hover:bg-[#f7f3ef]">
        Use this date
      </button>}
    </EventFormDropdown>
  )
}

const EventTimeSelect = ({ label, value, onChange, disabled, placeholder }) => {
  const [hour, minute] = value.slice(11, 16).split(":").map(Number)
  const time = { hour: hour % 12 || 12, minute, period: hour < 12 ? "AM" : "PM" }
  const updateTime = (key, value) => {
    const next = { ...time, [key]: value }
    const hour = next.hour % 12 + (next.period === "PM" ? 12 : 0)
    onChange(`${padTimePart(hour)}:${padTimePart(next.minute)}`)
  }
  const selectClass = "min-w-0 w-full appearance-none rounded-lg border border-gray-200 bg-white px-1 py-2 text-center text-sm text-gray-900 sm:appearance-auto sm:px-2"
  return (
    <EventFormDropdown label={label} value={disabled ? "—" : placeholder || `${time.hour}:${padTimePart(minute)} ${time.period}`} disabled={disabled}>
      <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-1 sm:gap-2">
        <select aria-label={`${label} hour`} value={time.hour} onChange={(event) => updateTime("hour", Number(event.target.value))} className={selectClass}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
        </select>
        <select aria-label={`${label} minute`} value={time.minute} onChange={(event) => updateTime("minute", Number(event.target.value))} className={selectClass}>
          {Array.from({ length: 60 }, (_, minute) => <option key={minute} value={minute}>{padTimePart(minute)}</option>)}
        </select>
        <select aria-label={`${label} AM or PM`} value={time.period} onChange={(event) => updateTime("period", event.target.value)} className={selectClass}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {placeholder && <button type="button" onClick={() => onChange(value.slice(11, 16))}
        className="mt-2 rounded-md px-2 py-1 text-sm font-semibold text-[#6f4f34] hover:bg-[#f7f3ef]">
        Use this time
      </button>}
    </EventFormDropdown>
  )
}

const initialForm = (date = "") => ({
  eventId: "",
  sourceEventId: "",
  templateId: "",
  originalTemplateId: "",
  title: "",
  description: "",
  location: "",
  venueType: "chapel",
  venueName: "",
  address1: "",
  address2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  venueNotes: "",
  participatingMinistryIds: [],
  allMembersSelected: false,
  useTemplatePositions: false,
  roomIds: [],
  startTime: `${date || toInputValue(new Date()).slice(0, 10)}T09:00`,
  endTime: "",
  endDate: "",
  allDay: false,
  confirmationDeadline: "",
  recurrenceFrequency: "none",
  recurrenceInterval: 1,
  recurrenceCount: 12,
  recurrenceWeekday: 5,
  recurrenceOrdinal: 1,
  updateScope: "this_event",
  participationType: "members",
  visibility: "public",
  inlineResponsibilities: [],
  copyCount: 1,
  copySourceRoster: true,
})

const cloneFormForEvent = (event) => ({
  ...initialForm(),
  sourceEventId: event.id,
  templateId: "",
  title: event.title,
  description: event.description || "",
  location: event.location || "",
  roomIds: event.room_ids || event.rooms?.map((room) => room.id) || [],
  startTime: nextWeekInputValue(event.start_time),
  endTime: nextWeekInputValue(event.end_time),
  participationType: event.participation_type || "members",
  visibility: event.visibility || "public",
  copySourceRoster: true,
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

const MinistryEvents = ({ data: workspaceData, activeAction, onEventSelect, ministries, onMinistryChange }) => {
  const [localMinistry, setLocalMinistry] = React.useState(null)
  React.useEffect(() => setLocalMinistry(null), [workspaceData.ministry.id])
  const data = localMinistry && !onMinistryChange
    ? { ...workspaceData, ministry: localMinistry }
    : workspaceData
  const canManageRecurrence = ["owner", "super_admin"].includes(
    data.user?.globalRole,
  )
  const [templates, setTemplates] = React.useState([])
  const [managedMinistries, setManagedMinistries] = React.useState([])
  const availableMinistries = ministries || managedMinistries
  const ministryChoices = availableMinistries.some((ministry) => ministry.id === data.ministry.id)
    ? availableMinistries : [data.ministry, ...availableMinistries]
  const [events, setEvents] = React.useState([])
  const [rooms, setRooms] = React.useState([])
  const [form, setForm] = React.useState(() =>
    activeAction?.event ? cloneFormForEvent(activeAction.event) : initialForm(activeAction?.date),
  )
  const isNewEvent = !form.eventId && !form.sourceEventId
  const selectedMinistryIds = form.allMembersSelected
    ? ministryChoices.map((ministry) => ministry.id)
    : form.participatingMinistryIds
  const selectedMinistryNames = ministryChoices
    .filter((ministry) => selectedMinistryIds.includes(ministry.id))
    .map((ministry) => ministry.name)
  const canAddAttendanceCall = form.visibility !== "private" && form.participationType !== "volunteers"
  const startDate = form.startTime.slice(0, 10)
  const isAllDay = isNewEvent && form.allDay
  const defaultEndTime = isNewEvent
    ? toInputValue(new Date(new Date(form.startTime).getTime() + 3_600_000))
    : ""
  const timedEnd = form.endTime || defaultEndTime
  const endDate = form.endDate || (isAllDay ? startDate : timedEnd.slice(0, 10))
  const schedulingStartTime = isAllDay ? `${startDate}T00:00` : form.startTime
  const schedulingEndTime = isAllDay
    ? `${nextDate(endDate)}T00:00`
    : form.endDate ? `${form.endDate}T${timedEnd.slice(11, 16)}` : timedEnd
  const deadlineValue = form.confirmationDeadline || toInputValue(
    new Date(new Date(schedulingStartTime || toInputValue(new Date())).getTime() - 3_600_000),
  )
  const deadlineTooLate = Boolean(form.confirmationDeadline && schedulingStartTime &&
    form.confirmationDeadline >= schedulingStartTime)
  const [showTemplateForm, setShowTemplateForm] = React.useState(false)
  const closeTemplateForm = React.useCallback(() => setShowTemplateForm(false), [])
  const templateDialogRef = useAccessibleDialog(showTemplateForm, closeTemplateForm)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [templatePreview, setTemplatePreview] = React.useState(null)
  const [assignmentCandidates, setAssignmentCandidates] = React.useState({})
  const [availableMinistryMembers, setAvailableMinistryMembers] = React.useState([])
  const [memberPreview, setMemberPreview] = React.useState(null)
  const [assignmentSelections, setAssignmentSelections] = React.useState({})
  const [isLoadingCandidates, setIsLoadingCandidates] = React.useState(false)
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
    () => previewRepeatingDates({ ...form, startTime: schedulingStartTime }),
    [form, schedulingStartTime],
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
      setManagedMinistries(templateResult.manageableMinistries || [])
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
    setForm(
      activeAction?.event
        ? cloneFormForEvent(activeAction.event)
        : initialForm(activeAction.date),
    )
    setMessage("")
    setErrorMessage("")
  }, [activeAction.id, activeAction.event, activeAction.date])

  React.useEffect(() => {
    if (
      form.eventId ||
      form.sourceEventId ||
      !form.templateId ||
      !schedulingStartTime ||
      !schedulingEndTime
    ) {
      setAssignmentCandidates({})
      return undefined
    }
    const start = new Date(schedulingStartTime)
    const end = new Date(schedulingEndTime)
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
    schedulingEndTime,
    form.eventId,
    form.sourceEventId,
    schedulingStartTime,
    form.templateId,
  ])

  React.useEffect(() => {
    if (
      form.eventId ||
      form.sourceEventId ||
      !schedulingStartTime ||
      !schedulingEndTime ||
      form.participationType === "volunteers"
    ) {
      setAvailableMinistryMembers([])
      setMemberPreview(null)
      return undefined
    }
    const start = new Date(schedulingStartTime)
    const end = new Date(schedulingEndTime)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setAvailableMinistryMembers([])
      return undefined
    }
    const controller = new AbortController()
    const expectedAttendance = form.inlineResponsibilities.find(
      (item) => item.assignmentMode === "all_available_members",
    )
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(getFunctionEndpoint("scheduling/events"), {
          method: "POST",
          headers: requestHeaders(),
          signal: controller.signal,
          body: JSON.stringify({
            action: "preview_ministry_members",
            ministryId: data.ministry.id,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            audienceScope: expectedAttendance?.audienceScope || "ministry",
            requiredLevelId: expectedAttendance?.requiredLevelId || "",
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || "Unable to load members")
        setAvailableMinistryMembers(result.members || [])
        setMemberPreview(result.preview || null)
      } catch (error) {
        if (error.name !== "AbortError") setErrorMessage(error.message)
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    data.ministry.id,
    schedulingEndTime,
    form.eventId,
    form.participationType,
    form.sourceEventId,
    schedulingStartTime,
    form.inlineResponsibilities,
  ])

  React.useEffect(() => {
    if (
      data.ministry?.slug !== "priests" ||
      !schedulingStartTime ||
      !schedulingEndTime
    ) {
      setPrioryOverview(null)
      return undefined
    }
    const start = new Date(schedulingStartTime)
    const end = new Date(schedulingEndTime)
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
  }, [data.ministry?.slug, schedulingEndTime, schedulingStartTime])

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
    setConflictPreview(null)
    if (field !== "templateId") setTemplatePreview(null)
    if (["startTime", "endTime", "endDate", "allDay"].includes(field)) {
      setAssignmentSelections({})
    }
    if (field === "participationType" && value === "volunteers") {
      setAssignmentSelections({})
    }
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateNewEventStart = (startTime) => {
    setConflictPreview(null)
    setAssignmentSelections({})
    setForm((current) => ({
      ...current,
      startTime,
      endTime: current.endTime ? endAtClockTime(startTime, current.endTime.slice(11, 16)) : "",
      endDate: current.endDate && current.endDate < startTime.slice(0, 10)
        ? startTime.slice(0, 10) : current.endDate,
    }))
  }

  const selectTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId)
    const privateByDefault = /sick call|private appointment|travel/i.test(
      template?.name || "",
    )
    setForm((current) => ({
      ...current,
      templateId,
      title: current.title || template?.name || "",
      participationType: current.participationType,
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

  const changeSelectedMinistry = (ministryId, checked) => {
    const nextIds = checked
      ? [...form.participatingMinistryIds, ministryId]
      : form.participatingMinistryIds.filter((id) => id !== ministryId)
    updateField("participatingMinistryIds", nextIds)
    if (!nextIds.length || nextIds.includes(data.ministry.id)) return
    const nextMinistry = ministryChoices.find((ministry) => ministry.id === nextIds[0])
    if (!nextMinistry) return
    selectTemplate("")
    setTemplates([])
    if (onMinistryChange) onMinistryChange(nextMinistry.id)
    else setLocalMinistry(nextMinistry)
  }

  const updateAssignmentSelection = (slotKey, userId) => {
    setAssignmentSelections((current) => ({ ...current, [slotKey]: userId }))
  }

  const addInlineResponsibility = (assignmentMode = "standard") => {
    const key = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setForm((current) => ({
      ...current,
      inlineResponsibilities: [
        ...current.inlineResponsibilities,
        {
          key,
          name:
            assignmentMode === "all_available_members"
              ? "Expected ministry attendance"
              : "",
          assignmentMode,
          audienceScope: "ministry",
          requiredLevelId: "",
          preferredAssigneeUserId: "",
          quantityNeeded: 1,
          responsibilityType: "position",
          relativeStartMinutes: 0,
          substitutionAllowed: assignmentMode === "standard",
          isRequired: assignmentMode === "standard",
        },
      ],
    }))
  }

  const updateInlineResponsibility = (key, field, value) => {
    setForm((current) => ({
      ...current,
      inlineResponsibilities: current.inlineResponsibilities.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    }))
  }

  const removeInlineResponsibility = (key) => {
    setForm((current) => ({
      ...current,
      inlineResponsibilities: current.inlineResponsibilities.filter(
        (item) => item.key !== key,
      ),
    }))
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
    })
  }

  const prepareClone = (event) => setForm(cloneFormForEvent(event))

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
      if (isNewEvent && form.participationType === "members" && !selectedMinistryIds.length) {
        throw new Error("Select a ministry or choose All Members.")
      }
      if (deadlineTooLate) throw new Error("The RSVP deadline must be before the event starts.")
      const editing = Boolean(form.eventId)
      const cloning = Boolean(form.sourceEventId)
      const requestedUpdateScope =
        editing && form.recurrenceFrequency !== "none"
          ? event.nativeEvent?.submitter?.value === "this_and_future"
            ? "this_and_future"
            : "this_event"
          : form.updateScope
      const body = {
        ...form,
        ministryId: data.ministry.id,
        startTime: new Date(schedulingStartTime).toISOString(),
        endTime: isNewEvent && !isAllDay && !form.endTime && !form.endDate
          ? null : new Date(schedulingEndTime).toISOString(),
        ...(isNewEvent ? {
          location: form.venueType === "chapel"
            ? "Our Chapel"
            : [form.venueName, form.address1, form.address2,
                [form.city, form.region, form.postalCode].filter(Boolean).join(" "),
                form.country, form.venueNotes]
                .map((value) => value.trim()).filter(Boolean).join(", "),
          roomIds: form.venueType === "chapel" ? form.roomIds : [],
          participatingMinistryIds: form.participationType === "members"
            ? selectedMinistryIds.filter((id) => id !== data.ministry.id)
            : [],
          inlineResponsibilities: form.participationType === "volunteers" ? [] :
            form.inlineResponsibilities
              .filter((item) => canAddAttendanceCall || item.assignmentMode === "standard")
              .map((item) => form.visibility === "ministry" && item.audienceScope === "all"
                ? { ...item, audienceScope: "ministry" }
                : item),
        } : {}),
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
        updateScope: requestedUpdateScope,
        action: cloning ? "clone" : undefined,
        status: editing ? undefined : "published",
        assignments:
          !editing &&
          !cloning && form.useTemplatePositions &&
          form.participationType !== "volunteers"
            ? Object.entries(assignmentSelections)
                .filter(([, userId]) => Boolean(userId))
                .map(([slotKey, userId]) => ({
                  templateResponsibilityId: slotKey.split(":")[0],
                  userId,
                }))
            : [],
      }
      if (!(editing && requestedUpdateScope === "this_and_future")) {
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
    activeAction.id === "clone-event" ||
    (activeAction.id === "modify" &&
      Boolean(form.eventId || form.sourceEventId))
  const selectedAssignmentUserIds = new Set(
    Object.values(assignmentSelections).filter(Boolean),
  )

  if (isLoading && !showForm) {
    return <p className="p-6 text-center text-gray-500">Loading events...</p>
  }

  return (
    <div className="space-y-6">
      {showTemplateForm && (
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/40 p-4">
          <section ref={templateDialogRef} role="dialog" aria-modal="true" aria-labelledby="new-event-template-title" tabIndex={-1}
            className="mx-auto max-w-4xl rounded-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="new-event-template-title" className="century-font text-2xl">New template</h2>
              <button type="button" onClick={closeTemplateForm} className="rounded-lg border border-gray-200 px-3 py-2">Close</button>
            </div>
            <MinistryTemplates data={data} activeAction={{ id: "new-template" }}
              onTemplateCreated={(templateId, name) => {
                closeTemplateForm()
                setForm((current) => ({ ...current, templateId, title: current.title || name }))
                loadData()
              }} />
          </section>
        </div>
      )}
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
                  {conflict.copyStartTime && (
                    <span> · Copy on {formatEventDate(conflict.copyStartTime)}</span>
                  )}
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
          className={
            activeAction.id === "add-event"
              ? "w-full border-0 bg-white p-0 shadow-none"
              : "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
          }
        >
          {isNewEvent && (
            <div className="mb-5">
              <MinistryOrdoReference summaryOnly startTime={form.startTime || new Date().toISOString()} />
            </div>
          )}
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
            <div role="group" aria-label="Event frequency" className="mt-5 inline-flex flex-wrap rounded-xl bg-gray-50 p-1">
              <button
                type="button"
                aria-pressed={!creatingRepeatingEvent}
                onClick={() => {
                  setCreatingRepeatingEvent(false)
                  updateField("recurrenceFrequency", "none")
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  !creatingRepeatingEvent
                    ? "bg-white text-[#6f4f34] shadow-sm"
                    : "text-gray-600"
                }`}
              >
                One Time Event
              </button>
              <button
                type="button"
                aria-pressed={creatingRepeatingEvent}
                onClick={() => {
                  setCreatingRepeatingEvent(true)
                  updateField("recurrenceFrequency", "weekly")
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  creatingRepeatingEvent
                    ? "bg-white text-[#6f4f34] shadow-sm"
                    : "text-gray-600"
                }`}
              >
                Repeating Event
              </button>
            </div>
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
              Event name
              <input
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                required
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/15 disabled:bg-gray-50 disabled:text-gray-600"
              />
            </label>
            {isNewEvent ? (
              <fieldset className="min-w-0 sm:col-span-2">
                <legend className="text-sm font-semibold text-gray-700">Date &amp; time</legend>
                <div className="mt-2 grid grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-2 sm:gap-x-3">
                  <span className="text-right text-sm font-medium text-gray-700">From</span>
                  <EventDateSelect label="Start date" value={startDate}
                    onChange={(date) => updateNewEventStart(`${date}T${form.startTime.slice(11, 16)}`)} />
                  <EventTimeSelect label="Start time" value={form.startTime} disabled={isAllDay}
                    onChange={(clockTime) => updateNewEventStart(`${startDate}T${clockTime}`)} />
                  <span className="text-right text-sm font-medium text-gray-700">To</span>
                  <EventDateSelect label="End date" value={endDate} min={startDate}
                    onChange={(date) => updateField("endDate", date)} />
                  <EventTimeSelect label="End time" value={timedEnd} disabled={isAllDay}
                    onChange={(clockTime) => updateField("endTime", endAtClockTime(form.startTime, clockTime))} />
                  <label className="col-start-2 col-span-2 flex items-center gap-2 py-1 text-sm text-gray-700">
                    <input type="checkbox" checked={isAllDay} className="size-4 accent-orange-600"
                      onChange={(event) => updateField("allDay", event.target.checked)} />
                    All Day
                  </label>
                </div>
              </fieldset>
            ) : <>
            <label className="text-sm font-semibold text-gray-700">
              Start time
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
              End time
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
            </>}
            <fieldset className="min-w-0 sm:col-span-2">
              <legend className="text-sm font-semibold text-gray-700">RSVP deadline</legend>
              <div className="mt-2 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2 sm:gap-3">
                <EventDateSelect label="RSVP date" value={deadlineValue.slice(0, 10)} max={schedulingStartTime.slice(0, 10)}
                  placeholder={!form.confirmationDeadline && "Select date"}
                  onChange={(date) => updateField("confirmationDeadline", `${date}T${deadlineValue.slice(11, 16)}`)} />
                <EventTimeSelect label="RSVP time" value={deadlineValue}
                  placeholder={!form.confirmationDeadline && "Select time"}
                  onChange={(time) => updateField("confirmationDeadline", `${deadlineValue.slice(0, 10)}T${time}`)} />
              </div>
              <div className="mt-2 flex items-start justify-between gap-2 text-xs text-gray-500">
                {deadlineTooLate
                  ? <span role="alert" className="text-red-700">Choose a deadline before the event starts.</span>
                  : <span>Optional. The app chooses a deadline if you leave it blank.</span>}
                {form.confirmationDeadline && (
                  <button type="button" onClick={() => updateField("confirmationDeadline", "")}
                    className="shrink-0 font-semibold text-[#6f4f34] hover:underline">Clear</button>
                )}
              </div>
            </fieldset>
            {canManageRecurrence &&
              ((creatingRepeatingEvent && !form.eventId && !form.sourceEventId) ||
                (form.eventId && form.recurrenceFrequency !== "none")) && (
              <fieldset className="rounded-xl border border-gray-100 p-4 sm:col-span-2">
                <legend className="px-2 text-sm font-semibold text-gray-700">
                  Repeating-event rule
                </legend>
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
                {!form.eventId && repeatingDatePreview.length > 0 && (
                  <div className="mt-4 rounded-xl bg-[#f7f3ef] p-4 text-sm text-gray-700">
                    <p className="font-semibold text-[#6f4f34]">Date preview</p>
                    <ul className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                      {repeatingDatePreview.map((date) => (
                        <li key={date.toISOString()}>
                          {isAllDay ? date.toLocaleDateString("en-US", { dateStyle: "medium" }) : formatEventDate(date)}
                        </li>
                      ))}
                    </ul>
                    {Number(form.recurrenceCount) > repeatingDatePreview.length && (
                      <p className="mt-2 text-xs text-gray-500">
                        + {Number(form.recurrenceCount) - repeatingDatePreview.length} more dates
                      </p>
                    )}
                  </div>
                )}
              </fieldset>
            )}
            {isNewEvent && (
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-semibold text-gray-700">Location</legend>
                <div className="mt-2 inline-flex rounded-xl bg-gray-50 p-1">
                  {[["chapel", "Our Chapel"], ["outside", "Outside Venue"]].map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={form.venueType === value}
                      onClick={() => updateField("venueType", value)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold ${form.venueType === value ? "bg-white text-[#6f4f34] shadow-sm" : "text-gray-600"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {isNewEvent && form.venueType === "outside" && (
              <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <legend className="sr-only">Outside venue address</legend>
                {VENUE_FIELDS.map(([field, label]) => (
                  <label key={field} className="text-sm font-semibold text-gray-700">
                    {label}
                    <input value={form[field]} onChange={(event) => updateField(field, event.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" />
                  </label>
                ))}
                <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                  Venue notes
                  <textarea value={form.venueNotes} onChange={(event) => updateField("venueNotes", event.target.value)}
                    placeholder="Parking or arrival instructions" rows={2}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal" />
                </label>
              </fieldset>
            )}
            {!isNewEvent && <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Location
              <input
                value={form.location}
                onChange={(event) =>
                  updateField("location", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal"
              />
            </label>}
            {(!isNewEvent || form.venueType === "chapel") && <fieldset className="sm:col-span-2">
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
            </fieldset>}
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Event description
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                rows={3}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal"
              />
            </label>
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
            </label>
            {isNewEvent && form.participationType === "members" && (
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-semibold text-gray-700">Select ministries</legend>
                <div className="mt-2">
                  <EventFormDropdown label="Select ministries" fullWidth highlight={selectedMinistryIds.length > 0}
                    value={form.allMembersSelected ? "ALL MEMBERS" : selectedMinistryNames.join(", ") || "Choose ministries"}>
                  <div className="max-h-56 overflow-y-auto">
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-gray-50 ${form.allMembersSelected ? "text-orange-700" : "text-gray-700"}`}>
                      <input type="checkbox" checked={form.allMembersSelected} className="size-4 accent-orange-600"
                        onChange={(event) => updateField("allMembersSelected", event.target.checked)} />
                      ALL MEMBERS
                    </label>
                    {!canManageRecurrence && (
                      <p className="px-3 pb-2 text-xs text-gray-500">Includes the ministries you administer.</p>
                    )}
                    <div className="border-t border-gray-100 pt-1">
                      {ministryChoices.map((ministry) => {
                        const checked = !form.allMembersSelected && form.participatingMinistryIds.includes(ministry.id)
                        return (
                          <label key={ministry.id}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${form.allMembersSelected
                              ? "cursor-not-allowed text-gray-400"
                              : checked ? "cursor-pointer font-semibold text-orange-700 hover:bg-orange-50" : "cursor-pointer text-gray-700 hover:bg-gray-50"}`}>
                            <input type="checkbox" checked={checked} disabled={form.allMembersSelected}
                              className="size-4 accent-orange-600"
                              onChange={(event) => changeSelectedMinistry(ministry.id, event.target.checked)} />
                            {ministry.name}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  </EventFormDropdown>
                </div>
              </fieldset>
            )}
          </div>

          {!form.eventId && !form.sourceEventId && (
            <div className="mt-5 flex items-end gap-2"><label className="min-w-0 flex-1 text-sm font-semibold text-gray-700">
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
            </label>
            <button type="button" aria-label="Create a template" onClick={() => setShowTemplateForm(true)} className="size-12 shrink-0 rounded-xl border border-gray-200 text-[#6f4f34] hover:bg-gray-50"><PlusIcon aria-hidden="true" className="mx-auto size-5" /></button>
            </div>
          )}

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

          {form.sourceEventId && (
            <section className="mt-5 space-y-4 rounded-xl border border-[#d8c7b8] bg-[#fbf8f4] p-4">
              <label className="block text-sm font-semibold text-gray-700">
                Number of copies
                <input
                  type="number"
                  min="1"
                  max="52"
                  step="1"
                  required
                  value={form.copyCount}
                  onChange={(event) => updateField("copyCount", event.target.value)}
                  className="ml-3 w-20 rounded-lg border border-gray-200 bg-white px-3 py-2"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  The first copy uses the date above. Each additional copy starts one week later at the same chapel time.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.copySourceRoster}
                  onChange={(event) => updateField("copySourceRoster", event.target.checked)}
                  className="mt-0.5 size-4 accent-[#896542]"
                />
                <span>
                  <span className="block font-semibold">Call the source event roster to attend</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    Everyone assigned to the original event will be expected at each copy when available. They can choose Can’t attend.
                  </span>
                </span>
              </label>
            </section>
          )}

          {!form.eventId &&
            !form.sourceEventId &&
            form.participationType !== "volunteers" && (
              <section className="mt-5 rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Positions
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Add required positions only if this event needs them.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addInlineResponsibility("standard")}
                      className="rounded-lg border border-[#C1A387] bg-white px-3 py-2 text-sm font-semibold text-[#6f4f34]"
                    >
                      Add required position
                    </button>
                    {canAddAttendanceCall && <button
                      type="button"
                      disabled={form.inlineResponsibilities.some(
                        (item) => item.assignmentMode === "all_available_members",
                      )}
                      onClick={() => addInlineResponsibility("all_available_members")}
                      className="rounded-lg bg-[#896542] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Add attendance call
                    </button>}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {form.inlineResponsibilities.filter((item) => canAddAttendanceCall || item.assignmentMode === "standard").map((responsibility) => (
                    <div key={responsibility.key} className="flex flex-wrap items-end gap-3 rounded-xl bg-[#f7f3ef] p-4">
                      {responsibility.assignmentMode === "all_available_members" ? (
                        <label className="min-w-0 flex-1 text-sm font-semibold text-gray-700">
                          Attendance notification
                          <select value={form.visibility === "ministry" ? "ministry" : responsibility.audienceScope} onChange={(event) =>
                            updateInlineResponsibility(responsibility.key, "audienceScope", event.target.value)
                          } className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal">
                            <option value="ministry">{form.participationType === "members" ? "All members of selected ministries" : "All members of the lead ministry"}</option>
                            {canManageRecurrence && form.visibility === "public" && <option value="all">All members</option>}
                          </select>
                        </label>
                      ) : (
                        <>
                          <label className="min-w-0 flex-1 text-sm font-semibold text-gray-700">
                            Position
                            <input value={responsibility.name} onChange={(event) =>
                              updateInlineResponsibility(responsibility.key, "name", event.target.value)
                            } required className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal" />
                          </label>
                          <label className="min-w-0 flex-1 text-sm font-semibold text-gray-700">
                            Assigned member
                            <select value={responsibility.preferredAssigneeUserId} onChange={(event) =>
                              updateInlineResponsibility(responsibility.key, "preferredAssigneeUserId", event.target.value)
                            } disabled={!form.startTime || !schedulingEndTime}
                              className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal">
                              <option value="">Leave blank</option>
                              {availableMinistryMembers.map((member) => (
                                <option key={member.userId} value={member.userId}>{member.firstName} {member.lastName}</option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}
                      <button type="button" onClick={() => removeInlineResponsibility(responsibility.key)}
                        aria-label={`Remove ${responsibility.name || "position"}`}
                        className="rounded-lg border border-red-200 bg-white px-3 py-3 text-sm font-semibold text-red-700">
                        Remove
                      </button>
                    </div>
                  ))}
                  {form.inlineResponsibilities.some(
                    (item) => item.assignmentMode === "all_available_members",
                    ) && memberPreview && selectedMinistryIds.length <= 1 && (
                    <p className="rounded-lg bg-white px-3 py-2 text-sm text-gray-600">
                      {memberPreview.expectedCount} expected · {memberPreview.unavailableCount} unavailable · {memberPreview.conflictCount} schedule conflict{memberPreview.conflictCount === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              </section>
            )}

          {isNewEvent && selectedTemplate?.responsibilities?.some((item) => item.assignmentMode === "standard") && (
            <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={form.useTemplatePositions}
                onChange={(event) => updateField("useTemplatePositions", event.target.checked)} />
              Include the template’s positions
            </label>
          )}

          {!form.eventId &&
            !form.sourceEventId &&
            form.useTemplatePositions &&
            selectedTemplate?.responsibilities?.some((item) => item.assignmentMode === "standard") && (
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
                  {form.participationType !== "volunteers" && (
                      <button
                        type="button"
                        onClick={autoAssign}
                        disabled={isLoadingCandidates || !form.startTime || !schedulingEndTime}
                        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {isLoadingCandidates ? "Checking members…" : "Auto Assignments"}
                      </button>
                    )}
                </div>
                {form.participationType === "volunteers" ? (
                  <p className="mt-4 rounded-lg bg-[#f7f3ef] p-3 text-sm text-gray-600">
                    Volunteer positions remain blank for public signup and cannot be auto-assigned.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {creatingRepeatingEvent && (
                      <p className="rounded-lg bg-[#f7f3ef] p-3 text-sm text-gray-600">
                        A selected member stays assigned across the series when available. Unavailable dates remain open for leader review.
                      </p>
                    )}
                    {selectedTemplate.responsibilities.filter((item) => item.assignmentMode === "standard").map((responsibility) => (
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
                                    disabled={!form.startTime || !schedulingEndTime || isLoadingCandidates}
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

          <div className="mt-6 flex flex-wrap gap-2">
            {form.eventId ? (
              canManageRecurrence && form.recurrenceFrequency !== "none" ? (
                <>
                  <button
                    type="submit"
                    name="updateScope"
                    value="this_event"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#896542] bg-white px-5 py-3 font-semibold text-[#6f4f34] hover:bg-[#f7f3ef] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckIcon className="size-5" />
                    {isSaving ? "Saving..." : "Update current event"}
                  </button>
                  <button
                    type="submit"
                    name="updateScope"
                    value="this_and_future"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white hover:bg-[#6f4f34] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckIcon className="size-5" />
                    {isSaving ? "Saving..." : "Update all future events"}
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white hover:bg-[#6f4f34] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckIcon className="size-5" />
                  {isSaving ? "Saving..." : "Update event"}
                </button>
              )
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
                    ? Number(form.copyCount) > 1
                      ? `PUBLISH ${form.copyCount} COPIES`
                      : "PUBLISH COPY"
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
