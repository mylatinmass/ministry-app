import * as React from "react"
import { Link } from "../compat/gatsby"
import Layout from "../components/Layout"
import Seo from "../components/Seo"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  message: "",
  website: "",
}

const AccessRequestApp = () => {
  const [form, setForm] = React.useState(initialForm)
  const [status, setStatus] = React.useState("idle")
  const [feedback, setFeedback] = React.useState("")

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const submitRequest = async (event) => {
    event.preventDefault()
    setStatus("submitting")
    setFeedback("")
    try {
      const response = await fetch(getFunctionEndpoint("ministry-access-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to submit request")
      setStatus("success")
      setFeedback(result.message)
      setForm(initialForm)
    } catch (error) {
      setStatus("error")
      setFeedback(error.message || "Unable to submit request")
    }
  }

  return (
    <Layout robots="noindex,nofollow">
      <Seo
        title="Request Ministry Access | MyLatinMass.com"
        description="Request access to the Ministry application."
      />
      <section className="mx-auto my-10 w-11/12 max-w-xl">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-9">
          <header className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C1A387]">Ministries</p>
            <h1 className="mt-2 century-font text-3xl text-[#6f4f34]">Request access</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Tell us who you are. An administrator will review your request and assign the appropriate ministry before sending an invitation.
            </p>
          </header>

          {status === "success" ? (
            <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 text-center">
              <p role="status" className="font-semibold text-green-800">{feedback}</p>
              <p className="mt-2 text-sm text-green-700">You do not need to submit another request.</p>
              <Link to="/" className="mt-5 inline-block font-semibold text-[#896542] underline">Return to login</Link>
            </div>
          ) : (
            <form onSubmit={submitRequest} className="mt-8 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">First name<input name="firstName" value={form.firstName} onChange={updateField} required autoComplete="given-name" maxLength={100} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
                <label className="text-sm font-semibold text-gray-700">Last name<input name="lastName" value={form.lastName} onChange={updateField} required autoComplete="family-name" maxLength={100} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              </div>
              <label className="block text-sm font-semibold text-gray-700">Email address<input name="email" type="email" value={form.email} onChange={updateField} required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              <label className="block text-sm font-semibold text-gray-700">Phone <span className="font-normal text-gray-400">(optional)</span><input name="phone" type="tel" value={form.phone} onChange={updateField} autoComplete="tel" maxLength={50} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
              <label className="block text-sm font-semibold text-gray-700">Message <span className="font-normal text-gray-400">(optional)</span><textarea name="message" value={form.message} onChange={updateField} maxLength={2000} rows={4} placeholder="Anything the administrator should know" className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
              <label className="absolute -left-[10000px]" aria-hidden="true">Website<input name="website" value={form.website} onChange={updateField} tabIndex={-1} autoComplete="off" /></label>
              <button type="submit" disabled={status === "submitting"} className="w-full rounded-xl bg-[#896542] px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{status === "submitting" ? "Submitting..." : "Submit access request"}</button>
              {status === "error" && <p role="alert" className="text-center text-sm text-red-700">{feedback}</p>}
              <p className="text-center text-xs leading-relaxed text-gray-500">Submitting this form does not create an account or grant access. You will receive a private invitation only after approval.</p>
            </form>
          )}
        </div>
      </section>
    </Layout>
  )
}

export default AccessRequestApp
