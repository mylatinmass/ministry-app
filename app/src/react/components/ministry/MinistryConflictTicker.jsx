import * as React from "react"
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const formatConflictDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "an upcoming date"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

const MinistryConflictTicker = ({ profileId, onOpenAvailability }) => {
  const [conflicts, setConflicts] = React.useState([])

  const loadConflicts = React.useCallback(async () => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    if (!token) return
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/availability"),
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.message)
      setConflicts(
        (result.assignments || []).filter(
          (assignment) =>
            assignment.status === "change_requested" ||
            assignment.changeRequestStatus === "pending",
        ),
      )
    } catch {
      // Keep the current ticker visible through temporary network failures.
    }
  }, [])

  React.useEffect(() => {
    loadConflicts()
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadConflicts()
    }
    const interval = window.setInterval(loadConflicts, 30_000)
    window.addEventListener("focus", loadConflicts)
    window.addEventListener("ministry-conflicts-updated", loadConflicts)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", loadConflicts)
      window.removeEventListener("ministry-conflicts-updated", loadConflicts)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [loadConflicts, profileId])

  if (!conflicts.length) return null

  const first = conflicts[0]
  const summary =
    conflicts.length === 1
      ? `${first.eventTitle}: ${first.responsibilityName} on ${formatConflictDate(first.startTime)}`
      : `${conflicts.length} assigned duties conflict with your updated availability`

  return (
    <button
      type="button"
      onClick={onOpenAvailability}
      className="ministry-conflict-ticker z-40 flex w-full shrink-0 items-center gap-3 bg-orange-500 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-md"
      aria-label={`${summary}. Open Availability to address this now.`}
    >
      <ExclamationTriangleIcon className="ministry-conflict-alert-icon size-6 shrink-0 text-white" />
      <span className="min-w-0 flex-1">
        <span className="mr-2 font-extrabold uppercase tracking-wide">
          Schedule conflict
        </span>
        <span>{summary}.</span>
      </span>
      <span className="shrink-0 rounded-lg border border-white/60 px-2.5 py-1 text-xs font-bold uppercase">
        Handle now
      </span>
    </button>
  )
}

export default MinistryConflictTicker
