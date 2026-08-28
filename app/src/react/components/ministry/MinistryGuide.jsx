import * as React from "react"
import { createPortal } from "react-dom"
import { XMarkIcon } from "@heroicons/react/24/outline"
import { GUIDE_TARGET_SELECTOR } from "./ministryGuideDefinitions"

const GuideContext = React.createContext(null)
const HANDOFF_KEY = "ministry_guide_navigation_handoff"
const HANDOFF_TTL = 15_000
const ROLE_LEVEL = { member: 0, admin: 1, owner: 3, super_admin: 3 }
const OVERLAY_CLASS = "pointer-events-auto bg-gray-950/65 backdrop-blur-[1px]"

const isVisible = (element) => {
  if (!element) return false
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0 &&
    rect.width > 0 &&
    rect.height > 0
  )
}

const findVisibleTarget = (target) =>
  Array.from(document.querySelectorAll(GUIDE_TARGET_SELECTOR(target))).find(
    isVisible,
  ) || null

const readHandoff = () => {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(HANDOFF_KEY) || "null")
    window.sessionStorage.removeItem(HANDOFF_KEY)
    if (!value || Date.now() - value.createdAt > HANDOFF_TTL) return null
    return value.state
  } catch (error) {
    window.sessionStorage.removeItem(HANDOFF_KEY)
    return null
  }
}

const writeHandoff = (state) => {
  try {
    window.sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({ createdAt: Date.now(), state }),
    )
  } catch (error) {
    // A guide remains usable even when session storage is unavailable.
  }
}

const roleAllows = (role, requiredRole) => {
  const normalized = role === "owner" ? "owner" : role || "member"
  return (ROLE_LEVEL[normalized] || 0) >= (ROLE_LEVEL[requiredRole] || 0)
}

const targetValueIsValid = (target) => {
  if (!target) return false
  if (target instanceof HTMLInputElement) {
    if (["checkbox", "radio"].includes(target.type)) return target.checked
    return target.checkValidity() && target.value.trim().length > 0
  }
  if (target instanceof HTMLSelectElement) {
    return target.checkValidity() && target.value !== ""
  }
  if (target instanceof HTMLTextAreaElement) {
    return target.checkValidity() && target.value.trim().length > 0
  }
  return true
}

