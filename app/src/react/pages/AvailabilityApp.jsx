import * as React from "react"
import BrowserLocation from "./BrowserLocation"
import MinistryRouteGuard from "../components/ministry/MinistryRouteGuard"

const AvailabilityRedirect = () => {
  React.useEffect(() => {
    window.location.replace("/ministry?section=availability")
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-gray-500">Opening Ministry workspace...</p>
    </div>
  )
}

const AvailabilityPage = ({ location }) => (
  <MinistryRouteGuard location={location}>
    <AvailabilityRedirect />
  </MinistryRouteGuard>
)

const AvailabilityApp = () => (
  <BrowserLocation component={AvailabilityPage} />
)

export default AvailabilityApp
