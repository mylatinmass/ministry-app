const KLAVIYO_REVISION = "2026-07-15"
const REMINDER_METRIC = "Ministry Assignment Reminder Due"

const normalizePhone = (value: unknown) => {
  const raw = String(value || "").trim()
  const digits = raw.replace(/\D/g, "")
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`
  }
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return ""
}

const localStart = (value: string | Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value))

export const sendKlaviyoReminderDue = async (context: any) => {
  const apiKey = (process.env.KLAVIYO_PRIVATE_API_KEY || "").trim()
  if (!apiKey) {
    throw Object.assign(new Error("Klaviyo is not configured"), {
      code: "klaviyo_not_configured",
    })
  }

  const phoneNumber = normalizePhone(context.recipient_phone)
  if (!phoneNumber) {
    throw Object.assign(new Error("The recipient telephone number is invalid"), {
      code: "invalid_phone_number",
    })
  }

  const assignmentUrl = `https://ministry.mylatinmass.com/${context.ministry_slug}?event=${context.event_id}`
  const startsAt = new Date(context.start_time).toISOString()
  const response = await fetch("https://a.klaviyo.com/api/events", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify({
      data: {
        type: "event",
        attributes: {
          properties: {
            starts_at: startsAt,
            starts_at_local: localStart(context.start_time),
            time_zone: "America/New_York",
            assignment_url: assignmentUrl,
            notification_text: `Reminder: your ministry assignment begins ${localStart(
              context.start_time,
            )}.`,
          },
          time: new Date().toISOString(),
          unique_id: context.id,
          metric: {
            data: {
              type: "metric",
              attributes: { name: REMINDER_METRIC },
            },
          },
          profile: {
            data: {
              type: "profile",
              attributes: {
                phone_number: phoneNumber,
              },
            },
          },
        },
      },
    }),
  })

  if (response.status !== 202) {
    const result: any = await response.json().catch(() => ({}))
    const detail = result?.errors?.[0]?.detail || `Klaviyo returned ${response.status}`
    throw Object.assign(new Error(detail), {
      code: result?.errors?.[0]?.code || "klaviyo_event_rejected",
      status: response.status,
    })
  }

  return { status: response.status, metric: REMINDER_METRIC }
}

export { REMINDER_METRIC }
