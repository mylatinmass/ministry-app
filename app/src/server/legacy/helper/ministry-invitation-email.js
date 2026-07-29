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

const buildMinistryInvitationEmail = ({
  ministries,
  acceptUrl,
  declineUrl,
  expiresAt,
}) => {
  const ministryNames = ministries.map((ministry) => ministry.name)
  const subject = `Invitation to join ${
    ministryNames.length === 1
      ? ministryNames[0]
      : `${ministryNames.length} ministries`
  }`
  const ministryRows = ministryNames
    .map(
      (name) =>
        `<li style="margin: 8px 0; color: #374151;">${escapeHtml(name)}</li>`
    )
    .join("")
  const expiration = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(expiresAt))

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 28px; border: 1px solid #e5e7eb; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://mylatinmass.com/my-latin-mass.png" alt="My Latin Mass" style="max-width: 100px; height: auto;">
      </div>
      <h1 style="margin: 0; color: #6f4f34; font-size: 28px; line-height: 1.25;">You are invited to serve</h1>
      <p style="margin: 18px 0 8px; color: #374151; font-size: 16px; line-height: 1.65;">
        You have been invited to join the following ${
          ministryNames.length === 1 ? "ministry" : "ministries"
        } at Our Lady of Victory Chapel:
      </p>
      <ul style="margin: 14px 0 24px; padding-left: 24px; font-size: 16px;">${ministryRows}</ul>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
        <tr>
          <td align="center" style="padding: 6px;">
            <a href="${escapeHtml(acceptUrl)}" style="display: inline-block; min-width: 150px; padding: 13px 20px; border-radius: 8px; background: #896542; color: #ffffff; font-weight: 700; text-decoration: none;">Accept invitation</a>
          </td>
          <td align="center" style="padding: 6px;">
            <a href="${escapeHtml(declineUrl)}" style="display: inline-block; min-width: 150px; padding: 12px 20px; border: 1px solid #9ca3af; border-radius: 8px; background: #ffffff; color: #4b5563; font-weight: 700; text-decoration: none;">Decline</a>
          </td>
        </tr>
      </table>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        This private invitation expires on ${escapeHtml(
          expiration
        )}. It can be answered only once. If you accept and do not yet have a ministry account, you will be asked to create one.
      </p>
      <p style="margin-top: 30px; color: #374151; font-size: 15px;">— My Latin Mass</p>
    </div>
  `

  const text = [
    "You are invited to serve",
    "",
    `You have been invited to join the following ${
      ministryNames.length === 1 ? "ministry" : "ministries"
    } at Our Lady of Victory Chapel:`,
    ...ministryNames.map((name) => `- ${name}`),
    "",
    `Accept: ${acceptUrl}`,
    `Decline: ${declineUrl}`,
    "",
    `This private invitation expires on ${expiration} and can be answered only once.`,
    "",
    "— My Latin Mass",
  ].join("\n")

  return { subject, html, text }
}

const sendMinistryInvitationEmail = async (options) => {
  assertLiveDeliveryAllowed()
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error("Invitation email is not configured")
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
  const message = buildMinistryInvitationEmail(options)

  return transporter.sendMail({
    from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
    replyTo: process.env.GMAIL_USER,
    to: options.email,
    ...message,
  })
}

module.exports = {
  buildMinistryInvitationEmail,
  sendMinistryInvitationEmail,
}
