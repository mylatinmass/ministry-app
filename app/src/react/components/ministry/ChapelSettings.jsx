import * as React from "react"
import {
  CheckIcon,
  PencilSquareIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const emptyObservance = {
  id: "",
  name: "",
  month: 1,
  day: 1,
  defaultTemplateId: "",
  defaultStartTime: "",
  effectiveStartYear: "",
  notes: "",
  status: "active",
}

const sections = [
  {
    title: "Chapel information",
    fields: [
      ["chapelName", "Chapel name"],
      ["publicPhone", "Public telephone", "tel"],
      ["publicEmail", "Public email", "email"],
      ["websiteUrl", "Website", "url"],
      ["streetAddress", "Street address", "textarea"],
      ["mailingAddress", "Mailing address", "textarea"],
      ["defaultEventLocation", "Default event location"],
      ["mapUrl", "Map and directions link", "url"],
      ["timeZone", "Time zone"],
    ],
  },
  {
    title: "Calendar and scheduling",
    fields: [
      ["publicCalendarUrl", "Public calendar subscription", "url"],
      ["defaultMassTemplateId", "Default Mass template", "template"],
      ["defaultEventTemplateId", "Default event template", "template"],
      ["schedulingHorizonDays", "Scheduling horizon in days", "number"],
      ["publicEventVisibility", "Default event visibility", "visibility"],
    ],
  },
  {
    title: "Communications",
    fields: [
      ["notificationSenderName", "Notification sender name"],
      ["replyToEmail", "Reply-to email", "email"],
      ["emergencyContact", "Emergency or cancellation contact"],
    ],
  },
  {
    title: "Brand and public links",
    fields: [
      ["logoUrl", "Chapel logo URL", "url"],
      ["facebookUrl", "Facebook", "url"],
      ["instagramUrl", "Instagram", "url"],
      ["youtubeUrl", "YouTube", "url"],
    ],
  },
]

const formatDate = (month, day) =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(
    new Date(2024, Number(month) - 1, Number(day)),
  )

const Field = ({ field, value, templates, disabled, onChange }) => {
  const [name, label, type = "text"] = field
  const common =
    "mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-normal disabled:bg-gray-50 disabled:text-gray-500"
  let control
  if (type === "textarea") {
    control = (
      <textarea
        rows={2}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(name, event.target.value)}
        className={common}
      />
    )
  } else if (type === "template") {
    control = (
      <select
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(name, event.target.value)}
        className={common}
      >
        <option value="">No default template</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.ministryName} · {template.name}
          </option>
        ))}
      </select>
    )
  } else if (type === "visibility") {
    control = (
      <select
        value={value || "public"}
        disabled={disabled}
        onChange={(event) => onChange(name, event.target.value)}
        className={common}
      >
        <option value="public">Public</option>
        <option value="private">Private</option>
      </select>
    )
  } else {
    control = (
      <input
        type={type}
        min={type === "number" ? 1 : undefined}
        max={type === "number" ? 365 : undefined}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(name, event.target.value)}
        className={common}
      />
    )
  }
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      {control}
    </label>
  )
}

