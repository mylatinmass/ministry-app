import * as React from "react"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import MinistryLogin, { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const isMinistryPath = (pathname = "") =>
  ["/ministry", "/ministries"].some(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  )

const MinistryRouteGuard = ({ children, location }) => {
  const protectedRoute = isMinistryPath(location?.pathname)
  const [status, setStatus] = React.useState(
    protectedRoute ? "checking" : "authenticated"
  )

  React.useEffect(() => {
    const handleSessionExpired = () => {
      window.sessionStorage.removeItem(MINISTRY_SESSION_KEY)
      window.sessionStorage.removeItem("ministry_visible_profile_ids")
      setStatus("unauthenticated")
    }

    window.addEventListener("ministry-session-expired", handleSessionExpired)
    return () =>
      window.removeEventListener(
        "ministry-session-expired",
        handleSessionExpired
      )
  }, [])

  React.useEffect(() => {
    if (!protectedRoute) {
      setStatus("authenticated")
      return
    }

    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)

    if (!token) {
      setStatus("unauthenticated")
      return
    }

    setStatus("checking")
    fetch(getFunctionEndpoint("ministry-session"), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Session expired")
        return response.json()
      })
      .then((result) => {
        if (!result.valid) throw new Error("Session expired")
        setStatus("authenticated")
      })
      .catch(() => {
        window.sessionStorage.removeItem(MINISTRY_SESSION_KEY)
        window.sessionStorage.removeItem("ministry_visible_profile_ids")
        setStatus("unauthenticated")
      })
  }, [protectedRoute, location?.pathname])

  if (!protectedRoute || status === "authenticated") {
    return children
  }

  if (status === "unauthenticated") {
    return <MinistryLogin onLoginSuccess={() => setStatus("authenticated")} />
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <p className="text-gray-500">Checking ministry session...</p>
    </div>
  )
}

export { isMinistryPath }
export default MinistryRouteGuard
