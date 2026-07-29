import * as React from "react"
import {
  CheckCircleIcon,
  EnvelopeIcon,
  UserMinusIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const roleLabels = {
  owner: "Owner",
  admin: "Leader",
  member: "Member",
}

const MinistryMembers = ({ data, activeAction }) => {
  const [memberData, setMemberData] = React.useState(null)
  const [email, setEmail] = React.useState("")
  const [selectedMinistryIds, setSelectedMinistryIds] = React.useState([
    data.ministry.id,
  ])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
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

  const updateMembership = async ({ userId, action, level, requestId }) => {
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
          userId,
          action,
          level,
          requestId,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to update member")
      setMessage(result.message)
      if (action === "leave") {
        if (data.user.globalRole === "regular") {
          window.sessionStorage.removeItem(MINISTRY_SESSION_KEY)
        }
        window.location.assign("/ministry")
        return
      }
      await loadMembers()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  if (isLoading) {
    return <p className="p-6 text-center text-gray-500">Loading members...</p>
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
        <button
          type="button"
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

      {activeAction.id === "roles" && (
        <section>
          <div className="mb-4">
            <h3 className="century-font text-2xl text-gray-900">Member roles</h3>
            <p className="mt-1 text-sm text-gray-500">Leaders can manage this ministry. New invitations always begin as Member.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {memberData.members.map((member) => (
              <div key={member.id} className="flex flex-col gap-3 border-b border-gray-100 p-4 last:border-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{member.firstName} {member.lastName}</p>
                  <p className="truncate text-sm text-gray-500">{member.email} · {member.username || "Account pending"}</p>
                </div>
                {member.level === "owner" ? (
                  <span className="rounded-full bg-[#f4ede6] px-3 py-1 text-sm font-semibold text-[#896542]">Owner</span>
                ) : (
                  <select
                    aria-label={`Role for ${member.firstName} ${member.lastName}`}
                    value={member.level}
                    onChange={(event) =>
                      updateMembership({
                        userId: member.userId,
                        action: "set_role",
                        level: event.target.value,
                      })
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Leader</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeAction.id === "roster" && (
        <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div>
            <h3 className="mb-4 century-font text-2xl text-gray-900">Active roster</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {memberData.members.map((member) => (
                <article key={member.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{member.firstName} {member.lastName}</h4>
                      <p className="mt-1 text-sm text-gray-500">{member.email}</p>
                    </div>
                    <span className="rounded-full bg-[#f4ede6] px-2 py-1 text-xs font-semibold text-[#896542]">{roleLabels[member.level]}</span>
                  </div>
                  {member.level !== "owner" && member.userId !== data.user.id && (
                    <button
                      type="button"
                      onClick={() => updateMembership({ userId: member.userId, action: "remove" })}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:underline"
                    >
                      <UserMinusIcon className="size-4" /> Remove
                    </button>
                  )}
                  {member.userId === data.user.id && member.level !== "owner" && (
                    <button
                      type="button"
                      onClick={() => updateMembership({ userId: member.userId, action: "leave" })}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:underline"
                    >
                      <UserMinusIcon className="size-4" /> Leave ministry
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
          <aside>
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
            <h3 className="mb-4 century-font text-xl text-gray-900">Pending invitations</h3>
            <div className="space-y-3">
              {memberData.invitations.length ? memberData.invitations.map((invitation) => (
                <article key={invitation.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                  <p className="font-semibold text-gray-900">{invitation.email}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{invitation.ministryNames.join(", ")}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-700"><CheckCircleIcon className="size-4" /> Awaiting response</p>
                </article>
              )) : (
                <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">No pending invitations.</p>
              )}
            </div>
          </aside>
        </section>
      )}
    </div>
  )
}

export default MinistryMembers
