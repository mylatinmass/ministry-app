import * as React from "react"

export const Link = React.forwardRef(function Link(
  { to, children, ...props },
  ref,
) {
  return (
    <a ref={ref} href={to} {...props}>
      {children}
    </a>
  )
})

export const navigate = (to) => {
  window.location.assign(to)
}
