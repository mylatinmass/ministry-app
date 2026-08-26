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
import { MinistryCardGridSkeleton } from "./MinistryLoadingSkeleton"

const emptyResponsibility = (ministryId = "") => ({
  clientId:
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  ministryId,
  name: "",
  description: "",
  responsibilityType: "position",
  assignmentMode: "standard",
  quantityNeeded: 1,
  approvalRequired: false,
  substitutionAllowed: true,
  isRequired: false,
  requiredLevelId: "",
  requiredGroupId: "",
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
      groupIds: [],
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
  const [levelErrors, setLevelErrors] = React.useState({})
  const [editingMinistryId, setEditingMinistryId] = React.useState("")

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
      setEditingMinistryId("")
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
              { ministryId, isRequired: true, instructions: "", groupIds: [] },
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

  const updateResponsibility = (clientId, field, value) => {
    if (field === "requiredLevelId") {
      setLevelErrors((current) => {
        const next = { ...current }
        delete next[clientId]
        return next
      })
    }
    setForm((current) => ({
      ...current,
      responsibilities: current.responsibilities.map((responsibility) =>
        responsibility.clientId === clientId
          ? field === "assignmentMode" && value === "all_available_members"
            ? {
                ...responsibility,
                assignmentMode: value,
                name: "Expected ministry attendance",
                quantityNeeded: 1,
                substitutionAllowed: false,
                isRequired: false,
              }
            : { ...responsibility, [field]: value }
          : responsibility,
      ),
    }))
  }

  const changeResponsibilityMinistry = (clientId, ministryId) => {
    setLevelErrors((current) => {
      const next = { ...current }
      delete next[clientId]
      return next
    })
    setForm((current) => ({
      ...current,
      ministries: current.ministries.some(
        (block) => block.ministryId === ministryId,
      )
        ? current.ministries
        : [
            ...current.ministries,
            { ministryId, isRequired: true, instructions: "", groupIds: [] },
          ],
      responsibilities: current.responsibilities.map((responsibility) =>
        responsibility.clientId === clientId
          ? {
              ...responsibility,
              ministryId,
              requiredLevelId: "",
              requiredGroupId: "",
            }
          : responsibility,
      ),
    }))
  }

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
    setLevelErrors({})
    setEditingMinistryId(
      template.canEditTemplate
        ? ""
        : template.editableMinistryIds?.includes(data.ministry.id)
          ? data.ministry.id
          : template.editableMinistryIds?.[0] || "",
    )
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
        groupIds: block.groupIds || [],
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
    setMessage("")
    setErrorMessage("")

    const editableResponsibilities = editingMinistryId
      ? form.responsibilities.filter(
          (responsibility) =>
            responsibility.ministryId === editingMinistryId,
        )
      : form.responsibilities
    const nextLevelErrors = editableResponsibilities.reduce(
      (errors, responsibility) => {
        if (!responsibility.requiredLevelId) return errors
        const selectedLevel = library.levels.find(
          (level) => level.id === responsibility.requiredLevelId,
        )
        if (
          !selectedLevel ||
          selectedLevel.ministryId !== responsibility.ministryId
        ) {
          const ministry = library.ministries.find(
            (item) => item.id === responsibility.ministryId,
          )
          errors[responsibility.clientId] = `${
            responsibility.name || "This responsibility"
          } has an unavailable level. Choose a level from ${
            ministry?.name || "this ministry"
          }, or choose No level required.`
        }
        return errors
      },
      {},
    )

    if (Object.keys(nextLevelErrors).length) {
      setLevelErrors(nextLevelErrors)
      setErrorMessage(
        Object.keys(nextLevelErrors).length === 1
          ? "One required level needs your attention. The field is highlighted below."
          : `${Object.keys(nextLevelErrors).length} required levels need your attention. The fields are highlighted below.`,
      )
      window.requestAnimationFrame(() => {
        const firstError = document.querySelector("[data-level-error='true']")
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" })
        firstError?.querySelector("select")?.focus({ preventScroll: true })
      })
      return
    }

    setLevelErrors({})
    setIsSaving(true)
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/templates"),
        {
          method: form.templateId ? "PATCH" : "POST",
          headers: requestHeaders(),
          body: JSON.stringify(
            editingMinistryId
              ? {
                  action: "update_ministry_block",
                  templateId: form.templateId,
                  ministryId: editingMinistryId,
                  block: form.ministries.find(
                    (block) => block.ministryId === editingMinistryId,
                  ),
                  responsibilities: editableResponsibilities,
                }
              : form,
          ),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to save template")
      }
      setMessage(
        editingMinistryId
          ? `${ministryName(editingMinistryId)} section updated for future events.`
          : form.templateId
            ? "Template updated."
            : "Template created.",
      )
      setForm(initialForm(data.ministry.id))
      setEditingMinistryId("")
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
    return <MinistryCardGridSkeleton label="Loading ministry templates" />
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
                  disabled={!template.canEditTemplate}
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
                  disabled={!template.canEditTemplate}
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
                    {editingMinistryId
                      ? "Ministry-managed section"
                      : "Master event template"}
                  </p>
                  <h3 className="mt-2 century-font text-2xl text-gray-900">
                    {editingMinistryId
                      ? `${ministryName(editingMinistryId)} · ${form.name}`
                      : form.templateId
                        ? "Edit template"
                        : "New template"}
                  </h3>
                  {editingMinistryId && (
                    <p className="mt-2 text-sm text-gray-500">
                      Your changes apply to this ministry’s section on future
                      events. Other ministry sections remain unchanged.
                    </p>
                  )}
                </div>
                {form.templateId && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(initialForm(data.ministry.id))
                      setEditingMinistryId("")
                    }}
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
                    disabled={Boolean(editingMinistryId)}
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
                    disabled={Boolean(editingMinistryId)}
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
                  disabled={Boolean(editingMinistryId)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-normal outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/15"
                />
              </label>
            </section>

            {!editingMinistryId && (
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
            )}

            {form.ministries
              .filter(
                (block) =>
                  !editingMinistryId ||
                  block.ministryId === editingMinistryId,
              )
              .map((block) => {
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
                      Add position or responsibility
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
                  {(library.ministries.find((ministry) => ministry.id === block.ministryId)?.groups || []).length > 0 && (
                    <fieldset className="mt-4 rounded-xl border border-gray-100 p-3">
                      <legend className="px-1 text-sm font-semibold text-gray-700">Event audience</legend>
                      <p className="mb-2 text-xs text-gray-500">Leave every group unchecked to include the whole ministry.</p>
                      <div className="flex flex-wrap gap-4">
                        {library.ministries.find((ministry) => ministry.id === block.ministryId).groups.map((group) => (
                          <label key={group.id} className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={(block.groupIds || []).includes(group.id)} onChange={(event) => updateBlock(block.ministryId, "groupIds", event.target.checked ? [...(block.groupIds || []), group.id] : (block.groupIds || []).filter((id) => id !== group.id))} />
                            {group.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  <div className="mt-5 space-y-4">
                    {responsibilities.length ? (
                      responsibilities.map((responsibility) => (
                        <div
                          key={responsibility.clientId}
                          className="rounded-xl border border-gray-100 p-4"
                        >
                          <div className="grid gap-3 sm:grid-cols-[1.2fr_0.9fr_0.8fr_0.4fr_auto]">
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
                              disabled={responsibility.assignmentMode === "all_available_members"}
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
                            <select
                              value={responsibility.assignmentMode || "standard"}
                              onChange={(event) =>
                                updateResponsibility(
                                  responsibility.clientId,
                                  "assignmentMode",
                                  event.target.value,
                                )
                              }
                              aria-label={`Assignment mode for ${responsibility.name || "responsibility"}`}
                              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                            >
                              <option value="standard">Specific position</option>
                              <option value="all_available_members">Expected ministry attendance</option>
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
                              disabled={responsibility.assignmentMode === "all_available_members"}
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
                              disabled={Boolean(editingMinistryId)}
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
                            {(library.ministries.find((ministry) => ministry.id === responsibility.ministryId)?.groups || []).length > 0 && (
                              <select
                                value={responsibility.requiredGroupId || ""}
                                onChange={(event) =>
                                  updateResponsibility(
                                    responsibility.clientId,
                                    "requiredGroupId",
                                    event.target.value,
                                  )
                                }
                                aria-label={`Required group for ${
                                  responsibility.name || "responsibility"
                                }`}
                                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                              >
                                <option value="">No group required</option>
                                {library.ministries.find((ministry) => ministry.id === responsibility.ministryId).groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                              </select>
                            )}
                            <div
                              data-level-error={
                                levelErrors[responsibility.clientId]
                                  ? "true"
                                  : undefined
                              }
                            >
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
                                aria-invalid={Boolean(
                                  levelErrors[responsibility.clientId],
                                )}
                                className={`h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none ${
                                  levelErrors[responsibility.clientId]
                                    ? "border-red-500 bg-red-50 ring-2 ring-red-200"
                                    : "border-gray-200 focus:border-[#896542]"
                                }`}
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
                              {levelErrors[responsibility.clientId] && (
                                <p className="mt-1 text-xs font-medium text-red-700">
                                  {levelErrors[responsibility.clientId]}
                                </p>
                              )}
                            </div>
                            <select
                              value={responsibility.relativeStartMinutes}
                              onChange={(event) =>
                                updateResponsibility(
                                  responsibility.clientId,
                                  "relativeStartMinutes",
                                  Number(event.target.value),
                                )
                              }
                              aria-label="Responsibility time offset"
                              className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                            >
                              <option value="0">At event start</option>
                              <option value="-15">-15m</option>
                              <option value="-30">-30m</option>
                              <option value="-45">-45m</option>
                              <option value="-60">-1h</option>
                              <option value="-120">-2h</option>
                            </select>
                            <span className="text-xs text-gray-500 sm:col-span-2">
                              Time offset from the event start. Negative values mean the responsibility begins earlier.
                            </span>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={responsibility.approvalRequired}
                                disabled={responsibility.assignmentMode === "all_available_members"}
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
                                disabled={responsibility.assignmentMode === "all_available_members"}
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
                            <label className="flex items-center gap-3 text-sm font-semibold text-gray-600 sm:col-span-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={responsibility.substitutionAllowed !== false}
                                aria-label={`Substitutions for ${responsibility.name || "responsibility"}`}
                                disabled={responsibility.assignmentMode === "all_available_members"}
                                onClick={() =>
                                  updateResponsibility(
                                    responsibility.clientId,
                                    "substitutionAllowed",
                                    responsibility.substitutionAllowed === false,
                                  )
                                }
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                                  responsibility.substitutionAllowed !== false
                                    ? "bg-orange-500"
                                    : "bg-gray-300"
                                }`}
                              >
                                <span
                                  className={`absolute left-0 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                                    responsibility.substitutionAllowed !== false
                                      ? "translate-x-5"
                                      : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                              SUB
                            </label>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center">
                        <p className="text-sm font-semibold text-gray-700">
                          Flexible ministry staffing
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          No positions are required. This ministry can organize
                          as many participants as needed for each event.
                        </p>
                      </div>
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
                : editingMinistryId
                  ? `Update ${ministryName(editingMinistryId)} section`
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
