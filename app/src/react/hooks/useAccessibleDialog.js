import * as React from "react"

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

const useAccessibleDialog = (open, onClose) => {
  const dialogRef = React.useRef(null)
  const returnFocusRef = React.useRef(null)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => {
    if (!open) return undefined
    returnFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    const focusable = Array.from(dialog?.querySelectorAll(FOCUSABLE) || [])
    ;(focusable[0] || dialog)?.focus?.()

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (event.key !== "Tab" || !dialog) return
      const controls = Array.from(dialog.querySelectorAll(FOCUSABLE))
      if (!controls.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      returnFocusRef.current?.focus?.()
    }
  }, [open])

  return dialogRef
}

export default useAccessibleDialog
