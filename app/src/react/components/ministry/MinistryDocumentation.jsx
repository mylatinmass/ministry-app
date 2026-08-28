import * as React from "react"
import {
  ChevronDownIcon,
  CursorArrowRaysIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import documentationSource from "../../../content/ministry-documentation.md?raw"
import { useMinistryGuide } from "./MinistryGuide"
import { buildGuide } from "./ministryGuideDefinitions"

const normalizeSearchText = (value = "") =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const parseDocumentation = (source) => {
  const topics = []
  let current = null
  let section = ""

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (line.startsWith("## ")) {
      if (current) topics.push(current)
      current = {
        title: line.slice(3).trim(),
        purpose: "",
        note: "",
        steps: [],
        guideMode: "",
        guideOverrides: {},
      }
      section = ""
      continue
    }
    if (!current) continue

    if (line === "<!-- guide: auto -->") {
      current.guideMode = "auto"
      continue
    }

    if (line.startsWith("<!-- guide-step:") && current.steps.length) {
      try {
        const json = line
          .replace("<!-- guide-step:", "")
          .replace(/-->$/, "")
          .trim()
        current.guideOverrides[current.steps.length - 1] = JSON.parse(json)
      } catch (error) {
        // Invalid directives are surfaced by the static documentation validator.
      }
      continue
    }

    if (line === "### How to") {
      section = "how-to"
      continue
    }
    if (line.startsWith("**Purpose:**")) {
      current.purpose = line.replace("**Purpose:**", "").trim()
      continue
    }
    if (!line || section !== "how-to") continue

    const prefixedFirstStep = line.match(/^(.+?):\s*1\.\s+(.+)$/)
    if (prefixedFirstStep) {
      const note = prefixedFirstStep[1].replace(/^\*\*|\*\*$/g, "").trim()
      current.note = current.note ? `${current.note} ${note}` : note
      current.steps.push(prefixedFirstStep[2].trim())
      continue
    }

    const step = line.match(/^\d+\.\s+(.+)$/)
    if (step) {
      current.steps.push(step[1].trim())
      continue
    }

    const note = line.replace(/^\*\*(.+)\*\*$/, "$1").trim()
    current.note = current.note ? `${current.note} ${note}` : note
  }

  if (current) topics.push(current)
  return topics
    .filter(
      (topic) =>
        topic.title &&
        topic.purpose &&
        topic.steps.length &&
        topic.guideMode === "auto",
    )
    .map((topic) => ({ ...topic, guide: buildGuide(topic) }))
    .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }))
}

const documentationTopics = parseDocumentation(documentationSource)

const MinistryDocumentation = () => {
  const { startGuide } = useMinistryGuide()
  const [query, setQuery] = React.useState("")
  const [openTitle, setOpenTitle] = React.useState("")
  const normalizedQuery = normalizeSearchText(query)

  const visibleTopics = React.useMemo(() => {
    if (!normalizedQuery) return documentationTopics

    return documentationTopics
      .map((topic) => {
        const title = normalizeSearchText(topic.title)
        const purpose = normalizeSearchText(topic.purpose)
        const rank = title.startsWith(normalizedQuery)
          ? 0
          : title.includes(normalizedQuery)
            ? 1
            : purpose.includes(normalizedQuery)
              ? 2
              : null
        return { topic, rank }
      })
      .filter(({ rank }) => rank !== null)
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.topic.title.localeCompare(b.topic.title, "en", {
            sensitivity: "base",
          }),
      )
      .map(({ topic }) => topic)
  }, [normalizedQuery])

  React.useEffect(() => {
    if (
      openTitle &&
      !visibleTopics.some((topic) => topic.title === openTitle)
    ) {
      setOpenTitle("")
    }
  }, [openTitle, visibleTopics])

  return (
    <section aria-labelledby="documentation-title" className="mx-auto max-w-5xl">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
          Support documentation
        </p>
        <h2 id="documentation-title" className="mt-2 century-font text-3xl text-gray-950">
          How can we help?
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          Search completed Ministry App features by name or purpose, then open a
          topic for step-by-step instructions.
        </p>

        <label className="relative mt-6 block">
          <span className="sr-only">Search documentation</span>
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documentation"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-11 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#896542] focus:ring-2 focus:ring-[#896542]/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear documentation search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <XMarkIcon className="size-4" />
            </button>
          )}
        </label>

        <p className="mt-3 text-xs font-medium text-gray-500" role="status">
          {visibleTopics.length} {visibleTopics.length === 1 ? "guide" : "guides"}
        </p>
      </div>

      {visibleTopics.length ? (
        <div className="mt-4 space-y-3">
          {visibleTopics.map((topic) => {
            const isOpen = openTitle === topic.title
            const panelId = `documentation-${topic.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")}`

            return (
              <article
                key={topic.title}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenTitle(isOpen ? "" : topic.title)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-[#fbf8f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#896542] sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-gray-950">
                      {topic.title}
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-gray-600">
                      {topic.purpose}
                    </span>
                  </span>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className={`mt-1 size-5 shrink-0 text-[#896542] transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div id={panelId} className="border-t border-gray-100 px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#896542]">
                        How to
                      </h3>
                      <button
                        type="button"
                        onClick={() => startGuide(topic.guide)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#896542] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6f4f34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#896542]"
                      >
                        <CursorArrowRaysIcon aria-hidden="true" className="size-5" />
                        Guide Me
                      </button>
                    </div>
                    {topic.note && (
                      <p className="mt-3 text-sm font-semibold text-gray-700">
                        {topic.note}
                      </p>
                    )}
                    <ol className="mt-3 space-y-3">
                      {topic.steps.map((step, index) => (
                        <li key={`${topic.title}-${index}`} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f4ede6] text-xs font-bold text-[#6f4f34]">
                            {index + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center">
          <p className="font-semibold text-gray-800">No documentation found</p>
          <p className="mt-1 text-sm text-gray-500">
            Try a feature name or describe what you want to accomplish.
          </p>
        </div>
      )}
    </section>
  )
}

export { documentationTopics, parseDocumentation }
export default MinistryDocumentation
