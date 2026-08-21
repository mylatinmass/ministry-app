const nodemailer = require("nodemailer")

const escapeHtml = (value = "") =>
  value.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")

const sendChildApplicationEmail = async ({
  email,
  reviewerFirstName,
  childName,
  guardianName,
}) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error("Member application email is not configured")
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
  return transporter.sendMail({
    from: `"My Latin Mass" <${process.env.GMAIL_USER}>`,
    replyTo: process.env.GMAIL_USER,
    to: email,
    subject: `${guardianName} asked to add child ${childName}`,
    text: [
      `Hello ${reviewerFirstName || "Super Admin"},`,
      "",
      `${guardianName} is asking to add ${childName}, their child, as a new member of the Ministry app.`,
      "Review this request under Members → Pending member approvals.",
    ].join("\n"),
    html: `<p>Hello ${escapeHtml(reviewerFirstName || "Super Admin")},</p><p><strong>${escapeHtml(guardianName)}</strong> is asking to add <strong>${escapeHtml(childName)}</strong>, their child, as a new member of the Ministry app.</p><p>Review this request under <strong>Members → Pending member approvals</strong>.</p>`,
  })
}

module.exports = { sendChildApplicationEmail }
