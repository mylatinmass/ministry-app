import * as React from "react"
import { Link } from "../../compat/gatsby"
import {
  BellAlertIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  LinkIcon,
  ShieldCheckIcon,
  MoonIcon,
  Squares2X2Icon,
  SunIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserPlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import getFunctionEndpoint from "../../utils/getFunctionEndpoint"
import { MINISTRY_SESSION_KEY } from "./MinistryLogin"
import PushNotifications from "./PushNotifications"
import TelegramNotifications from "./TelegramNotifications"
import { applyMinistryTheme } from "../../utils/ministryTheme"
import {
  buildHouseholdProfileColors,
  CHILD_PROFILE_COLOR_SWATCHES,
} from "../../utils/householdCalendar"
import MinistrySectionActions from "./MinistrySectionActions"

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

const formatGuardianNames = (guardians = []) => {
  const names = guardians
    .map((guardian) => [guardian.firstName, guardian.lastName].filter(Boolean).join(" "))
    .filter(Boolean)
  if (!names.length) return "your account"
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`
}

const ProfileSectionHeading = ({
  icon: Icon,
  title,
  subtitle,
  editing,
  changed,
  saving,
  onToggleEdit,
  onSave,
  guideId,
  showActions = true,
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
    {showActions && <div className="flex items-center gap-2">
      <button
        type="button"
        data-guide-id={guideId}
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
    </div>}
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
  const [editingChildId, setEditingChildId] = React.useState("")
  const [childEditDraft, setChildEditDraft] = React.useState(null)
  const [colorPickerChildId, setColorPickerChildId] = React.useState("")
  const [guardianEditorChildId, setGuardianEditorChildId] = React.useState("")
  const [leaveMinistryDialog, setLeaveMinistryDialog] = React.useState(null)
  const [activeProfileSection, setActiveProfileSection] = React.useState("account")
  const [testingChannel, setTestingChannel] = React.useState("")
  const [channelTestMessage, setChannelTestMessage] = React.useState("")
  const pushNotificationsRef = React.useRef(null)
  const telegramNotificationsRef = React.useRef(null)
  const familyProfileColors = React.useMemo(
    () => buildHouseholdProfileColors(familyData?.profiles || []),
    [familyData?.profiles],
  )

  React.useEffect(() => {
    if (!leaveMinistryDialog) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSaving) setLeaveMinistryDialog(null)
    }
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isSaving, leaveMinistryDialog])

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

  const childDraftHasChanges = (child) => Boolean(
    childEditDraft && (
      childEditDraft.calendarColor !== familyProfileColors.get(child.id) ||
      childEditDraft.guardianEmail.trim() ||
      childEditDraft.guardianIdToRemove
    )
  )

  const beginChildEdit = (child) => {
    setEditingChildId(child.id)
    setColorPickerChildId("")
    setGuardianEditorChildId("")
    setChildEditDraft({
      calendarColor: familyProfileColors.get(child.id),
      guardianEmail: "",
      guardianIdToRemove: "",
    })
    setLinkingChildId("")
    setGuardianEmail("")
    setMessage("")
    setErrorMessage("")
  }

  const cancelChildEdit = () => {
    setEditingChildId("")
    setChildEditDraft(null)
    setColorPickerChildId("")
    setGuardianEditorChildId("")
    setRequestMinistryId("")
    setMessage("")
    setErrorMessage("")
  }

  const saveChildEdit = async (child) => {
    if (!childDraftHasChanges(child)) {
      cancelChildEdit()
      return
    }
    if (childEditDraft.guardianIdToRemove) {
      const guardian = child.guardians.find(
        (item) => item.id === childEditDraft.guardianIdToRemove,
      )
      const guardianName = guardian
        ? [guardian.firstName, guardian.lastName].filter(Boolean).join(" ")
        : "this parent or guardian"
      const confirmed = window.confirm(
        `Remove ${guardianName}'s link to ${child.firstName} ${child.lastName}? The remaining linked parent or guardian will keep access.`,
      )
      if (!confirmed) return
    }

    setIsSaving(true)
    setMessage("")
    setErrorMessage("")
    try {
      const token = window.sessionStorage.getItem(MINISTRY_SESSION_KEY)
      const actions = []
      if (childEditDraft.calendarColor !== familyProfileColors.get(child.id)) {
        actions.push({
          action: "set_calendar_color",
          profileId: child.id,
          calendarColor: childEditDraft.calendarColor,
        })
      }
      if (childEditDraft.guardianEmail.trim()) {
        actions.push({
          action: "invite_guardian",
          profileId: child.id,
          email: childEditDraft.guardianEmail.trim(),
        })
      }
      if (childEditDraft.guardianIdToRemove) {
        actions.push({
          action: "unlink_guardian",
          profileId: child.id,
          guardianId: childEditDraft.guardianIdToRemove,
        })
      }

      let result = null
      for (const action of actions) {
        const response = await fetch(getFunctionEndpoint("ministry-profiles"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(action),
        })
        result = await response.json()
        if (!response.ok) throw new Error(result.message || "Unable to update profile")
      }
      setMessage(result?.message || "Child profile updated.")
      setEditingChildId("")
      setChildEditDraft(null)
      setColorPickerChildId("")
      setGuardianEditorChildId("")
      setRequestMinistryId("")
      await loadFamily()
      window.dispatchEvent(new Event("ministry-profiles-updated"))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmLeaveMinistry = async () => {
    if (!leaveMinistryDialog) return
    const { child, ministry } = leaveMinistryDialog
    const saved = await runFamilyAction({
      action: "leave_ministry",
      profileId: child.id,
      ministryId: ministry.id,
    })
    if (saved) setRequestMinistryId("")
    setLeaveMinistryDialog(null)
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

  const removePendingChild = async (child) => {
    const childName = [child.firstName, child.lastName].filter(Boolean).join(" ")
    const confirmed = window.confirm(
      `Remove ${childName}? This will cancel the pending app approval and remove this child profile from your account.`,
    )
    if (!confirmed) return
    await runFamilyAction({ action: "remove_pending_child", profileId: child.id })
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
    setEditingChildId("")
    setChildEditDraft(null)
    setLinkingChildId("")
    setGuardianEmail("")
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
    setEditingChildId("")
    setChildEditDraft(null)
    setColorPickerChildId("")
    setGuardianEditorChildId("")
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
      applyMinistryTheme(result.profile.appearanceTheme)
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
      <MinistrySectionActions
        label="Profile sections"
        actions={profileSections.map(([id, label, icon]) => ({
          id,
          label,
          icon,
          active: activeProfileSection === id,
          onClick: () => selectProfileSection(id),
        }))}
      />

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
            guideId="profile-edit-account"
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
              disabled={!isEditing || profile.isManagedProfile}
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
            {profile.isManagedProfile && (
              <p className="mt-1 text-xs text-gray-500">
                Managed profiles use the parent account's appearance.
              </p>
            )}
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
          guideId="profile-edit-notifications"
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
          guideId="profile-edit-ministries"
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
            showActions={false}
          />
            {!profile.isManagedProfile && (
              <div className="mt-3 flex justify-end">
              <button
                type="button"
                data-guide-id="profile-add-child"
                onClick={() => {
                  cancelChildEdit()
                  setShowAddChild((visible) => !visible)
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]"
              >
                {showAddChild ? <XMarkIcon className="size-4" /> : <PlusIcon className="size-4" />}
                {showAddChild ? "Cancel" : "Add Child"}
              </button>
              </div>
            )}

          {showAddChild && (
            <form onSubmit={addChild} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input data-guide-id="profile-child-first-name" required placeholder="First name" value={childForm.firstName} onChange={(event) => setChildForm((current) => ({ ...current, firstName: event.target.value }))} className="h-10 rounded-lg border border-gray-200 px-3 text-sm" />
              <input data-guide-id="profile-child-last-name" required placeholder="Last name" value={childForm.lastName} onChange={(event) => setChildForm((current) => ({ ...current, lastName: event.target.value }))} className="h-10 rounded-lg border border-gray-200 px-3 text-sm" />
              <button type="submit" disabled={isSaving} className="rounded-lg bg-[#896542] px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Add child profile</button>
            </form>
          )}

          {!profile.isManagedProfile && familyData.profiles.filter((item) => !item.isGuardian).length > 0 && (
            <div className="mt-3 space-y-2">
              {familyData.profiles.filter((item) => !item.isGuardian).map((child) => {
                const editingChild = editingChildId === child.id
                const changed = editingChild && childDraftHasChanges(child)
                const displayedColor = editingChild
                  ? childEditDraft.calendarColor
                  : familyProfileColors.get(child.id)
                const selectedMinistry = familyData.ministries.find(
                  (ministry) => ministry.id === requestMinistryId,
                )
                const hasSelectedMinistry = Boolean(
                  selectedMinistry && child.activeMinistryIds?.includes(selectedMinistry.id),
                )
                const selectedMinistryPending = Boolean(
                  selectedMinistry && familyData.membershipRequests.some(
                    (request) => request.profileId === child.id &&
                      request.ministryId === selectedMinistry.id,
                  ),
                )
                return (
                  <article key={child.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="relative shrink-0">
                            {editingChild ? (
                              <button
                                type="button"
                                data-guide-id="profile-child-calendar-color-toggle"
                                aria-label="Choose calendar color"
                                aria-expanded={colorPickerChildId === child.id}
                                disabled={isSaving || childEditDraft?.guardianIdToRemove}
                                onClick={() => setColorPickerChildId((current) => current === child.id ? "" : child.id)}
                                className="block size-4 rounded-full ring-2 ring-white outline-none shadow-sm ring-offset-1 ring-offset-gray-50 focus:ring-[#896542] disabled:opacity-40"
                                style={{ backgroundColor: displayedColor }}
                              />
                            ) : (
                              <span
                                className="block size-3.5 rounded-full ring-1 ring-black/15"
                                style={{ backgroundColor: displayedColor }}
                                aria-hidden="true"
                              />
                            )}
                            {editingChild && childEditDraft && colorPickerChildId === child.id && (
                              <fieldset
                                data-guide-id="profile-child-calendar-color"
                                disabled={isSaving || childEditDraft.guardianIdToRemove}
                                className="absolute left-0 top-full z-30 mt-2 grid w-52 grid-cols-4 gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
                              >
                                <legend className="sr-only">Choose a calendar dot color</legend>
                                {CHILD_PROFILE_COLOR_SWATCHES.map((swatch) => {
                                  const selected = childEditDraft.calendarColor === swatch.value
                                  return (
                                    <label
                                      key={swatch.value}
                                      title={swatch.name}
                                      className="relative aspect-square cursor-pointer outline-none focus-within:ring-2 focus-within:ring-[#896542] focus-within:ring-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40"
                                    >
                                      <input
                                        type="radio"
                                        name={`calendar-color-${child.id}`}
                                        value={swatch.value}
                                        checked={selected}
                                        onChange={() => {
                                          setChildEditDraft((current) => ({
                                            ...current,
                                            calendarColor: swatch.value,
                                          }))
                                          setColorPickerChildId("")
                                        }}
                                        className="sr-only"
                                      />
                                      <span
                                        className={`grid size-full place-items-center border-2 shadow-sm ${
                                          selected ? "border-white ring-2 ring-[#6f4f34]" : "border-white ring-1 ring-black/15"
                                        }`}
                                        style={{ backgroundColor: swatch.value, color: swatch.foreground }}
                                        aria-hidden="true"
                                      >
                                        {selected && <CheckIcon className="size-5 stroke-[3]" />}
                                      </span>
                                      <span className="sr-only">{swatch.name}</span>
                                    </label>
                                  )
                                })}
                              </fieldset>
                            )}
                          </div>
                          <h4 className="truncate font-semibold text-gray-900">
                            {child.firstName} {child.lastName}
                          </h4>
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-xs text-gray-500">
                            Linked to {formatGuardianNames(child.guardians)}
                          </p>
                          {editingChild && (
                            <button
                              type="button"
                              data-guide-id="profile-child-guardian-toggle"
                              aria-label="Edit linked parents and guardians"
                              aria-expanded={guardianEditorChildId === child.id}
                              onClick={() => setGuardianEditorChildId((current) => current === child.id ? "" : child.id)}
                              className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${guardianEditorChildId === child.id ? "bg-[#efe4d9] text-[#6f4f34]" : "text-gray-400 hover:bg-white hover:text-[#6f4f34]"}`}
                            >
                              <LinkIcon className="size-4" />
                            </button>
                          )}
                        </div>
                        {child.hasPendingGuardianInvitation && (
                          <p className="mt-0.5 text-xs text-amber-700">Parent link invitation pending</p>
                        )}
                      </div>
                      <button
                        type="button"
                        data-guide-id="profile-child-edit"
                        disabled={isSaving}
                        onClick={() => {
                          if (!editingChild) beginChildEdit(child)
                          else if (changed) saveChildEdit(child)
                          else cancelChildEdit()
                        }}
                        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                          changed
                            ? "bg-[#896542] text-white"
                            : "border border-[#d8c7b8] bg-white text-[#6f4f34]"
                        }`}
                      >
                        {isSaving && editingChild ? "SAVING…" : changed ? "SAVE" : editingChild ? "CANCEL" : "EDIT"}
                      </button>
                    </div>

                    {editingChild && childEditDraft && (
                      <div className="mt-3">
                        {guardianEditorChildId === child.id && (
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                        {child.status === "active" && child.relationshipStatus === "active" && (
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Link to another parent or guardian</span>
                            <input
                              data-guide-id="profile-guardian-email"
                              type="email"
                              autoComplete="email"
                              placeholder="Their existing account email"
                              value={childEditDraft.guardianEmail}
                              disabled={isSaving || childEditDraft.guardianIdToRemove}
                              onChange={(event) => setChildEditDraft((current) => ({
                                ...current,
                                guardianEmail: event.target.value,
                              }))}
                              className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                            />
                          </label>
                        )}

                        {child.guardianCount > 1 && (
                          <fieldset className="mt-3">
                            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remove a parent link</legend>
                            <div className="mt-1.5 space-y-1.5">
                              {child.guardians.map((guardian) => {
                                const guardianName = [guardian.firstName, guardian.lastName].filter(Boolean).join(" ")
                                const selected = childEditDraft.guardianIdToRemove === guardian.id
                                return (
                                  <label key={guardian.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${selected ? "border-red-200 bg-red-50 text-red-800" : "border-gray-200 bg-white text-gray-700"}`}>
                                    <input
                                      data-guide-id="profile-remove-guardian"
                                      type="checkbox"
                                      checked={selected}
                                      disabled={isSaving}
                                      onChange={() => setChildEditDraft((current) => ({
                                        ...current,
                                        guardianIdToRemove: selected ? "" : guardian.id,
                                      }))}
                                      className="size-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    />
                                    <span>Remove {guardianName}{guardian.isCurrentGuardian ? " (you)" : ""}</span>
                                  </label>
                                )
                              })}
                            </div>
                            <p className="mt-1.5 text-xs text-gray-500">Only one link can be removed at a time.</p>
                          </fieldset>
                        )}
                          </div>
                        )}

                        {child.status === "pending" && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => removePendingChild(child)}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                          >
                            <TrashIcon className="size-4" /> Remove child
                          </button>
                        )}

                        {child.status === "active" && child.relationshipStatus === "active" && familyData.ministries.length > 0 && (
                          <div className={guardianEditorChildId === child.id ? "mt-4 border-t border-gray-200 pt-3" : ""}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ministry access</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <select data-guide-id="profile-child-ministry" value={requestMinistryId} onChange={(event) => setRequestMinistryId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                                <option value="">Choose a ministry</option>
                                {familyData.ministries.map((ministry) => (
                                  <option key={ministry.id} value={ministry.id}>
                                    {child.activeMinistryIds?.includes(ministry.id) ? "✓ " : ""}{ministry.name}
                                  </option>
                                ))}
                              </select>
                              {hasSelectedMinistry ? (
                                <button
                                  type="button"
                                  data-guide-id="profile-child-leave-ministry"
                                  disabled={isSaving}
                                  onClick={() => setLeaveMinistryDialog({ child, ministry: selectedMinistry })}
                                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                                >
                                  LEAVE MINISTRY
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!requestMinistryId || selectedMinistryPending || isSaving}
                                  onClick={() => runFamilyAction({ action: "request_membership", profileId: child.id, ministryId: requestMinistryId })}
                                  className="rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34] disabled:opacity-50"
                                >
                                  {selectedMinistryPending ? "REQUEST PENDING" : "REQUEST ACCESS"}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
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
                  data-guide-id="profile-link-guardian"
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
                    <input data-guide-id="profile-guardian-email" id="active-child-guardian-email" type="email" required autoComplete="email" placeholder="Other guardian's account email" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} className="h-10 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm" />
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
                  <input data-guide-id="profile-independent-email" type="email" required placeholder="New email address" value={separationEmail} onChange={(event) => setSeparationEmail(event.target.value)} className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm" />
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

      {leaveMinistryDialog && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) setLeaveMinistryDialog(null)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-ministry-title"
            aria-describedby="leave-ministry-description"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h3 id="leave-ministry-title" className="century-font text-xl text-gray-900">
              Leave ministry?
            </h3>
            <p id="leave-ministry-description" className="mt-2 text-sm leading-6 text-gray-600">
              Are you sure you want to LEAVE {leaveMinistryDialog.ministry.name} MINISTRY?
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Ministry administrators will receive a message, and upcoming assignments will request substitutes. Assignments that have not been filled can be restored if this profile rejoins later.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={confirmLeaveMinistry}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isSaving ? "LEAVING…" : "LEAVE"}
              </button>
              <button
                type="button"
                autoFocus
                disabled={isSaving}
                onClick={() => setLeaveMinistryDialog(null)}
                className="rounded-lg border border-red-600 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                DON'T LEAVE
              </button>
            </div>
          </div>
        </div>
      )}

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
