import * as React from "react"
import Layout from "../components/Layout"
import Seo from "../components/Seo"
import getFunctionEndpoint from "../utils/getFunctionEndpoint"

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value))

const AssignmentResponseApp = () => {
  const [assignment, setAssignment] = React.useState(null)
  const [status, setStatus] = React.useState("loading")
  const [message, setMessage] = React.useState("")
  const token = React.useMemo(
    () => new URLSearchParams(window.location.search).get("token") || "",
    [],
  )

  React.useEffect(() => {
    fetch(`${getFunctionEndpoint("assignment-response")}?${new URLSearchParams({ token })}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message)
        setAssignment(result)
        setStatus("ready")
      })
      .catch((error) => {
        setMessage(error.message || "This response link is unavailable.")
        setStatus("error")
      })
  }, [token])

  const respond = async (action) => {
    setStatus("submitting")
    setMessage("")
    try {
      const response = await fetch(getFunctionEndpoint("assignment-response"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message)
      setMessage(result.message)
      setStatus("complete")
    } catch (error) {
      setMessage(error.message || "Unable to record your response.")
      setStatus("error")
    }
  }

  return (
    <Layout robots="noindex,nofollow">
      <Seo title="Respond to Ministry Assignment | MyLatinMass.com" />
      <section className="mx-auto my-10 w-11/12 max-w-xl">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C1A387]">
            Ministry assignment
          </p>
          <h1 className="mt-2 century-font text-3xl text-[#6f4f34]">
            Confirm your assignment
          </h1>
          {status === "loading" && <p className="mt-6 text-gray-500">Checking your private response link...</p>}
          {assignment && !["complete", "error"].includes(status) && (
            <div className="mt-6">
              <p className="font-semibold text-gray-900">{assignment.responsibilityName}</p>
              <p className="mt-1 text-gray-700">{assignment.eventTitle}</p>
              <p className="mt-1 text-sm text-gray-500">
                {formatDate(assignment.startTime)}
                {assignment.location ? ` · ${assignment.location}` : ""}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button type="button" disabled={status === "submitting"} onClick={() => respond("confirm")} className="rounded-xl bg-[#896542] px-6 py-3 font-semibold text-white disabled:opacity-60">
                  {status === "submitting" ? "Saving..." : "Confirm assignment"}
                </button>
                <button type="button" disabled={status === "submitting"} onClick={() => respond("decline")} className="rounded-xl border border-red-200 px-6 py-3 font-semibold text-red-700 disabled:opacity-60">
                  Decline
                </button>
              </div>
            </div>
          )}
          {["complete", "error"].includes(status) && (
            <p role={status === "error" ? "alert" : "status"} className={`mt-6 rounded-xl p-4 font-semibold ${status === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
              {message}
            </p>
          )}
        </div>
      </section>
    </Layout>
  )
}

export default AssignmentResponseApp
