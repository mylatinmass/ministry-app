import * as React from "react"
import {
  ClipboardDocumentIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const emptyAssignment = () => ({
  name: "",
  description: "",
  quantityNeeded: 1,
  approvalRequired: false,
})

const initialForm = () => ({
  title: "",
  description: "",
  location: "",
  startTime: "",
  endTime: "",
  signupCode: "",
  assignments: [emptyAssignment()],
})

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${window.sessionStorage.getItem(
    MINISTRY_SESSION_KEY,
  )}`,
})

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const VolunteerEvents = ({ creating = false, onBack }) => {
  const [events, setEvents] = React.useState([])
  const [form, setForm] = React.useState(initialForm)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [error, setError] = React.useState("")

  const loadEvents = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/volunteer-events"),
        { headers: headers() },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to load volunteer events")
      }
      setEvents(result.events)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const updateAssignment = (index, field, value) =>
    setForm((current) => ({
      ...current,
      assignments: current.assignments.map((assignment, assignmentIndex) =>
        assignmentIndex === index
          ? { ...assignment, [field]: value }
          : assignment,
      ),
    }))

  const submit = async (submitEvent) => {
    submitEvent.preventDefault()
    setSaving(true)
    setMessage("")
    setError("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/volunteer-events"),
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            ...form,
            startTime: new Date(form.startTime).toISOString(),
            endTime: new Date(form.endTime).toISOString(),
            assignments: form.assignments.map((assignment) => ({
              ...assignment,
              quantityNeeded: Number(assignment.quantityNeeded),
            })),
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to create volunteer event")
      }
      setMessage(result.message)
      setForm(initialForm())
      await loadEvents()
      onBack?.()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleSignup = async (event) => {
    setError("")
    setMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/volunteer-events"),
        {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({
            action: "set_signup_open",
            eventId: event.id,
            signupOpen: !event.signup_open,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to update link")
      setMessage(result.message)
      await loadEvents()
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  const copyLink = async (code) => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/volunteer/${code}`,
    )
    setMessage("Volunteer link copied")
  }

  if (creating) {
    return (
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#896542]">Standalone volunteer event</p>
            <h2 className="mt-1 century-font text-3xl text-gray-950">Create event and assignments</h2>
            <p className="mt-2 text-sm text-gray-500">A ministry is optional. Volunteers use the public link to claim one of the assignments below.</p>
          </div>
          <button type="button" onClick={onBack} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">Back to events</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-gray-700 sm:col-span-2">Event title<input required maxLength={250} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
          <label className="text-sm font-semibold text-gray-700">Starts<input required type="datetime-local" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
          <label className="text-sm font-semibold text-gray-700">Ends<input required type="datetime-local" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
          <label className="text-sm font-semibold text-gray-700">Location <span className="font-normal text-gray-400">(optional)</span><input maxLength={500} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
          <label className="text-sm font-semibold text-gray-700">Public URL<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="parish-picnic-2026" value={form.signupCode} onChange={(event) => setForm((current) => ({ ...current, signupCode: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /><span className="mt-1 block font-normal text-gray-400">ministry.mylatinmass.com/volunteer/{form.signupCode || "your-link"}</span></label>
          <label className="text-sm font-semibold text-gray-700 sm:col-span-2">Description <span className="font-normal text-gray-400">(optional)</span><textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
        </div>

        <fieldset className="space-y-4 rounded-2xl border border-[#e8ddd3] bg-[#fbf8f4] p-4 sm:p-5">
          <legend className="px-2 text-lg font-semibold text-[#6f4f34]">Volunteer assignments</legend>
          {form.assignments.map((assignment, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[1fr_8rem_auto]">
              <label className="text-sm font-semibold text-gray-700">Assignment name<input required maxLength={250} placeholder="Setup tables" value={assignment.name} onChange={(event) => updateAssignment(index, "name", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              <label className="text-sm font-semibold text-gray-700">Openings<input required type="number" min="1" max="100" value={assignment.quantityNeeded} onChange={(event) => updateAssignment(index, "quantityNeeded", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              <button type="button" aria-label={`Remove assignment ${index + 1}`} disabled={form.assignments.length === 1} onClick={() => setForm((current) => ({ ...current, assignments: current.assignments.filter((_, assignmentIndex) => assignmentIndex !== index) }))} className="self-end rounded-xl border border-gray-200 p-2.5 text-gray-500 disabled:opacity-30"><TrashIcon className="size-5" /></button>
              <label className="text-sm font-semibold text-gray-700 sm:col-span-2">What the volunteer will do <span className="font-normal text-gray-400">(optional)</span><input maxLength={1000} value={assignment.description} onChange={(event) => updateAssignment(index, "description", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              <label className="flex items-center gap-2 self-end text-sm text-gray-600 sm:col-span-1"><input type="checkbox" checked={assignment.approvalRequired} onChange={(event) => updateAssignment(index, "approvalRequired", event.target.checked)} className="size-4 accent-[#896542]" />Require approval</label>
            </div>
          ))}
          <button type="button" onClick={() => setForm((current) => ({ ...current, assignments: [...current.assignments, emptyAssignment()] }))} className="inline-flex items-center gap-2 rounded-xl border border-[#d8c7b8] bg-white px-4 py-2 text-sm font-semibold text-[#6f4f34]"><PlusIcon className="size-4" />Add another assignment</button>
        </fieldset>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Creating event..." : "Create event and open volunteer signup"}</button>
      </form>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <h3 className="century-font text-2xl text-gray-950">Standalone volunteer events</h3>
        <p className="mt-1 text-sm text-gray-500">These events use assignments and a public signup link; they do not require a ministry.</p>
      </div>
      {message && <p role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading volunteer events...</p>
      ) : events.length ? (
        <div className="mt-4 divide-y divide-gray-100">
          {events.map((event) => (
            <article key={event.id} className="flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-64 flex-1">
                <p className="font-semibold text-gray-900">{event.title}</p>
                <p className="mt-1 text-sm text-gray-500">{formatDate(event.start_time)} · {event.assignment_count} {event.assignment_count === 1 ? "assignment" : "assignments"} · {event.filled_count}/{event.opening_count} filled</p>
                <p className="mt-1 text-xs text-[#896542]">/volunteer/{event.signup_code}</p>
              </div>
              <button type="button" onClick={() => copyLink(event.signup_code)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600"><ClipboardDocumentIcon className="size-4" />Copy link</button>
              <button type="button" onClick={() => toggleSignup(event)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${event.signup_open ? "border border-red-200 text-red-700" : "bg-[#896542] text-white"}`}>{event.signup_open ? "Close signup" : "Open signup"}</button>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">No standalone volunteer events have been created yet.</p>
      )}
    </section>
  )
}

export default VolunteerEvents
