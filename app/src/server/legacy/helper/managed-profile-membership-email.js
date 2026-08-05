const nodemailer = require("nodemailer")
const { assertLiveDeliveryAllowed } = require("./delivery-safety")
const { getInvitationOrigin } = (() => {
  const getInvitationOrigin = (event = {}) => {
    const configured = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL
    if (configured) return configured.replace(/\/$/, "")
    const headers = event.headers || {}
    const host = headers["x-forwarded-host"] || headers.host
    const protocol = headers["x-forwarded-proto"] || "https"
    return host ? `${protocol}://${host}` : "https://mylatinmass.com"
  }
  return { getInvitationOrigin }
})()

const escapeHtml = (value = "") =>
  value.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")

const buildMembershipRequestUrl = (event, token, intent) => {
  const url = new URL("/membership-request", getInvitationOrigin(event))
  const fragment = new URLSearchParams({ token, intent })
  url.hash = fragment.toString()
  return url.toString()
}

const sendMembershipRequestEmail = async ({
  email,
  reviewerFirstName,
  childName,
  guardianName,
  ministryName,
  acceptUrl,
  declineUrl,
  expiresAt,
}) => {
  assertLiveDeliveryAllowed()
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error("Membership request email is not configured")
  }
  const expiration = new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric",
  }).format(new Date(expiresAt))
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
  return transporter.sendMail({
    from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
    replyTo: process.env.GMAIL_USER,
    to: email,
    subject: `${childName} requested to join ${ministryName}`,
    text: [
      `Hello ${reviewerFirstName || "Ministry Leader"},`, "",
      `${guardianName} requested ministry membership for ${childName}.`,
      `Ministry: ${ministryName}`, "",
      `Accept: ${acceptUrl}`, `Decline: ${declineUrl}`, "",
      `Only the first response will be recorded. These links expire ${expiration}.`,
    ].join("\n"),
    html: `<p>Hello ${escapeHtml(reviewerFirstName || "Ministry Leader")},</p><p>${escapeHtml(guardianName)} requested ministry membership for <strong>${escapeHtml(childName)}</strong>.</p><p><strong>Ministry:</strong> ${escapeHtml(ministryName)}</p><p><a href="${escapeHtml(acceptUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#896542;color:#fff;text-decoration:none;font-weight:700;">Review and accept</a> <a href="${escapeHtml(declineUrl)}" style="display:inline-block;padding:11px 18px;border:1px solid #9ca3af;border-radius:8px;color:#4b5563;text-decoration:none;font-weight:700;">Review and decline</a></p><p>Only the first response will be recorded. These private links expire ${escapeHtml(expiration)}.</p>`,
  })
}

module.exports = { buildMembershipRequestUrl, sendMembershipRequestEmail }
