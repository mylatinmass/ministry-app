import * as React from "react"
import Layout from "../components/Layout"
import Seo from "../components/Seo"
import { Link } from "../compat/gatsby"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"

const initialForm = {
  responsibilityId: "",
  name: "",
  email: "",
  phone: "",
  notes: "",
  emailConsent: true,
  smsConsent: false,
  termsAccepted: false,
  website: "",
}

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const VolunteerSignupApp = ({ code }) => {
  const [event, setEvent] = React.useState(null)
  const [form, setForm] = React.useState(initialForm)
  const [status, setStatus] = React.useState("loading")
  const [feedback, setFeedback] = React.useState("")
  const [accountResult, setAccountResult] = React.useState(null)

  React.useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const url = new URL(getFunctionEndpoint("volunteer-signup"), window.location.origin)
        url.searchParams.set("code", code)
        const profile = new URLSearchParams(window.location.search).get("profile")
        if (profile) url.searchParams.set("profile", profile)
        const response = await fetch(url)
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || "Volunteer signup unavailable")
        if (!active) return
        setEvent(result)
        if (result.prefill) {
          setForm((current) => ({ ...current, ...result.prefill }))
        }
        setStatus("ready")
      } catch (error) {
        if (!active) return
        setFeedback(error.message)
        setStatus("error")
      }
    }
    load()
    return () => {
      active = false
    }
  }, [code])

  const updateField = (event) => {
    const { name, type, checked, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const submit = async (submitEvent) => {
    submitEvent.preventDefault()
    setStatus("submitting")
    setFeedback("")
    try {
      const response = await fetch(getFunctionEndpoint("volunteer-signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...form }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to sign up")
      setFeedback(result.message)
      setAccountResult(result)
      setStatus("success")
    } catch (error) {
      setFeedback(error.message)
      setStatus("error-submit")
    }
  }

  const selectedAssignment = event?.responsibilities.find(
    (responsibility) => responsibility.id === form.responsibilityId,
  )

  return (
    <Layout robots="noindex,nofollow">
      <Seo title="Volunteer Signup | My Latin Mass" description="Sign up to volunteer for a chapel event." />
      <main className="mx-auto my-10 w-11/12 max-w-2xl">
        {status === "loading" ? (
          <p className="py-20 text-center text-gray-500">Loading volunteer signup...</p>
        ) : status === "error" ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <h1 className="century-font text-3xl text-[#6f4f34]">Volunteer signup unavailable</h1>
            <p role="alert" className="mt-3 text-amber-800">{feedback}</p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <header className="bg-[#fbf8f4] p-6 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#896542]">{event.ministryName}</p>
              <h1 className="mt-2 century-font text-4xl text-[#6f4f34]">{event.title}</h1>
              <p className="mt-3 font-semibold text-gray-800">{formatDateTime(event.startTime)}</p>
              {event.location && <p className="mt-1 text-sm text-gray-600">{event.location}</p>}
              {event.description && <p className="mt-4 text-sm leading-relaxed text-gray-600">{event.description}</p>}
            </header>

            {status === "success" ? (
              <div className="p-8 text-center sm:p-10">
                <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-800">
                  <p role="status" className="font-semibold">{feedback}</p>
                  <p className="mt-2 text-sm">
                    {accountResult?.accountInvitationSent
                      ? "Check your email to add a password. Your profile will let you manage reminders without joining a ministry."
                      : accountResult?.accountAlreadyActive
                        ? "This assignment is connected to your existing profile, where you can manage reminders."
                        : "Your volunteer profile was saved. Contact the event organizer if your account invitation does not arrive."}
                  </p>
                </div>
              </div>
            ) : event.responsibilities.length ? (
              <div className="p-6 sm:p-9">
                <div>
                  <h2 className="century-font text-2xl text-gray-950">Choose an available assignment</h2>
                  <p className="mt-1 text-sm text-gray-500">Select the job you would like to volunteer for. Your contact form will appear after you choose.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {event.responsibilities.map((responsibility) => {
                      const selected = form.responsibilityId === responsibility.id
                      return (
                        <button
                          key={responsibility.id}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, responsibilityId: responsibility.id }))}
                          className={`rounded-xl border p-4 text-left transition ${selected ? "border-[#896542] bg-[#fbf8f4] ring-2 ring-[#d8c7b8]" : "border-gray-200 bg-white hover:border-[#C1A387]"}`}
                        >
                          <span className="block font-semibold text-gray-900">{responsibility.name}</span>
                          {responsibility.description && <span className="mt-1 block text-sm leading-relaxed text-gray-500">{responsibility.description}</span>}
                          <span className="mt-3 block text-sm font-semibold text-[#896542]">{responsibility.unlimitedCapacity ? "Unlimited openings" : `${responsibility.availableSlots} ${responsibility.availableSlots === 1 ? "opening" : "openings"}`}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {selectedAssignment && (
                  <form onSubmit={submit} className="mt-8 space-y-5 border-t border-gray-100 pt-7">
                    <div className="flex flex-col gap-2 rounded-xl border border-[#e6ddd4] bg-[#faf8f5] p-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                      <span>Already have a volunteer or ministry account?</span>
                      <Link to="/" className="font-semibold text-[#6f4f34] underline">Sign in with password or one-time link</Link>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fbf8f4] p-4">
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-[#896542]">Your assignment</p><p className="mt-1 font-semibold text-gray-900">{selectedAssignment.name}</p></div>
                      <button type="button" onClick={() => setForm((current) => ({ ...current, responsibilityId: "" }))} className="text-sm font-semibold text-[#6f4f34] underline">Choose a different assignment</button>
                    </div>
                <label className="block text-sm font-semibold text-gray-700">Full name<input name="name" value={form.name} onChange={updateField} required autoComplete="name" maxLength={200} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-gray-700">Email<input name="email" type="email" value={form.email} onChange={updateField} required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
                  <label className="text-sm font-semibold text-gray-700">Telephone<input name="phone" type="tel" value={form.phone} onChange={updateField} required autoComplete="tel" maxLength={50} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
                </div>
                <label className="block text-sm font-semibold text-gray-700">Note <span className="font-normal text-gray-400">(optional)</span><textarea name="notes" value={form.notes} onChange={updateField} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
                <fieldset className="rounded-xl border border-gray-100 p-4">
                  <legend className="px-2 text-sm font-semibold text-gray-700">Event updates</legend>
                  <label className="flex gap-3 text-sm text-gray-600"><input name="emailConsent" type="checkbox" checked={form.emailConsent} onChange={updateField} className="mt-0.5 size-4 accent-[#896542]" /><span>Email me information and changes about this volunteer assignment.</span></label>
                  <label className="mt-3 flex gap-3 text-sm text-gray-600"><input name="smsConsent" type="checkbox" checked={form.smsConsent} onChange={updateField} className="mt-0.5 size-4 accent-[#896542]" /><span>Text me information and changes about this volunteer assignment when SMS is available.</span></label>
                </fieldset>
                <label className="flex gap-3 text-sm text-gray-600"><input name="termsAccepted" type="checkbox" checked={form.termsAccepted} onChange={updateField} required className="mt-0.5 size-4 accent-[#896542]" /><span>I agree to submit my contact information for this event and create or connect a volunteer profile. This does not add me to a ministry.</span></label>
                <label className="absolute -left-[10000px]" aria-hidden="true">Website<input name="website" value={form.website} onChange={updateField} tabIndex={-1} autoComplete="off" /></label>
                <button type="submit" disabled={status === "submitting"} className="w-full rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white disabled:opacity-60">{status === "submitting" ? "Submitting..." : "Sign up to volunteer"}</button>
                {status === "error-submit" && <p role="alert" className="text-center text-sm text-red-700">{feedback}</p>}
                  </form>
                )}
              </div>
            ) : (
              <p className="p-8 text-center text-gray-600">All volunteer assignments for this event are currently filled.</p>
            )}
          </section>
        )}
      </main>
    </Layout>
  )
}

export default VolunteerSignupApp
