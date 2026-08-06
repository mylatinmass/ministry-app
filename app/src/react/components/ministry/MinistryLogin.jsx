import * as React from "react"
import { Link } from "../../compat/gatsby"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"

const MINISTRY_SESSION_KEY = "ministry_jwt"

const MinistryLogin = ({ onLoginSuccess, passwordOnly = false }) => {
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [linkMessage, setLinkMessage] = React.useState("")
  const [isSendingLink, setIsSendingLink] = React.useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage("")
    setIsSubmitting(true)

    try {
      const response = await fetch(getFunctionEndpoint("ministry-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Invalid credentials")
      }

      window.sessionStorage.setItem(MINISTRY_SESSION_KEY, result.token)
      window.sessionStorage.removeItem("ministry_visible_profile_ids")
      onLoginSuccess(result.user)
    } catch (error) {
      setErrorMessage(
        error.message || "Invalid credentials, please contact your administrator"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLinkRequest = async (event) => {
    event.preventDefault()
    setErrorMessage("")
    setLinkMessage("")
    setIsSendingLink(true)
    try {
      const response = await fetch(getFunctionEndpoint("ministry-login-link"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to send sign-in link")
      setLinkMessage(result.message)
    } catch (error) {
      setErrorMessage(error.message || "Unable to send sign-in link")
    } finally {
      setIsSendingLink(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white p-5">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="century-font text-3xl text-[#C1A387]">
          Ministries Login
        </h1>
        <p className="text-center text-sm text-gray-500">
          Enter your username or email and password.
        </p>
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        <label className="w-full">
          <span className="mb-1 block text-sm text-gray-600">Username or email</span>
          <input
            type="text"
            autoComplete="username"
            className="h-12 w-full rounded border p-3"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label className="w-full">
          <span className="mb-1 block text-sm text-gray-600">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            className="h-12 w-full rounded border p-3"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#9b826b] px-5 py-2 text-white duration-200 ease-in-out hover:bg-[#826b55] disabled:cursor-wait disabled:opacity-60"
        >
          {isSubmitting ? "CHECKING..." : "LOGIN WITH PASSWORD"}
        </button>
        </form>
        {!passwordOnly && (
          <>
            <div className="flex w-full items-center gap-3 text-xs uppercase tracking-wider text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />or<span className="h-px flex-1 bg-gray-200" />
            </div>
            <form onSubmit={handleLinkRequest} className="flex w-full flex-col gap-4">
              <p className="text-center text-sm text-gray-500">
                Members and registered volunteers may receive a private, one-time sign-in link. Super Admin and Owner accounts must use a password.
              </p>
              <label className="w-full">
                <span className="mb-1 block text-sm text-gray-600">Email</span>
                <input type="email" autoComplete="email" className="h-12 w-full rounded border p-3" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <button type="submit" disabled={isSendingLink} className="rounded-lg border border-[#9b826b] px-5 py-2 text-[#6f4f34] duration-200 hover:bg-[#faf8f5] disabled:cursor-wait disabled:opacity-60">
                {isSendingLink ? "SENDING..." : "EMAIL ME A SIGN-IN LINK"}
              </button>
              {linkMessage && <p role="status" className="text-center text-sm text-green-700">{linkMessage}</p>}
            </form>
          </>
        )}
        <div role="alert" className="min-h-5 text-center text-sm leading-tight text-red-600">{errorMessage}</div>
        {!passwordOnly && (
          <p className="text-center text-sm text-gray-500">
            Not registered?{" "}
            <Link className="font-semibold text-[#896542] underline" to="/access-request">
              Request access
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  )
}

export { MINISTRY_SESSION_KEY }
export default MinistryLogin
