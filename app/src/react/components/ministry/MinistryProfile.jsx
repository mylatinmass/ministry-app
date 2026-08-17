import * as React from "react"
import { Link } from "../../compat/gatsby"
import {
  BellAlertIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UserPlusIcon,
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
  ["email", "Email", "Send notifications to the email address on this account."],
  ["telegram", "Telegram", "Send notifications to your connected Telegram account."],
  ["sms", "SMS", "Send text messages to the telephone number on this account."],
  ["push", "Push notifications", "Send browser notifications to devices you enable below."],
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

const Field = ({ label, name, value, isEditing, onChange, type = "text" }) => (
  <label className="block">
    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
      {label}
    </span>
    {isEditing ? (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/10"
      />
    ) : (
      <p className="mt-2 min-h-7 text-base font-medium text-gray-900">
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

  const handleTelegramConnectionChange = React.useCallback((connected) => {
    const updateTelegramState = (current) =>
      current
        ? {
            ...current,
            telegramConnected: connected,
            notificationChannels: connected
              ? current.notificationChannels
              : { ...current.notificationChannels, telegram: false },
          }
        : current
    setProfile(updateTelegramState)
    setDraft(updateTelegramState)
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
      [name]: name === "notificationLeadMinutes" ? Number(value) : value,
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

  const beginEditing = () => {
    setDraft(profile)
    setIsEditing(true)
    setMessage("")
    setErrorMessage("")
  }

  const saveProfile = async () => {
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

  const leaveSession = (destination) => {
    window.sessionStorage.removeItem(MINISTRY_SESSION_KEY)
    window.sessionStorage.removeItem("ministry_visible_profile_ids")
    window.location.assign(destination)
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

  return (
    <div className="relative mx-auto max-w-5xl pb-8">
      <div className="sticky top-0 z-10 bg-white flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-7">
        <div className="">
          <p className="text-lg font-semibold">
            {profile.username || `${profile.firstName} ${profile.lastName}`}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <button
              type="button"
              onClick={() => leaveSession("/")}
              className="text-[#896542] hover:underline"
            >
              Sign out
            </button>
            <span className="text-gray-300">or</span>
            <button
              type="button"
              onClick={() => leaveSession("/")}
              className="text-[#896542] hover:underline"
            >
              Switch user
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={isEditing ? saveProfile : beginEditing}
          disabled={isSaving}
          className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
            isEditing
              ? "bg-[#896542] text-white hover:bg-[#6f4f34]"
              : "border border-[#d8c7b8] bg-white text-[#6f4f34] hover:bg-[#f7f3ef]"
          }`}
        >
          {isEditing ? (
            isSaving ? (
              "UPDATING..."
            ) : (
              "UPDATE"
            )
          ) : (
            <>
              <PencilSquareIcon className="size-4" /> Edit
            </>
          )}
        </button>
      </div>
      <section className="relative rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 sm:p-7">
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
            value={draft.phone}
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
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
              Account status
            </span>
            <p className="mt-2 inline-flex items-center gap-2 text-base font-medium capitalize text-gray-900">
              <CheckCircleIcon className="size-5 text-green-600" />
              {profile.status}
            </p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
              Background check
            </span>
            <p className="mt-2 inline-flex items-center gap-2 text-base font-medium text-gray-900">
              <ShieldCheckIcon className={`size-5 ${profile.backgroundCheckVerified ? "text-orange-500" : "text-gray-400"}`} />
              {profile.backgroundCheckVerified ? "Verified" : "Not verified"}
            </p>
          </div>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
              Appearance
            </span>
            {isEditing ? (
              <select
                name="appearanceTheme"
                value={draft.appearanceTheme || "light"}
                onChange={handleChange}
                className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 outline-none transition focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/10"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            ) : (
              <p className="mt-2 min-h-7 text-base font-medium capitalize text-gray-900">
                {profile.appearanceTheme || "light"}
              </p>
            )}
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-[#f4ede6] p-2.5 text-[#896542]">
            <BellAlertIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="century-font text-xl text-gray-900">
              Event notifications
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              This account setting applies to every upcoming event in all of
              your ministries.
            </p>
            <label className="mt-5 block max-w-sm">
              <span className="text-sm font-semibold text-gray-700">
                Notify me before an event
              </span>
              {isEditing && !profile.isManagedProfile ? (
                <select
                  name="notificationLeadMinutes"
                  value={draft.notificationLeadMinutes}
                  onChange={handleChange}
                  className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 outline-none focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/10"
                >
                  {reminderOptions.map(([minutes, label]) => (
                    <option key={minutes} value={minutes}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-lg font-semibold text-[#6f4f34]">
                  {reminderLabel}
                </p>
              )}
            </label>
            <div className="mt-5 border-t border-gray-100 pt-5">
              <p className="text-sm font-semibold text-gray-700">
                Notification methods
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {notificationChannelOptions.map(([key, label, description]) => {
                  if (key === "telegram" && !profile.telegramConnected) {
                    return null
                  }
                  const selected = Boolean(draft.notificationChannels?.[key])
                  const unavailable =
                    (key === "email" && !draft.email) ||
                    (key === "sms" && !draft.phone)
                  return (
                    <label
                      key={key}
                      className="flex items-start gap-3 rounded-xl border border-gray-100 p-4"
                    >
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
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">
                          {label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                          {unavailable
                            ? key === "email"
                              ? "Add an email address before selecting Email."
                              : "Add a telephone number before selecting SMS."
                            : description}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
              {isEditing &&
                !profile.isManagedProfile &&
                draft.notificationChannels?.sms && (
                  <label className="mt-4 flex items-start gap-3 rounded-xl border border-gray-100 p-4">
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
            <div className="mt-5 border-t border-gray-100 pt-5">
              <p className="text-sm font-semibold text-gray-700">
                What should notify me
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {notificationCategoryOptions.map(
                  ([key, label, description]) => (
                    <label
                      key={key}
                      className="flex items-start gap-3 rounded-xl border border-gray-100 p-4"
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
                        <span className="mt-1 block text-xs leading-relaxed text-gray-500">
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
                <PushNotifications />
                <TelegramNotifications
                  globalRole={profile.globalRole}
                  onConnectionChange={handleTelegramConnectionChange}
                />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-[#f4ede6] p-2.5 text-[#896542]">
            <UserGroupIcon className="size-6" />
          </span>
          <div>
            <h3 className="century-font text-xl text-gray-900">
              Ministries
            </h3>
            <p className="text-sm text-gray-500">
              {profile.ministries.length} active{" "}
              {profile.ministries.length === 1 ? "ministry" : "ministries"}
            </p>
          </div>
        </div>
        {profile.ministries.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {profile.ministries.map((ministry) => (
              <Link
                key={ministry.id}
                to={`/${ministry.slug}`}
                className="rounded-xl border border-gray-100 p-4 transition hover:border-[#C1A387] hover:bg-[#fcfaf8]"
              >
                <p className="font-semibold text-gray-900">{ministry.name}</p>
                <p className="mt-1 text-sm text-gray-500">
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
          <p className="mt-5 text-sm text-gray-500">
            No active ministry memberships.
          </p>
        )}
      </section>

      {familyData && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-[#f4ede6] p-2.5 text-[#896542]">
                <UserGroupIcon className="size-6" />
              </span>
              <div>
                <h3 className="century-font text-xl text-gray-900">Managed Profiles</h3>
                <p className="text-sm text-gray-500">Children keep their own duties and service history.</p>
              </div>
            </div>
            {!profile.isManagedProfile && (
              <button
                type="button"
                onClick={() => setShowAddChild((visible) => !visible)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]"
              >
                <PlusIcon className="size-4" /> Add Child
              </button>
            )}
          </div>

          {showAddChild && (
            <form onSubmit={addChild} className="mt-5 grid gap-3 sm:grid-cols-2">
              <input required placeholder="First name" value={childForm.firstName} onChange={(event) => setChildForm((current) => ({ ...current, firstName: event.target.value }))} className="h-11 rounded-xl border border-gray-200 px-3" />
              <input required placeholder="Last name" value={childForm.lastName} onChange={(event) => setChildForm((current) => ({ ...current, lastName: event.target.value }))} className="h-11 rounded-xl border border-gray-200 px-3" />
              <button type="submit" disabled={isSaving} className="rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">Add child profile</button>
            </form>
          )}

          {!profile.isManagedProfile && familyData.profiles.filter((item) => !item.isGuardian).length > 0 && (
            <div className="mt-5 space-y-3">
              {familyData.profiles.filter((item) => !item.isGuardian).map((child) => (
                <div key={child.id} className="rounded-xl border border-gray-100 p-4">
                  <p className="font-semibold text-gray-900">{child.firstName} {child.lastName}</p>
                  <p className="mt-1 text-sm text-gray-500">{child.relationshipStatus === "separation_pending" ? "Independent account activation pending" : "Managed child profile"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {child.guardianCount} linked {child.guardianCount === 1 ? "guardian" : "guardians"}
                    {child.hasPendingGuardianInvitation ? " · Link invitation pending" : ""}
                  </p>
                  {child.relationshipStatus === "active" && familyData.ministries.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select value={requestMinistryId} onChange={(event) => setRequestMinistryId(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                        <option value="">Request ministry access</option>
                        {familyData.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
                      </select>
                      <button type="button" disabled={!requestMinistryId || isSaving} onClick={() => runFamilyAction({ action: "request_membership", profileId: child.id, ministryId: requestMinistryId })} className="rounded-lg border border-[#d8c7b8] px-3 py-2 text-sm font-semibold text-[#6f4f34]">Send request</button>
                    </div>
                  )}
                  {child.relationshipStatus === "active" && (
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
                        className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3"
                      />
                      <button type="submit" disabled={!guardianEmail || isSaving} className="rounded-xl bg-[#896542] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        Send link
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {profile.isManagedProfile && (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-gray-100 p-4">
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
                    <input id="active-child-guardian-email" type="email" required autoComplete="email" placeholder="Other guardian's account email" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3" />
                    <button type="submit" disabled={!guardianEmail || isSaving} className="rounded-xl bg-[#896542] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send link</button>
                  </form>
                )}
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="font-semibold text-gray-900">Create an independent account</p>
                <p className="mt-1 text-sm text-gray-500">
                  {separationPending
                    ? "An activation invitation is pending. You can resend it, use a corrected email, or cancel the separation."
                    : "A verified activation email will add a private login while keeping every ministry, assignment, and completed duty on this profile."}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input type="email" required placeholder="New email address" value={separationEmail} onChange={(event) => setSeparationEmail(event.target.value)} className="h-11 flex-1 rounded-xl border border-gray-200 px-3" />
                  <button type="button" disabled={!separationEmail || isSaving} onClick={() => runFamilyAction({ action: "start_separation", profileId: profile.id, email: separationEmail })} className="rounded-xl border border-[#d8c7b8] px-4 py-2 text-sm font-semibold text-[#6f4f34]">
                    {separationPending ? "Resend activation" : "Send activation"}
                  </button>
                  {separationPending && (
                    <button type="button" disabled={isSaving} onClick={cancelSeparation} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
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
