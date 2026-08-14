import * as React from "react"
import { Link } from "../compat/gatsby"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"

const GuardianLinkApp = () => {
  const token = React.useMemo(() => {
    if (typeof window === "undefined") return ""
    return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || ""
  }, [])
  const [invitation, setInvitation] = React.useState(null)
  const [status, setStatus] = React.useState("loading")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", "/profile-link")
    if (!token) {
      setStatus("error")
      setMessage("This profile invitation link is incomplete.")
      return
    }
    fetch(getFunctionEndpoint("ministry-guardian-link-response"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "inspect", token }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message)
        return result.invitation
      })
      .then((result) => {
        setInvitation(result)
        if (result.status !== "pending" || result.expired) {
          setStatus("error")
          setMessage(result.expired ? "This invitation has expired." : "This invitation was already answered.")
        } else if (!result.accountAvailable) {
          setStatus("error")
          setMessage("The invited Ministry account is no longer available.")
        } else {
          setStatus("ready")
        }
      })
      .catch((error) => {
        setStatus("error")
        setMessage(error.message || "Unable to open this profile invitation")
      })
  }, [token])

  const respond = async (action) => {
    setIsSubmitting(true)
    setMessage("")
    try {
      const response = await fetch(getFunctionEndpoint("ministry-guardian-link-response"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message)
      setStatus(result.status)
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message || "Unable to answer this invitation")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto my-10 w-11/12 max-w-xl">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-9">
        <h1 className="century-font text-3xl text-[#6f4f34]">Link child profile</h1>
        {status === "loading" && <p className="mt-6 text-gray-500">Opening your invitation...</p>}
        {status === "error" && <p role="alert" className="mt-6 text-red-600">{message}</p>}
        {status === "ready" && invitation && (
          <div className="mt-6">
            <p className="text-gray-600">
              Hello {invitation.guardianFirstName}. {invitation.invitedByName} invited you to link
              {" "}<strong>{invitation.childName}</strong> to your Ministry account.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Accepting lets you view and manage this child's schedule and receive their event notifications.
              The child's ministries, assignments, availability, and history remain on the same profile.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" disabled={isSubmitting} onClick={() => respond("accept")} className="rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white disabled:opacity-50">
                Accept link
              </button>
              <button type="button" disabled={isSubmitting} onClick={() => respond("decline")} className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600 disabled:opacity-50">
                Decline
              </button>
            </div>
            {message && <p role="alert" className="mt-4 text-sm text-red-600">{message}</p>}
          </div>
        )}
        {(status === "accepted" || status === "declined") && (
          <div className="mt-6">
            <p role="status" className="text-green-700">{message}</p>
            <Link to="/" className="mt-5 inline-block rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white">
              Open Ministry App
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

export default GuardianLinkApp
