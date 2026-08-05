import * as React from "react"
import {
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserMinusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const roleLabels = {
  owner: "Owner",
  admin: "Leader",
  member: "Member",
}

const MinistryGlobalMembers = () => {
  const [data, setData] = React.useState(null)
  const [query, setQuery] = React.useState("")
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteMinistryIds, setInviteMinistryIds] = React.useState([])
  const [addMinistryByMember, setAddMinistryByMember] = React.useState({})
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
        {
          headers: authHeaders(),
        }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.message || "Unable to load members")
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

  const runMembershipAction = async (change) => {
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
      if (!response.ok)
        throw new Error(result.message || "Unable to update membership")
      setMessage(result.message)
      await loadMembers()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const sendInvitation = async (event) => {
    event.preventDefault()
    setMessage("")
    setErrorMessage("")
    setIsSaving(true)
    try {
      const response = await fetch(getFunctionEndpoint("ministry-members"), {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          email: inviteEmail,
          ministryIds: inviteMinistryIds,
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.message || "Unable to send invitation")
      setMessage(result.message)
      setInviteEmail("")
      setInviteMinistryIds([])
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredMembers = React.useMemo(() => {
    if (!data) return []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return data.members
    return data.members.filter((member) =>
      [
        member.firstName,
        member.lastName,
        member.email,
        member.username,
        ...member.memberships.map((membership) => membership.ministryName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    )
  }, [data, query])

  if (isLoading && !data) {
    return (
      <p className="p-8 text-center text-gray-500">Loading every member...</p>
    )
  }
  if (!data) {
    return (
      <p role="alert" className="p-8 text-center text-red-700">
        {errorMessage}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {(message || errorMessage) && (
        <div
          role={errorMessage ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${errorMessage ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"}`}
        >
          {errorMessage || message}
        </div>
      )}

      <section className="grid gap-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="flex items-center gap-3">
            <UsersIcon className="size-6 text-[#896542]" />
            <h3 className="century-font text-2xl text-gray-900">All members</h3>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {data.members.length} active{" "}
            {data.members.length === 1 ? "member" : "members"} across{" "}
            {data.ministries.length} ministries.
          </p>
          <label className="relative mt-5 block">
            <span className="sr-only">Search members</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3.5 size-5 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, username, or ministry"
              className="h-12 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#896542]"
            />
          </label>
        </div>

        <form
          onSubmit={sendInvitation}
          className="rounded-xl border border-[#e6ddd4] bg-[#faf8f5] p-4"
        >
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="size-5 text-[#896542]" />
            <h4 className="font-semibold text-gray-900">Invite a new member</h4>
          </div>
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="member@example.com"
            className="mt-3 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.ministries.map((ministry) => (
              <label
                key={ministry.id}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
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
      </section>

      <div className="space-y-4">
        {filteredMembers.map((member) => {
          const existingIds = new Set(
            member.memberships.map((membership) => membership.ministryId)
          )
          const availableMinistries = data.ministries.filter(
            (ministry) => !existingIds.has(ministry.id)
          )
          return (
            <article
              key={member.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="century-font text-2xl text-gray-900">
                    {member.firstName} {member.lastName}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {member.email} ·{" "}
                    {member.username || "Account setup pending"}
                  </p>
                </div>
                {member.globalRole !== "regular" && (
                  <span className="self-start rounded-full bg-[#f4ede6] px-3 py-1 text-xs font-semibold text-[#896542]">
                    {member.globalRole === "owner"
                      ? "Global Owner"
                      : "Super Admin"}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {!member.memberships.length && (
                  <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                    This account is not currently assigned to an active
                    ministry.
                  </p>
                )}
                {member.memberships.map((membership) => {
                  const ministryLevels = data.levels.filter(
                    (level) => level.ministryId === membership.ministryId
                  )
                  return (
                    <div
                      key={membership.id}
                      className="grid gap-3 rounded-xl border border-gray-100 p-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          {membership.ministryName}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {membership.highestLevelName ||
                            "No ministry level assigned"}
                        </p>
                      </div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Access
                        {membership.role === "owner" ? (
                          <span className="mt-1 block rounded-lg bg-[#f4ede6] px-3 py-2 text-sm normal-case text-[#896542]">
                            Owner
                          </span>
                        ) : (
                          <select
                            value={membership.role}
                            disabled={isSaving}
                            onChange={(event) =>
                              runMembershipAction({
                                ministryId: membership.ministryId,
                                userId: member.id,
                                action: "set_role",
                                level: event.target.value,
                              })
                            }
                            className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Leader</option>
                          </select>
                        )}
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Highest level
                        <select
                          value={membership.highestLevelId || ""}
                          disabled={isSaving}
                          onChange={(event) =>
                            runMembershipAction({
                              ministryId: membership.ministryId,
                              userId: member.id,
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
                              `Remove ${member.firstName} ${member.lastName} from ${membership.ministryName}?`
                            ) &&
                            runMembershipAction({
                              ministryId: membership.ministryId,
                              userId: member.id,
                              action: "remove",
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                        >
                          <UserMinusIcon className="size-4" />
                          Remove
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {availableMinistries.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={addMinistryByMember[member.id] || ""}
                    onChange={(event) =>
                      setAddMinistryByMember((current) => ({
                        ...current,
                        [member.id]: event.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                  >
                    <option value="">Add to another ministry...</option>
                    {availableMinistries.map((ministry) => (
                      <option key={ministry.id} value={ministry.id}>
                        {ministry.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={isSaving || !addMinistryByMember[member.id]}
                    onClick={() =>
                      runMembershipAction({
                        ministryId: addMinistryByMember[member.id],
                        userId: member.id,
                        action: "add_existing_member",
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34] disabled:opacity-50"
                  >
                    <PlusIcon className="size-4" />
                    Add membership
                  </button>
                </div>
              )}
            </article>
          )
        })}
        {!filteredMembers.length && (
          <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-500">
            No members match this search.
          </p>
        )}
      </div>
    </div>
  )
}

export default MinistryGlobalMembers
