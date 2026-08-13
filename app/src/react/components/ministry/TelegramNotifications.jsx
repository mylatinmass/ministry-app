import * as React from "react"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const request = async (path, options = {}) => {
  const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
  const response = await fetch(getFunctionEndpoint(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.message), { result })
  return result
}

const TelegramNotifications = ({ globalRole, onConnectionChange }) => {
  const [data, setData] = React.useState(null)
  const [setup, setSetup] = React.useState(null)
  const [status, setStatus] = React.useState("loading")
  const [message, setMessage] = React.useState("")
  const [awaitingConnection, setAwaitingConnection] = React.useState(false)
  const isGlobalAdmin = ["owner", "super_admin"].includes(globalRole)

  const load = React.useCallback(async () => {
    try {
      const [connection, integration] = await Promise.all([
        request("telegram/connection"),
        isGlobalAdmin
          ? request("telegram/setup").catch((error) => ({ error: error.message }))
          : Promise.resolve(null),
      ])
      setData(connection)
      setSetup(integration)
      setStatus("ready")
      const isConnected = connection.connection?.status === "active"
      onConnectionChange?.(isConnected)
      if (isConnected) setAwaitingConnection(false)
    } catch (error) {
      setStatus("error")
      setMessage(error.message)
    }
  }, [isGlobalAdmin, onConnectionChange])

  React.useEffect(() => {
    load()
    const refresh = () => load()
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [load])

  React.useEffect(() => {
    if (!awaitingConnection) return undefined
    const refreshTimer = window.setInterval(load, 2500)
    const stopTimer = window.setTimeout(() => setAwaitingConnection(false), 60000)
    return () => {
      window.clearInterval(refreshTimer)
      window.clearTimeout(stopTimer)
    }
  }, [awaitingConnection, load])

  const connect = async () => {
    setStatus("working")
    setMessage("")
    try {
      const result = await request("telegram/connection", {
        method: "POST",
        body: JSON.stringify({ action: "create_link" }),
      })
      setAwaitingConnection(true)
      window.open(result.url, "_blank", "noopener,noreferrer")
      setMessage("Press Start in Telegram, then return to this page.")
    } catch (error) {
      setMessage(error.message)
    } finally {
      setStatus("ready")
    }
  }

  const disconnect = async () => {
    setStatus("working")
    setMessage("")
    try {
      await request("telegram/connection", {
        method: "POST",
        body: JSON.stringify({ action: "disconnect" }),
      })
      await load()
      setMessage("Telegram disconnected.")
    } catch (error) {
      setMessage(error.message)
      setStatus("ready")
    }
  }

  const sendTest = async () => {
    setStatus("working")
    setMessage("")
    try {
      const result = await request("telegram/connection", {
        method: "POST",
        body: JSON.stringify({ action: "test" }),
      })
      await load()
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message)
      await load()
    } finally {
      setStatus("ready")
    }
  }

  const configureWebhook = async () => {
    const replacing = Boolean(setup?.webhook?.url && !setup?.webhook?.active)
    if (
      replacing &&
      !window.confirm(
        "This bot already has another webhook. Replacing it may stop that integration. Continue only if the existing integration is no longer used.",
      )
    ) {
      return
    }
    setStatus("working")
    setMessage("")
    try {
      await request("telegram/setup", {
        method: "POST",
        body: JSON.stringify({ replaceExisting: replacing }),
      })
      await load()
      setMessage("Telegram webhook activated.")
    } catch (error) {
      setMessage(error.message)
      setStatus("ready")
    }
  }

  if (status === "loading") {
    return <p className="mt-4 text-sm text-gray-500">Checking Telegram...</p>
  }
  if (!data?.configured) {
    return <p className="mt-4 text-sm text-gray-500">Telegram is not configured.</p>
  }

  const connected = data.connection?.status === "active"

  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <p className="text-sm font-semibold text-gray-700">Telegram</p>
      <p className="mt-1 text-sm text-gray-500">
        {connected
          ? `Connected${data.connection.username ? ` to @${data.connection.username}` : ""}.`
          : `Connect your account to @${data.botUsername}.`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={connected ? disconnect : connect}
          disabled={status === "working" || awaitingConnection}
          className={`inline-flex min-w-44 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
            connected
              ? "border border-[#d8c7b8] bg-white text-[#6f4f34] hover:bg-[#f7f3ef]"
              : "bg-[#896542] text-white hover:bg-[#6f4f34]"
          }`}
        >
          {status === "working"
            ? "UPDATING..."
            : awaitingConnection
              ? "Waiting for Telegram..."
              : connected
                ? "Disconnect Telegram"
                : "Connect Telegram"}
        </button>
        {connected && (
          <button
            type="button"
            onClick={sendTest}
            disabled={status === "working"}
            className="inline-flex min-w-44 items-center justify-center rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6f4f34] disabled:cursor-wait disabled:opacity-60"
          >
            Send test DM
          </button>
        )}
      </div>

      {isGlobalAdmin && setup && !setup.error && (
        <div className="mt-4 rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
            Telegram integration
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {setup.webhook.active
              ? "Webhook active"
              : setup.webhook.url
                ? "This bot is connected to another webhook"
                : "Webhook not active"}
          </p>
          {!setup.webhook.active && (
            <button
              type="button"
              onClick={configureWebhook}
              disabled={status === "working"}
              className="mt-3 rounded-lg border border-[#d8c7b8] px-3 py-2 text-xs font-semibold text-[#6f4f34] disabled:opacity-60"
            >
              {setup.webhook.url ? "Review and replace webhook" : "Activate webhook"}
            </button>
          )}
          {setup.webhook.lastErrorMessage && (
            <p className="mt-2 text-xs text-red-600">
              {setup.webhook.lastErrorMessage}
            </p>
          )}
        </div>
      )}
      {setup?.error && (
        <p className="mt-3 text-xs text-red-600">{setup.error}</p>
      )}
      {message && (
        <p role="status" aria-live="polite" className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
          {message}
        </p>
      )}
    </div>
  )
}

export default TelegramNotifications
