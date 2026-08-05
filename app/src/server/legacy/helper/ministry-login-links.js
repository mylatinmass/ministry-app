const crypto = require("crypto")
const nodemailer = require("nodemailer")
const { assertLiveDeliveryAllowed } = require("./delivery-safety")
const getLoginOrigin = (event) => {
  const configured = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL
  if (configured) return configured.replace(/\/$/, "")
  const headers = event.headers || {}
  const host = headers["x-forwarded-host"] || headers.host
  const protocol = headers["x-forwarded-proto"] || "https"
  return host ? `${protocol}://${host}` : "https://mylatinmass.com"
}

const LOGIN_LINK_LIFETIME_MINUTES = 15
const createLoginLinkToken = () => crypto.randomBytes(32).toString("base64url")
const hashLoginLinkToken = (token = "") =>
  crypto.createHash("sha256").update(token.toString()).digest("hex")

const buildLoginLinkUrl = (event, token) => {
  const url = new URL("/login-link", getLoginOrigin(event))
  url.hash = new URLSearchParams({ token }).toString()
  return url.toString()
}

const sendMinistryLoginLinkEmail = async ({ email, loginUrl, expiresAt }) => {
  assertLiveDeliveryAllowed()
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error("Login email is not configured")
  }
  const expiration = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(expiresAt))
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
  return transporter.sendMail({
    from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
    replyTo: process.env.GMAIL_USER,
    to: email,
    subject: "Your Ministry sign-in link",
    text: [
      "Use this private, one-time link to sign in to Ministries:",
      loginUrl,
      "",
      `The link expires at ${expiration}.`,
      "For security, membership approvals and access changes still require your username and password.",
      "If you did not request this link, you can ignore this email.",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;border:1px solid #e5e7eb"><h1 style="color:#6f4f34">Ministries sign-in</h1><p>Use this private, one-time link to sign in:</p><p style="margin:26px 0"><a href="${loginUrl}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#896542;color:#fff;text-decoration:none;font-weight:700">Sign in to Ministries</a></p><p style="color:#6b7280">This link expires at ${expiration}. Membership approvals and access changes still require your username and password.</p><p style="color:#6b7280">If you did not request this link, you can ignore this email.</p></div>`,
  })
}

module.exports = {
  LOGIN_LINK_LIFETIME_MINUTES,
  buildLoginLinkUrl,
  createLoginLinkToken,
  hashLoginLinkToken,
  sendMinistryLoginLinkEmail,
}
