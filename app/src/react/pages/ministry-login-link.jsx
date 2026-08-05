import * as React from "react"
import { Link } from "../compat/gatsby"
import Layout from "../components/Layout"
import Seo from "../components/Seo"
import { MINISTRY_SESSION_KEY } from "../components/ministry/MinistryLogin"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"

const MinistryLoginLinkPage = ({ location }) => {
  const token = React.useMemo(
    () => new URLSearchParams((location?.hash || "").replace(/^#/, "")).get("token") || "",
    [location?.hash]
  )
  const [status, setStatus] = React.useState("loading")
  const [message, setMessage] = React.useState("Signing you in...")

  React.useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", "/login-link")
    if (!token) {
      setStatus("error")
      setMessage("This sign-in link is incomplete.")
      return
    }
    fetch(getFunctionEndpoint("ministry-login-link-response"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || "Unable to sign in")
        return result
      })
      .then((result) => {
        window.sessionStorage.setItem(MINISTRY_SESSION_KEY, result.token)
        window.sessionStorage.removeItem("ministry_visible_profile_ids")
        setStatus("success")
        setMessage("Signed in. Opening Ministries...")
        window.setTimeout(() => window.location.assign("/"), 350)
      })
      .catch((error) => {
        setStatus("error")
        setMessage(error.message || "This sign-in link cannot be used")
      })
  }, [token])

  return (
    <Layout robots="noindex,nofollow">
      <Seo title="Ministries Sign-in | MyLatinMass.com" description="Use a private Ministry sign-in link." />
      <section className="mx-auto my-16 w-11/12 max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <h1 className="century-font text-3xl text-[#6f4f34]">Ministries sign-in</h1>
        <p className={`mt-6 ${status === "error" ? "text-red-700" : "text-gray-600"}`}>{message}</p>
        {status === "error" && <Link to="/" className="mt-6 inline-block font-semibold text-[#896542] underline">Return to login</Link>}
      </section>
    </Layout>
  )
}

export default MinistryLoginLinkPage
