import * as React from "react"

const Bar = ({ className = "" }) => (
  <div className={`rounded-full bg-gray-200 ${className}`} />
)

const LoadingRegion = ({ label, children }) => (
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    className="animate-pulse"
  >
    <span className="sr-only">{label}</span>
    {children}
  </div>
)

const MinistryCardGridSkeleton = ({
  label = "Loading content",
  count = 4,
}) => (
  <LoadingRegion label={label}>
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="size-9 rounded-xl bg-gray-200" />
            <Bar className="h-5 w-16" />
          </div>
          <Bar className="mt-5 h-5 w-2/3" />
          <Bar className="mt-3 h-3 w-full" />
          <Bar className="mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  </LoadingRegion>
)

const MinistryListSkeleton = ({
  label = "Loading list",
  count = 5,
}) => (
  <LoadingRegion label={label}>
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="min-w-0 flex-1">
          <Bar className="h-5 w-40" />
          <Bar className="mt-2 h-3 w-56 max-w-full" />
        </div>
        <Bar className="h-9 w-24" />
      </div>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="size-10 shrink-0 rounded-full bg-gray-200" />
          <div className="min-w-0 flex-1">
            <Bar className="h-4 w-1/3" />
            <Bar className="mt-2 h-3 w-1/2" />
          </div>
          <Bar className="h-7 w-16" />
        </div>
      ))}
    </div>
  </LoadingRegion>
)

const MinistryOpenRolesSkeleton = ({ count = 2 }) => (
  <LoadingRegion label="Loading eligible members for open roles">
    <div className="space-y-3">
      {Array.from({ length: count }, (_, eventIndex) => (
        <div
          key={eventIndex}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Bar className="h-3 w-32" />
              <Bar className="mt-3 h-5 w-52 max-w-full" />
            </div>
            <Bar className="h-9 w-20" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, roleIndex) => (
              <div
                key={roleIndex}
                className="rounded-xl bg-gray-50 p-3"
              >
                <Bar className="h-3 w-24" />
                <div className="mt-2 h-10 rounded-lg border border-gray-200 bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </LoadingRegion>
)

export {
  MinistryCardGridSkeleton,
  MinistryListSkeleton,
  MinistryOpenRolesSkeleton,
}
