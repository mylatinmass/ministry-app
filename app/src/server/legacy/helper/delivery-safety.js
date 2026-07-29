const assertLiveDeliveryAllowed = () => {
  if (
    process.env.VERCEL_ENV !== "production" &&
    process.env.ALLOW_PREVIEW_DELIVERY !== "true"
  ) {
    throw new Error("Outbound notification delivery is disabled outside production")
  }
}

module.exports = { assertLiveDeliveryAllowed }
