import * as React from "react"
import {
  AcademicCapIcon,
  ArchiveBoxIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  HandRaisedIcon,
  HeartIcon,
  MusicalNoteIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  UserMinusIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryPendingInvitations from "./MinistryPendingInvitations"
import { MinistryListSkeleton } from "./MinistryLoadingSkeleton"

const roleLabels = {
  owner: "Owner",
  admin: "Ministry Admin",
  member: "Member",
}

const servingPreferenceOptions = [
  { value: "prefer", label: "Always available (100%)" },
  { value: "sometimes", label: "Can help sometimes" },
  { value: "if_necessary", label: "Available if necessary" },
  { value: "cannot_serve", label: "Cannot serve" },
  { value: "not_specified", label: "Not specified" },
]

const badgeIconOptions = [
  { key: "academic-cap", label: "Academic cap", Icon: AcademicCapIcon },
  { key: "hand-raised", label: "Raised hand", Icon: HandRaisedIcon },
  { key: "heart", label: "Heart", Icon: HeartIcon },
  { key: "musical-note", label: "Musical note", Icon: MusicalNoteIcon },
  { key: "shield-check", label: "Shield", Icon: ShieldCheckIcon },
  { key: "sparkles", label: "Sparkles", Icon: SparklesIcon },
  { key: "star", label: "Star", Icon: StarIcon },
  { key: "user-group", label: "Group", Icon: UserGroupIcon },
]

const LevelBadge = ({ iconKey, label, className = "" }) => {
  const option = badgeIconOptions.find((badge) => badge.key === iconKey)
  const Icon = option?.Icon
  return (
    <span
      title={option ? `${label}: ${option.label}` : label}
      className={`inline-flex size-8 items-center justify-center rounded-full bg-[#f4ede6] text-[#896542] ${className}`}
    >
      {Icon ? <Icon className="size-4" /> : <span className="text-xs font-semibold">{label}</span>}
    </span>
  )
}

const ReliabilityBadge = ({ reliability, compact = false }) => {
  if (!reliability) return null
  const needsFollowUp = reliability.needsFollowUp
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        needsFollowUp
          ? "bg-amber-100 text-amber-900"
          : "bg-emerald-50 text-emerald-700"
      }`}
      title={needsFollowUp ? "This member has reliability points to recover. Please follow up." : "Reliability is current."}
    >
      {needsFollowUp && <ExclamationTriangleIcon className="size-4" />}
      Reliability {reliability.score}
      {!compact && needsFollowUp ? " · Follow up" : ""}
    </span>
  )
}

const MinistryMembers = ({ data, activeAction }) => {
  const [memberData, setMemberData] = React.useState(null)
  const [email, setEmail] = React.useState("")
  const [selectedMinistryIds, setSelectedMinistryIds] = React.useState([
    data.ministry.id,
  ])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [newLevelName, setNewLevelName] = React.useState("")
  const [newLevelIconKey, setNewLevelIconKey] = React.useState("")
  const [newGroupName, setNewGroupName] = React.useState("")
  const [newGroupDescription, setNewGroupDescription] = React.useState("")
  const [newGroupAutomatic, setNewGroupAutomatic] = React.useState(false)
  const [levelDrafts, setLevelDrafts] = React.useState({})
  const [groupDrafts, setGroupDrafts] = React.useState({})
  const [selectedMemberId, setSelectedMemberId] = React.useState("")
  const [preferenceDrafts, setPreferenceDrafts] = React.useState({})
  const [draggedLevelId, setDraggedLevelId] = React.useState("")
  const [levelDropTargetId, setLevelDropTargetId] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  const endpoint = React.useMemo(() => {
    if (typeof window === "undefined") return ""
    const url = new URL(
      getFunctionEndpoint("ministry-members"),
      window.location.origin
    )
    url.searchParams.set("ministryId", data.ministry.id)
    return url.toString()
  }, [data.ministry.id])

  const loadMembers = React.useCallback(async () => {
    if (!endpoint) return
    setIsLoading(true)
    setErrorMessage("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to load members")
      setMemberData(result)
      const preferenceRecords = result.canManage
        ? result.members || []
        : result.currentMembership
          ? [{ userId: data.user.id, ...result.currentMembership }]
          : []
      setPreferenceDrafts(
        Object.fromEntries(
          preferenceRecords.map((member) => [
            member.userId,
            {
              servingPreference:
                member.servingPreference || "prefer",
              monthlyFrequencyLimit: member.monthlyFrequencyLimit ?? "",
              automaticAssignmentMonthlyLimit:
                member.automaticAssignmentMonthlyLimit ?? "",
            },
          ]),
        ),
      )
      setLevelDrafts(
        Object.fromEntries(
          (result.levels || []).map((level) => [
            level.id,
            {
              name: level.name,
              iconKey: level.iconKey || "",
            },
          ]),
        ),
      )
      setGroupDrafts(Object.fromEntries((result.groups || []).map((group) => [group.id, { name: group.name, description: group.description || "" }])))
      if (result.ministries?.some((ministry) => ministry.id === data.ministry.id)) {
        setSelectedMinistryIds((current) =>
          current.length ? current : [data.ministry.id]
        )
      }
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [data.ministry.id, endpoint])

  React.useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const toggleMinistry = (ministryId) => {
    setSelectedMinistryIds((current) =>
      current.includes(ministryId)
        ? current.filter((id) => id !== ministryId)
        : [...current, ministryId]
    )
  }

  const sendInvitation = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage("")
    setErrorMessage("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("ministry-members"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, ministryIds: selectedMinistryIds }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to send invitation")
      const skipped = result.skippedMinistries?.length
        ? ` Already a member of: ${result.skippedMinistries.join(", ")}.`
        : ""
      setMessage(`${result.message}.${skipped}`)
      setEmail("")
      await loadMembers()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateMembership = async (membershipChange) => {
    setMessage("")
    setErrorMessage("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("ministry-members"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ministryId: data.ministry.id,
          ...membershipChange,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to update member")
      setMessage(result.message)
      if (membershipChange.action === "leave") {
        if (data.user.globalRole === "regular") {
          window.sessionStorage.removeItem(MINISTRY_SESSION_KEY)
        }
        window.location.assign("/")
        return true
      }
      await loadMembers()
      return true
    } catch (error) {
      setErrorMessage(error.message)
      return false
    }
  }

  const updatePreferenceDraft = (userId, field, value) =>
    setPreferenceDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: value,
      },
    }))

  const saveServingPreferences = (userId) =>
    updateMembership({
      userId,
      action: "set_serving_preferences",
      ...(preferenceDrafts[userId] || {}),
    })

  const manageInvitation = async (action, invitation) => {
    setIsSubmitting(true)
    try {
      await updateMembership({
        action,
        invitationId: invitation.id,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const createMinistryLevel = async (event) => {
    event.preventDefault()
    if (!newLevelName.trim()) return
    setIsSubmitting(true)
    try {
      const saved = await updateMembership({
        action: "create_ministry_level",
        name: newLevelName,
        iconKey: newLevelIconKey,
      })
      if (saved) {
        setNewLevelName("")
        setNewLevelIconKey("")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const createGroup = async (event) => {
    event.preventDefault()
    if (!newGroupName.trim()) return
    const saved = await updateMembership({
      action: "create_group",
      name: newGroupName,
      description: newGroupDescription,
      automaticMembership: newGroupAutomatic,
    })
    if (saved) {
      setNewGroupName("")
      setNewGroupDescription("")
      setNewGroupAutomatic(false)
    }
  }

  const updateLevelDraft = (levelId, field, value) =>
    setLevelDrafts((current) => ({
      ...current,
      [levelId]: {
        ...current[levelId],
        [field]: value,
      },
    }))

  const swapMinistryLevels = async (targetLevelId) => {
    if (!draggedLevelId || draggedLevelId === targetLevelId) return

    // The list is displayed highest-first, while rank_order is stored
    // lowest-first. Swap what the administrator sees, then send the stored
    // order back to the server.
    const displayedLevels = [...(memberData?.levels || [])].reverse()
    const draggedIndex = displayedLevels.findIndex(
      (level) => level.id === draggedLevelId,
    )
    const targetIndex = displayedLevels.findIndex(
      (level) => level.id === targetLevelId,
    )
    if (draggedIndex < 0 || targetIndex < 0) return

    ;[displayedLevels[draggedIndex], displayedLevels[targetIndex]] = [
      displayedLevels[targetIndex],
      displayedLevels[draggedIndex],
    ]
    await updateMembership({
      action: "reorder_ministry_levels",
      orderedLevelIds: displayedLevels.reverse().map((level) => level.id),
    })
  }

  if (isLoading) {
    return <MinistryListSkeleton label="Loading ministry members" />
  }

  if (!memberData) {
    return <p role="alert" className="p-6 text-center text-red-600">{errorMessage}</p>
  }

  if (!memberData.canManage) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
        <h3 className="century-font text-2xl text-[#6f4f34]">Your membership</h3>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          You are a Member of {data.ministry.name}. You may leave this ministry at any time.
        </p>
        <p className="mt-3 text-sm font-semibold text-[#6f4f34]">
          Ministry level:{" "}
          {memberData.currentMembership?.highestLevelName ||
            "Not assigned yet"}
        </p>
        {memberData.currentMembership?.groupNames?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {memberData.currentMembership.groupNames.map((name) => <span key={name} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{name}</span>)}
          </div>
        )}
        <div className="mt-6 rounded-xl border border-gray-100 bg-[#fcfaf8] p-5">
          <h4 className="century-font text-xl text-gray-900">
            Service Frequency
          </h4>
          <p className="mt-1 text-sm text-gray-500">
            Choose how frequently you can serve in this ministry. Everyone starts as always available.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Service frequency
              <select
                value={preferenceDrafts[data.user.id]?.servingPreference || "prefer"}
                onChange={(event) =>
                  updatePreferenceDraft(
                    data.user.id,
                    "servingPreference",
                    event.target.value,
                  )
                }
                className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
              >
                {servingPreferenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Times per month in this ministry
              <input
                type="number"
                min="1"
                max="100"
                value={preferenceDrafts[data.user.id]?.monthlyFrequencyLimit ?? ""}
                onChange={(event) =>
                  updatePreferenceDraft(
                    data.user.id,
                    "monthlyFrequencyLimit",
                    event.target.value,
                  )
                }
                placeholder="No limit"
                className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
              Automatic assignments per month across all ministries
              <input
                type="number"
                min="1"
                max="100"
                value={preferenceDrafts[data.user.id]?.automaticAssignmentMonthlyLimit ?? ""}
                onChange={(event) =>
                  updatePreferenceDraft(
                    data.user.id,
                    "automaticAssignmentMonthlyLimit",
                    event.target.value,
                  )
                }
                placeholder="No limit"
                className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => saveServingPreferences(data.user.id)}
            className="mt-4 rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34]"
          >
            Update frequency
          </button>
        </div>
        <button
          type="button"
          data-guide-id="member-leave-ministry"
          onClick={() =>
            updateMembership({ userId: data.user.id, action: "leave" })
          }
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          <UserMinusIcon className="size-4" />
          Leave ministry
        </button>
      </section>
    )
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

      {activeAction.id === "add-member" && (
        <form
          onSubmit={sendInvitation}
          className="grid gap-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:grid-cols-[1fr_1.1fr]"
        >
          <div>
            <div className="flex items-center gap-3">
              <EnvelopeIcon className="size-6 text-[#896542]" />
              <h3 className="century-font text-2xl text-gray-900">Invite a member</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              One private email will include every selected ministry. Membership begins only after the recipient accepts.
            </p>
            <label className="mt-5 block text-sm font-semibold text-gray-700">
              Email address
              <input
                type="email"
                data-guide-id="member-invite-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="member@example.com"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-normal outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/15"
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-gray-700">Ministries</legend>
            <div className="mt-2 space-y-2">
              {memberData.ministries.map((ministry) => (
                <label
                  key={ministry.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 p-3 hover:border-[#C1A387]"
                >
                  <input
                    type="checkbox"
                    data-guide-id="member-invite-ministry"
                    checked={selectedMinistryIds.includes(ministry.id)}
                    onChange={() => toggleMinistry(ministry.id)}
                    className="size-4 accent-[#896542]"
                  />
                  <span className="text-sm font-medium text-gray-800">{ministry.name}</span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !selectedMinistryIds.length}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white hover:bg-[#6f4f34] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <EnvelopeIcon className="size-5" />
              {isSubmitting ? "Sending invitation..." : "Send invitation"}
            </button>
          </fieldset>
        </form>
      )}

      {activeAction.id === "levels" && (
        <div className="space-y-8">
          <section>
            <div className="mb-4">
              <h3 className="century-font text-2xl text-gray-900">
                Ministry levels
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Levels run from least to most capable. A member may serve their
                highest granted level and every level below it.
              </p>
              <p className="mt-2 text-xs font-semibold text-[#896542]">
                Drag one level onto another to swap their order. The highest
                level qualifies for every capability below it.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {[...(memberData.levels || [])].reverse().map((level) => {
                const levelIndex = memberData.levels.findIndex(
                  (candidate) => candidate.id === level.id,
                )
                const draft = levelDrafts[level.id] || {
                  name: level.name,
                  iconKey: level.iconKey || "",
                }
                return (
                  <div
                    key={level.id}
                    draggable
                    onDragStart={() => {
                      setDraggedLevelId(level.id)
                      setLevelDropTargetId(level.id)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setLevelDropTargetId(level.id)
                    }}
                    onDrop={async (event) => {
                      event.preventDefault()
                      await swapMinistryLevels(level.id)
                      setDraggedLevelId("")
                      setLevelDropTargetId("")
                    }}
                    onDragEnd={() => {
                      setDraggedLevelId("")
                      setLevelDropTargetId("")
                    }}
                    className={`grid cursor-grab gap-3 border-b border-gray-100 p-4 last:border-0 active:cursor-grabbing sm:grid-cols-[auto_auto_1fr_auto] sm:items-center ${
                      levelDropTargetId === level.id &&
                      draggedLevelId !== level.id
                        ? "bg-[#fcf7f2] ring-2 ring-inset ring-[#C1A387]"
                        : ""
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      title="Drag to swap this level"
                      className="hidden text-gray-400 sm:block"
                    >
                      <ChevronUpDownIcon className="size-5" />
                    </span>
                    <LevelBadge iconKey={level.iconKey} label={level.rankOrder} />
                    <div className="grid gap-2 sm:grid-cols-[1fr_13rem]">
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          updateLevelDraft(
                            level.id,
                            "name",
                            event.target.value,
                          )
                        }
                        aria-label={`Name for level ${level.rankOrder}`}
                        className="h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#896542]"
                      />
                      <select
                        value={draft.iconKey}
                        onChange={(event) => updateLevelDraft(level.id, "iconKey", event.target.value)}
                        aria-label={`Badge icon for ${level.name}`}
                        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#896542]"
                      >
                        <option value="">No badge yet</option>
                        {badgeIconOptions.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateMembership({
                            action: "move_ministry_level",
                            levelId: level.id,
                            direction: "up",
                          })
                        }
                        disabled={levelIndex === memberData.levels.length - 1}
                        aria-label={`Move ${level.name} higher`}
                        className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-[#C1A387] disabled:opacity-30"
                      >
                        <ChevronUpIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateMembership({
                            action: "move_ministry_level",
                            levelId: level.id,
                            direction: "down",
                          })
                        }
                        disabled={levelIndex === 0}
                        aria-label={`Move ${level.name} lower`}
                        className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-[#C1A387] disabled:opacity-30"
                      >
                        <ChevronDownIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateMembership({
                            action: "update_ministry_level",
                            levelId: level.id,
                            ...draft,
                          })
                        }
                        className="rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Archive "${level.name}"? It must not be assigned to members or responsibilities.`,
                            )
                          ) {
                            updateMembership({
                              action: "archive_ministry_level",
                              levelId: level.id,
                            })
                          }
                        }}
                        aria-label={`Archive ${level.name}`}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <ArchiveBoxIcon className="size-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {!memberData.levels?.length && (
                <p className="p-5 text-center text-sm text-gray-500">
                  No levels have been configured for this ministry.
                </p>
              )}
              <form
                onSubmit={createMinistryLevel}
                className="grid gap-3 border-t border-gray-100 bg-[#fcfaf8] p-4 sm:grid-cols-[1fr_13rem_auto]"
              >
                <input
                  value={newLevelName}
                  onChange={(event) => setNewLevelName(event.target.value)}
                  required
                  placeholder="New level name"
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#896542]"
                />
                <select
                  value={newLevelIconKey}
                  onChange={(event) => setNewLevelIconKey(event.target.value)}
                  aria-label="Badge icon for new level"
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#896542]"
                >
                  <option value="">No badge yet</option>
                  {badgeIconOptions.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <PlusIcon className="size-4" />
                  Add level
                </button>
              </form>
            </div>
          </section>
          <section>
            <div className="mb-4">
              <h3 className="century-font text-2xl text-gray-900">Ministry groups</h3>
              <p className="mt-1 text-sm text-gray-500">Groups describe where members belong and remain independent from ministry levels.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {(memberData.groups || []).map((group) => (
                <div key={group.id} className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <input value={groupDrafts[group.id]?.name ?? group.name} onChange={(event) => setGroupDrafts((current) => ({ ...current, [group.id]: { ...current[group.id], name: event.target.value } }))} aria-label={`Name for ${group.name}`} className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm font-semibold" />
                    <input value={groupDrafts[group.id]?.description ?? group.description} onChange={(event) => setGroupDrafts((current) => ({ ...current, [group.id]: { ...current[group.id], description: event.target.value } }))} aria-label={`Description for ${group.name}`} placeholder="Description" className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={group.automaticMembership}
                      onChange={(event) => updateMembership({ action: "update_group", groupId: group.id, name: group.name, description: group.description, automaticMembership: event.target.checked })}
                      className="size-4 rounded border-gray-300"
                    />
                    Automatic membership
                  </label>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={group.sortOrder <= 1} onClick={() => { const ordered = [...memberData.groups]; const index = ordered.findIndex((item) => item.id === group.id); [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]]; updateMembership({ action: "reorder_groups", groupIds: ordered.map((item) => item.id) }) }} className="rounded-lg border border-gray-200 p-2 disabled:opacity-30" aria-label={`Move ${group.name} up`}><ChevronUpIcon className="size-4" /></button>
                    <button type="button" disabled={group.sortOrder >= memberData.groups.length} onClick={() => { const ordered = [...memberData.groups]; const index = ordered.findIndex((item) => item.id === group.id); [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]]; updateMembership({ action: "reorder_groups", groupIds: ordered.map((item) => item.id) }) }} className="rounded-lg border border-gray-200 p-2 disabled:opacity-30" aria-label={`Move ${group.name} down`}><ChevronDownIcon className="size-4" /></button>
                    <button type="button" onClick={() => updateMembership({ action: "update_group", groupId: group.id, ...(groupDrafts[group.id] || group), automaticMembership: group.automaticMembership })} className="rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]">Update</button>
                  </div>
                  <button type="button" onClick={() => updateMembership({ action: "archive_group", groupId: group.id })} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700" aria-label={`Archive ${group.name}`}>
                    <ArchiveBoxIcon className="size-4" />
                  </button>
                </div>
              ))}
              <form onSubmit={createGroup} className="grid gap-3 bg-[#fcfaf8] p-4 sm:grid-cols-2">
                <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} required placeholder="New group name" className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm" />
                <input value={newGroupDescription} onChange={(event) => setNewGroupDescription(event.target.value)} placeholder="Description (optional)" className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm" />
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={newGroupAutomatic} onChange={(event) => setNewGroupAutomatic(event.target.checked)} className="size-4 rounded border-gray-300" />Automatic membership</label>
                <button type="submit" className="rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white">Add group</button>
              </form>
            </div>
          </section>
        </div>
      )}

      {activeAction.id === "member-access" && (
        <div className="space-y-8">
          <section>
            <div className="mb-4">
              <h3 className="century-font text-2xl text-gray-900">
                Member access and levels
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Access controls administration. Set each person’s highest
                level in this ministry; they can serve that level and every
                level below it.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {memberData.members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  className="flex flex-col gap-3 border-b border-gray-100 p-4 last:border-0 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">
                      {member.firstName} {member.lastName}
                      {member.backgroundCheckVerified && (
                        <ShieldCheckIcon className="ml-1.5 inline size-5 text-orange-500" aria-label="Background check verified" />
                      )}
                    </p>
                    {member.reliability?.needsFollowUp && (
                      <div className="mt-2"><ReliabilityBadge reliability={member.reliability} /></div>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#f4ede6] px-3 py-2 text-sm font-semibold text-[#896542]">
                    {member.highestLevelName && <LevelBadge iconKey={member.highestLevelIconKey} label={member.highestLevelRank || ""} className="bg-white" />}
                    {member.highestLevelName || "No level assigned"}
                  </span>
                  {(member.groupIds || []).map((groupId) => {
                    const group = memberData.groups?.find((item) => item.id === groupId)
                    return group ? <span key={group.id} className="rounded-full bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{group.name}</span> : null
                  })}
                  <span className="text-sm font-semibold text-[#896542]">
                    Manage member
                  </span>
                </button>
              ))}
            </div>
            {selectedMemberId && (() => {
              const member = memberData.members.find(
                (candidate) => candidate.id === selectedMemberId,
              )
              if (!member) return null
              return (
                <div className="mt-5 rounded-2xl border border-[#d8c7b8] bg-[#fcfaf8] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#896542]">Member details</p>
                      <h4 className="mt-1 century-font text-2xl text-gray-900">
                        {member.firstName} {member.lastName}
                        {member.backgroundCheckVerified && (
                          <ShieldCheckIcon className="ml-2 inline size-6 text-orange-500" aria-label="Background check verified" />
                        )}
                      </h4>
                    </div>
                    <button type="button" onClick={() => setSelectedMemberId("")} className="text-sm font-semibold text-[#6f4f34] hover:underline">Close</button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className={`rounded-xl border p-4 sm:col-span-2 ${
                      member.reliability?.needsFollowUp
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-100 bg-emerald-50"
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Reliability score</p>
                          <p className="mt-1 text-xs text-gray-600">
                            {member.reliability?.needsFollowUp
                              ? "This member has lost points. Reach out to understand the situation and help correct the pattern."
                              : "No reliability follow-up is currently needed."}
                          </p>
                        </div>
                        <ReliabilityBadge reliability={member.reliability} />
                      </div>
                    </div>
                    <fieldset className="rounded-xl border border-blue-100 bg-blue-50 p-4 sm:col-span-2">
                      <legend className="px-1 text-sm font-semibold text-blue-900">Groups</legend>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {(memberData.groups || []).map((group) => (
                          <label key={group.id} className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                            <input
                              type="checkbox"
                              checked={(member.groupIds || []).includes(group.id)}
                              disabled={group.automaticMembership}
                              onChange={(event) => {
                                const groupIds = event.target.checked
                                  ? [...(member.groupIds || []), group.id]
                                  : (member.groupIds || []).filter((id) => id !== group.id)
                                updateMembership({ userId: member.userId, action: "set_member_groups", groupIds })
                              }}
                              className="size-4 rounded border-blue-300"
                            />
                            {group.name}{group.automaticMembership ? " (automatic)" : ""}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="text-sm font-semibold text-gray-700">
                      Access role
                      {member.level === "owner" ? (
                        <span className="mt-2 block rounded-lg bg-[#f4ede6] px-3 py-2 text-[#896542]">Owner</span>
                      ) : (
                        <select value={member.level} onChange={(event) => updateMembership({ userId: member.userId, action: "set_role", level: event.target.value })} className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal">
                          <option value="member">Member</option>
                          <option value="admin">Ministry Admin</option>
                        </select>
                      )}
                    </label>
                    <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
                      <span>
                        Can serve
                        <span className="mt-1 block text-xs font-normal text-gray-500">
                          Only a ministry administrator can change this setting.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={member.canServe}
                        onChange={(event) =>
                          updateMembership({
                            userId: member.userId,
                            action: "set_can_serve",
                            canServe: event.target.checked,
                          })
                        }
                        className="size-5 rounded border-gray-300 text-[#896542] focus:ring-[#896542]"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Highest level in {data.ministry.name}
                      <select value={member.highestLevelId || ""} onChange={(event) => updateMembership({ userId: member.userId, action: "set_ministry_level", highestLevelId: event.target.value })} className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal">
                        <option value="">Not assigned</option>
                        {memberData.levels.map((level) => <option key={level.id} value={level.id}>Level {level.rankOrder} · {level.name}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Service frequency
                      <select
                        value={preferenceDrafts[member.userId]?.servingPreference || "prefer"}
                        onChange={(event) =>
                          updatePreferenceDraft(member.userId, "servingPreference", event.target.value)
                        }
                        className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
                      >
                        {servingPreferenceOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Times per month in this ministry
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={preferenceDrafts[member.userId]?.monthlyFrequencyLimit ?? ""}
                        onChange={(event) =>
                          updatePreferenceDraft(member.userId, "monthlyFrequencyLimit", event.target.value)
                        }
                        placeholder="No limit"
                        className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
                      />
                    </label>
                    {memberData.canManageAll && (
                      <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                        Automatic assignments per month across all ministries
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={preferenceDrafts[member.userId]?.automaticAssignmentMonthlyLimit ?? ""}
                          onChange={(event) =>
                            updatePreferenceDraft(member.userId, "automaticAssignmentMonthlyLimit", event.target.value)
                          }
                          placeholder="No limit"
                          className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
                        />
                      </label>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => saveServingPreferences(member.userId)}
                    className="mt-4 rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f4f34]"
                  >
                    Update service frequency
                  </button>
                </div>
              )
            })()}
          </section>
        </div>
      )}

      {activeAction.id === "roster" && (
        <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div>
            <h3 className="mb-4 century-font text-2xl text-gray-900">Active roster</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {memberData.members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  aria-pressed={selectedMemberId === member.id}
                  className={`flex w-full items-center gap-2 rounded-2xl border bg-white px-4 py-4 text-left shadow-sm transition hover:border-[#C1A387] hover:shadow-md ${
                    selectedMemberId === member.id
                      ? "border-[#896542] ring-2 ring-[#f4ede6]"
                      : "border-gray-100"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">
                    {member.firstName} {member.lastName}
                  </span>
                  <span className="shrink-0 rounded-full bg-[#f4ede6] px-2.5 py-1 text-xs font-semibold text-[#896542]">
                    {roleLabels[member.level]}
                  </span>
                  <span className="max-w-36 shrink-0 truncate rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {member.highestLevelName || "No level"}
                  </span>
                </button>
              ))}
            </div>
            {selectedMemberId && (() => {
              const member = memberData.members.find(
                (candidate) => candidate.id === selectedMemberId,
              )
              if (!member) return null
              return (
                <div className="mt-5 rounded-2xl border border-[#d8c7b8] bg-[#fcfaf8] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#896542]">Ministry member details</p>
                      <h4 className="mt-1 century-font text-2xl text-gray-900">
                        {member.firstName} {member.lastName}
                      </h4>
                    </div>
                    <button type="button" onClick={() => setSelectedMemberId("")} className="text-sm font-semibold text-[#6f4f34] hover:underline">Close</button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <fieldset className="rounded-xl border border-blue-100 bg-blue-50 p-4 sm:col-span-2">
                      <legend className="px-1 text-sm font-semibold text-blue-900">Groups</legend>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {(memberData.groups || []).map((group) => (
                          <label key={group.id} className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                            <input
                              type="checkbox"
                              checked={(member.groupIds || []).includes(group.id)}
                              disabled={group.automaticMembership}
                              onChange={(event) => {
                                const groupIds = event.target.checked
                                  ? [...(member.groupIds || []), group.id]
                                  : (member.groupIds || []).filter((id) => id !== group.id)
                                updateMembership({ userId: member.userId, action: "set_member_groups", groupIds })
                              }}
                              className="size-4 rounded border-blue-300"
                            />
                            {group.name}{group.automaticMembership ? " (automatic)" : ""}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="text-sm font-semibold text-gray-700">
                      Access role
                      {member.level === "owner" ? (
                        <span className="mt-2 block rounded-lg bg-[#f4ede6] px-3 py-2 text-[#896542]">Owner</span>
                      ) : (
                        <select value={member.level} onChange={(event) => updateMembership({ userId: member.userId, action: "set_role", level: event.target.value })} className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal">
                          <option value="member">Member</option>
                          <option value="admin">Ministry Admin</option>
                        </select>
                      )}
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Highest level in {data.ministry.name}
                      <select value={member.highestLevelId || ""} onChange={(event) => updateMembership({ userId: member.userId, action: "set_ministry_level", highestLevelId: event.target.value })} className="mt-2 block h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal">
                        <option value="">Not assigned</option>
                        {memberData.levels.map((level) => <option key={level.id} value={level.id}>Level {level.rankOrder} · {level.name}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 sm:col-span-2">
                      <span>
                        Can serve
                        <span className="mt-1 block text-xs font-normal text-gray-500">Only a ministry administrator can change this setting.</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={member.canServe}
                        onChange={(event) => updateMembership({ userId: member.userId, action: "set_can_serve", canServe: event.target.checked })}
                        className="size-5 rounded border-gray-300 text-[#896542] focus:ring-[#896542]"
                      />
                    </label>
                  </div>
                  {member.level !== "owner" && (
                    <button
                      type="button"
                      onClick={() => updateMembership({ userId: member.userId, action: member.userId === data.user.id ? "leave" : "remove" })}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:underline"
                    >
                      <UserMinusIcon className="size-4" /> {member.userId === data.user.id ? "Leave ministry" : "Remove from ministry"}
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
          <aside>
            {memberData.canManageAll && (
              <>
                <h3 className="mb-4 century-font text-xl text-gray-900">Access requests</h3>
                <p className="mb-3 text-xs leading-relaxed text-gray-500">
                  These requests are not assigned to a chapel or ministry. Approving here sends an invitation for {data.ministry.name}.
                </p>
                <div className="mb-6 space-y-3">
                  {memberData.accessRequests?.length ? memberData.accessRequests.map((request) => (
                    <article key={request.id} className="rounded-xl border border-[#e6ddd4] bg-[#faf8f5] p-4">
                      <p className="font-semibold text-gray-900">{request.firstName} {request.lastName}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => updateMembership({ action: "approve_access_request", requestId: request.id })} className="rounded-lg bg-[#896542] px-3 py-2 text-xs font-semibold text-white">Approve for this ministry</button>
                        <button type="button" onClick={() => updateMembership({ action: "decline_access_request", requestId: request.id })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600">Decline</button>
                      </div>
                    </article>
                  )) : (
                    <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">No access requests.</p>
                  )}
                </div>
              </>
            )}
            <h3 className="mb-4 century-font text-xl text-gray-900">Child membership requests</h3>
            <div className="mb-6 space-y-3">
              {memberData.membershipRequests?.length ? memberData.membershipRequests.map((request) => (
                <article key={request.id} className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="font-semibold text-gray-900">{request.firstName} {request.lastName}</p>
                  <p className="mt-1 text-xs text-gray-500">Requested by {request.guardianName}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => updateMembership({ action: "approve_request", requestId: request.id })} className="rounded-lg bg-[#896542] px-3 py-2 text-xs font-semibold text-white">Approve</button>
                    <button type="button" onClick={() => updateMembership({ action: "decline_request", requestId: request.id })} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600">Decline</button>
                  </div>
                </article>
              )) : (
                <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">No child membership requests.</p>
              )}
            </div>
            <h3 className="mb-1 century-font text-xl text-gray-900">Pending invited members</h3>
            <p className="mb-4 text-xs leading-relaxed text-gray-500">
              Super Admins and the person who sent an invitation can see the pending recipient.
            </p>
            <MinistryPendingInvitations
              invitations={memberData.invitations}
              onAction={manageInvitation}
              disabled={isSubmitting}
            />
          </aside>
        </section>
      )}
    </div>
  )
}

export default MinistryMembers
