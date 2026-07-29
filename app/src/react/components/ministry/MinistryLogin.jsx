import * as React from "react"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"

const MINISTRY_SESSION_KEY = "ministry_jwt"

const MinistryLogin = ({ onLoginSuccess }) => {
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white p-5">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col items-center gap-5 rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="century-font text-3xl text-[#C1A387]">
          Ministries Login
        </h1>
        <p className="text-center text-sm text-gray-500">
          Enter your ministry username and password.
        </p>
        <label className="w-full">
          <span className="mb-1 block text-sm text-gray-600">Username</span>
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
        <div
          role="alert"
          className="min-h-5 text-center text-sm leading-tight text-red-600"
        >
          {errorMessage}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#9b826b] px-5 py-2 text-white duration-200 ease-in-out hover:bg-[#826b55] disabled:cursor-wait disabled:opacity-60"
        >
          {isSubmitting ? "CHECKING..." : "LOGIN"}
        </button>
        <p className="text-center text-sm text-gray-500">
          To request ministry access, email{" "}
          <a
            className="text-[#896542] underline"
            href="mailto:mylatinmass@gmail.com"
          >
            mylatinmass@gmail.com
          </a>
          .
        </p>
      </form>
    </div>
  )
}

export { MINISTRY_SESSION_KEY }
export default MinistryLogin
