import * as React from "react"
import { Helmet } from "react-helmet"
import Seo from "../../components/Seo"
import BrowserLocation from "../BrowserLocation"
import { MINISTRY_SESSION_KEY } from "../../components/ministry/MinistryLogin"
import MinistryRouteGuard from "../../components/ministry/MinistryRouteGuard"
import MinistryWorkspace from "../../components/ministry/MinistryWorkspace"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"

const MinistryPageContent = ({ slug: slugProp, params = {}, location = {} }) => {
  const slug =
    slugProp ||
    params?.slug ||
    location?.pathname?.split("/").filter(Boolean).at(-1) ||
    ""
  const [data, setData] = React.useState(null)
  const [errorMessage, setErrorMessage] = React.useState("")

  React.useEffect(() => {
    if (!slug) return undefined

    const controller = new AbortController()
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const endpoint = new URL(
      getFunctionEndpoint("ministry-detail"),
      window.location.origin,
    )
    endpoint.searchParams.set("slug", slug)

    fetch(endpoint.toString(), {
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
          throw new Error(result.message || "Unable to load ministry")
        }

        return result
      })
      .then(setData)
      .catch((error) => {
        if (error.name !== "AbortError") setErrorMessage(error.message)
      })

    return () => controller.abort()
  }, [slug])

  return (
    <div className="min-h-screen w-full bg-white">
      <Helmet>
        <html lang="en" />
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Helmet>
      <Seo
        title={`${data?.ministry?.name || "Ministry"} | MyLatinMass.com`}
        description="Ministry scheduling and project management workspace."
      />
      {errorMessage ? (
        <div className="flex min-h-[60vh] items-center justify-center bg-white p-5">
          <div className="max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <h1 className="century-font text-2xl text-[#896542]">
              Unable to open ministry
            </h1>
            <p className="mt-3 text-gray-600">{errorMessage}</p>
          </div>
        </div>
      ) : data ? (
        <MinistryWorkspace data={data} />
      ) : (
        <div className="flex min-h-[60vh] items-center justify-center bg-white">
          <p className="text-gray-500">Loading ministry workspace...</p>
        </div>
      )}
    </div>
  )
}

const GuardedMinistryPage = ({ location, slug }) => (
  <MinistryRouteGuard location={location}>
    <MinistryPageContent location={location} slug={slug} />
  </MinistryRouteGuard>
)

const MinistryPage = ({ slug }) => (
  <BrowserLocation component={GuardedMinistryPage} slug={slug} />
)

export default MinistryPage
