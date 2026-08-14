import * as React from "react"
import { Helmet } from "react-helmet"
import Seo from "../../components/Seo"
import BrowserLocation from "../BrowserLocation"
import { MINISTRY_SESSION_KEY } from "../../components/ministry/MinistryLogin"
import MinistryHomeWorkspace from "../../components/ministry/MinistryHomeWorkspace"
import MinistryRouteGuard from "../../components/ministry/MinistryRouteGuard"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"

const MinistryHomeContent = () => {
  const [data, setData] = React.useState(null)
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
      .then(setData)
      .catch((error) => {
        if (error.name !== "AbortError") {
          setErrorMessage(error.message)
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [])

  return (
    <div className="min-h-screen w-full bg-white">
      <Helmet>
        <html lang="en" />
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Helmet>
      <Seo
        title="Ministries | MyLatinMass.com"
        description="Ministry project management for Our Lady of Victory Chapel."
      />
      {errorMessage ? (
        <div className="flex min-h-[60vh] items-center justify-center bg-white p-5">
          <div className="max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <h1 className="century-font text-2xl text-[#896542]">
              Unable to open Ministry
            </h1>
            <p className="mt-3 text-gray-600">{errorMessage}</p>
          </div>
        </div>
      ) : data ? (
        <MinistryHomeWorkspace
          data={{
            ...data,
            actor: data.actor || data.user,
            ministries: data.ministries || [],
            calendarEvents: data.calendarEvents || [],
          }}
        />
      ) : (
        <div className="flex min-h-screen items-center justify-center bg-white">
          <p className="text-gray-500">
            {isLoading ? "Loading Ministry workspace..." : "Loading..."}
          </p>
        </div>
      )}
    </div>
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
