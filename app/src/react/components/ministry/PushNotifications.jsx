import * as React from "react"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const subscriptionStorageKey = "ministry_push_subscription_id"

const decodeApplicationServerKey = (value) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
  (window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1)

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true

const PushNotifications = () => {
  const [status, setStatus] = React.useState("checking")
  const [message, setMessage] = React.useState("")

  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported")
      return
    }

    navigator.serviceWorker
      .getRegistration("/")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "enabled" : "disabled"))
      .catch(() => setStatus("disabled"))
  }, [])

  const saveSubscription = async (subscription) => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("push/subscriptions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription.toJSON()),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message || "Unable to enable notifications")
    }
    window.localStorage.setItem(subscriptionStorageKey, result.subscription.id)
  }

  const enable = async () => {
    setMessage("")
    if (isIos() && !isStandalone()) {
      setMessage(
        "On iPhone or iPad, first add this Ministry app to your Home Screen, open it there, and then enable notifications.",
      )
      return
    }

    setStatus("working")
    try {
      const permission = await window.Notification.requestPermission()
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.")
      }

      const registration = await navigator.serviceWorker.register(
        "/service-worker.js",
        { scope: "/" },
      )
      await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        const keyResponse = await fetch(
          getFunctionEndpoint("push/vapid-public-key"),
          { cache: "no-store" },
        )
        const keyResult = await keyResponse.json()
        if (!keyResponse.ok) {
          throw new Error(keyResult.message || "Notifications are not configured")
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(keyResult.publicKey),
        })
      }

      await saveSubscription(subscription)
      setStatus("enabled")
      setMessage("Notifications are enabled on this device.")
    } catch (error) {
      setStatus("disabled")
      setMessage(error.message)
    }
  }

  const disable = async () => {
    setStatus("working")
    setMessage("")
    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/")
      const subscription = await registration?.pushManager.getSubscription()
      const subscriptionId = window.localStorage.getItem(subscriptionStorageKey)
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)

      if (subscriptionId) {
        const response = await fetch(
          `${getFunctionEndpoint("push/subscriptions")}?id=${encodeURIComponent(
            subscriptionId,
          )}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        if (!response.ok && response.status !== 404) {
          const result = await response.json()
          throw new Error(result.message || "Unable to disable notifications")
        }
      }

      await subscription?.unsubscribe()
      window.localStorage.removeItem(subscriptionStorageKey)
      setStatus("disabled")
      setMessage("Notifications are disabled on this device.")
    } catch (error) {
      setStatus("enabled")
      setMessage(error.message)
    }
  }

  const sendTest = async () => {
    setStatus("testing")
    setMessage("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("push/test"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to send test notification")
      }
      setMessage("Test notification sent. Check this device.")
    } catch (error) {
      setMessage(error.message)
    } finally {
      setStatus("enabled")
    }
  }

  if (status === "checking") {
    return <p className="mt-4 text-sm text-gray-500">Checking this device...</p>
  }

  if (status === "unsupported") {
    return (
      <p className="mt-4 text-sm text-gray-500">
        Push notifications are not supported by this browser.
      </p>
    )
  }

  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <p className="text-sm font-semibold text-gray-700">
        Notifications on this device
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={status === "enabled" ? disable : enable}
          disabled={["working", "testing"].includes(status)}
          className={`inline-flex min-w-44 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
            status === "enabled" || status === "testing"
              ? "border border-[#d8c7b8] bg-white text-[#6f4f34] hover:bg-[#f7f3ef]"
              : "bg-[#896542] text-white hover:bg-[#6f4f34]"
          }`}
        >
          {status === "working"
            ? "UPDATING..."
            : status === "enabled" || status === "testing"
              ? "Disable notifications"
              : "Enable notifications"}
        </button>
        {(status === "enabled" || status === "testing") && (
          <button
            type="button"
            onClick={sendTest}
            disabled={status === "testing"}
            className="inline-flex min-w-44 items-center justify-center rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6f4f34] disabled:cursor-wait disabled:opacity-60"
          >
            {status === "testing" ? "SENDING..." : "Send test notification"}
          </button>
        )}
      </div>
      {message && (
        <p role="status" aria-live="polite" className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
          {message}
        </p>
      )}
    </div>
  )
}

export default PushNotifications
