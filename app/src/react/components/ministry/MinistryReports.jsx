import * as React from "react"
import {
  ArrowDownTrayIcon,
  ChartBarIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))

const escapeCsv = (value) => {
  const text = value == null ? "" : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n")
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const MinistryReports = ({ ministry, activeAction }) => {
  const [report, setReport] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState("")

  React.useEffect(() => {
    let active = true
    const load = async () => {
      setIsLoading(true)
      setErrorMessage("")
      try {
        const url = new URL(
          getFunctionEndpoint("scheduling/reports"),
          window.location.origin,
        )
        url.searchParams.set("ministryId", ministry.id)
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${window.sessionStorage.getItem(
              MINISTRY_SESSION_KEY,
            )}`,
          },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || "Unable to load reports")
        if (active) setReport(result)
      } catch (error) {
        if (active) setErrorMessage(error.message)
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [ministry.id])

  const exportReports = () => {
    if (!report) return
    downloadCsv(`${ministry.slug || "ministry"}-participation-report.csv`, [
      [
        "Member",
        "Confirmed",
        "Served",
        "No-shows",
        "Substitutes",
        "Excused",
        "Unrecorded",
        "Recent workload (30 days)",
        "Reliability",
      ],
      ...report.participation.map((member) => [
        `${member.firstName} ${member.lastName}`,
        member.confirmed,
        member.served,
        member.noShows,
        member.substitutes,
        member.excused,
        member.unrecorded,
        member.recentWorkload,
        member.reliabilityPercent == null ? "Not enough data" : `${member.reliabilityPercent}%`,
      ]),
      [],
      ["Upcoming coverage"],
      ["Event", "Date", "Responsibility", "Needed", "Assigned", "Shortage"],
      ...report.coverage.map((item) => [
        item.title,
        formatDateTime(item.startTime),
        item.responsibilityName,
        item.quantityNeeded,
        item.assignedQuantity,
        item.shortage,
      ]),
    ])
  }

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading reports...</p>
  }
  if (errorMessage) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{errorMessage}</p>
  }

  const showCoverage = activeAction.id === "coverage-report"
  const showExport = activeAction.id === "export"

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
            {report.ministry.name} · Internal report
          </p>
          <h2 className="mt-2 century-font text-3xl text-gray-950">
            {showCoverage ? "Upcoming coverage" : showExport ? "Export reports" : "Service and reliability"}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Six-month history. Service outcomes remain separate from assignment confirmation.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
          >
            <PrinterIcon className="size-4" /> Print
          </button>
          <button
            type="button"
            onClick={exportReports}
            className="inline-flex items-center gap-2 rounded-lg bg-[#896542] px-3 py-2 text-sm font-semibold text-white"
          >
            <ArrowDownTrayIcon className="size-4" /> Export CSV
          </button>
        </div>
      </header>

      {showCoverage ? (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fbf8f4] text-xs uppercase tracking-wide text-[#896542]">
                <tr>
                  <th className="px-4 py-3">Event</th><th className="px-4 py-3">Responsibility</th>
                  <th className="px-4 py-3">Assigned</th><th className="px-4 py-3">Shortage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.coverage.map((item) => (
                  <tr key={item.responsibilityId}>
                    <td className="px-4 py-3"><p className="font-semibold text-gray-900">{item.title}</p><p className="text-xs text-gray-500">{formatDateTime(item.startTime)}</p></td>
                    <td className="px-4 py-3">{item.responsibilityName}</td>
                    <td className="px-4 py-3">{item.assignedQuantity}/{item.quantityNeeded}</td>
                    <td className={`px-4 py-3 font-semibold ${item.shortage ? "text-red-700" : "text-green-700"}`}>{item.shortage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : showExport ? (
        <section className="rounded-2xl border border-dashed border-[#d8c7b8] bg-white p-8 text-center">
          <ArrowDownTrayIcon className="mx-auto size-10 text-[#896542]" />
          <h3 className="mt-4 century-font text-2xl text-gray-900">Download the current report</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">The CSV includes participation, outcomes, reliability, and upcoming coverage using the same access-controlled data shown here.</p>
          <button type="button" onClick={exportReports} className="mt-5 rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white">Export CSV</button>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fbf8f4] text-xs uppercase tracking-wide text-[#896542]">
                  <tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Served</th><th className="px-4 py-3">No-shows</th><th className="px-4 py-3">30-day workload</th><th className="px-4 py-3">Reliability</th><th className="px-4 py-3">Time patterns</th><th className="px-4 py-3">Recent position history</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.participation.map((member) => (
                    <tr key={member.userId}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{member.firstName} {member.lastName}</td>
                      <td className="px-4 py-3">{member.served}</td>
                      <td className="px-4 py-3">{member.noShows}</td>
                      <td className="px-4 py-3">{member.recentWorkload}</td>
                      <td className="px-4 py-3">{member.reliabilityPercent == null ? "Not enough data" : `${member.reliabilityPercent}%`}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {member.timePatterns.filter((pattern) => pattern.recorded >= 2).map((pattern) => `${pattern.time}: ${pattern.served}/${pattern.recorded}`).join(" · ") || "No repeated time yet"}
                      </td>
                      <td className="min-w-64 px-4 py-3 text-xs text-gray-500">
                        {member.recentAssignments.slice(0, 4).map((assignment) => `${formatDateTime(assignment.startTime)} · ${assignment.responsibilityName} (${assignment.outcome.replaceAll("_", " ")})`).join("; ") || "No service in this period"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><ChartBarIcon className="size-5 text-[#896542]" /><h3 className="century-font text-xl text-gray-900">Ministry level history</h3></div>
            <div className="mt-4 space-y-3">
              {report.levelHistory.length ? report.levelHistory.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3 text-sm">
                  <span><strong>{entry.memberName}</strong> · {entry.levelName}</span>
                  <span className="text-xs text-gray-500">{formatDateTime(entry.createdAt)} · recorded by {entry.actorName}</span>
                </div>
              )) : <p className="text-sm text-gray-500">No level changes have been recorded yet.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default MinistryReports
