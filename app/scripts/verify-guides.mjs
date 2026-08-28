import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { buildGuide } from "../src/react/components/ministry/ministryGuideDefinitions.js"

const root = process.cwd()
const documentation = await fs.readFile(
  path.join(root, "src/content/ministry-documentation.md"),
  "utf8",
)

assert.match(documentation, /guide:\s*\n\s*version: 1/)
assert.match(documentation, /coverage: all-completed-topics/)
assert.match(documentation, /commitPolicy: explain-without-submitting/)

const topics = []
let current = null
let section = ""

for (const rawLine of documentation.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (line.startsWith("## ")) {
    if (current) topics.push(current)
    current = {
      title: line.slice(3).trim(),
      purpose: "",
      note: "",
      steps: [],
      guideMode: "auto",
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
    const json = line
      .replace("<!-- guide-step:", "")
      .replace(/-->$/, "")
      .trim()
    current.guideOverrides[current.steps.length - 1] = JSON.parse(json)
    continue
  }
  if (line.startsWith("**Purpose:**")) {
    current.purpose = line.replace("**Purpose:**", "").trim()
    continue
  }
  if (line === "### How to") {
    section = "how-to"
    continue
  }
  if (!line || section !== "how-to") continue
  const prefixedFirstStep = line.match(/^(.+?):\s*1\.\s+(.+)$/)
  if (prefixedFirstStep) {
    current.note = prefixedFirstStep[1].replace(/^\*\*|\*\*$/g, "").trim()
    current.steps.push(prefixedFirstStep[2].trim())
    continue
  }
  const step = line.match(/^\d+\.\s+(.+)$/)
  if (step) current.steps.push(step[1].trim())
}
if (current) topics.push(current)

assert.ok(topics.length > 0, "Documentation must contain at least one topic")
const stepCount = topics.reduce((total, topic) => total + topic.steps.length, 0)
assert.ok(stepCount >= topics.length, "Every topic must contain at least one step")
const guideIds = new Set()
const modeCounts = { target: 0, information: 0, commit: 0 }
for (const topic of topics) {
  assert.equal(topic.guideMode, "auto", `${topic.title} is missing guide metadata`)
  assert.ok(topic.purpose, `${topic.title} is missing its purpose`)
  assert.ok(topic.steps.length, `${topic.title} has no steps`)
  const guide = buildGuide(topic)
  assert.ok(guide.id, `${topic.title} has no guide ID`)
  assert.ok(!guideIds.has(guide.id), `Duplicate guide ID: ${guide.id}`)
  guideIds.add(guide.id)
  assert.equal(
    guide.steps.length,
    topic.steps.length,
    `${topic.title} does not map every written step`,
  )
  for (const step of guide.steps) {
    assert.ok(["target", "information", "commit"].includes(step.mode))
    modeCounts[step.mode] += 1
    assert.ok(step.instruction)
    if (step.mode === "target") {
      assert.ok(step.target)
      assert.match(
        step.target,
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        `${topic.title} references an invalid target ID`,
      )
    }
    if (step.mode === "commit") assert.equal(step.event, "continue")
  }
}

console.log(
  `Verified ${topics.length} guides and ${stepCount} mapped documentation steps (${modeCounts.target} spotlight, ${modeCounts.information} informational, ${modeCounts.commit} protected final actions).`,
)
