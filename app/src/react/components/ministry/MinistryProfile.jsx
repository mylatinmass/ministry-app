import * as React from "react"
import { Link } from "../../compat/gatsby"
import {
  BellAlertIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  MoonIcon,
  Squares2X2Icon,
  SunIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import PushNotifications from "./PushNotifications"
import TelegramNotifications from "./TelegramNotifications"
import { applyMinistryTheme } from "../../utils/ministryTheme"

const reminderOptions = [
  [15, "15 minutes"],
  [30, "30 minutes"],
  [45, "45 minutes"],
  [60, "1 hour"],
  [120, "2 hours"],
  [180, "3 hours"],
  [240, "4 hours"],
]

const notificationChannelOptions = [
  ["email", "Email", EnvelopeIcon],
  ["sms", "SMS", ChatBubbleOvalLeftEllipsisIcon],
  ["telegram", "Telegram", PaperAirplaneIcon],
  ["push", "Push notifications", DevicePhoneMobileIcon],
]

const notificationCategoryOptions = [
  ["reminders", "Assignment reminders", "Upcoming duties and confirmation deadlines."],
  ["scheduleChanges", "Schedule changes", "Assignments, publication, changes, cancellations, and substitutes."],
  ["announcements", "Announcements", "Messages sent by ministry leaders."],
  ["volunteerOpportunities", "Volunteer opportunities", "Open responsibilities that match your ministries."],
]

const membershipLabels = {
  owner: "Owner",
  admin: "Leader",
  member: "Member",
}

const profileSections = [
  ["account", "Account Details", UserCircleIcon],
  ["notifications", "Notifications", BellAlertIcon],
  ["ministries", "Ministries", Squares2X2Icon],
  ["profiles", "Profiles", UserGroupIcon],
]

const sectionDraft = (section, value) => {
  if (!value) return null
  if (section === "account") {
    return {
      firstName: value.firstName || "",
      lastName: value.lastName || "",
      email: value.email || "",
      phone: formatTelephone(value.phone),
      username: value.username || "",
      appearanceTheme: value.appearanceTheme || "light",
    }
  }
  if (section === "notifications") {
    return {
      notificationLeadMinutes: value.notificationLeadMinutes,
      notificationChannels: value.notificationChannels || {},
      notificationCategories: value.notificationCategories || {},
      smsTransactionalConsentAccepted: Boolean(
        value.smsTransactionalConsentAccepted,
      ),
    }
  }
  return null
}

const sectionHasChanges = (section, saved, draft) =>
  JSON.stringify(sectionDraft(section, saved)) !==
  JSON.stringify(sectionDraft(section, draft))

const ProfileSectionHeading = ({
  icon: Icon,
  title,
  subtitle,
  editing,
  changed,
  saving,
  onToggleEdit,
  onSave,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="rounded-lg bg-[#f4ede6] p-2 text-[#896542]">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h3 className="century-font text-xl text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleEdit}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8c7b8] px-3 py-2 text-xs font-semibold text-[#6f4f34] disabled:opacity-50"
      >
        {editing ? <XMarkIcon className="size-4" /> : <PencilSquareIcon className="size-4" />}
        {editing ? "Cancel" : "Edit"}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!editing || !changed || saving}
        className="rounded-lg bg-[#896542] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  </div>
)

const formatTelephone = (value) => {
  let digits = String(value || "").replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (!digits) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const normalizeEmailConnection = (value) =>
  String(value || "").trim().toLowerCase()

const normalizePhoneConnection = (value) => {
  let digits = String(value || "").replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1)
  return digits
}

const Field = ({ label, name, value, isEditing, onChange, type = "text" }) => (
  <label className="block">
    <span className="text-sm font-semibold text-gray-700">
      {label}
    </span>
    {isEditing ? (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        maxLength={type === "tel" ? 14 : undefined}
        autoComplete={type === "tel" ? "tel" : undefined}
        className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/10"
      />
    ) : (
      <p className="mt-1 min-h-6 break-words text-sm font-medium text-gray-900">
        {value || (
          <span className="font-normal text-gray-400">Not provided</span>
        )}
      </p>
    )}
  </label>
)

const MinistryProfile = ({ initialUser, onUserUpdate }) => {
  const [profile, setProfile] = React.useState(null)
  const [draft, setDraft] = React.useState(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [familyData, setFamilyData] = React.useState(null)
  const [showAddChild, setShowAddChild] = React.useState(false)
  const [childForm, setChildForm] = React.useState({ firstName: "", lastName: "" })
  const [requestMinistryId, setRequestMinistryId] = React.useState("")
  const [separationEmail, setSeparationEmail] = React.useState("")
  const [linkingChildId, setLinkingChildId] = React.useState("")
  const [guardianEmail, setGuardianEmail] = React.useState("")
  const [activeProfileSection, setActiveProfileSection] = React.useState("account")
  const [testingChannel, setTestingChannel] = React.useState("")
  const [channelTestMessage, setChannelTestMessage] = React.useState("")
  const pushNotificationsRef = React.useRef(null)
  const telegramNotificationsRef = React.useRef(null)

  const handleTelegramConnectionChange = React.useCallback((connected) => {
    const updateTelegramState = (current) =>
      current
        ? {
            ...current,
            telegramConnected: connected,
            notificationConnections: {
              ...current.notificationConnections,
              telegram: connected,
            },
            notificationChannels: connected
              ? current.notificationChannels
              : { ...current.notificationChannels, telegram: false },
          }
        : current
    setProfile(updateTelegramState)
    setDraft(updateTelegramState)
  }, [])

  const handlePushConnectionChange = React.useCallback((connected) => {
    const updatePushState = (current) =>
      current
        ? {
            ...current,
            notificationConnections: {
              ...current.notificationConnections,
              push: connected,
            },
            notificationChannels: connected
              ? current.notificationChannels
              : { ...current.notificationChannels, push: false },
          }
        : current
    setProfile(updatePushState)
    setDraft(updatePushState)
  }, [])

  const handleNotificationControllerMessage = React.useCallback((nextMessage) => {
    setChannelTestMessage(nextMessage)
  }, [])

  const loadFamily = React.useCallback(async () => {
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
    const response = await fetch(getFunctionEndpoint("ministry-profiles"), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || "Unable to load family profiles")
    setFamilyData(result)
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)

    fetch(getFunctionEndpoint("ministry-profile"), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.message || "Unable to load profile")
        return result.profile
      })
      .then((loadedProfile) => {
        setProfile(loadedProfile)
        setDraft(loadedProfile)
      })
      .catch((error) => {
        if (error.name !== "AbortError") setErrorMessage(error.message)
      })
      .finally(() => setIsLoading(false))

    loadFamily().catch(() => {})

    return () => controller.abort()
  }, [loadFamily])

  React.useEffect(() => {
    if (!profile?.isManagedProfile || !familyData) return
    const activeManagedProfile = familyData.profiles.find(
      (item) => item.id === profile.id && !item.isGuardian,
    )
    if (activeManagedProfile?.relationshipStatus === "separation_pending") {
      setSeparationEmail(activeManagedProfile.separationEmail || "")
    }
  }, [familyData, profile?.id, profile?.isManagedProfile])

  const runFamilyAction = async (body) => {
    setIsSaving(true)
    setMessage("")
    setErrorMessage("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("ministry-profiles"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to update profiles")
      setMessage(result.message)
      await loadFamily()
      window.dispatchEvent(new Event("ministry-profiles-updated"))
      return true
    } catch (error) {
      setErrorMessage(error.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const addChild = async (event) => {
    event.preventDefault()
    const saved = await runFamilyAction({ action: "create_child", ...childForm })
    if (saved) {
      setChildForm({ firstName: "", lastName: "" })
      setShowAddChild(false)
    }
  }

  const cancelSeparation = async () => {
    const confirmed = window.confirm(
      "Cancel this independent account activation? The emailed activation link will stop working.",
    )
    if (!confirmed) return
    const saved = await runFamilyAction({
      action: "cancel_separation",
      profileId: profile.id,
    })
    if (saved) setSeparationEmail("")
  }

  const sendGuardianLink = async (event, profileId) => {
    event.preventDefault()
    const saved = await runFamilyAction({
      action: "invite_guardian",
      profileId,
      email: guardianEmail,
    })
    if (saved) {
      setGuardianEmail("")
      setLinkingChildId("")
    }
  }

  const unlinkChild = async (child) => {
    const confirmed = window.confirm(
      `Unlink ${child.firstName} ${child.lastName} from your account? The other linked guardian will keep access.`,
    )
    if (!confirmed) return
    await runFamilyAction({ action: "unlink_guardian", profileId: child.id })
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setDraft((current) => ({
      ...current,
      [name]: name === "notificationLeadMinutes"
        ? Number(value)
        : name === "phone"
          ? formatTelephone(value)
          : value,
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleNotificationChannelChange = (event) => {
    const { name, checked } = event.target
    setDraft((current) => ({
      ...current,
      notificationChannels: {
        ...current.notificationChannels,
        [name]: checked,
      },
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleNotificationCategoryChange = (event) => {
    const { name, checked } = event.target
    setDraft((current) => ({
      ...current,
      notificationCategories: {
        ...current.notificationCategories,
        [name]: checked,
      },
    }))
    setMessage("")
    setErrorMessage("")
  }

  const sendNotificationTest = async (channel) => {
    setTestingChannel(channel)
    setChannelTestMessage("")
    setErrorMessage("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("notifications/test"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ channel }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Unable to send test")
      setProfile((current) => ({
        ...current,
        notificationConnections: {
          ...current.notificationConnections,
          [channel]: Boolean(result.connected),
        },
      }))
      setDraft((current) => ({
        ...current,
        notificationConnections: {
          ...current.notificationConnections,
          [channel]: Boolean(result.connected),
        },
      }))
      setChannelTestMessage(result.message)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setTestingChannel("")
    }
  }

  const runNotificationMethodAction = (channel, connected) => {
    if (["email", "sms"].includes(channel)) {
      sendNotificationTest(channel)
      return
    }
    const methodRef = channel === "telegram"
      ? telegramNotificationsRef
      : pushNotificationsRef
    methodRef.current?.[connected ? "sendTest" : "connect"]?.()
  }

  const beginEditing = () => {
    setDraft(profile)
    setIsEditing(true)
    setMessage("")
    setErrorMessage("")
  }

  const cancelEditing = () => {
    setDraft(profile)
    setIsEditing(false)
    setMessage("")
    setErrorMessage("")
  }

  const selectProfileSection = (section) => {
    if (section === activeProfileSection) return
    if (
      isEditing &&
      sectionHasChanges(activeProfileSection, profile, draft) &&
      !window.confirm("Discard the unsaved changes in this section?")
    ) {
      return
    }
    setDraft(profile)
    setIsEditing(false)
    setMessage("")
    setErrorMessage("")
    setActiveProfileSection(section)
  }

  const saveProfile = async () => {
    if (!sectionHasChanges(activeProfileSection, profile, draft)) return
    setIsSaving(true)
    setMessage("")
    setErrorMessage("")

    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const response = await fetch(getFunctionEndpoint("ministry-profile"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.message || "Unable to update profile")

      setProfile(result.profile)
      setDraft(result.profile)
      applyMinistryTheme(result.profile.appearanceTheme, result.profile.id)
      setIsEditing(false)
      setMessage("Your account has been updated.")
      onUserUpdate?.({
        ...initialUser,
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
        username: result.profile.username,
        appearanceTheme: result.profile.appearanceTheme,
      })
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <p className="p-6 text-center text-gray-500">Loading your profile...</p>
    )
  }

  if (!profile || !draft) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-red-700">
        {errorMessage || "Unable to load your profile."}
      </div>
    )
  }

  const reminderLabel =
    reminderOptions.find(
      ([minutes]) => minutes === profile.notificationLeadMinutes,
    )?.[1] || "1 hour"
  const activeManagedProfile = familyData?.profiles.find(
    (item) => item.id === profile.id && !item.isGuardian,
  )
  const separationPending =
    activeManagedProfile?.relationshipStatus === "separation_pending"
  const activeSectionChanged = sectionHasChanges(
    activeProfileSection,
    profile,
    draft,
  )
  const toggleSectionEditing = () =>
    isEditing ? cancelEditing() : beginEditing()

  return (
    <div className="relative mx-auto max-w-5xl pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-4">
      <nav
        aria-label="Profile sections"
        className="hidden grid-cols-4 gap-1 rounded-2xl bg-gray-50 p-1.5 shadow-sm ring-1 ring-gray-100 lg:grid"
      >
        {profileSections.map(([id, label, Icon]) => {
          const active = activeProfileSection === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => selectProfileSection(id)}
              className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm transition ${
                active
                  ? "bg-white font-semibold text-[#6f4f34] shadow-sm"
                  : "font-medium text-gray-500 hover:bg-white/60 hover:text-gray-800"
              }`}
            >
              <Icon className="size-5 shrink-0" />
              <span className="leading-tight">{label}</span>
            </button>
          )
        })}
      </nav>

      {activeProfileSection === "account" && (
      <section className="relative border-b border-gray-100 py-4">
        <div className="mb-4">
          <ProfileSectionHeading
            icon={UserCircleIcon}
            title="Account Details"
            subtitle="Personal information and account appearance."
            editing={isEditing}
            changed={activeSectionChanged}
            saving={isSaving}
            onToggleEdit={toggleSectionEditing}
            onSave={saveProfile}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6">
          <Field
            label="First name"
            name="firstName"
            value={draft.firstName}
            isEditing={isEditing}
            onChange={handleChange}
          />
          <Field
            label="Last name"
            name="lastName"
            value={draft.lastName}
            isEditing={isEditing}
            onChange={handleChange}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            value={draft.email}
            isEditing={isEditing && !profile.isManagedProfile}
            onChange={handleChange}
          />
          <Field
            label="Telephone"
            name="phone"
            type="tel"
            value={formatTelephone(draft.phone)}
            isEditing={isEditing && !profile.isManagedProfile}
            onChange={handleChange}
          />
          <Field
            label="Username"
            name="username"
            value={draft.username}
            isEditing={isEditing && !profile.isManagedProfile}
            onChange={handleChange}
          />
          <div>
            <span className="text-sm font-semibold text-gray-700">
              Account status
            </span>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium capitalize text-gray-900">
              <CheckCircleIcon className="size-4 text-green-600" />
              {profile.status}
            </p>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-700">
              Background check
            </span>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-gray-900">
              <ShieldCheckIcon className={`size-4 ${profile.backgroundCheckVerified ? "text-orange-500" : "text-gray-400"}`} />
              {profile.backgroundCheckVerified ? "Verified" : "Not verified"}
            </p>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-700">
              Appearance
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={(draft.appearanceTheme || "light") === "dark"}
              aria-label={`Use ${(draft.appearanceTheme || "light") === "dark" ? "light" : "dark"} appearance`}
              disabled={!isEditing}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  appearanceTheme:
                    (current.appearanceTheme || "light") === "dark"
                      ? "light"
                      : "dark",
                }))
              }
              className="mt-1 inline-flex rounded-full border border-gray-200 bg-gray-100 p-0.5 outline-none transition focus-visible:ring-2 focus-visible:ring-[#896542]/30 disabled:cursor-default"
            >
              <span
                title="Light"
                className={`grid size-8 place-items-center rounded-full transition ${
                  (draft.appearanceTheme || "light") === "light"
                    ? "bg-white text-amber-500 shadow-sm"
                    : "text-gray-400"
                }`}
              >
                <SunIcon className="size-4" />
                <span className="sr-only">Light</span>
              </span>
              <span
                title="Dark"
                className={`grid size-8 place-items-center rounded-full transition ${
                  (draft.appearanceTheme || "light") === "dark"
                    ? "bg-gray-800 text-blue-200 shadow-sm"
                    : "text-gray-400"
                }`}
              >
                <MoonIcon className="size-4" />
                <span className="sr-only">Dark</span>
              </span>
            </button>
          </div>
        </div>
      </section>
      )}

      {activeProfileSection === "notifications" && (
      <section className="border-b border-gray-100 py-4 sm:py-5">
        <ProfileSectionHeading
          icon={BellAlertIcon}
          title="Notifications"
          subtitle="Event reminders and communication preferences."
          editing={isEditing}
          changed={activeSectionChanged}
          saving={isSaving}
          onToggleEdit={toggleSectionEditing}
          onSave={saveProfile}
        />
          <div className="mt-4 min-w-0">
            <label className="mt-3 block max-w-sm">
              <span className="text-sm font-semibold text-gray-700">
                Notify me before an event
              </span>
              {isEditing && !profile.isManagedProfile ? (
                <select
                  name="notificationLeadMinutes"
                  value={draft.notificationLeadMinutes}
                  onChange={handleChange}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/10"
                >
                  {reminderOptions.map(([minutes, label]) => (
                    <option key={minutes} value={minutes}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm font-semibold text-[#6f4f34]">
                  {reminderLabel}
                </p>
              )}
            </label>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700">
                Notification methods
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {notificationChannelOptions.map(([key, label, Icon]) => {
                  const selected = Boolean(draft.notificationChannels?.[key])
                  const connected = key === "email"
                    ? Boolean(profile.notificationConnections?.email) &&
                      normalizeEmailConnection(draft.email) ===
                        normalizeEmailConnection(profile.email)
                    : key === "sms"
                      ? Boolean(profile.notificationConnections?.sms) &&
                        normalizePhoneConnection(draft.phone) ===
                          normalizePhoneConnection(profile.phone)
                      : Boolean(profile.notificationConnections?.[key])
                  const unavailable =
                    (key === "email" && !draft.email) ||
                    (key === "sms" && !draft.phone) ||
                    (key === "telegram" && !connected) ||
                    (key === "push" && !connected)
                  const canTest =
                    !((key === "email" && !draft.email) ||
                      (key === "sms" && !draft.phone)) &&
                    (key !== "sms" || draft.smsTransactionalConsentAccepted)
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5"
                    >
                      <label className="flex min-w-0 flex-1 items-start gap-2.5">
                        <input
                          type="checkbox"
                          name={key}
                          checked={selected}
                          onChange={handleNotificationChannelChange}
                          disabled={
                            !isEditing ||
                            profile.isManagedProfile ||
                            unavailable
                          }
                          className="mt-0.5 size-4 accent-[#896542] disabled:opacity-50"
                        />
                        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900">
                          <Icon className="size-5 shrink-0 text-[#896542]" />
                          <span>{label}</span>
                        </span>
                      </label>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {connected && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                            Connected
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => runNotificationMethodAction(key, connected)}
                          disabled={
                            profile.isManagedProfile ||
                            (["email", "sms"].includes(key) &&
                              (!canTest || Boolean(testingChannel)))
                          }
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 ${
                            connected
                              ? "border border-[#d8c7b8] bg-white text-[#6f4f34]"
                              : "bg-[#896542] text-white"
                          }`}
                        >
                          {testingChannel === key
                            ? "Sending…"
                            : connected
                              ? "Send test"
                              : "Connect"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {channelTestMessage && (
                <p role="status" aria-live="polite" className="mt-2 text-xs font-medium text-green-700">
                  {channelTestMessage}
                </p>
              )}
              {isEditing &&
                !profile.isManagedProfile &&
                draft.notificationChannels?.sms && (
                  <label className="mt-3 flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.smsTransactionalConsentAccepted)}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          smsTransactionalConsentAccepted: event.target.checked,
                        }))
                      }
                      className="mt-0.5 size-4 accent-[#896542]"
                    />
                    <span className="text-xs leading-relaxed text-gray-500">
                      I agree to receive transactional text messages about my
                      ministry assignments, schedule changes, and cancellations.
                      Message and data rates may apply. Reply STOP to opt out.
                    </span>
                  </label>
                )}
              {profile.isManagedProfile && (
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  This managed profile uses its guardian's notification methods.
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700">
                What should notify me
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {notificationCategoryOptions.map(
                  ([key, label, description]) => (
                    <label
                      key={key}
                      className="flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        name={key}
                        checked={Boolean(
                          draft.notificationCategories?.[key],
                        )}
                        onChange={handleNotificationCategoryChange}
                        disabled={!isEditing || profile.isManagedProfile}
                        className="mt-0.5 size-4 accent-[#896542] disabled:opacity-50"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">
                          {label}
                        </span>
                        <span className="mt-0.5 hidden text-xs leading-snug text-gray-500 sm:block">
                          {description}
                        </span>
                      </span>
                    </label>
                  ),
                )}
              </div>
            </div>
            {!profile.isManagedProfile && (
              <>
                <PushNotifications
                  ref={pushNotificationsRef}
                  controllerOnly
                  onConnectionChange={handlePushConnectionChange}
                  onMessageChange={handleNotificationControllerMessage}
                />
                <TelegramNotifications
                  ref={telegramNotificationsRef}
                  controllerOnly
                  globalRole={profile.globalRole}
                  onConnectionChange={handleTelegramConnectionChange}
                  onMessageChange={handleNotificationControllerMessage}
                />
              </>
            )}
        </div>
      </section>
      )}

      {activeProfileSection === "ministries" && (
      <section className="border-b border-gray-100 py-4 sm:py-5">
        <ProfileSectionHeading
          icon={Squares2X2Icon}
          title="Ministries"
          subtitle={`${profile.ministries.length} active ${profile.ministries.length === 1 ? "ministry" : "ministries"}`}
          editing={isEditing}
          changed={activeSectionChanged}
          saving={isSaving}
          onToggleEdit={toggleSectionEditing}
          onSave={saveProfile}
        />
        {profile.ministries.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {profile.ministries.map((ministry) => (
              <Link
                key={ministry.id}
                to={`/${ministry.slug}`}
                className="rounded-lg bg-gray-50 px-3 py-2.5 transition hover:bg-[#f7f3ef]"
              >
                <p className="font-semibold text-gray-900">{ministry.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {membershipLabels[ministry.level] || ministry.level}
                  {ministry.canServe ? " · Serving member" : ""}
                  {ministry.highestLevelName
                    ? ` · ${ministry.highestLevelName}`
                    : ""}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            No active ministry memberships.
          </p>
        )}
      </section>
      )}

      {activeProfileSection === "profiles" && familyData && (
        <section className="py-4 sm:py-5">
          <ProfileSectionHeading
            icon={UserGroupIcon}
            title="Profiles"
            subtitle="Managed children, guardians, and account access."
            editing={isEditing}
            changed={activeSectionChanged}
            saving={isSaving}
            onToggleEdit={toggleSectionEditing}
            onSave={saveProfile}
          />
            {!profile.isManagedProfile && isEditing && (
              <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddChild((visible) => !visible)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]"
              >
                <PlusIcon className="size-4" /> Add Child
              </button>
              </div>
            )}

          {showAddChild && (
            <form onSubmit={addChild} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input required placeholder="First name" value={childForm.firstName} onChange={(event) => setChildForm((current) => ({ ...current, firstName: event.target.value }))} className="h-10 rounded-lg border border-gray-200 px-3 text-sm" />
              <input required placeholder="Last name" value={childForm.lastName} onChange={(event) => setChildForm((current) => ({ ...current, lastName: event.target.value }))} className="h-10 rounded-lg border border-gray-200 px-3 text-sm" />
              <button type="submit" disabled={isSaving} className="rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Add child profile</button>
            </form>
          )}

          {!profile.isManagedProfile && familyData.profiles.filter((item) => !item.isGuardian).length > 0 && (
            <div className="mt-3 space-y-2">
              {familyData.profiles.filter((item) => !item.isGuardian).map((child) => (
                <div key={child.id} className="rounded-lg bg-gray-50 p-3">
                  <p className="font-semibold text-gray-900">{child.firstName} {child.lastName}</p>
                  <p className="mt-1 text-sm text-gray-500">{child.status === "pending" ? "Pending app approval" : child.relationshipStatus === "separation_pending" ? "Independent account activation pending" : "Managed child profile"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {child.guardianCount} linked {child.guardianCount === 1 ? "guardian" : "guardians"}
                    {child.hasPendingGuardianInvitation ? " · Link invitation pending" : ""}
                  </p>
                  {child.status === "active" && child.relationshipStatus === "active" && familyData.ministries.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select value={requestMinistryId} onChange={(event) => setRequestMinistryId(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                        <option value="">Request ministry access</option>
                        {familyData.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
                      </select>
                      <button type="button" disabled={!requestMinistryId || isSaving} onClick={() => runFamilyAction({ action: "request_membership", profileId: child.id, ministryId: requestMinistryId })} className="rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]">Send request</button>
                    </div>
                  )}
                  {child.status === "active" && child.relationshipStatus === "active" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLinkingChildId((current) => current === child.id ? "" : child.id)
                          setGuardianEmail("")
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]"
                      >
                        <UserPlusIcon className="size-4" /> Link profile
                      </button>
                      {child.guardianCount > 1 && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => unlinkChild(child)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600"
                        >
                          Unlink from my account
                        </button>
                      )}
                    </div>
                  )}
                  {linkingChildId === child.id && (
                    <form onSubmit={(event) => sendGuardianLink(event, child.id)} className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <label className="sr-only" htmlFor={`guardian-email-${child.id}`}>Other guardian's account email</label>
                      <input
                        id={`guardian-email-${child.id}`}
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="Other guardian's account email"
                        value={guardianEmail}
                        onChange={(event) => setGuardianEmail(event.target.value)}
                        className="h-10 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                      />
                      <button type="submit" disabled={!guardianEmail || isSaving} className="rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        Send link
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {profile.isManagedProfile && (
            <div className="mt-3 space-y-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="font-semibold text-gray-900">Linked guardians</p>
                <p className="mt-1 text-sm text-gray-500">
                  {activeManagedProfile?.guardianCount || 1} linked {(activeManagedProfile?.guardianCount || 1) === 1 ? "guardian receives" : "guardians receive"} this profile's schedules and notifications.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLinkingChildId((current) => current === profile.id ? "" : profile.id)
                    setGuardianEmail("")
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]"
                >
                  <UserPlusIcon className="size-4" /> Link another guardian
                </button>
                {linkingChildId === profile.id && (
                  <form onSubmit={(event) => sendGuardianLink(event, profile.id)} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label className="sr-only" htmlFor="active-child-guardian-email">Other guardian's account email</label>
                    <input id="active-child-guardian-email" type="email" required autoComplete="email" placeholder="Other guardian's account email" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} className="h-10 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm" />
                    <button type="submit" disabled={!guardianEmail || isSaving} className="rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send link</button>
                  </form>
                )}
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="font-semibold text-gray-900">Create an independent account</p>
                <p className="mt-1 text-sm text-gray-500">
                  {separationPending
                    ? "An activation invitation is pending. You can resend it, use a corrected email, or cancel the separation."
                    : "A verified activation email will add a private login while keeping every ministry, assignment, and completed duty on this profile."}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input type="email" required placeholder="New email address" value={separationEmail} onChange={(event) => setSeparationEmail(event.target.value)} className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm" />
                  <button type="button" disabled={!separationEmail || isSaving} onClick={() => runFamilyAction({ action: "start_separation", profileId: profile.id, email: separationEmail })} className="rounded-lg border border-[#d8c7b8] px-4 py-2 text-sm font-semibold text-[#6f4f34]">
                    {separationPending ? "Resend activation" : "Send activation"}
                  </button>
                  {separationPending && (
                    <button type="button" disabled={isSaving} onClick={cancelSeparation} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeProfileSection === "profiles" && !familyData && (
        <p className="py-8 text-center text-sm text-gray-500">
          Loading profiles…
        </p>
      )}

      <nav
        aria-label="Profile sections"
        className="ministry-mobile-actions fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(63,45,29,0.10)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
          {profileSections.map(([id, label, Icon]) => {
            const active = activeProfileSection === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectProfileSection(id)}
                aria-pressed={active}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition ${
                  active ? "bg-[#f7f3ef] text-[#6f4f34]" : "text-gray-500"
                }`}
              >
                <Icon className="size-5" />
                <span className="leading-tight">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div aria-live="polite" aria-atomic="true" className="min-h-6 text-center text-sm">
        {errorMessage ? (
          <p role="alert" className="text-red-600">{errorMessage}</p>
        ) : message ? (
          <p role="status" className="font-medium text-green-700">{message}</p>
        ) : isEditing ? (
          <p className="text-gray-500">
            Leave this profile view to discard unsaved changes.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default MinistryProfile
