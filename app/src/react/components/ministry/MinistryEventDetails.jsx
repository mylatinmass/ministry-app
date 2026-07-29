import * as React from "react"
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const MinistryEventDetails = ({ event, ministryName, onClose }) => {
  const [details, setDetails] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")

  React.useEffect(() => {
    if (!event?.id) {
      setDetails(null)
      return
    }
    const loadDetails = async () => {
      setIsLoading(true)
      setErrorMessage("")
      try {
        const url = new URL(
          getFunctionEndpoint("scheduling/events"),
          window.location.origin,
        )
        url.searchParams.set("eventId", event.id)
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${window.sessionStorage.getItem(
              MINISTRY_SESSION_KEY,
            )}`,
          },
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.message || "Unable to load event")
        }
        setDetails(result)
      } catch (error) {
        setErrorMessage(error.message)
      } finally {
        setIsLoading(false)
      }
    }
    loadDetails()
  }, [event?.id])

  if (!event) return null

  const displayedEvent = details || event

  const start = new Date(displayedEvent.start_time)
  const end = new Date(displayedEvent.end_time)

  const setScheduleStatus = async (ministryId, status) => {
    setErrorMessage("")
    try {
      const response = await fetch(
        getFunctionEndpoint("scheduling/events"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.sessionStorage.getItem(
              MINISTRY_SESSION_KEY,
            )}`,
          },
          body: JSON.stringify({
            action: "set_schedule_status",
            eventId: displayedEvent.id,
            ministryId,
            status,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || "Unable to update schedule")
      }
      setDetails((current) => ({
        ...current,
        ministries: current.ministries.map((ministry) =>
          ministry.ministryId === ministryId
            ? { ...ministry, scheduleStatus: status }
            : ministry,
        ),
      }))
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const groupedResponsibilities = (details?.responsibilities || []).reduce(
    (groups, responsibility) => {
      const key = responsibility.ministryId || "unassigned"
      if (!groups[key]) {
        groups[key] = {
          ministryName: responsibility.ministryName || ministryName,
          items: [],
        }
      }
      groups[key].items.push(responsibility)
      return groups
    },
    {},
  )

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#6f4f34] hover:bg-gray-50"
        >
          <ArrowLeftIcon className="size-5" />
          Schedule
        </button>
        <p className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-[#896542] sm:block">
          {ministryName}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close event details"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-50"
        >
          <XMarkIcon className="size-5" />
        </button>
      </header>

      <main className="mx-auto w-11/12 max-w-3xl py-8 sm:py-12">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#f4ede6] px-3 py-1 text-xs font-semibold uppercase text-[#896542]">
            {displayedEvent.status}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-500">
            {displayedEvent.participation_type}
          </span>
        </div>
        <h1 className="mt-5 century-font text-4xl leading-tight text-gray-950 sm:text-5xl">
          {displayedEvent.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
          {displayedEvent.description ||
            "No event description has been added yet."}
        </p>

        {errorMessage && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-2xl border border-gray-100 p-4">
            <CalendarDaysIcon className="size-6 shrink-0 text-[#896542]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Date
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }).format(start)}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-gray-100 p-4">
            <ClockIcon className="size-6 shrink-0 text-[#896542]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Time
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {new Intl.DateTimeFormat("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(start)}{" "}
                –{" "}
                {new Intl.DateTimeFormat("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(end)}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-gray-100 p-4 sm:col-span-2">
            <MapPinIcon className="size-6 shrink-0 text-[#896542]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Location
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {displayedEvent.location || "Location not set"}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-10 border-t border-gray-100 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
            Participating ministries
          </p>
          <h2 className="mt-2 century-font text-2xl text-gray-950">
            One event, coordinated schedules
          </h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-gray-500">
              Loading responsibilities...
            </p>
          ) : details?.ministries?.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {details.ministries.map((ministry) => (
                <article
                  key={ministry.ministryId}
                  className="rounded-2xl border border-gray-100 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {ministry.ministryName}
                      </h3>
                      <p className="mt-1 text-xs uppercase text-gray-500">
                        {ministry.scheduleStatus.replaceAll("_", " ")}
                      </p>
                    </div>
                    {ministry.isRequired && (
                      <span className="rounded-full bg-[#f4ede6] px-2 py-1 text-[10px] font-semibold uppercase text-[#896542]">
                        Required
                      </span>
                    )}
                  </div>
                  {ministry.canManage && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setScheduleStatus(ministry.ministryId, "ready")
                        }
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-[#C1A387]"
                      >
                        Mark ready
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setScheduleStatus(
                            ministry.ministryId,
                            "published",
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-[#896542] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6f4f34]"
                      >
                        <CheckCircleIcon className="size-4" />
                        Publish schedule
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-10 border-t border-gray-100 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
            Responsibilities
          </p>
          <h2 className="mt-2 century-font text-2xl text-gray-950">
            {details?.responsibilities?.length ||
              displayedEvent.responsibility_count ||
              0}{" "}
            responsibilities
          </h2>
          <div className="mt-5 space-y-6">
            {Object.entries(groupedResponsibilities).map(
              ([ministryId, group]) => (
                <div key={ministryId}>
                  <h3 className="font-semibold text-[#6f4f34]">
                    {group.ministryName}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {group.items.map((responsibility) => (
                      <article
                        key={responsibility.id}
                        className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">
                            {responsibility.name}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {responsibility.responsibilityType.replaceAll(
                              "_",
                              " ",
                            )}{" "}
                            · {responsibility.assignedQuantity}/
                            {responsibility.quantityNeeded} assigned
                            {responsibility.requiredQualification
                              ? ` · ${responsibility.requiredQualification}`
                              : ""}
                          </p>
                        </div>
                        <span className="self-start rounded-full bg-gray-100 px-2 py-1 text-xs uppercase text-gray-500 sm:self-auto">
                          {responsibility.status}
                        </span>
                      </article>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default MinistryEventDetails