const ChapelSettings = () => {
  const [data, setData] = React.useState(null)
  const [settings, setSettings] = React.useState(null)
  const [editing, setEditing] = React.useState(false)
  const [observance, setObservance] = React.useState(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  const request = React.useCallback(async (options = {}) => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("chapel-settings"), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "Unable to load chapel settings")
    return result
  }, [])

  React.useEffect(() => {
    request()
      .then((result) => {
        setData(result)
        setSettings(result.settings)
      })
      .catch((error) => setErrorMessage(error.message))
  }, [request])

  const save = async (body) => {
    setIsSaving(true)
    setMessage("")
    setErrorMessage("")
    try {
      const result = await request({
        method: "PATCH",
        body: JSON.stringify(body),
      })
      setData(result)
      setSettings(result.settings)
      setEditing(false)
      setObservance(null)
      setMessage(result.message)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!data || !settings) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
        {errorMessage || "Loading chapel settings..."}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {(message || errorMessage) && (
        <p
          role={errorMessage ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            errorMessage
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {errorMessage || message}
        </p>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="century-font text-2xl text-gray-950">Chapel settings</h2>
            <p className="mt-1 text-sm text-gray-500">
              Public information and chapel-wide defaults. Credentials remain server-side.
            </p>
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#896542] hover:border-[#C1A387]"
            >
              <PencilSquareIcon className="size-5" /> Edit
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => save({ action: "update_settings", settings })}
              className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34] disabled:opacity-60"
            >
              <CheckIcon className="size-5" /> {isSaving ? "Updating..." : "Update"}
            </button>
          )}
        </div>

        <div className="mt-6 space-y-7">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="century-font text-xl text-gray-900">{section.title}</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => (
                  <Field
                    key={field[0]}
                    field={field}
                    value={settings[field[0]]}
                    templates={data.templates}
                    disabled={!editing}
                    onChange={(name, value) =>
                      setSettings((current) => ({ ...current, [name]: value }))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="century-font text-2xl text-gray-950">Local observances</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
              Only chapel-specific fixed dates belong here. Standard feasts and movable dates continue to come from the 1962 Ordo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setObservance({ ...emptyObservance })}
            className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34]"
          >
            <PlusIcon className="size-5" /> Add observance
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {data.observances.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setObservance({ ...item })}
              className="rounded-xl border border-gray-200 p-4 text-left hover:border-[#C1A387]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#896542]">
                    {formatDate(item.month, item.day)}
                  </p>
                  <h3 className="mt-1 font-semibold text-gray-900">{item.name}</h3>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs uppercase text-gray-500">
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {item.notes || "No notes added."}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="century-font text-2xl text-gray-950">Chapel ministries</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ministry descriptions and access remain managed from each ministry workspace.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.ministries.map((ministry) => (
            <article key={ministry.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-900">{ministry.name}</p>
                <span className="text-xs uppercase text-gray-400">{ministry.status}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {ministry.description || "No description added."}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="century-font text-2xl text-gray-950">Recent changes</h2>
        <div className="mt-4 space-y-2">
          {data.auditHistory.length ? data.auditHistory.map((entry) => (
            <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-gray-100 py-2 text-sm">
              <span className="text-gray-700">{entry.actorName} · {entry.summary}</span>
              <span className="text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
          )) : <p className="text-sm text-gray-500">No chapel-setting changes recorded yet.</p>}
        </div>
      </section>

      {observance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="century-font text-2xl text-gray-950">
                  {observance.id ? "Edit observance" : "Add observance"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">This is a chapel-specific exception to the standard Ordo calendar.</p>
              </div>
              <button type="button" onClick={() => setObservance(null)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <XMarkIcon className="size-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-semibold text-gray-700">
                Name
                <input value={observance.name} onChange={(event) => setObservance((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Month
                <input type="number" min="1" max="12" value={observance.month} onChange={(event) => setObservance((current) => ({ ...current, month: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Day
                <input type="number" min="1" max="31" value={observance.day} onChange={(event) => setObservance((current) => ({ ...current, day: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-normal" />
              </label>
              <label className="sm:col-span-2 text-sm font-semibold text-gray-700">
                Default template
                <select value={observance.defaultTemplateId} onChange={(event) => setObservance((current) => ({ ...current, defaultTemplateId: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-normal">
                  <option value="">Choose when creating the event</option>
                  {data.templates.map((template) => <option key={template.id} value={template.id}>{template.ministryName} · {template.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Default time
                <input type="time" value={observance.defaultStartTime} onChange={(event) => setObservance((current) => ({ ...current, defaultStartTime: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Effective starting year
                <input type="number" min="1900" max="2200" value={observance.effectiveStartYear} onChange={(event) => setObservance((current) => ({ ...current, effectiveStartYear: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-normal" />
              </label>
              <label className="sm:col-span-2 text-sm font-semibold text-gray-700">
                Notes
                <textarea rows="3" value={observance.notes} onChange={(event) => setObservance((current) => ({ ...current, notes: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Status
                <select value={observance.status} onChange={(event) => setObservance((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-normal">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => save({ action: "save_observance", observance })}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6f4f34] disabled:opacity-60"
            >
              <CheckIcon className="size-5" /> {isSaving ? "Updating..." : "Update observance"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChapelSettings
