const crypto = require("crypto")

const hashVolunteerInvitationToken = (token = "") =>
  crypto.createHash("sha256").update(token.toString()).digest("hex")

module.exports = { hashVolunteerInvitationToken }
