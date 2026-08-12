import * as React from "react"
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  UserMinusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistryPendingInvitations from "./MinistryPendingInvitations"

const ministryRoleLabels = {
  owner: "Owner",
  admin: "Ministry Admin",
  member: "Member",
}

const globalRoleLabel = (role) => {
  if (role === "owner") return "Global Owner"
  if (role === "super_admin") return "Super Admin"
  return "Member"
}

const MinistryGlobalMembers = () => {
  const [data, setData] = React.useState(null)
  const [query, setQuery] = React.useState("")
  const [selectedMemberId, setSelectedMemberId] = React.useState(null)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteMinistryIds, setInviteMinistryIds] = React.useState([])
  const [addMinistryId, setAddMinistryId] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  const authHeaders = React.useCallback(
    (json = false) => ({
      ...(json ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${window.sessionStorage.getItem(MINISTRY_SESSION_KEY)}`,
    }),
    []
  )

  const loadMembers = React.useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("ministry-global-members"),
        { headers: authHeaders() }
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to load members")
      }
      setData(result)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [authHeaders])

  React.useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const selectedMember = React.useMemo(
    () => data?.members.find((member) => member.id === selectedMemberId) || null,
    [data, selectedMemberId]
  )

  const filteredMembers = React.useMemo(() => {
    if (!data) return []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return data.members
    return data.members.filter((member) =>
      [
        member.firstName,
        member.lastName,
        globalRoleLabel(member.globalRole),
        ...member.memberships.map((membership) => membership.ministryName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    )
  }, [data, query])

  const runMemberAction = async (change) => {
    setMessage("")
    setErrorMessage("")
    setIsSaving(true)
    try {
      const response = await fetch(getFunctionEndpoint("ministry-members"), {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify(change),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to update member")
      }
      setMessage(result.message)
      setAddMinistryId("")
      await loadMembers()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const sendInvitationRequest = async ({ email, userId, ministryIds }) => {
    setMessage("")
    setErrorMessage("")
    setIsSaving(true)
    try {
      const response = await fetch(getFunctionEndpoint("ministry-members"), {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          email,
          userId,
          ministryIds,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to send invitation")
      }
      setMessage(result.message)
      await loadMembers()
      return true
    } catch (error) {
      setErrorMessage(error.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const sendInvitation = async (event) => {
    event.preventDefault()
    const sent = await sendInvitationRequest({
      email: inviteEmail,
      ministryIds: inviteMinistryIds,
    })
    if (sent) {
      setInviteEmail("")
      setInviteMinistryIds([])
      setInviteOpen(false)
    }
  }

  const inviteExistingMember = async () => {
    if (!selectedMember?.id || !addMinistryId) return
    const sent = await sendInvitationRequest({
      userId: selectedMember.id,
      ministryIds: [addMinistryId],
    })
    if (sent) setAddMinistryId("")
  }

  if (isLoading && !data) {
    return <p className="p-8 text-center text-gray-500">Loading members...</p>
  }

  if (!data) {
    return (
      <p role="alert" className="p-8 text-center text-red-700">
        {errorMessage}
      </p>
    )
  }

  const notice = (message || errorMessage) && (
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
  )

  if (selectedMember) {
    const existingMinistryIds = new Set(
      selectedMember.memberships.map((membership) => membership.ministryId)
    )
    const availableMinistries = data.ministries.filter(
      (ministry) => !existingMinistryIds.has(ministry.id)
    )
    const isCurrentUser = selectedMember.id === data.currentUserId

    return (
      <div className="space-y-5">
        {notice}
        <button
          type="button"
          onClick={() => {
            setSelectedMemberId(null)
            setMessage("")
            setErrorMessage("")
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6f4f34]"
        >
          <ArrowLeftIcon className="size-4" />
          Back to members
        </button>

        <header className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="century-font text-3xl text-gray-950">
                {selectedMember.firstName} {selectedMember.lastName}
              </h2>
            </div>
            <span className="self-start rounded-full bg-[#f4ede6] px-3 py-1 text-xs font-semibold text-[#896542]">
              {globalRoleLabel(selectedMember.globalRole)}
            </span>
          </div>
        </header>

        {data.canManageAll && <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="size-6 text-[#896542]" />
            <div>
              <h3 className="font-semibold text-gray-900">Account access</h3>
              <p className="text-sm text-gray-500">
                Super Admins can see and manage every Ministry app ministry.
              </p>
            </div>
          </div>
          {selectedMember.globalRole === "owner" || isCurrentUser ? (
            <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
              {selectedMember.globalRole === "owner"
                ? "Global Owner access cannot be changed here."
                : "You cannot change your own Super Admin access."}
            </p>
          ) : (
            <label className="mt-4 block max-w-sm text-sm font-semibold text-gray-700">
              Global access level
              <select
                value={selectedMember.globalRole}
                disabled={isSaving}
                onChange={(event) => {
                  const nextRole = event.target.value
                  const description =
                    nextRole === "super_admin"
                      ? `Grant ${selectedMember.firstName} Super Admin access to every ministry?`
                      : `Remove ${selectedMember.firstName}'s Super Admin access?`
                  if (window.confirm(description)) {
                    runMemberAction({
                      action: "set_global_role",
                      userId: selectedMember.id,
                      globalRole: nextRole,
                    })
                  }
                }}
                className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal"
              >
                <option value="regular">Regular Ministry account</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </label>
          )}
        </section>}

        {data.canManageAll && selectedMember.globalRole !== "owner" && !isCurrentUser && (
          <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Suppress member profile</h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              This removes the member from every active Ministry list and blocks Ministry sign-in.
              Their account, assignments, membership history, and audit history are retained so the
              same profile can be restored if they accept a future invitation.
            </p>
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                window.confirm(
                  `Suppress ${selectedMember.firstName} ${selectedMember.lastName}? They will be removed from every active Ministry list but their history will be retained.`
                ) &&
                runMemberAction({
                  userId: selectedMember.id,
                  action: "suppress_profile",
                })
              }
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
            >
              <UserMinusIcon className="size-4" />
              Suppress member profile
            </button>
          </section>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900">Ministry memberships</h3>
          <div className="mt-4 space-y-3">
            {selectedMember.memberships.map((membership) => {
              const ministryLevels = data.levels.filter(
                (level) => level.ministryId === membership.ministryId
              )
              return (
                <div
                  key={membership.id}
                  className="grid gap-3 rounded-xl border border-gray-100 p-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{membership.ministryName}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {membership.highestLevelName || "No ministry level assigned"}
                    </p>
                  </div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Ministry access
                    {membership.role === "owner" ? (
                      <span className="mt-1 block rounded-lg bg-[#f4ede6] px-3 py-2 text-sm normal-case text-[#896542]">
                        Owner
                      </span>
                    ) : (
                      <select
                        value={membership.role}
                        disabled={isSaving}
                        onChange={(event) =>
                          runMemberAction({
                            ministryId: membership.ministryId,
                            userId: selectedMember.id,
                            action: "set_role",
                            level: event.target.value,
                          })
                        }
                        className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Ministry Admin</option>
                      </select>
                    )}
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Highest level
                    <select
                      value={membership.highestLevelId || ""}
                      disabled={isSaving}
                      onChange={(event) =>
                        runMemberAction({
                          ministryId: membership.ministryId,
                          userId: selectedMember.id,
                          action: "set_ministry_level",
                          highestLevelId: event.target.value,
                        })
                      }
                      className="mt-1 block min-w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700"
                    >
                      <option value="">Not assigned</option>
                      {ministryLevels.map((level) => (
                        <option key={level.id} value={level.id}>
                          Level {level.rankOrder} · {level.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {membership.role !== "owner" && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        window.confirm(
                          `Remove ${selectedMember.firstName} from ${membership.ministryName}?`
                        ) &&
                        runMemberAction({
                          ministryId: membership.ministryId,
                          userId: selectedMember.id,
                          action: "remove",
                        })
                      }
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      <UserMinusIcon className="size-4" />
                      Remove from ministry
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {availableMinistries.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={addMinistryId}
                onChange={(event) => setAddMinistryId(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="">Invite to a ministry...</option>
                {availableMinistries.map((ministry) => (
                  <option key={ministry.id} value={ministry.id}>
                    {ministry.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isSaving || !addMinistryId}
                onClick={inviteExistingMember}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34] disabled:opacity-50"
              >
                <EnvelopeIcon className="size-4" />
                Send invitation
              </button>
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {notice}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <UsersIcon className="size-6 text-[#896542]" />
            <div>
              <h2 className="century-font text-2xl text-gray-950">Members</h2>
              <p className="text-sm text-gray-500">
                {data.members.length} Ministry app {data.members.length === 1 ? "member" : "members"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white"
          >
            <EnvelopeIcon className="size-4" />
            Invite new member
          </button>
        </div>

        {inviteOpen && (
          <form onSubmit={sendInvitation} className="mt-5 rounded-xl border border-[#e6ddd4] bg-[#faf8f5] p-4">
            <h3 className="font-semibold text-gray-900">Send a private Ministry invitation</h3>
            <p className="mt-1 text-sm text-gray-500">
              After the person accepts, open their profile here to set their Ministry access and level.
            </p>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="member@example.com"
              className="mt-3 h-11 w-full max-w-lg rounded-lg border border-gray-200 bg-white px-3 text-sm"
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.ministries.map((ministry) => (
                <label key={ministry.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={inviteMinistryIds.includes(ministry.id)}
                    onChange={() =>
                      setInviteMinistryIds((current) =>
                        current.includes(ministry.id)
                          ? current.filter((id) => id !== ministry.id)
                          : [...current, ministry.id]
                      )
                    }
                    className="size-4 accent-[#896542]"
                  />
                  {ministry.name}
                </label>
              ))}
            </div>
            <button
              type="submit"
              disabled={isSaving || !inviteMinistryIds.length}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <EnvelopeIcon className="size-4" />
              Send invitation
            </button>
          </form>
        )}

        <label className="relative mt-5 block">
          <span className="sr-only">Search members</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3.5 size-5 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, ministry, or access"
            className="h-12 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#896542]"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="century-font text-2xl text-gray-950">
            Pending invitations
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            People who have been invited but have not accepted yet.
          </p>
        </div>
        <MinistryPendingInvitations
          invitations={data.invitations || []}
          onAction={(action, invitation) =>
            runMemberAction({ action, invitationId: invitation.id })
          }
          disabled={isSaving}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.2fr_0.8fr_1.5fr_2rem] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid">
          <span>Member</span>
          <span>Account access</span>
          <span>Ministries</span>
          <span />
        </div>
        <div className="divide-y divide-gray-100">
          {filteredMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setSelectedMemberId(member.id)
                setMessage("")
                setErrorMessage("")
              }}
              className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-[#faf8f5] md:grid-cols-[1.2fr_0.8fr_1.5fr_2rem] md:items-center md:gap-4"
            >
              <span>
                <span className="block font-semibold text-gray-900">
                  {member.firstName} {member.lastName}
                </span>
              </span>
              <span className="text-sm font-semibold text-[#6f4f34]">
                {globalRoleLabel(member.globalRole)}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {member.memberships.map((membership) => (
                  <span key={membership.id} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                    {membership.ministryName} · {ministryRoleLabels[membership.role]}
                  </span>
                ))}
              </span>
              <ChevronRightIcon className="hidden size-5 text-gray-400 md:block" />
            </button>
          ))}
          {!filteredMembers.length && (
            <p className="p-8 text-center text-gray-500">No members match this search.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default MinistryGlobalMembers
