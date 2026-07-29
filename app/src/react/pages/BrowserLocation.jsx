import * as React from "react"

const BrowserLocation = ({ component: Component }) => {
  const [location, setLocation] = React.useState(null)

  React.useEffect(() => {
    setLocation({
      hash: window.location.hash,
      search: window.location.search,
      pathname: window.location.pathname,
    })
  }, [])

  if (!location) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
        Opening…
      </div>
    )
  }

  return <Component location={location} />
}

export default BrowserLocation
