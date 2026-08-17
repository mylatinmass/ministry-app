import * as React from "react"
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LinkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const PrioryScheduleSettings = () => {
  const [data, setData] = React.useState(null)
  const [form, setForm] = React.useState(null)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const request = React.useCallback(async (options = {}, query = "") => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(
      `${getFunctionEndpoint("scheduling/priory-allocations")}${query}`,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      },
    )
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "Unable to load the Priory schedule")
    return result
  }, [])

  const load = React.useCallback(async () => {
    const start = new Date()
    const end = new Date(start.getTime() + 60 * 60_000)
    const result = await request(
      {},
      `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
    )
    setData(result)
    setForm({ ...result.settings })
  }, [request])

  React.useEffect(() => {
    load().catch((error) => setErrorMessage(error.message))
  }, [load])

  const act = async (body, successMessage) => {
    setBusy(true)
    setMessage("")
    setErrorMessage("")
    try {
      await request({ method: "POST", body: JSON.stringify(body) })
      await load()
      setMessage(successMessage)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (!data || !form) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">{errorMessage || "Loading Priory schedule settings..."}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="century-font text-2xl text-gray-950">Priory priest schedule</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Connect this mission to the Priory&apos;s allocation Sheet. Detailed appointments and private pastoral information remain in this chapel&apos;s database.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !data.settings.enabled}
            onClick={() => act({ action: "refresh" }, "Priory schedule refreshed")}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            disabled={busy || !data.canConfigure}
            onClick={() => act({
              action: "save_settings",
              enabled: Boolean(form.enabled),
              spreadsheetId: form.spreadsheetId,
              missionId: form.missionId,
              missionName: form.missionName,
              timeZone: form.timeZone,
            }, "Priory connection updated")}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#896542] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
            Update
          </button>
        </div>
      </div>

      {(message || errorMessage || data.stale || data.settings.lastSyncError) && (
        <div
          role={errorMessage || data.settings.lastSyncError ? "alert" : "status"}
          className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            errorMessage || data.settings.lastSyncError || data.stale
              ? "border-orange-200 bg-orange-50 text-orange-800"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {(errorMessage || data.settings.lastSyncError || data.stale) && (
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {errorMessage || data.settings.lastSyncError ||
              (data.stale ? "The cached Priory schedule is more than 15 minutes old. Existing cached allocations remain available." : message)}
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(form.enabled)}
            disabled={!data.canConfigure}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
            className="h-5 w-5 accent-orange-500"
          />
          Use the shared Priory schedule
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Mission ID
          <input
            value={form.missionId || ""}
            disabled={!data.canConfigure}
            onChange={(event) => setForm((current) => ({ ...current, missionId: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-normal"
            placeholder="olv-miami"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Mission name
          <input
            value={form.missionName || ""}
            disabled={!data.canConfigure}
            onChange={(event) => setForm((current) => ({ ...current, missionName: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Time zone
          <input
            value={form.timeZone || "America/New_York"}
            disabled={!data.canConfigure}
            onChange={(event) => setForm((current) => ({ ...current, timeZone: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700 md:col-span-2">
          Google Spreadsheet ID
          <div className="relative mt-2">
            <LinkIcon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-gray-400" aria-hidden="true" />
            <input
              value={form.spreadsheetId || ""}
              disabled={!data.canConfigure}
              onChange={(event) => setForm((current) => ({ ...current, spreadsheetId: event.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 font-normal"
              placeholder="The ID between /d/ and /edit in the Sheet URL"
            />
          </div>
        </label>
      </div>

      <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-semibold text-gray-800">Required protected tabs</p>
        <p className="mt-1">Priests · Allocations · Exceptions · Requests</p>
        <p className="mt-2">The application service account must be able to read all four tabs and append only to Requests. Protect Priests, Allocations, and Exceptions from that service account.</p>
        <p className="mt-2">Last successful sync: {data.settings.lastSyncSucceededAt ? new Date(data.settings.lastSyncSucceededAt).toLocaleString() : "Never"}</p>
      </div>

      {data.settings.enabled && (
        <div className="mt-6">
          <h3 className="century-font text-xl text-gray-950">Priest profile mappings</h3>
          <p className="mt-1 text-sm text-gray-500">Map permanent Priest IDs to local Priest-ministry profiles. Display-name changes will not break the connection.</p>
          <div className="mt-3 space-y-3">
            {data.localPriests.map((priest) => {
              const mapping = data.mappings.find((item) => item.localUserId === priest.id)
              return (
                <div key={priest.id} className="grid gap-3 rounded-xl border border-gray-100 p-4 md:grid-cols-[1fr_1.2fr_auto] md:items-center">
                  <span className="font-semibold text-gray-900">{priest.name}</span>
                  <select
                    value={mapping?.externalPriestId || ""}
                    disabled={busy || !data.canManage}
                    onChange={(event) => {
                      const externalPriestId = event.target.value
                      act(
                        externalPriestId
                          ? { action: "save_mapping", userId: priest.id, externalPriestId }
                          : { action: "remove_mapping", userId: priest.id },
                        externalPriestId ? "Priest mapping saved" : "Priest mapping removed",
                      )
                    }}
                    className="min-h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Not mapped</option>
                    {data.priests.map((item) => (
                      <option key={item.externalPriestId} value={item.externalPriestId}>
                        {item.displayName} · {item.externalPriestId}
                      </option>
                    ))}
                  </select>
                  <span className={`text-sm font-semibold ${mapping ? "text-green-700" : "text-orange-700"}`}>
                    {mapping ? "Mapped" : "Needs mapping"}
                  </span>
                </div>
              )
            })}
            {!data.localPriests.length && <p className="text-sm text-gray-500">No active Priest-ministry members are available to map.</p>}
          </div>
        </div>
      )}
    </section>
  )
}

export default PrioryScheduleSettings
