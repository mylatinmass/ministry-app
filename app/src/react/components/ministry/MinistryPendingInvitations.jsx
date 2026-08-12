import * as React from "react"
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))

const MinistryPendingInvitations = ({
  invitations = [],
  onAction,
  disabled = false,
}) => (
  <div className="space-y-3">
    {invitations.length ? (
      invitations.map((invitation) => (
        <article
          key={invitation.id}
          className="rounded-xl border border-amber-100 bg-amber-50/50 p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words font-semibold text-gray-900">
                Private email invitation
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {invitation.ministryNames.join(", ")}
              </p>
              {invitation.requestedByName && (
                <p className="mt-1 text-xs text-gray-500">
                  Invited by {invitation.requestedByName}
                </p>
              )}
              <p
                className={`mt-2 flex items-center gap-1 text-xs font-semibold ${
                  invitation.expired ? "text-red-700" : "text-amber-700"
                }`}
              >
                {invitation.expired ? (
                  <ClockIcon className="size-4" />
                ) : (
                  <CheckCircleIcon className="size-4" />
                )}
                {invitation.expired
                  ? "Expired — resend to issue a new link"
                  : `Awaiting response · expires ${formatDate(invitation.expiresAt)}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAction("resend_invitation", invitation)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8c7b8] bg-white px-3 py-2 text-xs font-semibold text-[#6f4f34] disabled:opacity-50"
              >
                <ArrowPathIcon className="size-4" />
                Resend
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this invitation? The existing invitation link will stop working.",
                    )
                  ) {
                    onAction("cancel_invitation", invitation)
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
              >
                <XCircleIcon className="size-4" />
                Cancel
              </button>
            </div>
          </div>
        </article>
      ))
    ) : (
      <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
        No pending invitations.
      </p>
    )}
  </div>
)

export default MinistryPendingInvitations
