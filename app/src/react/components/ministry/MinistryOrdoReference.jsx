import * as React from "react"
import {
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const CHAPEL_TIME_ZONE = "America/New_York"

const colorClasses = {
  Black: "bg-gray-950",
  Green: "bg-green-700",
  Red: "bg-red-700",
  Rose: "bg-rose-400",
  Violet: "bg-violet-700",
  White: "border border-gray-300 bg-white",
}

const toChapelDate = (value) => {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return value.slice(0, 10)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHAPEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

const requestHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${window.sessionStorage.getItem(
    MINISTRY_SESSION_KEY,
  )}`,
})

const MinistryOrdoReference = ({ eventId = "", startTime }) => {
  const liturgicalDate = toChapelDate(startTime)
  const [reference, setReference] = React.useState(null)
  const [selectedOptionId, setSelectedOptionId] = React.useState("")
  const [sacristyNotes, setSacristyNotes] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  const loadReference = React.useCallback(async () => {
    if (!liturgicalDate) {
      setReference(null)
      return
    }
    setIsLoading(true)
    setErrorMessage("")
    try {
      const url = new URL(
        getFunctionEndpoint("scheduling/ordo"),
        window.location.origin,
      )
      url.searchParams.set("date", liturgicalDate)
      if (eventId) url.searchParams.set("eventId", eventId)
      const response = await fetch(url, { headers: requestHeaders() })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to load the 1962 Ordo")
      }
      setReference(result)
      setSelectedOptionId(
        result.event?.selectedMassOptionId ||
          (result.day.massOptions.length === 1
            ? result.day.massOptions[0].id
            : ""),
      )
      setSacristyNotes(result.event?.sacristyNotes || "")
    } catch (error) {
      setReference(null)
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [eventId, liturgicalDate])

  React.useEffect(() => {
    setMessage("")
    loadReference()
  }, [loadReference])

  const saveReference = async () => {
    if (!eventId || !reference?.event) return
    setIsSaving(true)
    setMessage("")
    setErrorMessage("")
    try {
      const body = { eventId }
      if (reference.event.canSelectMass) {
        body.selectedMassOptionId = selectedOptionId
      }
      if (reference.event.canEditSacristyNotes) {
        body.sacristyNotes = sacristyNotes
      }
      const response = await fetch(
        getFunctionEndpoint("scheduling/ordo"),
        {
          method: "PATCH",
          headers: requestHeaders(),
          body: JSON.stringify(body),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to update Ordo details")
      }
      setReference(result)
      setMessage(result.message)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!liturgicalDate) return null

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500">
        Loading the 1962 Ordo...
      </div>
    )
  }

  if (!reference?.day) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        <p className="font-semibold">1962 Ordo unavailable</p>
        <p className="mt-1">
          {errorMessage ||
            "No Ordo reference is currently available for this date."}
        </p>
      </div>
    )
  }

  const { day } = reference
  const eventReference = reference.event
  const selectionRequired =
    day.massOptions.length > 1 &&
    !eventReference?.selectedMassOptionId
  const canUpdate =
    eventReference?.canSelectMass ||
    eventReference?.canEditSacristyNotes

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#896542]">
            1962 Ordo
          </p>
          <h2 className="mt-1 century-font text-2xl text-gray-900">
            {day.celebration}
          </h2>
        </div>
        <a
          href={day.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[#6f4f34] hover:border-[#C1A387]"
        >
          View 1962 Ordo
          <ArrowTopRightOnSquareIcon className="size-4" />
        </a>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {day.classLabel && (
          <span className="rounded-full bg-[#f4ede6] px-3 py-1 text-xs font-semibold text-[#896542]">
            {day.classLabel}
          </span>
        )}
        {day.vestmentColor && (
          <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            <span
              aria-hidden="true"
              className={`size-3 rounded-full ${
                colorClasses[day.vestmentColor] || "bg-gray-400"
              }`}
            />
            {day.massOptions.length > 1
              ? `Primary color: ${day.vestmentColor}`
              : `${day.vestmentColor} vestments`}
          </span>
        )}
        {day.stale && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Cached reference
          </span>
        )}
      </div>

      {day.commemorations.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          {day.commemorations.map((commemoration) => (
            <p key={commemoration}>{commemoration}</p>
          ))}
        </div>
      )}

      {day.generalInformation.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#f7f3ef] p-4 text-sm text-[#6f4f34]">
          {day.generalInformation.map((information) => (
            <p key={information}>{information}</p>
          ))}
        </div>
      )}

      {day.reminders.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <ExclamationTriangleIcon className="size-5" />
            Ordo reminder
          </p>
          {day.reminders.map((reminder) => (
            <p key={reminder} className="mt-1">
              {reminder}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">Mass</h3>
          {selectionRequired && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Selection required
            </span>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {day.massOptions.map((option) => {
            const selected = selectedOptionId === option.id
            return (
              <label
                key={option.id}
                className={`block rounded-xl border p-4 ${
                  selected
                    ? "border-[#C1A387] bg-[#f7f3ef]"
                    : "border-gray-200"
                } ${
                  eventReference?.canSelectMass
                    ? "cursor-pointer"
                    : "cursor-default"
                }`}
              >
                <div className="flex items-start gap-3">
                  {eventReference?.canSelectMass && (
                    <input
                      type="radio"
                      name={`ordo-mass-${eventId}`}
                      value={option.id}
                      checked={selected}
                      onChange={() => setSelectedOptionId(option.id)}
                      className="mt-1"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">
                      {option.label}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      {option.instructions}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      {option.vestmentColor && (
                        <span>{option.vestmentColor} vestments</span>
                      )}
                      {option.gloria !== null && (
                        <span>
                          {option.gloria ? "Gloria" : "No Gloria"}
                        </span>
                      )}
                      {option.credo !== null && (
                        <span>{option.credo ? "Credo" : "No Credo"}</span>
                      )}
                    </div>
                    {selected &&
                      day.massOptions.length > 1 &&
                      !option.vestmentColor && (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                          The Ordo does not explicitly state the vestment color
                          for this option. Confirm it before preparation.
                        </p>
                      )}
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {eventReference?.sourceChanged && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            The 1962 Ordo changed after this Mass was selected.
          </p>
          {eventReference.selectedMassOption && (
            <>
              <p className="mt-2 font-semibold">
                Approved selection:{" "}
                {eventReference.selectedMassOption.label}
              </p>
              <p className="mt-1">
                {eventReference.selectedMassOption.instructions}
              </p>
            </>
          )}
          <p className="mt-2">
            Review the source before changing the approved selection.
          </p>
        </div>
      )}

      {eventReference?.canEditSacristyNotes && (
        <label className="mt-5 block text-sm font-semibold text-gray-700">
          Sacristy page and setup notes
          <div className="relative mt-2">
            <BookOpenIcon className="pointer-events-none absolute left-3 top-3 size-5 text-gray-400" />
            <textarea
              value={sacristyNotes}
              onChange={(event) => setSacristyNotes(event.target.value)}
              rows={3}
              placeholder="Missal pages, ribbon placement, altar setup, and other local preparation notes"
              className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 font-normal"
            />
          </div>
        </label>
      )}

      {(message || errorMessage) && (
        <p
          role={errorMessage ? "alert" : "status"}
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            errorMessage
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {errorMessage || message}
        </p>
      )}

      {canUpdate && (
        <button
          type="button"
          onClick={saveReference}
          disabled={
            isSaving ||
            (eventReference.canSelectMass &&
              day.massOptions.length > 1 &&
              !selectedOptionId)
          }
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white hover:bg-[#6f4f34] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckIcon className="size-5" />
          {isSaving ? "Updating..." : "Update Ordo details"}
        </button>
      )}

      {!eventId && day.massOptions.length > 1 && (
        <p className="mt-4 text-xs text-gray-500">
          The Mass choice is made after the event is created.
        </p>
      )}
    </section>
  )
}

export default MinistryOrdoReference