const GuideSpotlight = ({ state, step, target, rect, unavailable, onAdvance, onCancel }) => {
  const closeRef = React.useRef(null)
  const isTargetStep = step.mode === "target" && target && rect && !unavailable
  const isFinal = state.stepIndex === state.guide.steps.length - 1
  const padding = 7
  const hole = rect
    ? {
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        right: Math.min(window.innerWidth, rect.right + padding),
        bottom: Math.min(window.innerHeight, rect.bottom + padding),
      }
    : null
  const cardWidth = Math.min(360, window.innerWidth - 24)
  const cardLeft = hole
    ? Math.min(
        Math.max(12, hole.left + (hole.right - hole.left - cardWidth) / 2),
        window.innerWidth - cardWidth - 12,
      )
    : Math.max(12, (window.innerWidth - cardWidth) / 2)
  const cardTop = hole
    ? hole.bottom + 170 <= window.innerHeight
      ? hole.bottom + 12
      : Math.max(12, hole.top - 182)
    : Math.max(16, window.innerHeight / 2 - 120)

  React.useEffect(() => {
    if (!isTargetStep) closeRef.current?.focus()
  }, [isTargetStep, state.stepIndex])

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[10000]" aria-live="polite">
      {isTargetStep ? (
        <>
          <div className={`fixed left-0 right-0 top-0 ${OVERLAY_CLASS}`} style={{ height: hole.top }} />
          <div className={`fixed bottom-0 left-0 right-0 ${OVERLAY_CLASS}`} style={{ top: hole.bottom }} />
          <div className={`fixed left-0 ${OVERLAY_CLASS}`} style={{ top: hole.top, width: hole.left, height: hole.bottom - hole.top }} />
          <div className={`fixed right-0 ${OVERLAY_CLASS}`} style={{ top: hole.top, left: hole.right, height: hole.bottom - hole.top }} />
          <div
            className="pointer-events-none fixed rounded-xl ring-4 ring-white shadow-[0_0_0_3px_#896542,0_12px_40px_rgba(0,0,0,0.35)]"
            style={{ top: hole.top, left: hole.left, width: hole.right - hole.left, height: hole.bottom - hole.top }}
          />
        </>
      ) : (
        <div className={`fixed inset-0 ${OVERLAY_CLASS}`} />
      )}

      <section
        role={isTargetStep ? "region" : "dialog"}
        aria-modal={isTargetStep ? undefined : "true"}
        aria-labelledby="ministry-guide-title"
        aria-describedby="ministry-guide-instruction"
        className="pointer-events-auto fixed rounded-2xl border border-white/30 bg-white p-5 text-gray-900 shadow-2xl"
        style={{ top: cardTop, left: cardLeft, width: cardWidth }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#896542]">
              Step {state.stepIndex + 1} of {state.guide.steps.length}
            </p>
            <h2 id="ministry-guide-title" className="mt-1 truncate font-semibold text-gray-950">
              {state.guide.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            aria-label="Cancel guide"
            className="-mr-2 -mt-2 shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#896542]"
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>
        <p id="ministry-guide-instruction" className="mt-3 text-sm leading-relaxed text-gray-700">
          {unavailable
            ? "This step is not available with the current account or app state. Complete the written prerequisite, then try this guide again."
            : step.instruction}
        </p>
        {isTargetStep ? (
          <p className="mt-3 text-xs font-semibold text-[#6f4f34]">
            Use the highlighted control to continue.
          </p>
        ) : (
          <button
            type="button"
            onClick={onAdvance}
            className="mt-4 w-full rounded-xl bg-[#896542] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6f4f34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#896542]"
          >
            {unavailable ? "End Guide" : step.mode === "commit" || isFinal ? "Finish Guide" : "Continue"}
          </button>
        )}
      </section>
    </div>,
    document.body,
  )
}

const MinistryGuideProvider = ({ children, role = "member" }) => {
  const [state, setState] = React.useState(() =>
    typeof window === "undefined" ? null : readHandoff(),
  )
  const [target, setTarget] = React.useState(null)
  const [rect, setRect] = React.useState(null)
  const [unavailable, setUnavailable] = React.useState(false)
  const previousFocusRef = React.useRef(null)

  const cancel = React.useCallback(() => {
    window.sessionStorage.removeItem(HANDOFF_KEY)
    setState(null)
    setTarget(null)
    setRect(null)
    setUnavailable(false)
  }, [])

  const completeOrAdvance = React.useCallback(() => {
    setState((current) => {
      if (!current) return null
      if (current.stepIndex >= current.guide.steps.length - 1) return null
      return { ...current, stepIndex: current.stepIndex + 1 }
    })
    setUnavailable(false)
  }, [])

  const startGuide = React.useCallback(
    (guide) => {
      previousFocusRef.current = document.activeElement
      const permitted = roleAllows(role, guide.requiredRole)
      setState({
        guide: permitted
          ? guide
          : {
              ...guide,
              steps: [
                {
                  id: "access-required",
                  mode: "information",
                  event: "continue",
                  instruction: `This guide requires ${guide.requiredRole.replace("_", " ")} access. Ask a ministry administrator if you need to complete this task.`,
                },
              ],
            },
        stepIndex: 0,
      })
      setUnavailable(false)
    },
    [role],
  )

  const step = state?.guide.steps[state.stepIndex]

  React.useEffect(() => {
    if (!state) {
      document.documentElement.style.removeProperty("overflow")
      document.body.style.removeProperty("overflow")
      previousFocusRef.current?.focus?.()
      return undefined
    }
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [Boolean(state)])

  React.useEffect(() => {
    if (!state || !step || step.mode !== "target") {
      setTarget(null)
      setRect(null)
      return undefined
    }

    let timeout
    let frame
    const locateTarget = () => {
      let nextTarget = findVisibleTarget(step.target)
      if (!nextTarget && step.target.startsWith("account-nav-")) {
        nextTarget = findVisibleTarget("account-menu")
      }
      if (!nextTarget && step.target.startsWith("ministry-nav-")) {
        nextTarget = findVisibleTarget("ministry-menu")
      }
      return nextTarget
    }
    const resolve = () => {
      const nextTarget = locateTarget()
      setTarget(nextTarget)
      if (nextTarget) {
        window.clearTimeout(timeout)
        setUnavailable(false)
        const htmlOverflow = document.documentElement.style.overflow
        const bodyOverflow = document.body.style.overflow
        document.documentElement.style.overflow = ""
        document.body.style.overflow = ""
        nextTarget.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" })
        document.documentElement.style.overflow = htmlOverflow
        document.body.style.overflow = bodyOverflow
        setRect(nextTarget.getBoundingClientRect())
        window.setTimeout(() => nextTarget.focus?.({ preventScroll: true }), 0)
      } else {
        setRect(null)
      }
    }
    if (
      step.target === "account-menu" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      window.setTimeout(completeOrAdvance, 0)
      return undefined
    }
    const scheduleResolve = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(resolve)
    }
    resolve()
    const observer = new MutationObserver(scheduleResolve)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("resize", scheduleResolve)
    window.addEventListener("scroll", scheduleResolve, true)
    timeout = window.setTimeout(() => {
      if (!locateTarget()) setUnavailable(true)
    }, 2500)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      window.removeEventListener("resize", scheduleResolve)
      window.removeEventListener("scroll", scheduleResolve, true)
    }
  }, [completeOrAdvance, state?.stepIndex, step?.target, step?.mode])

  React.useEffect(() => {
    if (!state || !step || step.mode !== "target") return undefined
    const handleInteraction = (event) => {
      const desired = event.target.closest?.(GUIDE_TARGET_SELECTOR(step.target))
      const menuFallback = event.target.closest?.(
        step.target.startsWith("account-nav-")
          ? GUIDE_TARGET_SELECTOR("account-menu")
          : step.target.startsWith("ministry-nav-")
            ? GUIDE_TARGET_SELECTOR("ministry-menu")
            : "[data-guide-never]",
      )
      if (menuFallback && !desired) return
      if (!desired) return
      if (["input", "change"].includes(step.event) && !targetValueIsValid(desired)) return

      const anchor = desired.closest("a[href]")
      if (anchor) {
        const destination = new URL(anchor.href, window.location.href)
        if (destination.origin === window.location.origin && destination.pathname !== window.location.pathname) {
          const nextIndex = state.stepIndex + 1
          if (nextIndex < state.guide.steps.length) {
            writeHandoff({ ...state, stepIndex: nextIndex })
          }
          return
        }
      }
      window.setTimeout(completeOrAdvance, 0)
    }
    const eventName = step.event === "input" ? "input" : step.event === "change" ? "change" : "click"
    document.addEventListener(eventName, handleInteraction, true)
    return () => document.removeEventListener(eventName, handleInteraction, true)
  }, [completeOrAdvance, state, step])

  React.useEffect(() => {
    if (!state) return undefined
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        cancel()
        return
      }
      if (event.key !== "Tab") return
      const allowed = [
        target,
        ...document.querySelectorAll('[aria-label="Cancel guide"], [aria-describedby="ministry-guide-instruction"] button'),
      ].filter(Boolean)
      if (!allowed.length) return
      const currentIndex = allowed.indexOf(document.activeElement)
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? allowed.length - 1
          : currentIndex - 1
        : currentIndex >= allowed.length - 1
          ? 0
          : currentIndex + 1
      event.preventDefault()
      allowed[nextIndex]?.focus?.()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [cancel, state, target])

  const contextValue = React.useMemo(
    () => ({ activeGuide: state?.guide || null, startGuide, cancelGuide: cancel }),
    [cancel, startGuide, state?.guide],
  )

  return (
    <GuideContext.Provider value={contextValue}>
      {children}
      {state && step && typeof document !== "undefined" && (
        <GuideSpotlight
          state={state}
          step={step}
          target={target}
          rect={rect}
          unavailable={unavailable}
          onAdvance={unavailable ? cancel : completeOrAdvance}
          onCancel={cancel}
        />
      )}
    </GuideContext.Provider>
  )
}

const useMinistryGuide = () => {
  const context = React.useContext(GuideContext)
  if (!context) throw new Error("useMinistryGuide must be used inside MinistryGuideProvider")
  return context
}

export { MinistryGuideProvider, useMinistryGuide }
