import * as React from "react"
import { Link } from "../compat/gatsby"
import { Helmet } from "react-helmet"
import Layout from "../components/Layout"
import Seo from "../components/Seo"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"
import MinistryLogin, { MINISTRY_SESSION_KEY } from "../components/ministry/MinistryLogin"

const MembershipRequestPage = ({ location }) => {
  const params = React.useMemo(
    () => new URLSearchParams((location?.hash || "").replace(/^#/, "")),
    [location?.hash]
  )
  const token = params.get("token") || ""
  const intent = params.get("intent") === "decline" ? "decline" : "accept"
  const [request, setRequest] = React.useState(null)
  const [status, setStatus] = React.useState("loading")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [needsPassword, setNeedsPassword] = React.useState(false)

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", "/membership-request")
    }
    if (!token) {
      setStatus("error")
      setMessage("This review link is incomplete.")
      return
    }
    fetch(getFunctionEndpoint("ministry-membership-request-response"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "inspect", token }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message)
        return result.request
      })
      .then((result) => {
        setRequest(result)
        if (result.status !== "pending") {
          setStatus("answered")
          setMessage(`This request was already ${result.status}${result.reviewedBy ? ` by ${result.reviewedBy}` : ""}.`)
        } else if (result.expired) {
          setStatus("error")
          setMessage("This review link has expired.")
        } else setStatus("ready")
      })
      .catch((error) => {
        setStatus("error")
        setMessage(error.message || "Unable to open this request")
      })
  }, [token])

  const answer = async () => {
    setIsSubmitting(true)
    setMessage("")
    try {
      const response = await fetch(getFunctionEndpoint("ministry-membership-request-response"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${window.sessionStorage.getItem(MINISTRY_SESSION_KEY) || ""}`,
        },
        body: JSON.stringify({ action: intent, token }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setNeedsPassword(true)
        throw new Error(result.message)
      }
      setRequest(result.request)
      setStatus("answered")
      setMessage(result.message)
    } catch (error) {
      setStatus("answered")
      setMessage(error.message || "Unable to answer this request")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout robots="noindex,nofollow">
      <Helmet><meta name="referrer" content="no-referrer" /></Helmet>
      <Seo title="Membership Request | MyLatinMass.com" description="Review a child ministry membership request." />
      <section className="mx-auto my-10 w-11/12 max-w-xl">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-9">
          <h1 className="century-font text-3xl text-[#6f4f34]">Membership request</h1>
          {status === "loading" && <p className="mt-6 text-gray-500">Opening request...</p>}
          {request && (
            <div className="mt-6 rounded-xl border border-[#e6ddd4] bg-[#faf8f5] p-5">
              <p><strong>{request.guardianName}</strong> requested membership for <strong>{request.childName}</strong>.</p>
              <p className="mt-2 text-[#6f4f34]"><strong>{request.ministryName}</strong></p>
            </div>
          )}
          {status === "ready" && (
            <div className="mt-6">
              <p className="text-sm text-gray-600">You are reviewing this as {request.reviewerName}. For security, membership decisions require username-and-password sign-in.</p>
              {!needsPassword && <button type="button" onClick={answer} disabled={isSubmitting} className={`mt-5 w-full rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50 ${intent === "accept" ? "bg-[#896542]" : "bg-gray-700"}`}>{isSubmitting ? "Recording response..." : intent === "accept" ? "Confirm acceptance" : "Confirm decline"}</button>}
            </div>
          )}
          {(status === "error" || status === "answered") && <p className="mt-6 text-gray-700">{message}</p>}
          {status === "answered" && <Link to="/" className="mt-5 inline-block text-sm font-semibold text-[#896542]">Open ministries</Link>}
        </div>
        {status === "ready" && needsPassword && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <MinistryLogin passwordOnly onLoginSuccess={() => setNeedsPassword(false)} />
          </div>
        )}
      </section>
    </Layout>
  )
}

export default MembershipRequestPage
