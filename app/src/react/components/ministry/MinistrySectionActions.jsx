import * as React from "react"

const MinistrySectionActions = ({ actions, label }) => {
  const visibleActions = actions.filter((action) => !action.hidden)

  const renderAction = (action, mobile = false) => {
    const Icon = action.icon
    return (
      <button
        key={action.id}
        type="button"
        data-guide-id={`action-${action.id}`}
        onClick={action.onClick}
        disabled={action.disabled}
        aria-pressed={action.active === undefined ? undefined : action.active}
        className={`flex min-w-0 items-center justify-center rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
          mobile
            ? "flex-col gap-1 px-1 py-2 text-[11px]"
            : "gap-2 px-3 py-2 text-sm"
        } ${
          action.active
            ? "bg-white text-[#6f4f34] shadow-sm"
            : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
        }`}
      >
        {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
        <span className="min-w-0 whitespace-nowrap text-center leading-tight">{action.label}</span>
      </button>
    )
  }

  return (
    <>
      <nav aria-label={label} className="hidden shrink-0 justify-center lg:flex">
        <div
          className="grid gap-1 rounded-2xl bg-gray-50 p-1.5 shadow-sm ring-1 ring-gray-100"
          style={{ gridTemplateColumns: `repeat(${visibleActions.length}, minmax(0, 1fr))` }}
        >
          {visibleActions.map((action) => renderAction(action))}
        </div>
      </nav>
      <nav
        aria-label={label}
        className="ministry-mobile-actions fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(63,45,29,0.10)] backdrop-blur lg:hidden"
      >
        <div
          className="mx-auto grid max-w-xl gap-1"
          style={{ gridTemplateColumns: `repeat(${visibleActions.length}, minmax(0, 1fr))` }}
        >
          {visibleActions.map((action) => renderAction(action, true))}
        </div>
      </nav>
    </>
  )
}

export default MinistrySectionActions
