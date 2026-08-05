const assertLiveDeliveryAllowed = (specificOverride) => {
  if (
    process.env.VERCEL_ENV !== "production" &&
    process.env.ALLOW_PREVIEW_DELIVERY !== "true" &&
    (!specificOverride || process.env[specificOverride] !== "true")
  ) {
    throw new Error("Outbound notification delivery is disabled outside production")
  }
}

module.exports = { assertLiveDeliveryAllowed }
