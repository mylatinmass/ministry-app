import * as React from "react"
import {
  CheckIcon,
  DocumentDuplicateIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryOrdoReference from "./MinistryOrdoReference"

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
  startTime: "",
  endTime: "",
  recurrenceFrequency: "none",
  recurrenceInterval: 1,
  recurrenceCount: 1,
})

const formatEventDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const MinistryEvents = ({ data, activeAction, onEventSelect }) => {
  const [templates, setTemplates] = React.useState([])
  const [events, setEvents] = React.useState([])
  const [form, setForm] = React.useState(initialForm)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [templatePreview, setTemplatePreview] = React.useState(null)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

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

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }))

  const selectTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId)
    setForm((current) => ({
      ...current,
      templateId,
      title: current.title || template?.name || "",
      description: current.description || template?.description || "",
    }))
  }

  const editEvent = (event) =>
    setForm({
      ...initialForm(),
      eventId: event.id,
      templateId: event.template_id || "",
      originalTemplateId: event.template_id || "",
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      startTime: toInputValue(event.start_time),
      endTime: toInputValue(event.end_time),
    })

  const prepareClone = (event) =>
    setForm({
      ...initialForm(),
      sourceEventId: event.id,
      templateId: event.template_id || "",
      title: `${event.title} Copy`,
      description: event.description || "",
      location: event.location || "",
      startTime: "",
      endTime: "",
    })

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
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        recurrence: {
          frequency: form.recurrenceFrequency,
          interval: Number(form.recurrenceInterval),
          count: Number(form.recurrenceCount),
        },
        action: cloning ? "clone" : undefined,
      }
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
        throw new Error(result.message || "Unable to save event")
      }
      setMessage(result.message)
      setForm(initialForm())
      await loadData()
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

          {!form.eventId && !form.sourceEventId && (
            <label className="mt-6 block text-sm font-semibold text-gray-700">
              Event template
              <select
                value={form.templateId}
                onChange={(event) => selectTemplate(event.target.value)}
                required
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 font-normal"
              >
                <option value="">Choose a template</option>
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
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Create an active template before creating an event.
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Event title
              <input
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                required
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/15"
              />
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
              Location
              <input
                value={form.location}
                onChange={(event) =>
                  updateField("location", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal"
              />
            </label>
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

          {form.startTime && (
            <div className="mt-5">
              <MinistryOrdoReference startTime={form.startTime} />
            </div>
          )}

          {!form.eventId && !form.sourceEventId && (
            <fieldset className="mt-5 rounded-xl border border-gray-100 p-4">
              <legend className="px-2 text-sm font-semibold text-gray-700">
                Repeating event
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm text-gray-600">
                  Repeats
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
                    <option value="none">One time</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                {form.recurrenceFrequency !== "none" && (
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
                          {form.recurrenceFrequency === "weekly"
                            ? "week(s)"
                            : "month(s)"}
                        </span>
                      </div>
                    </label>
                    <label className="text-sm text-gray-600">
                      Number of events
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={form.recurrenceCount}
                        onChange={(event) =>
                          updateField(
                            "recurrenceCount",
                            Number(event.target.value),
                          )
                        }
                        className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3"
                      />
                    </label>
                  </>
                )}
              </div>
            </fieldset>
          )}

          <button
            type="submit"
            disabled={
              isSaving ||
              (!form.eventId &&
                !form.sourceEventId &&
                !form.templateId)
            }
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white hover:bg-[#6f4f34] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {form.eventId ? (
              <CheckIcon className="size-5" />
            ) : form.sourceEventId ? (
              <DocumentDuplicateIcon className="size-5" />
            ) : (
              <PlusIcon className="size-5" />
            )}
            {isSaving
              ? "Saving..."
              : form.eventId
                ? "Update event"
                : form.sourceEventId
                  ? "Create draft copy"
                  : "Create event"}
          </button>
        </form>
      )}

      {activeAction.id !== "add-event" &&
        !form.eventId &&
        !form.sourceEventId && (
          <div className="space-y-3">
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
                      </p>
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
