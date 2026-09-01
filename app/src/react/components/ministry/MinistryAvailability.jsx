import * as React from "react"
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  InformationCircleIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import useAccessibleDialog from "../../hooks/useAccessibleDialog"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistrySectionActions from "./MinistrySectionActions"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const OCCURRENCES = [
  ["every", "Every"],
  ["first", "First"],
  ["second", "Second"],
  ["third", "Third"],
  ["fourth", "Fourth"],
  ["last", "Last"],
]
const QUARTER_MINUTES = [0, 15, 30, 45]

const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const toMonthKey = (date) => toDateKey(date).slice(0, 7)

const getMonthCells = (month) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

const formatDate = (key) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00Z`))

const formatRuleTime = (value) => {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number)
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${hours >= 12 ? "PM" : "AM"}`
}

const formatExclusion = (window) =>
  window?.allDay
    ? "Unavailable all day"
    : `Unavailable ${formatRuleTime(`${String(Math.floor(window.start / 60)).padStart(2, "0")}:${String(window.start % 60).padStart(2, "0")}`)}–${formatRuleTime(`${String(Math.floor(window.end / 60)).padStart(2, "0")}:${String(window.end % 60).padStart(2, "0")}`)}`

const formatAvailabilityWindow = (window) =>
  `Available ${formatRuleTime(`${String(Math.floor(window.start / 60)).padStart(2, "0")}:${String(window.start % 60).padStart(2, "0")}`)}–${formatRuleTime(`${String(Math.floor(window.end / 60)).padStart(2, "0")}:${String(window.end % 60).padStart(2, "0")}`)}`

const minutesToTimeValue = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

const TimeSelect = ({ label, value, onChange, disabled }) => {
  const [rawHours, rawMinutes] = String(value || "00:00").split(":").map(Number)
  const minute = QUARTER_MINUTES.reduce((closest, option) =>
    Math.abs(option - rawMinutes) < Math.abs(closest - rawMinutes) ? option : closest,
  )
  const parts = {
    hour: rawHours % 12 || 12,
    minute,
    period: rawHours >= 12 ? "PM" : "AM",
  }
  const update = (field, nextValue) => {
    const next = { ...parts, [field]: field === "period" ? nextValue : Number(nextValue) }
    const hours = next.hour % 12 + (next.period === "PM" ? 12 : 0)
    onChange(`${String(hours).padStart(2, "0")}:${String(next.minute).padStart(2, "0")}`)
  }
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium text-gray-700">{label}</legend>
      <div className="mt-1 grid grid-cols-[1fr_1fr_1.1fr] gap-1">
        <select aria-label={`${label} hour`} value={parts.hour} onChange={(event) => update("hour", event.target.value)} className="min-w-0 rounded-xl border border-gray-300 px-2 py-2 disabled:bg-gray-100">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
        </select>
        <select aria-label={`${label} minute`} value={parts.minute} onChange={(event) => update("minute", event.target.value)} className="min-w-0 rounded-xl border border-gray-300 px-2 py-2 disabled:bg-gray-100">
          {QUARTER_MINUTES.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}
        </select>
        <select aria-label={`${label} AM or PM`} value={parts.period} onChange={(event) => update("period", event.target.value)} className="min-w-0 rounded-xl border border-gray-300 px-2 py-2 disabled:bg-gray-100">
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </fieldset>
  )
}

const AvailabilityLegend = () => (
  <ul className="space-y-4 text-sm text-gray-600">
    <li className="flex items-center gap-3">
      <span className="size-4 shrink-0 rounded-full ring-1 ring-[#C1A387]" style={{ backgroundImage: "linear-gradient(to bottom, #fff 0%, #fff 50%, #f4ede6 50%, #f4ede6 100%)" }} />
      <span><strong className="font-semibold text-gray-900">Partially available</strong><br />Available for only part of the day.</span>
    </li>
    <li className="flex items-center gap-3">
      <span className="size-4 shrink-0 rounded-full bg-[#f4ede6] ring-1 ring-[#d8c7b8]" />
      <span><strong className="font-semibold text-gray-900">Excluded by a rule</strong><br />A recurring exclusion marks this day unavailable.</span>
    </li>
    <li className="flex items-center gap-3">
      <span className="size-4 shrink-0 rounded-full bg-emerald-600" />
      <span><strong className="font-semibold text-gray-900">Explicitly available</strong><br />You marked the entire day available.</span>
    </li>
    <li className="flex items-center gap-3">
      <span className="size-4 shrink-0 rounded-full bg-[#f4ede6]" />
      <span><strong className="font-semibold text-gray-900">Unavailable</strong><br />A date override or unavailable range applies.</span>
    </li>
    <li className="flex items-center gap-3">
      <span className="size-4 shrink-0 rounded bg-[#eee2d5] ring-1 ring-[#C1A387]" />
      <span><strong className="font-semibold text-gray-900">Selected</strong><br />This is the date currently open for editing.</span>
    </li>
  </ul>
)

const MinistryAvailability = ({ ministryId = "" }) => {
  const [data, setData] = React.useState(null)
  const [activeMinistryId, setActiveMinistryId] = React.useState(ministryId)
  const [activeView, setActiveView] = React.useState("calendar")
  const [visibleMonth, setVisibleMonth] = React.useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [showsTwoMonths, setShowsTwoMonths] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState("")
  const [showPartialAvailability, setShowPartialAvailability] = React.useState(false)
  const [legendOpen, setLegendOpen] = React.useState(false)
  const closeLegend = React.useCallback(() => setLegendOpen(false), [])
  const legendDialogRef = useAccessibleDialog(legendOpen, closeLegend)
  const [partialAvailability, setPartialAvailability] = React.useState({
    startTime: "10:00",
    endTime: "13:00",
  })
  const [ruleMinistryIds, setRuleMinistryIds] = React.useState([])
  const [creatingRule, setCreatingRule] = React.useState(false)
  const [editingRule, setEditingRule] = React.useState(null)
  const [newRule, setNewRule] = React.useState({
    occurrence: "every",
    dayOfWeek: 6,
    startTime: "16:00",
    endTime: "17:00",
    allDay: false,
  })
  const [range, setRange] = React.useState({ startDate: "", endDate: "", label: "" })
  const [editingRangeId, setEditingRangeId] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [error, setError] = React.useState("")

  const headers = React.useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${window.sessionStorage.getItem(MINISTRY_SESSION_KEY)}`,
  }), [])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const requestedMonths = [visibleMonth]
      if (showsTwoMonths) {
        requestedMonths.push(
          new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
        )
      }
      const results = await Promise.all(requestedMonths.map(async (month) => {
        const url = new URL(
          getFunctionEndpoint("scheduling/availability"),
          window.location.origin,
        )
        if (ministryId) url.searchParams.set("ministryId", ministryId)
        if (activeMinistryId) {
          url.searchParams.set("availabilityMinistryId", activeMinistryId)
        }
        url.searchParams.set("month", toMonthKey(month))
        const response = await fetch(url, { headers: headers() })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || "Unable to load availability")
        return result
      }))
      const result = {
        ...results[0],
        effectiveDays: results.flatMap((item) => item.effectiveDays || []),
      }
      setData(result)
      if (!activeMinistryId && result.availabilityMinistryId) {
        setActiveMinistryId(result.availabilityMinistryId)
      }
      setRuleMinistryIds((current) => {
        const availableIds = new Set((result.ministries || []).map((item) => item.id))
        const validIds = current.filter((id) => availableIds.has(id))
        return validIds.length
          ? validIds
          : result.availabilityMinistryId
            ? [result.availabilityMinistryId]
            : []
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [activeMinistryId, headers, ministryId, showsTwoMonths, visibleMonth])

  React.useEffect(() => { load() }, [load])

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const updateMonthCount = () => setShowsTwoMonths(media.matches)
    updateMonthCount()
    media.addEventListener("change", updateMonthCount)
    return () => media.removeEventListener("change", updateMonthCount)
  }, [])

  const post = async (body, successMessage) => {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch(getFunctionEndpoint("scheduling/availability"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to update availability")
      setMessage(successMessage || result.message)
      await load()
      window.dispatchEvent(new Event("ministry-conflicts-updated"))
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const createRule = async (event) => {
    event.preventDefault()
    if (!ruleMinistryIds.length) {
      setMessage("")
      setError("Choose at least one ministry")
      return false
    }
    const saved = await post(
      {
        action: editingRule
          ? "update_availability_rule"
          : "create_availability_rule",
        ...(editingRule ? { ruleIds: editingRule.ruleIds } : {}),
        ministryIds: ruleMinistryIds,
        ...newRule,
      },
      editingRule ? "Exclusion rule updated" : "Exclusion rule created",
    )
    if (saved) {
      setCreatingRule(false)
      setEditingRule(null)
      setNewRule({
        occurrence: "every",
        dayOfWeek: 6,
        startTime: "16:00",
        endTime: "17:00",
        allDay: false,
      })
      if (ruleMinistryIds[0] !== activeMinistryId) {
        setActiveMinistryId(ruleMinistryIds[0])
        setSelectedDate("")
      }
    }
    return saved
  }

  const removeRule = (rule) => post(
    { action: "delete_availability_rule", ruleIds: rule.ruleIds },
    "Exclusion rule removed",
  )

  const editRule = (rule) => {
    setEditingRule(rule)
    setCreatingRule(true)
    setRuleMinistryIds(
      (data?.ministries || [])
        .filter((ministry) => rule.ministryIds.includes(ministry.id))
        .map((ministry) => ministry.id),
    )
    setNewRule({
      occurrence: rule.occurrence,
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime || "16:00",
      endTime: rule.endTime || "17:00",
      allDay: rule.allDay,
    })
  }

  const cancelRuleForm = () => {
    setCreatingRule(false)
    setEditingRule(null)
    setNewRule({
      occurrence: "every",
      dayOfWeek: 6,
      startTime: "16:00",
      endTime: "17:00",
      allDay: false,
    })
  }

  const setOverride = async (preference, times = null) => {
    const saved = await post(
      {
        action: "set_date_override",
        ministryIds: (data?.ministries || []).map((ministry) => ministry.id),
        date: selectedDate,
        preference,
        partial: Boolean(times),
        ...(times || {}),
      },
      times
        ? "Date marked partially available"
        : preference === "available"
          ? "Date marked available all day"
          : "Date marked unavailable",
    )
    if (saved) setShowPartialAvailability(false)
    return saved
  }

  const addRange = async (event) => {
    event.preventDefault()
    const saved = await post(
      {
        action: editingRangeId ? "update_block" : "create_block",
        ...(editingRangeId ? { blockId: editingRangeId } : {}),
        ministryId: "",
        startDate: range.startDate,
        endDate: range.endDate,
        label: range.label,
        requestChanges: true,
      },
      editingRangeId ? "Unavailable date range updated" : "Unavailable date range saved",
    )
    if (saved) {
      setRange({ startDate: "", endDate: "", label: "" })
      setEditingRangeId("")
    }
  }

  const removeRange = (block) => post(
    { action: "cancel_block", blockId: block.id },
    "Unavailable range removed",
  )

  const removeDateOverride = (date) => post(
    {
      action: "reset_date_override",
      ministryIds: (data?.ministries || []).map((ministry) => ministry.id),
      date,
    },
    "Unavailable date removed",
  )

  const editDateOverride = (date) => {
    const parsed = new Date(`${date}T12:00:00`)
    setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1))
    setSelectedDate(date)
    setShowPartialAvailability(false)
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-availability-editor="${date}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  const dayMap = React.useMemo(
    () => new Map((data?.effectiveDays || []).map((day) => [day.date, day])),
    [data?.effectiveDays],
  )
  const groupedRules = React.useMemo(() => {
    const groups = new Map()
    for (const rule of data?.availabilityRules || []) {
      const key = [
        rule.dayOfWeek,
        rule.occurrence || "every",
        rule.allDay ? "all-day" : rule.startTime,
        rule.allDay ? "all-day" : rule.endTime,
      ].join("|")
      const current = groups.get(key) || {
        dayOfWeek: rule.dayOfWeek,
        occurrence: rule.occurrence || "every",
        startTime: rule.startTime,
        endTime: rule.endTime,
        allDay: rule.allDay,
        ruleIds: [],
        ministryIds: [],
        ministries: [],
      }
      current.ruleIds.push(rule.id)
      current.ministryIds.push(rule.ministryId)
      current.ministries.push(rule.ministryName)
      groups.set(key, current)
    }
    return [...groups.values()]
  }, [data?.availabilityRules])
  const displayedMonths = React.useMemo(
    () => showsTwoMonths
      ? [
          visibleMonth,
          new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
        ]
      : [visibleMonth],
    [showsTwoMonths, visibleMonth],
  )
  const selectedDay = selectedDate ? dayMap.get(selectedDate) : null
  const ranges = data?.blocks || []
  const unavailableDates = React.useMemo(
    () => (data?.dateOverrides || [])
      .filter((override) =>
        override.preference === "unavailable" && override.date >= (data?.today || ""),
      )
      .sort((left, right) => left.date.localeCompare(right.date)),
    [data?.dateOverrides, data?.today],
  )

  return (
    <div className="w-full space-y-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-10">
      <MinistrySectionActions
        label="Availability views"
        actions={[
          { id: "calendar", label: "Calendar", icon: CalendarDaysIcon, active: activeView === "calendar", onClick: () => setActiveView("calendar") },
          { id: "weekly", label: "Exclusion Rules", icon: ClockIcon, active: activeView === "weekly", onClick: () => setActiveView("weekly") },
        ]}
      />

      {(message || error) && (
        <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error || message}
        </p>
      )}

      {loading ? (
        <section className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-500 shadow-sm">Loading availability…</section>
      ) : !activeMinistryId ? (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-500">Join a ministry to set availability.</section>
      ) : activeView === "weekly" ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="century-font text-xl text-gray-900">Existing Exclusion Rules</h3>
              <button type="button" data-guide-id="availability-create-rule" onClick={() => { cancelRuleForm(); setCreatingRule(true) }} className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white">
                <PlusIcon className="size-5" /> Create New Exclusion Rule
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {!groupedRules.length && (
                <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No exclusion rules have been created.</p>
              )}
              {groupedRules.map((rule) => (
                <article key={`${rule.occurrence}-${rule.dayOfWeek}-${rule.startTime}-${rule.endTime}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 p-4">
                  <span className="rounded-xl bg-[#f4ede6] p-2.5 text-[#896542]"><ClockIcon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{OCCURRENCES.find(([value]) => value === rule.occurrence)?.[1] || "Every"} {WEEKDAYS[rule.dayOfWeek]}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {rule.allDay
                        ? "Unavailable all day"
                        : `Unavailable ${formatRuleTime(rule.startTime)}–${formatRuleTime(rule.endTime)}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{rule.ministries.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" data-guide-id="availability-edit-rule" disabled={saving} onClick={() => editRule(rule)} aria-label={`Edit ${WEEKDAYS[rule.dayOfWeek]} exclusion rule`} className="rounded-lg p-2 text-gray-400 hover:bg-[#f4ede6] hover:text-[#6f4f34] disabled:opacity-50"><PencilSquareIcon className="size-5" /></button>
                    <button type="button" disabled={saving} onClick={() => removeRule(rule)} aria-label={`Remove ${WEEKDAYS[rule.dayOfWeek]} exclusion rule`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><TrashIcon className="size-5" /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {creatingRule && (
            <form onSubmit={createRule} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="century-font text-xl text-gray-900">{editingRule ? "Edit Exclusion Rule" : "Create Exclusion Rule"}</h3>
                  <p className="mt-1 text-sm text-gray-500">You are available by default. An exclusion rule marks only the selected occurrence and time as unavailable.</p>
                </div>
                <button type="button" onClick={cancelRuleForm} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600">Cancel</button>
              </div>
              <fieldset className="mt-5">
                <legend className="text-sm font-semibold text-gray-700">Ministries</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(data.ministries || []).map((ministry) => {
                    const checked = ruleMinistryIds.includes(ministry.id)
                    return (
                      <label key={ministry.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${checked ? "border-[#C1A387] bg-[#faf7f4] text-[#6f4f34]" : "border-gray-200 text-gray-700"}`}>
                        <input type="checkbox" checked={checked} onChange={(event) => setRuleMinistryIds((current) => event.target.checked ? [...current, ministry.id] : current.filter((id) => id !== ministry.id))} className="size-4 rounded border-gray-300 text-[#896542] focus:ring-[#C1A387]" />
                        {ministry.name}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <div className="mt-5 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1.6fr_1.6fr_auto]">
                  <label className="text-sm font-medium text-gray-700">Occurs
                    <select value={newRule.occurrence} onChange={(event) => setNewRule((current) => ({ ...current, occurrence: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2">
                      {OCCURRENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">Day
                    <select value={newRule.dayOfWeek} onChange={(event) => setNewRule((current) => ({ ...current, dayOfWeek: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2">
                      {WEEKDAYS.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                    </select>
                  </label>
                  <TimeSelect label="Unavailable from" value={newRule.startTime} disabled={newRule.allDay} onChange={(startTime) => setNewRule((current) => ({ ...current, startTime }))} />
                  <TimeSelect label="Unavailable until" value={newRule.endTime} disabled={newRule.allDay} onChange={(endTime) => setNewRule((current) => ({ ...current, endTime }))} />
                  <label className="flex items-center gap-2 pb-2 text-sm text-gray-600"><input type="checkbox" checked={newRule.allDay} onChange={(event) => setNewRule((current) => ({ ...current, allDay: event.target.checked }))} /> All day</label>
              </div>
              <button disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{editingRule ? <PencilSquareIcon className="size-5" /> : <PlusIcon className="size-5" />}{saving ? "Saving…" : editingRule ? "Save Rule Changes" : "Create Exclusion Rule"}</button>
            </form>
          )}
        </div>
      ) : (
        <>
          <section className="border-0 bg-white p-0 shadow-none">
            <div className="relative xl:mx-12">
              <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="absolute left-2 top-1 z-10 rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 lg:top-1/2 lg:-translate-y-1/2 xl:-left-12"><ChevronLeftIcon className="size-5" /></button>
              <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="absolute right-2 top-1 z-10 rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 lg:top-1/2 lg:-translate-y-1/2 xl:-right-12"><ChevronRightIcon className="size-5" /></button>
              <button
                type="button"
                data-guide-id="availability-legend"
                aria-label="Explain availability calendar markers"
                aria-haspopup="dialog"
                aria-expanded={legendOpen}
                onClick={() => setLegendOpen(true)}
                className="absolute right-12 top-1 z-10 rounded-xl p-2 text-[#896542] transition hover:bg-[#f4ede6]"
                title="Explain calendar markers"
              >
                <InformationCircleIcon className="size-5" />
              </button>

              <div className="grid gap-6 lg:grid-cols-2">
                {displayedMonths.map((month) => {
                  const monthKey = `${month.getFullYear()}-${month.getMonth()}`
                  return (
                    <section key={monthKey} aria-label={new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(month)} className="w-full border-0 p-0">
                      <h4 className="text-center font-semibold text-gray-900">{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(month)}</h4>
                      <div className="mt-2 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-[0.14em] text-gray-700 sm:text-sm">
                        {WEEKDAYS.map((day) => <div key={day} className="py-2"><abbr title={day} className="no-underline" aria-label={day}>{day.slice(0, 1)}</abbr></div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-y-2 text-center sm:gap-y-3">
                        {getMonthCells(month).map((date) => {
                          const key = toDateKey(date)
                          const inMonth = date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()
                          if (!inMonth) return <span key={`${monthKey}-${key}`} aria-hidden="true" className="mx-auto min-h-14 w-full sm:min-h-16" />
                          const day = dayMap.get(key)
                          const past = key < data.today
                          const selected = selectedDate === key
                          const isToday = key === data.today
                          const explicitAvailable = day?.explicit && day.status === "available"
                          const explicitPartial = explicitAvailable && !(day.windows || []).some((window) => window.allDay)
                          const unavailable = day?.status === "unavailable"
                          const blocked = unavailable && (day?.explicit || day?.source === "range")
                          const exclusionRule = day?.source === "exclusion_rule"
                          const partiallyUnavailable = exclusionRule && day.status === "available"
                          const unavailableByRule = exclusionRule && unavailable
                          const dateSpecificLabel = day?.explicit
                            ? explicitPartial
                              ? `${(day.windows || []).map(formatAvailabilityWindow).join(", ")} explicitly`
                              : `explicitly ${day.status}`
                            : day?.source === "range"
                              ? "unavailable through a date range"
                              : partiallyUnavailable
                                ? `${(day.exclusions || []).map(formatExclusion).join(", ")} through an exclusion rule`
                                : unavailableByRule
                                    ? "unavailable through exclusion rules"
                                    : "generally available"
                          const stateClass = selected
                            ? "bg-[#eee2d5] text-[#6f4f34] ring-2 ring-[#6f4f34]"
                            : isToday
                              ? "bg-orange-500 text-white ring-2 ring-orange-500"
                              : explicitPartial
                                ? "text-[#6f4f34] ring-2 ring-emerald-600"
                              : explicitAvailable
                                ? "bg-emerald-600 text-white ring-2 ring-emerald-600"
                                : blocked
                                  ? "bg-[#f4ede6] text-[#6f4f34]"
                                  : partiallyUnavailable
                                    ? "text-[#6f4f34] ring-1 ring-[#C1A387]"
                                    : unavailableByRule
                                        ? "bg-[#f4ede6] text-[#6f4f34] ring-1 ring-[#d8c7b8]"
                                  : ""
                          const stateStyle = !selected && !isToday && (partiallyUnavailable || explicitPartial)
                            ? { backgroundImage: "linear-gradient(to bottom, #fff 0%, #fff 50%, #f4ede6 50%, #f4ede6 100%)" }
                            : undefined
                          return (
                            <button key={`${monthKey}-${key}`} type="button" data-guide-id={past ? undefined : "availability-date"} disabled={past} onClick={() => { setSelectedDate(key); setShowPartialAvailability(false) }} aria-pressed={selected} aria-current={isToday ? "date" : undefined} aria-label={`${formatDate(key)}: ${dateSpecificLabel}`} className={`group mx-auto flex min-h-14 w-full flex-col items-center text-gray-900 sm:min-h-16 ${past ? "cursor-not-allowed opacity-40" : ""}`}>
                              <span style={stateStyle} className={`relative flex size-8 items-center justify-center rounded-full text-sm font-semibold transition sm:size-12 md:text-base ${stateClass} ${past ? "" : stateClass ? "group-hover:brightness-95" : "group-hover:bg-gray-50"}`}>
                                {date.getDate()}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          </section>

          {selectedDate && (
            <section data-availability-editor={selectedDate} className="rounded-2xl border border-[#dfd1c4] bg-[#faf7f4] p-5">
              <h3 className="century-font text-xl text-gray-900">{formatDate(selectedDate)}</h3>
              <p className="mt-1 text-sm text-gray-600">
                {selectedDay?.explicit
                  ? selectedDay.status === "available" && !(selectedDay.windows || []).some((window) => window.allDay)
                    ? `${(selectedDay.windows || []).map(formatAvailabilityWindow).join(", ")} explicitly.`
                    : `Explicitly ${selectedDay.status}.`
                  : selectedDay?.source === "range"
                    ? "Unavailable through a date range."
                    : selectedDay?.source === "exclusion_rule"
                      ? `${(selectedDay.exclusions || []).map(formatExclusion).join(", ")} through an exclusion rule.`
                        : "Generally available."}
              </p>
              {selectedDate >= data.today && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" data-guide-id="availability-available" disabled={saving} onClick={() => setOverride("available")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircleIcon className="size-5" />Available all day</button>
                  <button type="button" data-guide-id="availability-partial" disabled={saving} onClick={() => {
                    const currentWindow = selectedDay?.explicit && selectedDay.status === "available"
                      ? (selectedDay.windows || []).find((window) => !window.allDay)
                      : null
                    if (currentWindow) {
                      setPartialAvailability({
                        startTime: minutesToTimeValue(currentWindow.start),
                        endTime: minutesToTimeValue(currentWindow.end),
                      })
                    }
                    setShowPartialAvailability((current) => !current)
                  }} className="inline-flex items-center gap-2 rounded-xl border border-[#b68b65] bg-white px-4 py-2 text-sm font-semibold text-[#6f4f34] disabled:opacity-50"><ClockIcon className="size-5" />Partially available</button>
                  <button type="button" data-guide-id="availability-unavailable" disabled={saving} onClick={() => setOverride("unavailable")} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><NoSymbolIcon className="size-5" />Unavailable</button>
                </div>
              )}
              {showPartialAvailability && selectedDate >= data.today && (
                <form onSubmit={(event) => { event.preventDefault(); setOverride("available", partialAvailability) }} className="mt-4 rounded-xl border border-[#dfd1c4] bg-white p-4">
                  <p className="text-sm font-semibold text-gray-800">When are you available on this date?</p>
                  <div className="mt-3 grid items-end gap-3 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-[1fr_1fr_auto]">
                    <TimeSelect label="Available from" value={partialAvailability.startTime} disabled={saving} onChange={(startTime) => setPartialAvailability((current) => ({ ...current, startTime }))} />
                    <TimeSelect label="Available until" value={partialAvailability.endTime} disabled={saving} onChange={(endTime) => setPartialAvailability((current) => ({ ...current, endTime }))} />
                    <button disabled={saving} className="rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save partial availability"}</button>
                  </div>
                </form>
              )}
            </section>
          )}

          <section className="grid gap-5 lg:grid-cols-2">
            <form data-availability-range-form onSubmit={addRange} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="century-font text-xl text-gray-900">{editingRangeId ? "Edit unavailable date range" : "Add an unavailable date range"}</h3>
                {editingRangeId && (
                  <button type="button" onClick={() => { setEditingRangeId(""); setRange({ startDate: "", endDate: "", label: "" }) }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600">Cancel</button>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">Start date<input data-guide-id="availability-range-start" required type="date" min={data.today} value={range.startDate} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal" /></label>
                <label className="text-sm font-semibold text-gray-700">End date<input data-guide-id="availability-range-end" required type="date" min={range.startDate || data.today} value={range.endDate} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal" /></label>
                <label className="text-sm font-semibold text-gray-700 sm:col-span-2">Label (optional)<input data-guide-id="availability-range-label" value={range.label} onChange={(event) => setRange((current) => ({ ...current, label: event.target.value }))} placeholder="Vacation, school break…" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal" /></label>
              </div>
              <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#896542] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{editingRangeId ? <PencilSquareIcon className="size-5" /> : <PlusIcon className="size-5" />}{editingRangeId ? "Save range changes" : "Save range"}</button>
            </form>
            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="century-font text-xl text-gray-900">Unavailable Dates</h3>
                <div className="mt-4 space-y-2">
                  {!unavailableDates.length && <p className="text-sm text-gray-500">No individual unavailable dates.</p>}
                  {unavailableDates.map((override) => (
                    <div key={override.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                      <p className="text-sm font-semibold text-gray-800">{formatDate(override.date)}</p>
                      <div className="flex items-center gap-1">
                        <button type="button" data-guide-id="availability-edit-date" disabled={saving} onClick={() => editDateOverride(override.date)} aria-label={`Edit ${formatDate(override.date)}`} className="rounded-lg p-2 text-gray-400 hover:bg-[#f4ede6] hover:text-[#6f4f34] disabled:opacity-50"><PencilSquareIcon className="size-5" /></button>
                        <button type="button" data-guide-id="availability-remove-date" disabled={saving} onClick={() => removeDateOverride(override.date)} aria-label={`Remove ${formatDate(override.date)}`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><TrashIcon className="size-5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="century-font text-xl text-gray-900">Unavailable Date Ranges</h3>
                <div className="mt-4 space-y-2">
                  {!ranges.length && <p className="text-sm text-gray-500">No unavailable date ranges.</p>}
                  {ranges.map((block) => (
                    <div key={block.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{block.startDate === block.endDate ? formatDate(block.startDate) : `${formatDate(block.startDate)}–${formatDate(block.endDate)}`}</p>
                        {block.label && <p className="mt-0.5 text-xs text-gray-500">{block.label}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" data-guide-id="availability-edit-range" disabled={saving} onClick={() => {
                          setEditingRangeId(block.id)
                          setRange({ startDate: block.startDate, endDate: block.endDate, label: block.label || "" })
                          window.requestAnimationFrame(() => document.querySelector("[data-availability-range-form]")?.scrollIntoView({ behavior: "smooth", block: "center" }))
                        }} aria-label="Edit unavailable date range" className="rounded-lg p-2 text-gray-400 hover:bg-[#f4ede6] hover:text-[#6f4f34] disabled:opacity-50"><PencilSquareIcon className="size-5" /></button>
                        <button type="button" data-guide-id="availability-remove-range" disabled={saving} onClick={() => removeRange(block)} aria-label="Remove unavailable date range" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><TrashIcon className="size-5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <div
        className={`fixed inset-0 z-[90] transition ${legendOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!legendOpen}
      >
        <button
          type="button"
          aria-label="Close availability calendar guide"
          onClick={closeLegend}
          tabIndex={legendOpen ? 0 : -1}
          className={`absolute inset-0 bg-black/35 backdrop-blur-[1px] transition-opacity duration-300 ${legendOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          ref={legendDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="availability-legend-title"
          tabIndex={-1}
          className={`absolute inset-y-0 right-0 flex w-[90%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${legendOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">Calendar guide</p>
              <h2 id="availability-legend-title" className="mt-1 century-font text-2xl text-gray-950">Availability markers</h2>
            </div>
            <button type="button" onClick={closeLegend} tabIndex={legendOpen ? 0 : -1} aria-label="Close availability calendar guide" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <XMarkIcon className="size-5" />
            </button>
          </header>
          <div className="ministry-scroll-region flex-1 overflow-y-auto p-5">
            <AvailabilityLegend />
          </div>
        </aside>
      </div>
    </div>
  )
}

export default MinistryAvailability
