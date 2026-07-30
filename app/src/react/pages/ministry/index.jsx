import * as React from "react"
import { Link } from "../../compat/gatsby"
import { ClockIcon } from "@heroicons/react/24/outline"
import Layout from "../../components/Layout"
import Seo from "../../components/Seo"
import BrowserLocation from "../BrowserLocation"
import { MINISTRY_SESSION_KEY } from "../../components/ministry/MinistryLogin"
import MinistryEventDetails from "../../components/ministry/MinistryEventDetails"
import MinistryHomeCalendar from "../../components/ministry/MinistryHomeCalendar"
import MinistryRouteGuard from "../../components/ministry/MinistryRouteGuard"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
const accessLabels = {
  owner: "Owner",
  super_admin: "Super Admin",
  admin: "Leader",
  member: "Member",
}

const MinistryHomeContent = () => {
  const [ministries, setMinistries] = React.useState([])
  const [currentUser, setCurrentUser] = React.useState(null)
  const [actor, setActor] = React.useState(null)
  const [isManagedProfile, setIsManagedProfile] = React.useState(false)
  const [calendarEvents, setCalendarEvents] = React.useState([])
  const [selectedEvent, setSelectedEvent] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState("")

  React.useEffect(() => {
    const controller = new AbortController()
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)

    fetch(getFunctionEndpoint("ministry-list"), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()

        if (!response.ok) {
          if (response.status === 401) {
            window.sessionStorage.removeItem(MINISTRY_SESSION_KEY)
            window.dispatchEvent(new Event("ministry-session-expired"))
          }
          throw new Error(result.message || "Unable to load ministries")
        }

        return result
      })
      .then((result) => {
        setActor(result.actor || result.user)
        setCurrentUser(result.user)
        setIsManagedProfile(Boolean(result.isManagedProfile))
        setMinistries(result.ministries || [])
        setCalendarEvents(result.calendarEvents || [])
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setErrorMessage(error.message)
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [])

  const returnToGuardian = async () => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("ministry-profiles"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "switch_profile", profileId: actor.id }),
    })
    const result = await response.json()
    if (response.ok) {
      window.sessionStorage.setItem(MINISTRY_SESSION_KEY, result.token)
      window.location.reload()
    }
  }

  return (
    <Layout robots="noindex,nofollow">
      <Seo
        title="Ministries | MyLatinMass.com"
        description="Ministry project management for Our Lady of Victory Chapel."
      />
      <section className="w-11/12 max-w-[1000px] mx-auto my-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="century-font text-[#C1A387] text-4xl">Calendar</h1>
          <p className="max-w-[600px] text-lg leading-relaxed text-gray-600">
            See every published ministry event in one place.
          </p>
          {currentUser?.globalRole === "super_admin" && (
            <p className="rounded-full bg-[#f4ede6] px-4 py-1 text-sm font-semibold text-[#896542]">
              Super Admin access to all ministries
            </p>
          )}
          <Link
            to="/ministry/availability"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8c7b8] px-4 py-2 text-sm font-semibold text-[#6f4f34] hover:bg-[#f7f3ef]"
          >
            <ClockIcon className="size-5" />
            Availability
          </Link>
        </header>

        {isLoading && (
          <p className="mt-10 text-center text-gray-500">
            Loading calendar...
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="mt-10 text-center text-red-600">
            {errorMessage}
          </p>
        )}

        {!isLoading && !errorMessage && (
          <MinistryHomeCalendar
            events={calendarEvents}
            onEventSelect={setSelectedEvent}
          />
        )}

        <div className="mt-10">
          {!isLoading && !errorMessage && (
            <h2 className="mb-5 century-font text-2xl text-gray-950">
              My Ministries
            </h2>
          )}
          {!isLoading && !errorMessage && ministries.length === 0 && (
            <div className="rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              You do not have access to any ministries yet.
              {isManagedProfile && actor && (
                <button
                  type="button"
                  onClick={returnToGuardian}
                  className="mx-auto mt-4 block rounded-xl border border-[#d8c7b8] px-4 py-2 text-sm font-semibold text-[#6f4f34]"
                >
                  Return to {actor.firstName} {actor.lastName}
                </button>
              )}
            </div>
          )}

          {!isLoading && ministries.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ministries.map((ministry) => (
                <Link
                  key={ministry.id}
                  to={`/ministry/${ministry.slug}`}
                  className="flex min-h-56 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#C1A387] hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h2 className="century-font text-2xl text-[#896542]">
                      {ministry.name}
                    </h2>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs uppercase text-gray-500">
                      {ministry.status}
                    </span>
                  </div>
                  <p className="flex-grow text-sm leading-relaxed text-gray-600">
                    {ministry.description ||
                      "No description has been added yet."}
                  </p>
                  <div className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-500">
                    <p className="font-semibold text-[#896542]">
                      {accessLabels[ministry.accessLevel] ||
                        ministry.accessLevel}
                    </p>
                    {ministry.canServe && (
                      <p className="font-semibold text-green-700">
                        Serving member
                      </p>
                    )}
                    <p>
                      {ministry.memberCount} serving{" "}
                      {ministry.memberCount === 1 ? "member" : "members"} ·{" "}
                      {ministry.templateCount}{" "}
                      {ministry.templateCount === 1 ? "template" : "templates"}
                    </p>
                  </div>
                  <span className="mt-4 text-sm font-semibold text-[#896542]">
                    Open ministry →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <MinistryEventDetails
          event={selectedEvent}
          ministryName={selectedEvent?.coordinator_ministry_name || "Ministry"}
          onClose={() => setSelectedEvent(null)}
        />
      </section>
    </Layout>
  )
}

const MinistryHomePage = ({ location }) => (
  <MinistryRouteGuard location={location}>
    <MinistryHomeContent />
  </MinistryRouteGuard>
)

const MinistryHome = () => (
  <BrowserLocation component={MinistryHomePage} />
)

export default MinistryHome
