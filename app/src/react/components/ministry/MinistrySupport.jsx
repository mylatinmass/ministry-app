import * as React from "react"
import {
  CheckCircleIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"

const MAX_FILES = 3
const MAX_FILE_BYTES = 1.5 * 1024 * 1024
const MAX_TOTAL_BYTES = 3 * 1024 * 1024
const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
])

const categories = [
  ["problem", "Report a problem"],
  ["question", "Ask a question"],
  ["suggestion", "Share a suggestion"],
  ["access", "Account or access help"],
  ["other", "Other"],
]

const fileToAttachment = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || "")
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        contentBase64: value.includes(",") ? value.split(",", 2)[1] : "",
      })
    }
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`))
    reader.readAsDataURL(file)
  })

const MinistrySupport = ({ ministryName = "" }) => {
  const [category, setCategory] = React.useState("problem")
  const [subject, setSubject] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [files, setFiles] = React.useState([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [successMessage, setSuccessMessage] = React.useState("")

  const addFiles = (event) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ""
    setErrorMessage("")

    const combined = [...files, ...selected]
    if (combined.length > MAX_FILES) {
      setErrorMessage(`You may attach up to ${MAX_FILES} files.`)
      return
    }
    const invalid = selected.find(
      (file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES,
    )
    if (invalid) {
      setErrorMessage(
        `${invalid.name} is not an accepted image, PDF, or text file, or is larger than 1.5 MB.`,
      )
      return
    }
    if (combined.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
      setErrorMessage("Attachments may total no more than 3 MB.")
      return
    }
    setFiles(combined)
  }

  const removeFile = (index) =>
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))

  const submit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const attachments = await Promise.all(files.map(fileToAttachment))
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("support"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          subject,
          message,
          ministryName,
          pageUrl: window.location.href,
          userAgent: window.navigator.userAgent,
          attachments,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to send support request")

      setSubject("")
      setMessage("")
      setFiles([])
      setSuccessMessage(result.message || "Your support request was sent.")
    } catch (error) {
      setErrorMessage(error.message || "Unable to send support request")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
        Contact chapel support
      </p>
      <h2 className="mt-2 century-font text-3xl text-gray-950">How can we help?</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
        Send a question, suggestion, or problem report to the designated support team.
        Add screenshots or other supporting files when they help explain what happened.
      </p>

      {successMessage && (
        <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircleIcon className="mt-0.5 size-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-5">
        <label className="block text-sm font-semibold text-gray-700">
          Type of request
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal text-gray-900"
          >
            {categories.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          Subject
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            maxLength={160}
            placeholder="Briefly describe what you need"
            className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal text-gray-900"
          />
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          Details
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            maxLength={5000}
            rows={8}
            placeholder="Tell us what happened, what you expected, and any steps that may help us reproduce the problem."
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal text-gray-900"
          />
          <span className="mt-1 block text-right text-xs font-normal text-gray-400">
            {message.length}/5000
          </span>
        </label>

        <div>
          <p className="text-sm font-semibold text-gray-700">Attachments</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Up to 3 PNG, JPG, WebP, GIF, PDF, or text files; 1.5 MB each and 3 MB total.
            Remove private information from screenshots before attaching them.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8c7b8] px-4 py-2.5 text-sm font-semibold text-[#6f4f34] hover:bg-[#f7f3ef]">
            <PaperClipIcon className="size-5" />
            Add images or files
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
              onChange={addFiles}
              className="sr-only"
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.lastModified}`} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <PaperClipIcon className="size-4 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">{Math.ceil(file.size / 1024)} KB</span>
                  <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`} className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-red-600">
                    <XMarkIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-[#896542] px-5 py-3 font-semibold text-white hover:bg-[#6f4f34] disabled:cursor-wait disabled:opacity-60"
        >
          <PaperAirplaneIcon className="size-5" />
          {isSubmitting ? "Sending..." : "Send support request"}
        </button>
      </form>
    </section>
  )
}

export default MinistrySupport
