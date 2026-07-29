import * as React from "react"
import {
  ArchiveBoxIcon,
  CheckIcon,
  DocumentDuplicateIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const emptyResponsibility = (ministryId = "") => ({
  clientId:
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  ministryId,
  name: "",
  description: "",
  responsibilityType: "position",
  quantityNeeded: 1,
  approvalRequired: false,
  isRequired: true,
  requiredLevelId: "",
  relativeStartMinutes: 0,
  instructions: "",
})

const initialForm = (ministryId) => ({
  templateId: "",
  name: "",
  description: "",
  coordinatorMinistryId: ministryId,
  participationType: "members",
  ministries: [
    {
      ministryId,
      isRequired: true,
      instructions: "",
    },
  ],
  responsibilities: [],
})

const requestHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${window.sessionStorage.getItem(
    MINISTRY_SESSION_KEY,
  )}`,
})

const MinistryTemplates = ({ data, activeAction }) => {
  const [library, setLibrary] = React.useState({
    templates: [],
    ministries: [],
    levels: [],
  })
  const [form, setForm] = React.useState(() =>
    initialForm(data.ministry.id),
  )
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  const endpoint = React.useMemo(() => {
    if (typeof window === "undefined") return ""
    const url = new URL(
      getFunctionEndpoint("scheduling/templates"),
      window.location.origin,
    )
    url.searchParams.set("ministryId", data.ministry.id)
    return url.toString()
  }, [data.ministry.id])

  const loadTemplates = React.useCallback(async () => {
    if (!endpoint) return
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await fetch(endpoint, {
        headers: requestHeaders(),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to load templates")
      }
      setLibrary(result)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [endpoint])

  React.useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  React.useEffect(() => {
    if (activeAction.id === "new-template" && !form.templateId) {
      setForm(initialForm(data.ministry.id))
    }
  }, [activeAction.id, data.ministry.id])

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }))

  const toggleMinistry = (ministryId) => {
    if (ministryId === form.coordinatorMinistryId) return
    setForm((current) => {
      const selected = current.ministries.some(
        (block) => block.ministryId === ministryId,
      )
      return {
        ...current,
        ministries: selected
          ? current.ministries.filter(
              (block) => block.ministryId !== ministryId,
            )
          : [
              ...current.ministries,
              { ministryId, isRequired: true, instructions: "" },
            ],
        responsibilities: selected
          ? current.responsibilities.filter(
              (responsibility) =>
                responsibility.ministryId !== ministryId,
            )
          : current.responsibilities,
      }
    })
  }

  const updateBlock = (ministryId, field, value) =>
    setForm((current) => ({
      ...current,
      ministries: current.ministries.map((block) =>
        block.ministryId === ministryId
          ? { ...block, [field]: value }
          : block,
      ),
    }))

  const addResponsibility = (ministryId) =>
    setForm((current) => ({
      ...current,
      responsibilities: [
        ...current.responsibilities,
        emptyResponsibility(ministryId),
      ],
    }))

  const updateResponsibility = (clientId, field, value) =>
    setForm((current) => ({
      ...current,
      responsibilities: current.responsibilities.map((responsibility) =>
        responsibility.clientId === clientId
          ? { ...responsibility, [field]: value }
          : responsibility,
      ),
    }))

  const changeResponsibilityMinistry = (clientId, ministryId) =>
    setForm((current) => ({
      ...current,
      ministries: current.ministries.some(
        (block) => block.ministryId === ministryId,
      )
        ? current.ministries
        : [
            ...current.ministries,
            { ministryId, isRequired: true, instructions: "" },
          ],
      responsibilities: current.responsibilities.map((responsibility) =>
        responsibility.clientId === clientId
          ? {
              ...responsibility,
              ministryId,
              requiredLevelId: "",
            }
          : responsibility,
      ),
    }))

  const removeResponsibility = (clientId) =>
    setForm((current) => ({
      ...current,
      responsibilities: current.responsibilities.filter(
        (responsibility) => responsibility.clientId !== clientId,
      ),
    }))

  const editTemplate = (template) => {
    setMessage("")
    setErrorMessage("")
    setForm({
      templateId: template.id,
      name: template.name,
      description: template.description || "",
      coordinatorMinistryId: template.coordinatorMinistryId,
      participationType: template.participationType,
      ministries: template.ministries.map((block) => ({
        ministryId: block.ministryId,
        isRequired: block.isRequired,
        instructions: block.instructions || "",
      })),
      responsibilities: template.responsibilities.map(
        (responsibility) => ({
          ...responsibility,
          clientId: responsibility.id,
        }),
      ),
    })
  }

  const submitTemplate = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/templates"),
        {
          method: form.templateId ? "PATCH" : "POST",
          headers: requestHeaders(),
          body: JSON.stringify(form),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to save template")
      }
      setMessage(
        form.templateId ? "Template updated." : "Template created.",
      )
      setForm(initialForm(data.ministry.id))
      await loadTemplates()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const duplicateTemplate = async (template) => {
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/templates"),
        {
          method: "POST",
          headers: requestHeaders(),
          body: JSON.stringify({
            ...template,
            action: "duplicate",
            name: `${template.name} Copy`,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to duplicate template")
      }
      setMessage("Template duplicated.")
      await loadTemplates()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const setTemplateStatus = async (template, status) => {
    setMessage("")
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/templates"),
        {
          method: "PATCH",
          headers: requestHeaders(),
          body: JSON.stringify({
            action: "set_status",
            templateId: template.id,
            status,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to update template")
      }
      setMessage(status === "archived" ? "Template archived." : "Template restored.")
      await loadTemplates()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const ministryName = (ministryId) =>
    library.ministries.find((ministry) => ministry.id === ministryId)?.name ||
    "Ministry"

  if (isLoading) {
    return (
      <p className="p-6 text-center text-gray-500">Loading templates...</p>
    )
  }

  const actionIsLibrary = ["duplicate", "archive"].includes(activeAction.id)

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

      {actionIsLibrary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {library.templates.map((template) => (
            <article
              key={template.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <DocumentDuplicateIcon className="size-6 text-[#896542]" />
                <span className="rounded-full bg-[#f4ede6] px-2 py-1 text-xs uppercase text-[#896542]">
                  {template.status}
                </span>
              </div>
              <h3 className="mt-5 century-font text-xl text-gray-900">
                {template.name}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {template.ministries
                  .map((ministry) => ministry.ministryName)
                  .join(" · ")}
              </p>
              <p className="mt-3 text-sm font-medium text-[#896542]">
                {template.responsibilityCount} responsibilities · Version{" "}
                {template.version}
              </p>
              {activeAction.id === "duplicate" ? (
                <button
                  type="button"
                  onClick={() => duplicateTemplate(template)}
                  disabled={!template.canEdit}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34]"
                >
                  <DocumentDuplicateIcon className="size-4" />
                  Duplicate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setTemplateStatus(
                      template,
                      template.status === "archived" ? "active" : "archived",
                    )
                  }
                  disabled={!template.canEdit}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#C1A387]"
                >
                  <ArchiveBoxIcon className="size-4" />
                  {template.status === "archived" ? "Restore" : "Archive"}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
          <form onSubmit={submitTemplate} className="space-y-6">
            <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#896542]">
                    Master event template
                  </p>
                  <h3 className="mt-2 century-font text-2xl text-gray-900">
                    {form.templateId ? "Edit template" : "New template"}
                  </h3>
                </div>
                {form.templateId && (
                  <button
                    type="button"
                    onClick={() => setForm(initialForm(data.ministry.id))}
                    className="text-sm font-semibold text-gray-500 hover:text-[#896542]"
                  >
                    New instead
                  </button>
                )}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">
                  Template name
                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    required
                    placeholder="High Mass with Procession"
                    className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/15"
                  />
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Participation
                  <select
                    value={form.participationType}
                    onChange={(event) =>
                      updateField("participationType", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 font-normal"
                  >
                    <option value="members">Members</option>
                    <option value="volunteers">Volunteers</option>
                    <option value="both">Members and volunteers</option>
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold text-gray-700">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/15"
                />
              </label>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="century-font text-2xl text-gray-900">
                Participating ministries
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Applying this template creates one event and connects every
                selected ministry.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {library.ministries.map((ministry) => {
                  const selected = form.ministries.some(
                    (block) => block.ministryId === ministry.id,
                  )
                  const coordinator =
                    ministry.id === form.coordinatorMinistryId
                  return (
                    <label
                      key={ministry.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 p-3 hover:border-[#C1A387]"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={coordinator}
                        onChange={() => toggleMinistry(ministry.id)}
                        className="size-4 accent-[#896542]"
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
                        {ministry.name}
                      </span>
                      {coordinator && (
                        <span className="text-xs font-semibold text-[#896542]">
                          Coordinates
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </section>

            {form.ministries.map((block) => {
              const responsibilities = form.responsibilities.filter(
                (responsibility) =>
                  responsibility.ministryId === block.ministryId,
              )
              return (
                <section
                  key={block.ministryId}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#896542]">
                        Ministry block
                      </p>
                      <h3 className="mt-1 century-font text-2xl text-gray-900">
                        {ministryName(block.ministryId)}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => addResponsibility(block.ministryId)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#896542] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34]"
                    >
                      <PlusIcon className="size-4" />
                      Add responsibility
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={block.isRequired}
                        onChange={(event) =>
                          updateBlock(
                            block.ministryId,
                            "isRequired",
                            event.target.checked,
                          )
                        }
                        className="size-4 accent-[#896542]"
                      />
                      Required ministry
                    </label>
                    <input
                      value={block.instructions}
                      onChange={(event) =>
                        updateBlock(
                          block.ministryId,
                          "instructions",
                          event.target.value,
                        )
                      }
                      placeholder="Ministry-wide instructions"
                      className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#896542]"
                    />
                  </div>

                  <div className="mt-5 space-y-4">
                    {responsibilities.length ? (
                      responsibilities.map((responsibility) => (
                        <div
                          key={responsibility.clientId}
                          className="rounded-xl border border-gray-100 p-4"
                        >
                          <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.45fr_auto]">
                            <input
                              value={responsibility.name}
                              onChange={(event) =>
                                updateResponsibility(
                                  responsibility.clientId,
                                  "name",
                                  event.target.value,
                                )
                              }
                              required
                              placeholder="Responsibility name"
                              className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#896542]"
                            />
                            <select
                              value={responsibility.responsibilityType}
                              onChange={(event) =>
                                updateResponsibility(
                                  responsibility.clientId,
                                  "responsibilityType",
                                  event.target.value,
                                )
                              }
                              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                            >
                              <option value="position">Position</option>
                              <option value="task">Task</option>
                              <option value="food">Food or supply</option>
                              <option value="time_slot">Time slot</option>
                            </select>
                            <input
                              type="number"
                              min="1"
                              value={responsibility.quantityNeeded}
                              onChange={(event) =>
                                updateResponsibility(
                                  responsibility.clientId,
                                  "quantityNeeded",
                                  Number(event.target.value),
                                )
                              }
                              aria-label="Quantity needed"
                              className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                removeResponsibility(
                                  responsibility.clientId,
                                )
                              }
                              aria-label={`Remove ${responsibility.name || "responsibility"}`}
                              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700"
                            >
                              <TrashIcon className="size-5" />
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <select
                              value={responsibility.ministryId}
                              onChange={(event) =>
                                changeResponsibilityMinistry(
                                  responsibility.clientId,
                                  event.target.value,
                                )
                              }
                              required
                              aria-label={`Ministry for ${
                                responsibility.name || "responsibility"
                              }`}
                              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                            >
                              <option value="">Choose ministry</option>
                              {library.ministries.map((ministry) => (
                                <option key={ministry.id} value={ministry.id}>
                                  {ministry.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={responsibility.requiredLevelId || ""}
                              onChange={(event) =>
                                updateResponsibility(
                                  responsibility.clientId,
                                  "requiredLevelId",
                                  event.target.value,
                                )
                              }
                              aria-label={`Required level for ${
                                responsibility.name || "responsibility"
                              }`}
                              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                            >
                              <option value="">No level required</option>
                              {library.levels
                                .filter(
                                  (level) =>
                                    level.ministryId ===
                                    responsibility.ministryId,
                                )
                                .map((level) => (
                                  <option key={level.id} value={level.id}>
                                    Level {level.rankOrder} · {level.name}
                                  </option>
                                ))}
                            </select>
                            <input
                              type="number"
                              value={responsibility.relativeStartMinutes}
                              onChange={(event) =>
                                updateResponsibility(
                                  responsibility.clientId,
                                  "relativeStartMinutes",
                                  Number(event.target.value),
                                )
                              }
                              placeholder="Minutes relative to event"
                              aria-label="Minutes relative to event start"
                              className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                            />
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={responsibility.approvalRequired}
                                onChange={(event) =>
                                  updateResponsibility(
                                    responsibility.clientId,
                                    "approvalRequired",
                                    event.target.checked,
                                  )
                                }
                                className="size-4 accent-[#896542]"
                              />
                              Leader approval required
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={responsibility.isRequired}
                                onChange={(event) =>
                                  updateResponsibility(
                                    responsibility.clientId,
                                    "isRequired",
                                    event.target.checked,
                                  )
                                }
                                className="size-4 accent-[#896542]"
                              />
                              Required responsibility
                            </label>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
                        No responsibilities in this ministry block yet.
                      </p>
                    )}
                  </div>
                </section>
              )
            })}

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white hover:bg-[#6f4f34] disabled:opacity-50"
            >
              <CheckIcon className="size-5" />
              {isSaving
                ? "Saving..."
                : form.templateId
                  ? "Update template"
                  : "Create template"}
            </button>
          </form>

          <aside>
            <h3 className="mb-3 century-font text-xl text-gray-900">
              Existing templates
            </h3>
            <div className="space-y-3">
              {library.templates
                .filter((template) => template.status !== "archived")
                .map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => editTemplate(template)}
                    disabled={!template.canEdit}
                    className="w-full rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm hover:border-[#C1A387]"
                  >
                    <div className="flex items-start gap-3">
                      <PencilSquareIcon className="mt-0.5 size-5 shrink-0 text-[#896542]" />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          {template.name}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">
                          {template.ministries.length} ministries ·{" "}
                          {template.responsibilityCount} responsibilities · v
                          {template.version}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export default MinistryTemplates
