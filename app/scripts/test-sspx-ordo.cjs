const test = require("node:test")
const assert = require("node:assert/strict")
const loadOrdo = () => import("../src/server/scheduling/sspx-ordo.mjs").then(({ default: ordo }) => ordo)
const day = {
  date: "2026-04-03",
  celebration: { id: 81, name: "Good <span>Friday</span>", rank: "1", color: "niger", colorOfficii: "violaceus" },
  votives: [{ id: 90, name: "An optional Mass", color: "albus" }],
}
test("maps the existing Ministry response fields without giving optional Masses the default rubrics", async () => {
  const { toMinistryDay } = await loadOrdo()
  const data = toMinistryDay({ day, regulae: { directives: [
    { section: "missa", code: "gloria", level: "vetitum", label: "No Gloria" },
    { scope: "officium", label: "Office", hint: "Office details" },
  ] } }, day.date)
  assert.equal(data.celebration, "Good Friday")
  assert.equal(data.classLabel, "I Class")
  assert.equal(data.vestmentColor, "Black")
  assert.equal(data.massOptions[0].gloria, false)
  assert.equal(data.massOptions[1].gloria, null)
  assert.equal(data.massOptions[1].vestmentColor, "White")
  assert.equal(data.breviary.Office, "Office details")
  assert.throws(() => toMinistryDay({ day }, "2026-04-04"), /different date/)
})
test("uses the U.S. SSPX settings and rejects a mismatched calendar", async () => {
  const { getCalendar } = await loadOrdo()
  await assert.rejects(getCalendar("2026/04/03", { rules: true, fetchImpl: async value => {
    const url = new URL(value)
    assert.equal(url.searchParams.get("source"), "civitates-foederatae")
    assert.equal(url.searchParams.get("congregation"), "fsspx")
    assert.equal(url.searchParams.get("regulae"), "1")
    return { ok: true, json: async () => ({ source: "other" }) }
  } }), /unexpected calendar/)
})

test("distinguishes abstinence, partial abstinence during a fast, and a complete fast", async () => {
  const { toMinistryDay } = await loadOrdo()
  for (const [rules, label] of [
    [{ fast: false, abstinence: true }, "Complete abstinence"],
    [{ fast: true, abstinence: "partial" }, "Fast and partial abstinence"],
    [{ fast: true, abstinence: true }, "Fast and complete abstinence"],
    [{ fast: false, abstinence: false }, ""],
  ]) {
    const result = toMinistryDay({ day: { ...day, observances: { fsspx: rules } } }, day.date)
    assert.equal(result.fastingObservance, label)
  }
})

test("refresh only updates the cached reference; approved event data survives a source change and outage", async () => {
  const ordo = await loadOrdo()
  const fs = require("node:fs")
  const path = require("node:path")
  const vm = require("node:vm")
  const ts = require("typescript")
  const source = fs.readFileSync(path.join(__dirname, "../src/server/scheduling/ordo.ts"), "utf8")
  const compiled = ts.transpileModule(source + "\nexport { loadOrdoDay, loadSelection }", {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const exports = {}
  let outage = false
  vm.runInNewContext(compiled, {
    exports, console, process: { env: {} },
    require: id => {
      if (id === "node:crypto") return require(id)
      if (id === "./sspx-ordo.mjs") return {
        ...ordo,
        getCalendar: async () => {
          if (outage) throw new Error("Ordo unavailable")
          return { day }
        },
      }
      return {}
    },
  })
  let cached = { id: "existing-day", liturgical_date: day.date, source_hash: "old", source_url: "https://1962ordo.today/day/old", fetched_at: new Date().toISOString() }
  const approved = {
    ordo_day_id: cached.id,
    selected_mass_option_id: "mass-1",
    selected_mass_option_snapshot: { id: "mass-1", label: "Approved selection" },
    sacristy_notes: "Approved notes",
    source_hash_at_selection: "old",
  }
  let writes = 0
  const client = { query: async (sql, params) => {
    if (sql.includes("INSERT INTO ordo_days")) {
      writes++
      cached = { ...cached, celebration: params[1], source_url: params[9], source_hash: params[12] }
      return { rows: [cached] }
    }
    if (/^SELECT \* FROM ordo_days/.test(sql.trim())) return { rows: [cached] }
    if (/^SELECT \*\s+FROM event_ordo_selections/.test(sql.trim())) return { rows: [approved] }
    assert.fail("Unexpected database operation: " + sql)
  } }
  const fresh = await exports.loadOrdoDay(client, day.date)
  assert.equal(fresh.id, cached.id)
  assert.equal(fresh.dataSource, "sspx_ordo")
  const selection = await exports.loadSelection(client, "event", fresh, {
    event: { start_time: day.date }, canViewRelated: true,
  })
  assert.equal(selection.sourceChanged, true)
  assert.deepEqual(selection.selectedMassOption, approved.selected_mass_option_snapshot)
  assert.equal(selection.sacristyNotes, "Approved notes")
  outage = true
  const stale = await exports.loadOrdoDay(client, day.date, true)
  assert.equal(stale.stale, true)
  assert.equal(stale.sourceHash, fresh.sourceHash)
  assert.equal(writes, 1)
})
