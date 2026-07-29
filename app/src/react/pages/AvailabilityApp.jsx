import * as React from "react"
import { Link } from "../compat/gatsby"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import BrowserLocation from "./BrowserLocation"
import MinistryAvailability from "../components/ministry/MinistryAvailability"
import MinistryRouteGuard from "../components/ministry/MinistryRouteGuard"

const AvailabilityPage = ({ location }) => (
  <MinistryRouteGuard location={location}>
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white px-4 py-3">
        <div className="mx-auto flex w-11/12 max-w-5xl items-center gap-3">
          <Link
            to="/ministry"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#6f4f34] hover:bg-gray-50"
          >
            <ArrowLeftIcon className="size-5" />
            Ministries
          </Link>
          <span className="ml-auto text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
            Account availability
          </span>
        </div>
      </header>
      <div className="mx-auto w-11/12 max-w-5xl py-6 sm:py-10">
        <MinistryAvailability />
      </div>
    </main>
  </MinistryRouteGuard>
)

const AvailabilityApp = () => (
  <BrowserLocation component={AvailabilityPage} />
)

export default AvailabilityApp
