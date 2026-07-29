import * as React from "react"
import { Link } from "../compat/gatsby"
import { Helmet } from "react-helmet"
import Layout from "../components/Layout"
import Seo from "../components/Seo"
import { MINISTRY_SESSION_KEY } from "../components/ministry/MinistryLogin"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"

const MinistryProfileSeparatePage = ({ location }) => {
  const token = React.useMemo(
    () => new URLSearchParams((location?.hash || "").replace(/^#/, "")).get("token") || "",
    [location?.hash]
  )
  const [separation, setSeparation] = React.useState(null)
  const [status, setStatus] = React.useState("loading")
  const [message, setMessage] = React.useState("")
  const [form, setForm] = React.useState({ username: "", phone: "", password: "" })
  const [usernameMessage, setUsernameMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", "/ministry/profile-separate")
    }
    if (!token) {
      setStatus("error")
      setMessage("This activation link is incomplete.")
      return
    }
    fetch(getFunctionEndpoint("ministry-profile-separation"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "inspect", token }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message)
        return result.separation
      })
      .then((result) => {
        setSeparation(result)
        if (result.status !== "pending" || result.expired) {
          setStatus("error")
          setMessage(result.expired ? "This activation link has expired." : "This activation was already completed.")
        } else setStatus("ready")
      })
      .catch((error) => {
        setStatus("error")
        setMessage(error.message || "Unable to open this activation")
      })
  }, [token])

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (name === "username") setUsernameMessage("")
  }

  const checkUsername = async () => {
    if (!form.username) return
    const response = await fetch(getFunctionEndpoint("ministry-profile-separation"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_username", token, username: form.username }),
    })
    const result = await response.json()
    setUsernameMessage(result.message || "")
  }

  const activate = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage("")
    try {
      const response = await fetch(getFunctionEndpoint("ministry-profile-separation"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", token, ...form }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message)
      window.sessionStorage.setItem(MINISTRY_SESSION_KEY, result.token)
      setStatus("accepted")
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message || "Unable to activate account")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout robots="noindex,nofollow">
      <Helmet><meta name="referrer" content="no-referrer" /></Helmet>
      <Seo title="Activate Ministry Profile | MyLatinMass.com" description="Activate an independent ministry profile." />
      <section className="mx-auto my-10 w-11/12 max-w-xl">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-9">
          <h1 className="century-font text-3xl text-[#6f4f34]">Activate your profile</h1>
          {status === "loading" && <p className="mt-6 text-gray-500">Opening your activation...</p>}
          {status === "error" && <p className="mt-6 text-red-600">{message}</p>}
          {status === "accepted" && (
            <div className="mt-6"><p className="text-green-700">{message}</p><Link to="/ministry" className="mt-5 inline-block rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white">Open my ministries</Link></div>
          )}
          {status === "ready" && separation && (
            <form onSubmit={activate} className="mt-6 space-y-4">
              <p className="text-gray-600">Welcome, {separation.firstName} {separation.lastName}. Your ministries and complete service history will stay with this account.</p>
              <div className="rounded-xl border border-[#e6ddd4] bg-[#faf8f5] p-4"><p className="text-xs font-semibold uppercase text-gray-500">Verified email</p><p className="mt-1">{separation.email}</p></div>
              <label className="block text-sm font-semibold text-gray-700">Username<input name="username" value={form.username} onChange={updateField} onBlur={checkUsername} required minLength={4} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /><span className="mt-1 block min-h-5 text-xs font-normal text-gray-500">{usernameMessage}</span></label>
              <label className="block text-sm font-semibold text-gray-700">Phone (optional)<input name="phone" type="tel" value={form.phone} onChange={updateField} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              <label className="block text-sm font-semibold text-gray-700">Password<input name="password" type="password" value={form.password} onChange={updateField} required minLength={8} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white disabled:opacity-50">{isSubmitting ? "Activating..." : "Activate independent account"}</button>
              {message && <p role="alert" className="text-center text-sm text-red-600">{message}</p>}
            </form>
          )}
        </div>
      </section>
    </Layout>
  )
}

export default MinistryProfileSeparatePage
