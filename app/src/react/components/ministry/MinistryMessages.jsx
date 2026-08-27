import * as React from "react"
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import MinistrySectionActions from "./MinistrySectionActions"

const messageDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const deliveryLabel = (message) => {
  const parts = [`${message.recipientCount} recipient${message.recipientCount === 1 ? "" : "s"}`]
  if (message.sentCount) parts.push(`${message.sentCount} delivered`)
  if (message.pendingCount) parts.push(`${message.pendingCount} pending`)
  if (message.skippedCount) parts.push(`${message.skippedCount} not enabled`)
  if (message.failedCount) parts.push(`${message.failedCount} failed`)
  return parts.join(" · ")
}

const messageTypeLabel = (value) => value === "alert" ? "Alert" : "Email"

const MinistryMessages = ({ onUnreadCountChange, initialMinistryId = "" }) => {
  const [data, setData] = React.useState({
    unreadCount: 0,
    canCompose: false,
    canMessageAll: false,
    manageableMinistries: [],
    manageableMembers: [],
    received: [],
    sent: [],
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [showComposer, setShowComposer] = React.useState(false)
  const [receivedFilter, setReceivedFilter] = React.useState("all")
  const [expandedReceivedId, setExpandedReceivedId] = React.useState("")
  const [expandedSentId, setExpandedSentId] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [memberSearch, setMemberSearch] = React.useState("")
  const [form, setForm] = React.useState({
    audience: "ministries",
    ministryId: initialMinistryId,
    ministryIds: initialMinistryId ? [initialMinistryId] : [],
    memberIds: [],
    groupIds: [],
    messageType: "email",
    subject: "",
    body: "",
  })

  const loadMessages = React.useCallback(async () => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("messages"), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "Unable to load messages")
    setData(result)
    onUnreadCountChange?.(result.unreadCount)
    setForm((current) => ({
      ...current,
      audience:
        current.audience === "all_members" && !result.canMessageAll
          ? "all_authorized"
          : current.audience,
      ministryId: (() => {
        const selected =
        current.ministryId && result.manageableMinistries.some(
          (ministry) => ministry.id === current.ministryId,
        )
          ? current.ministryId
          : result.manageableMinistries[0]?.id || ""
        return selected
      })(),
      ministryIds: current.ministryIds?.filter((id) =>
        result.manageableMinistries.some((ministry) => ministry.id === id),
      ).length
        ? current.ministryIds.filter((id) =>
            result.manageableMinistries.some((ministry) => ministry.id === id),
          )
        : result.manageableMinistries[0]?.id
          ? [result.manageableMinistries[0].id]
          : [],
      memberIds: current.memberIds?.filter((id) =>
        result.manageableMembers?.some((member) => member.id === id),
      ) || [],
    }))
  }, [onUnreadCountChange])

  React.useEffect(() => {
    setLoading(true)
    loadMessages()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [loadMessages])

  const patchRead = async (payload) => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("messages"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "Unable to update messages")
    setData(result)
    onUnreadCountChange?.(result.unreadCount)
  }

  const markRead = (message) => {
    if (message.read) return
    patchRead({ action: "mark_read", messageId: message.id }).catch((readError) =>
      setError(readError.message),
    )
  }

  const receivedMessages = React.useMemo(
    () => [...data.received]
      .sort((a, b) =>
        Number(a.read) - Number(b.read) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .filter((message) => receivedFilter !== "unread" || !message.read),
    [data.received, receivedFilter],
  )
  const filteredMembers = React.useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    if (!query) return data.manageableMembers || []
    return (data.manageableMembers || []).filter((member) =>
      `${member.firstName} ${member.lastName} ${(member.ministryNames || []).join(" ")}`
        .toLowerCase()
        .includes(query),
    )
  }, [data.manageableMembers, memberSearch])

  const toggleReceivedMessage = (message) => {
    const isOpening = expandedReceivedId !== message.id
    setExpandedReceivedId(isOpening ? message.id : "")
    if (isOpening) markRead(message)
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    setSending(true)
    setError("")
    setNotice("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("messages"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to send message")
      const summary = result.deliverySummary || {}
      const deliveryParts = [
        `${Number(summary.acceptedCount || 0)} accepted`,
        `${Number(summary.skippedCount || 0)} unavailable`,
      ]
      if (summary.pendingCount) deliveryParts.push(`${summary.pendingCount} pending`)
      if (summary.failedCount) deliveryParts.push(`${summary.failedCount} failed`)
      setNotice(result.processedDeliveryCount > 0
        ? `${messageTypeLabel(form.messageType)} processed immediately: ${deliveryParts.join(" · ")} channel deliveries.`
        : `${messageTypeLabel(form.messageType)} queued for ${result.recipientCount} ${result.recipientCount === 1 ? "member" : "members"}.`)
      setForm((current) => ({ ...current, subject: "", body: "" }))
      setShowComposer(false)
      await loadMessages()
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-500">Loading messages…</p>
  }

  return (
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-0">
      <MinistrySectionActions
        label="Message actions"
        actions={[
          { id: "all", label: "All Messages", icon: ChatBubbleLeftRightIcon, active: receivedFilter === "all", onClick: () => setReceivedFilter("all") },
          { id: "unread", label: "Unread Messages", icon: EnvelopeIcon, active: receivedFilter === "unread", onClick: () => setReceivedFilter("unread") },
          { id: "mark-read", label: "Mark all Read", icon: CheckCircleIcon, disabled: data.unreadCount === 0, onClick: () => patchRead({ action: "mark_all_read" }).catch((readError) => setError(readError.message)) },
          { id: "new-message", label: "New Message", icon: PaperAirplaneIcon, active: showComposer, hidden: !data.canCompose, onClick: () => setShowComposer((open) => !open) },
        ]}
      />

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </p>
      )}

      {showComposer && data.canCompose && (
        <form
          onSubmit={sendMessage}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <h3 className="century-font text-2xl text-gray-950">New Message</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Send to
              <select
                value={form.audience}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  audience: event.target.value,
                  groupIds: [],
                  memberIds: event.target.value === "members" ? current.memberIds : [],
                }))}
                required
                className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal"
              >
                <option value="all_authorized">
                  {data.canMessageAll ? "All members" : "All members in my ministries"}
                </option>
                <option value="ministries">One or more ministries</option>
                <option value="members">Selected members</option>
                <option value="groups">Selected ministry groups</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Type
              <select
                value={form.messageType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    messageType: event.target.value,
                    subject: event.target.value === "alert" ? "" : current.subject,
                  }))
                }
                className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal"
              >
                <option value="email">Email</option>
                <option value="alert">Alert</option>
              </select>
            </label>
          </div>

          {form.audience === "ministries" && (
            <fieldset className="rounded-xl border border-gray-200 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-700">Ministries</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.manageableMinistries.map((ministry) => (
                  <label key={ministry.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.ministryIds.includes(ministry.id)}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        ministryIds: event.target.checked
                          ? [...current.ministryIds, ministry.id]
                          : current.ministryIds.filter((id) => id !== ministry.id),
                      }))}
                    />
                    {ministry.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {form.audience === "members" && (
            <fieldset className="rounded-xl border border-gray-200 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-700">Members</legend>
              <input
                type="search"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search members or ministries"
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
              />
              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
                {filteredMembers.map((member) => (
                  <label key={member.id} className="flex items-start gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={form.memberIds.includes(member.id)}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        memberIds: event.target.checked
                          ? [...current.memberIds, member.id]
                          : current.memberIds.filter((id) => id !== member.id),
                      }))}
                    />
                    <span>
                      <span className="block font-semibold">{member.firstName} {member.lastName}</span>
                      <span className="block text-xs text-gray-500">{(member.ministryNames || []).join(", ")}</span>
                    </span>
                  </label>
                ))}
                {!filteredMembers.length && <p className="px-2 py-3 text-sm text-gray-500">No matching members.</p>}
              </div>
            </fieldset>
          )}

          {form.audience === "groups" && (() => {
            const ministry = data.manageableMinistries.find((item) => item.id === form.ministryId)
            return (
              <fieldset className="rounded-xl border border-gray-200 p-4">
                <legend className="px-1 text-sm font-semibold text-gray-700">Ministry groups</legend>
                <select
                  value={form.ministryId}
                  onChange={(event) => setForm((current) => ({ ...current, ministryId: event.target.value, ministryIds: [event.target.value], groupIds: [] }))}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                >
                  {data.manageableMinistries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <div className="mt-3 flex flex-wrap gap-4">
                    {(ministry?.groups || []).map((group) => (
                      <label key={group.id} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input type="checkbox" checked={form.groupIds.includes(group.id)} onChange={(event) => setForm((current) => ({ ...current, groupIds: event.target.checked ? [...current.groupIds, group.id] : current.groupIds.filter((id) => id !== group.id) }))} />
                        {group.name}
                      </label>
                    ))}
                    {!ministry?.groups?.length && <p className="text-sm text-gray-500">This ministry has no groups.</p>}
                </div>
              </fieldset>
            )
          })()}

          {form.messageType === "email" && (
            <label className="block text-sm font-semibold text-gray-700">
              Subject
              <input
                type="text"
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                maxLength={250}
                required
                className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal"
              />
            </label>
          )}

          <label className="block text-sm font-semibold text-gray-700">
            Message
            <textarea
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              required
              rows={form.messageType === "alert" ? 4 : 8}
              aria-invalid={form.messageType === "alert" && form.body.length > 200}
              aria-describedby={form.messageType === "alert" ? "alert-character-limit" : undefined}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 font-normal"
            />
          </label>
          {form.messageType === "alert" ? (
            <div id="alert-character-limit" className="flex items-center justify-between gap-3 text-xs text-gray-500">
              <span>Alerts use enabled Telegram, push, and SMS notifications—never email—and are limited to 200 characters.</span>
              <span
                aria-live="polite"
                className={form.body.length > 200 ? "font-semibold text-red-600" : ""}
              >
                {form.body.length}/200
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Email requires a subject and allows a full-length message.</p>
          )}
          <button
            type="submit"
            disabled={
              sending ||
              (form.audience === "ministries" && !form.ministryIds.length) ||
              (form.audience === "members" && !form.memberIds.length) ||
              (form.audience === "groups" && (!form.ministryId || !form.groupIds.length)) ||
              (form.messageType === "alert" && form.body.length > 200)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PaperAirplaneIcon className="size-5" />
            {sending ? "Sending…" : form.messageType === "alert" ? "Send Alert" : "Send Email"}
          </button>
        </form>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="century-font text-2xl text-gray-950">
            {data.canCompose ? "Inbox" : "Your Messages"}
          </h3>
        </div>
        {receivedMessages.length ? (
          <div className="space-y-2">
            {receivedMessages.map((message) => {
              const isExpanded = expandedReceivedId === message.id
              const panelId = `received-message-${message.id}`
              return (
                <article
                  key={message.id}
                  className={`overflow-hidden rounded-xl border ${
                    message.read
                      ? "border-gray-200 bg-white"
                      : "border-orange-500 bg-orange-50/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleReceivedMessage(message)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4"
                  >
                    {!message.read && <span className="size-2 shrink-0 rounded-full bg-orange-500" aria-label="Unread" />}
                    {message.channel === "email" ? (
                      <EnvelopeIcon className="size-4 shrink-0 text-[#896542]" />
                    ) : (
                      <ChatBubbleLeftRightIcon className="size-4 shrink-0 text-[#896542]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm text-gray-900 ${message.read ? "font-medium" : "font-bold"}`}>
                        {message.subject || "Ministry alert"}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {message.senderName} · {message.audience === "event_participants"
                          ? message.eventTitle || "Event participants"
                          : message.ministryName || "All members"}
                      </p>
                    </div>
                    <time className="hidden shrink-0 text-xs text-gray-400 sm:block">
                      {messageDate(message.createdAt)}
                    </time>
                    <ChevronDownIcon className={`size-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {isExpanded && (
                    <div id={panelId} className={`border-t px-4 py-3 ${message.read ? "border-gray-100" : "border-orange-200"}`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                        {message.body}
                      </p>
                      <p className="mt-3 text-xs text-gray-400 sm:hidden">
                        {messageDate(message.createdAt)}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        {messageTypeLabel(message.channel)}
                        {message.audience === "event_participants" && message.eventTitle
                          ? ` · ${message.eventTitle}`
                          : ""}
                      </p>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
            <p className="font-semibold text-gray-700">
              {receivedFilter === "unread" ? "No unread messages" : "No messages"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {receivedFilter === "unread"
                ? "You are all caught up."
                : "Announcements sent to this profile will appear here."}
            </p>
          </div>
        )}
      </section>

      {data.canCompose && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 century-font text-2xl text-gray-950">Sent Messages</h3>
          {data.sent.length ? (
            <div className="space-y-2">
              {data.sent.map((message) => {
                const isExpanded = expandedSentId === message.id
                const panelId = `sent-message-${message.id}`
                return (
                  <article key={message.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setExpandedSentId(isExpanded ? "" : message.id)}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4"
                    >
                      {message.channel === "email" ? (
                        <EnvelopeIcon className="size-4 shrink-0 text-[#896542]" />
                      ) : (
                        <ChatBubbleLeftRightIcon className="size-4 shrink-0 text-[#896542]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {message.subject || "Ministry alert"}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {message.targetLabel || message.ministryName || "All members"} · {deliveryLabel(message)}
                        </p>
                      </div>
                      <time className="hidden shrink-0 text-xs text-gray-400 sm:block">{messageDate(message.createdAt)}</time>
                      <ChevronDownIcon className={`size-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div id={panelId} className="border-t border-gray-100 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                          {message.body}
                        </p>
                        <p className="mt-3 text-xs text-gray-400">
                          {messageTypeLabel(message.channel)} · {messageDate(message.createdAt)}
                        </p>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              No messages have been sent yet.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

export default MinistryMessages
