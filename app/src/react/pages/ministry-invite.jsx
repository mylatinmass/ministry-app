import * as React from "react"
import { Link } from "gatsby"
import { Helmet } from "react-helmet"
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import Layout from "../components/Layout"
import Seo from "../components/Seo"
import { MINISTRY_SESSION_KEY } from "../components/ministry/MinistryLogin"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"

const MinistryInvitePage = ({ location }) => {
  const params = React.useMemo(
    () =>
      new URLSearchParams(
        (location?.hash || "").replace(/^#/, "") || location?.search || ""
      ),
    [location?.hash, location?.search]
  )
  const token = params.get("token") || ""
  const initialIntent = params.get("intent") === "decline" ? "decline" : "accept"
  const [invitation, setInvitation] = React.useState(null)
  const [intent, setIntent] = React.useState(initialIntent)
  const [status, setStatus] = React.useState("loading")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({
    username: "",
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
  })
  const [usernameState, setUsernameState] = React.useState({
    checking: false,
    available: null,
    message: "",
  })

  React.useEffect(() => {
    if (typeof window !== "undefined" && (window.location.hash || window.location.search)) {
      window.history.replaceState(null, "", "/ministry/invite")
    }
    if (!token) {
      setStatus("error")
      setMessage("This invitation link is incomplete.")
      return
    }
    fetch(getFunctionEndpoint("ministry-invitation-response"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "inspect", token }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || "Unable to load invitation")
        return result
      })
      .then((result) => {
        setInvitation(result.invitation)
        if (result.invitation.status !== "pending") {
          setStatus(result.invitation.status)
          setMessage(`This invitation was already ${result.invitation.status}.`)
        } else if (result.invitation.expired) {
          setStatus("expired")
          setMessage("This invitation has expired.")
        } else {
          setStatus("ready")
        }
      })
      .catch((error) => {
        setStatus("error")
        setMessage(error.message)
      })
  }, [token])

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (name === "username") {
      setUsernameState({ checking: false, available: null, message: "" })
    }
  }

  const checkUsername = async () => {
    if (!form.username) return
    setUsernameState({ checking: true, available: null, message: "Checking..." })
    try {
      const response = await fetch(
        getFunctionEndpoint("ministry-invitation-response"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            action: "check_username",
            username: form.username,
          }),
        }
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to check username")
      setUsernameState({
        checking: false,
        available: result.available,
        message: result.message,
      })
    } catch (error) {
      setUsernameState({ checking: false, available: false, message: error.message })
    }
  }

  const answerInvitation = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("ministry-invitation-response"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action: intent, ...form }),
        }
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to answer invitation")
      if (result.token) {
        window.sessionStorage.setItem(MINISTRY_SESSION_KEY, result.token)
      }
      setStatus(result.status)
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const terminal = ["accepted", "declined", "expired", "revoked"].includes(status)

  return (
    <Layout robots="noindex,nofollow">
      <Helmet>
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <Seo
        title="Ministry Invitation | MyLatinMass.com"
        description="Respond to a private ministry invitation."
      />
      <section className="mx-auto my-10 w-11/12 max-w-2xl">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-9">
          <header className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C1A387]">Our Lady of Victory Chapel</p>
            <h1 className="mt-2 century-font text-3xl text-[#6f4f34]">Ministry invitation</h1>
          </header>

          {status === "loading" && <p className="mt-8 text-center text-gray-500">Opening your invitation...</p>}

          {(status === "error" || terminal) && (
            <div className="mt-8 text-center">
              {status === "accepted" ? (
                <CheckCircleIcon className="mx-auto size-14 text-green-600" />
              ) : status === "declined" ? (
                <XCircleIcon className="mx-auto size-14 text-gray-500" />
              ) : (
                <ExclamationTriangleIcon className="mx-auto size-14 text-amber-600" />
              )}
              <p className="mt-4 text-lg font-semibold text-gray-900">{message}</p>
              {status === "accepted" && (
                <Link to="/ministry" className="mt-6 inline-block rounded-xl bg-[#896542] px-6 py-3 font-semibold text-white">Open my ministries</Link>
              )}
            </div>
          )}

          {status === "ready" && invitation && (
            <form onSubmit={answerInvitation} className="mt-8">
              <p className="text-center text-gray-600">You were invited to join:</p>
              <div className="mx-auto mt-4 max-w-md space-y-2">
                {invitation.ministries.map((ministry) => (
                  <div key={ministry.id} className="rounded-xl border border-[#e6ddd4] bg-[#faf8f5] px-4 py-3 text-center font-semibold text-[#6f4f34]">{ministry.name}</div>
                ))}
              </div>

              {intent === "decline" ? (
                <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                  <h2 className="font-semibold text-gray-900">Decline this invitation?</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">This will decline every ministry listed above. This decision cannot be changed with this email.</p>
                  <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                    <button type="button" onClick={() => setIntent("accept")} className="rounded-lg border border-gray-300 bg-white px-5 py-2 font-semibold text-gray-700">Go back</button>
                    <button type="submit" disabled={isSubmitting} className="rounded-lg bg-gray-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{isSubmitting ? "Declining..." : "Confirm decline"}</button>
                  </div>
                </div>
              ) : invitation.accountRequired ? (
                <div className="mt-8">
                  <div className="rounded-xl border border-[#e6ddd4] bg-[#faf8f5] p-4">
                    <p className="text-sm font-semibold text-gray-700">Verified email</p>
                    <p className="mt-1 text-gray-900">{invitation.email}</p>
                  </div>
                  <h2 className="mt-6 century-font text-2xl text-gray-900">Create your account</h2>
                  <p className="mt-1 text-sm text-gray-500">Every field is required. Your username must be unique and at least 4 characters.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-gray-700">First name<input name="firstName" value={form.firstName} onChange={updateField} required autoComplete="given-name" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
                    <label className="text-sm font-semibold text-gray-700">Last name<input name="lastName" value={form.lastName} onChange={updateField} required autoComplete="family-name" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
                    <label className="text-sm font-semibold text-gray-700">Phone<input name="phone" type="tel" value={form.phone} onChange={updateField} required autoComplete="tel" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
                    <label className="text-sm font-semibold text-gray-700">Username<input name="username" value={form.username} onChange={updateField} onBlur={checkUsername} minLength={4} required autoComplete="username" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /><span className={`mt-1 block min-h-5 text-xs ${usernameState.available === true ? "text-green-700" : usernameState.available === false ? "text-red-600" : "text-gray-500"}`}>{usernameState.message}</span></label>
                    <label className="text-sm font-semibold text-gray-700 sm:col-span-2">Password<input name="password" type="password" value={form.password} onChange={updateField} minLength={8} required autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /><span className="mt-1 block text-xs font-normal text-gray-500">At least 8 characters</span></label>
                  </div>
                  <button type="submit" disabled={isSubmitting || usernameState.available === false || usernameState.checking} className="mt-6 w-full rounded-xl bg-[#896542] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Creating account..." : "Create account and accept"}</button>
                  <button type="button" onClick={() => setIntent("decline")} className="mt-3 w-full py-2 text-sm font-semibold text-gray-500 hover:text-gray-800">Decline instead</button>
                </div>
              ) : (
                <div className="mt-8 text-center">
                  <p className="text-sm leading-relaxed text-gray-600">Accepting will add these ministries to your existing account <strong>{invitation.username}</strong>.</p>
                  <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                    <button type="submit" disabled={isSubmitting} className="rounded-xl bg-[#896542] px-6 py-3 font-semibold text-white disabled:opacity-50">{isSubmitting ? "Accepting..." : "Accept invitation"}</button>
                    <button type="button" onClick={() => setIntent("decline")} className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-600">Decline</button>
                  </div>
                </div>
              )}
              {message && <p role="alert" className="mt-5 text-center text-sm text-red-600">{message}</p>}
              <p className="mt-7 text-center text-xs leading-relaxed text-gray-400">This private invitation can be answered only once and expires {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(invitation.expiresAt))}.</p>
            </form>
          )}
        </div>
      </section>
    </Layout>
  )
}

export default MinistryInvitePage
