import * as React from "react"
import { Link } from "../compat/gatsby"
import Layout from "../components/Layout"
import Seo from "../components/Seo"
import { MINISTRY_SESSION_KEY } from "../components/ministry/MinistryLogin"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"

const VolunteerAccountApp = () => {
  const [token, setToken] = React.useState("")
  const [invitation, setInvitation] = React.useState(null)
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [status, setStatus] = React.useState("loading")
  const [message, setMessage] = React.useState("")

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const invitationToken = params.get("token") || ""
    setToken(invitationToken)
    window.history.replaceState(null, "", "/volunteer-account")
    if (!invitationToken) {
      setStatus("error")
      setMessage("This account invitation is incomplete.")
      return
    }
    fetch(getFunctionEndpoint("volunteer-account-invitation"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "inspect", token: invitationToken }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || "Unable to open account invitation")
        return result.invitation
      })
      .then((value) => {
        setInvitation(value)
        if (value.status !== "pending" || value.expired) {
          setStatus("error")
          setMessage(value.expired ? "This account invitation has expired." : "This account invitation has already been used.")
        } else {
          setStatus("ready")
        }
      })
      .catch((error) => {
        setStatus("error")
        setMessage(error.message)
      })
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setMessage("Passwords do not match")
      return
    }
    setStatus("submitting")
    setMessage("")
    try {
      const response = await fetch(getFunctionEndpoint("volunteer-account-invitation"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", token, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to activate account")
      window.sessionStorage.setItem(MINISTRY_SESSION_KEY, result.token)
      setStatus("success")
      setMessage(result.message)
    } catch (error) {
      setStatus("ready")
      setMessage(error.message)
    }
  }

  return (
    <Layout robots="noindex,nofollow">
      <Seo title="Activate Volunteer Account | My Latin Mass" description="Add a password to activate your volunteer profile." />
      <main className="mx-auto my-10 w-11/12 max-w-xl">
        <section className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm sm:p-10">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#896542]">Volunteer profile</p>
          <h1 className="mt-2 text-center century-font text-3xl text-[#6f4f34]">Create your password</h1>
          {status === "loading" && <p className="mt-8 text-center text-gray-500">Opening your invitation...</p>}
          {status === "error" && <p role="alert" className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-amber-800">{message}</p>}
          {status === "success" && (
            <div className="mt-8 text-center">
              <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">{message}</p>
              <p className="mt-4 text-sm text-gray-600">You can now manage your reminders and volunteer assignments. No ministry membership was added.</p>
              <Link to="/" className="mt-6 inline-block rounded-xl bg-[#896542] px-6 py-3 font-semibold text-white">Open my profile</Link>
            </div>
          )}
          {(status === "ready" || status === "submitting") && invitation && (
            <form onSubmit={submit} className="mt-8 space-y-5">
              <div className="rounded-xl border border-[#e6ddd4] bg-[#faf8f5] p-4 text-sm">
                <p><strong>{invitation.firstName} {invitation.lastName}</strong></p>
                <p className="mt-3 text-gray-600">{invitation.responsibilityName} · {invitation.eventTitle}</p>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">We already collected your profile information when you volunteered. Add a password to finish setting up your account.</p>
              <label className="block text-sm font-semibold text-gray-700">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              <label className="block text-sm font-semibold text-gray-700">Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              {message && <p role="alert" className="text-center text-sm text-red-700">{message}</p>}
              <button type="submit" disabled={status === "submitting"} className="w-full rounded-xl bg-[#896542] px-6 py-3 font-semibold text-white disabled:opacity-60">{status === "submitting" ? "Creating account..." : "Create my password"}</button>
            </form>
          )}
        </section>
      </main>
    </Layout>
  )
}

export default VolunteerAccountApp
