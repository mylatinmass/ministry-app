import nodemailer from "nodemailer"
import { getAuthenticatedIdentity } from "./ministry-identity"
import { json } from "./request"

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
const CATEGORIES: Record<string, string> = {
  problem: "Problem report",
  question: "Question",
  suggestion: "Suggestion",
  access: "Account or access help",
  other: "Other",
}

const cleanText = (value: unknown, maximum: number) =>
  value?.toString().replace(/\0/g, "").trim().slice(0, maximum) || ""

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character)

const safeFilename = (value: unknown, index: number) => {
  const normalized = cleanText(value, 120)
    .replace(/[\\/:*?"<>|\r\n]/g, "_")
    .replace(/^\.+/, "")
  return normalized || `attachment-${index + 1}`
}

const deliveryAllowed = () =>
  process.env.VERCEL_ENV === "production" ||
  process.env.ALLOW_PREVIEW_DELIVERY === "true"

export const handleSupport = async (request: Request) => {
  if (request.method !== "POST") return json({ message: "Method not allowed" }, 405)

  try {
    const identity: any = await getAuthenticatedIdentity(request)
    const body: any = await request.json().catch(() => null)
    if (!body) return json({ message: "Invalid request" }, 400)

    const category = cleanText(body.category, 30)
    const subject = cleanText(body.subject, 160)
    const message = cleanText(body.message, 5000)
    const ministryName = cleanText(body.ministryName, 160)
    const pageUrl = cleanText(body.pageUrl, 1000)
    const userAgent = cleanText(body.userAgent, 500)
    if (!CATEGORIES[category] || !subject || !message) {
      return json({ message: "Request type, subject, and details are required" }, 400)
    }

    const recipients = (process.env.SUPPORT_RECIPIENTS || process.env.GMAIL_USER || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    if (!recipients.length) {
      return json({ message: "The support recipient list is not configured" }, 503)
    }
    if (!deliveryAllowed()) {
      return json({ message: "Support email delivery is disabled in this environment" }, 503)
    }

    const sourceAttachments = Array.isArray(body.attachments) ? body.attachments : []
    if (sourceAttachments.length > MAX_FILES) {
      return json({ message: `You may attach up to ${MAX_FILES} files` }, 400)
    }

    let totalBytes = 0
    const attachments = sourceAttachments.map((attachment: any, index: number) => {
      const contentType = cleanText(attachment?.type, 100).toLowerCase()
      const contentBase64 = cleanText(attachment?.contentBase64, 2_100_000)
      if (!ACCEPTED_TYPES.has(contentType) || !/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64)) {
        throw Object.assign(new Error("An attachment has an unsupported type or invalid content"), { status: 400 })
      }
      const content = Buffer.from(contentBase64, "base64")
      if (!content.length || content.length > MAX_FILE_BYTES) {
        throw Object.assign(new Error("Each attachment must be no larger than 1.5 MB"), { status: 400 })
      }
      totalBytes += content.length
      return {
        filename: safeFilename(attachment?.name, index),
        content,
        contentType,
      }
    })
    if (totalBytes > MAX_TOTAL_BYTES) {
      return json({ message: "Attachments may total no more than 3 MB" }, 400)
    }

    const smtpUser = process.env.GMAIL_USER
    const smtpPass = process.env.GMAIL_PASS
    if (!smtpUser || !smtpPass) {
      return json({ message: "Support email delivery is not configured" }, 503)
    }

    const actor = identity.actor || identity.user
    const activeProfile = identity.user || actor
    const actorName = [actor?.first_name, actor?.last_name].filter(Boolean).join(" ") || actor?.username || "Unknown user"
    const profileName = [activeProfile?.first_name, activeProfile?.last_name].filter(Boolean).join(" ") || activeProfile?.username || actorName
    const replyTo = cleanText(actor?.email || activeProfile?.email, 320)
    const receivedAt = new Date().toISOString()
    const text = [
      `${CATEGORIES[category]}: ${subject}`,
      "",
      message,
      "",
      `Submitted by: ${actorName}`,
      `Active profile: ${profileName}`,
      `Account email: ${replyTo || "Not available"}`,
      `Ministry context: ${ministryName || "My Ministry home"}`,
      `Page: ${pageUrl || "Not available"}`,
      `Received: ${receivedAt}`,
      `Browser: ${userAgent || "Not available"}`,
      `Attachments: ${attachments.length}`,
    ].join("\n")
    const html = `
      <h2>${escapeHtml(CATEGORIES[category])}: ${escapeHtml(subject)}</h2>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      <hr />
      <p><strong>Submitted by:</strong> ${escapeHtml(actorName)}</p>
      <p><strong>Active profile:</strong> ${escapeHtml(profileName)}</p>
      <p><strong>Account email:</strong> ${escapeHtml(replyTo || "Not available")}</p>
      <p><strong>Ministry context:</strong> ${escapeHtml(ministryName || "My Ministry home")}</p>
      <p><strong>Page:</strong> ${escapeHtml(pageUrl || "Not available")}</p>
      <p><strong>Received:</strong> ${escapeHtml(receivedAt)}</p>
      <p><strong>Browser:</strong> ${escapeHtml(userAgent || "Not available")}</p>
      <p><strong>Attachments:</strong> ${attachments.length}</p>
    `

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
    })
    const result = await transporter.sendMail({
      from: `Ministry App Support <${smtpUser}>`,
      to: recipients,
      ...(replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) ? { replyTo } : {}),
      subject: `[Ministry Support] ${CATEGORIES[category]}: ${subject}`,
      text,
      html,
      attachments,
    })

    if (!result.messageId) throw new Error("The email provider did not confirm delivery")
    return json({ message: "Your support request was sent to the chapel support team." })
  } catch (error: any) {
    const status = error?.status || (/session|token|inactive/i.test(error?.message) ? 401 : 500)
    if (status === 500) console.error("Unable to send Ministry support request:", error)
    return json({ message: error?.message || "Unable to send support request" }, status)
  }
}
