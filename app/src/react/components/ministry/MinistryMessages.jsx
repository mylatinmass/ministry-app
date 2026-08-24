import * as React from "react"
import {
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

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
    received: [],
    sent: [],
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [showComposer, setShowComposer] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [form, setForm] = React.useState({
    audience: "ministry",
    ministryId: initialMinistryId,
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
          ? "ministry"
          : current.audience,
      ministryId:
        current.ministryId && result.manageableMinistries.some(
          (ministry) => ministry.id === current.ministryId,
        )
          ? current.ministryId
          : result.manageableMinistries[0]?.id || "",
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="century-font text-3xl text-gray-950">Messages</h2>
          <p className="mt-1 text-sm text-gray-500">
            One-way announcements from your ministry leaders.
          </p>
        </div>
        {data.canCompose && (
          <button
            type="button"
            onClick={() => setShowComposer((open) => !open)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6f4f34]"
          >
            {showComposer ? <XMarkIcon className="size-5" /> : <PaperAirplaneIcon className="size-5" />}
            {showComposer ? "Cancel" : "NEW MESSAGE"}
          </button>
        )}
      </div>

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
                value={form.audience === "all_members" ? "all_members" : form.ministryId}
                onChange={(event) =>
                  setForm((current) =>
                    event.target.value === "all_members"
                      ? { ...current, audience: "all_members", ministryId: "", groupIds: [] }
                      : { ...current, audience: "ministry", ministryId: event.target.value, groupIds: [] },
                  )
                }
                required
                className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal"
              >
                {data.canMessageAll && <option value="all_members">All members</option>}
                {data.manageableMinistries.map((ministry) => (
                  <option key={ministry.id} value={ministry.id}>
                    {ministry.name}
                  </option>
                ))}
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

          {form.audience !== "all_members" && (() => {
            const ministry = data.manageableMinistries.find((item) => item.id === form.ministryId)
            if (!ministry?.groups?.length) return null
            return (
              <fieldset className="rounded-xl border border-gray-200 p-4">
                <legend className="px-1 text-sm font-semibold text-gray-700">Audience</legend>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" checked={form.audience === "ministry"} onChange={() => setForm((current) => ({ ...current, audience: "ministry", groupIds: [] }))} />
                  Entire ministry
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" checked={form.audience === "groups"} onChange={() => setForm((current) => ({ ...current, audience: "groups" }))} />
                  Selected groups
                </label>
                {form.audience === "groups" && (
                  <div className="mt-3 flex flex-wrap gap-4 pl-6">
                    {ministry.groups.map((group) => (
                      <label key={group.id} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input type="checkbox" checked={form.groupIds.includes(group.id)} onChange={(event) => setForm((current) => ({ ...current, groupIds: event.target.checked ? [...current.groupIds, group.id] : current.groupIds.filter((id) => id !== group.id) }))} />
                        {group.name}
                      </label>
                    ))}
                  </div>
                )}
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
              (form.audience === "ministry" && !form.ministryId) ||
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="century-font text-2xl text-gray-950">Inbox</h3>
          {data.unreadCount > 0 && (
            <button
              type="button"
              onClick={() => patchRead({ action: "mark_all_read" }).catch((readError) => setError(readError.message))}
              className="text-xs font-semibold text-[#896542]"
            >
              Mark all read
            </button>
          )}
        </div>
        {data.received.length ? (
          <div className="space-y-3">
            {data.received.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => markRead(message)}
                aria-label={`${message.read ? "Read" : "Unread"} ${message.channel}: ${message.subject || "Ministry alert"}, from ${message.senderName}, ${messageDate(message.createdAt)}`}
                className={`w-full rounded-xl border px-4 py-4 text-left ${
                  message.read
                    ? "border-gray-100 bg-gray-50"
                    : "border-orange-200 bg-orange-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!message.read && <span className="size-2 rounded-full bg-orange-400" aria-label="Unread" />}
                    {message.channel === "email" ? (
                      <EnvelopeIcon className="size-5 text-[#896542]" />
                    ) : (
                      <ChatBubbleLeftRightIcon className="size-5 text-[#896542]" />
                    )}
                    <p className="font-semibold text-gray-900">
                      {message.subject || "Ministry alert"}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">{messageDate(message.createdAt)}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                  {message.body}
                </p>
                <p className="mt-3 text-xs text-gray-400">
                  {message.senderName} · {message.ministryName || "All members"} · {messageTypeLabel(message.channel)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
            <p className="font-semibold text-gray-700">No messages</p>
            <p className="mt-1 text-sm text-gray-500">Announcements sent to this profile will appear here.</p>
          </div>
        )}
      </section>

      {data.canCompose && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 century-font text-2xl text-gray-950">Sent Messages</h3>
          {data.sent.length ? (
            <div className="space-y-3">
              {data.sent.map((message) => (
                <article key={message.id} className="rounded-xl border border-gray-100 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900">
                      {message.subject || "Ministry alert"}
                    </p>
                    <p className="text-xs text-gray-400">{messageDate(message.createdAt)}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                    {message.body}
                  </p>
                  <p className="mt-3 text-xs text-gray-400">
                    {messageTypeLabel(message.channel)} · {message.ministryName || "All members"} · {deliveryLabel(message)}
                  </p>
                </article>
              ))}
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
