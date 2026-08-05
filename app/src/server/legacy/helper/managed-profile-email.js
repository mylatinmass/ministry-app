const nodemailer = require("nodemailer")
const { assertLiveDeliveryAllowed } = require("./delivery-safety")

const escapeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

const getSiteOrigin = (event) => {
  const configured = process.env.SITE_URL?.replace(/\/$/, "")
  if (configured) return configured
  const proto = event.headers?.["x-forwarded-proto"] || "https"
  const host = event.headers?.host
  if (!host) throw new Error("Unable to create profile activation link")
  return `${proto}://${host}`
}

const buildSeparationUrl = (event, token) =>
  `${getSiteOrigin(event)}/profile-separate#token=${encodeURIComponent(token)}`

const sendProfileSeparationEmail = async ({ email, firstName, activationUrl }) => {
  assertLiveDeliveryAllowed()
  const user = process.env.GMAIL_USER
  const password = process.env.GMAIL_PASS
  if (!user || !password) {
    throw new Error("Profile activation email is not configured")
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: password },
  })

  await transporter.sendMail({
    from: `MyLatinMass.com <${user}>`,
    to: email,
    subject: "Activate your independent ministry account",
    text: `Hello ${firstName},\n\nUse this private link to activate your independent ministry account. Your existing ministries, assignments, availability, and service history will remain with you.\n\n${activationUrl}\n\nThis link expires in 7 days.`,
    html: `<p>Hello ${escapeHtml(firstName)},</p><p>Use the private link below to activate your independent ministry account. Your existing ministries, assignments, availability, and service history will remain with you.</p><p><a href="${escapeHtml(activationUrl)}">Activate my account</a></p><p>This link expires in 7 days.</p>`,
  })
}

module.exports = { buildSeparationUrl, sendProfileSeparationEmail }
