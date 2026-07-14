import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

const [app, navigation] = await Promise.all([
  read("src/App.tsx"),
  read("src/components/responsive-section-tabs.tsx"),
])

test("record-level section navigation uses one responsive accessible component", () => {
  assert.match(navigation, /<div className="md:hidden"/)
  assert.match(navigation, /<Label htmlFor=\{`\$\{id\}-mobile`\} className="sr-only">\{label\}<\/Label>/)
  assert.match(navigation, /<Select value=\{value\} onValueChange=\{onValueChange\}>/)
  assert.match(navigation, /<SelectTrigger[\s\S]*className="w-full min-w-0"[\s\S]*aria-label=\{label\}/)
  assert.match(navigation, /<TabsList className="hidden md:flex md:w-fit" aria-label=\{label\}>/)
  assert.match(navigation, /className=\{cn\("min-w-24", triggerClassName\)\}/)
})

test("accounts, opportunity modes, opportunity sections, and playbooks share mobile navigation", () => {
  for (const id of ["account-sections", "opportunity-modes", "opportunity-sections", "playbook-sections"]) {
    assert.match(app, new RegExp(`<ResponsiveSectionTabs[\\s\\S]*?id="${id}"`), `missing ${id}`)
  }

  assert.match(app, /id="account-sections"[\s\S]*label="Account section"/)
  assert.match(app, /id="opportunity-modes"[\s\S]*label="Opportunity workspace"/)
  assert.match(app, /id="opportunity-sections"[\s\S]*label="Opportunity section"/)
  assert.match(app, /id="playbook-sections"[\s\S]*label="Playbook section"/)
})

test("local call-analysis filters remain compact tabs rather than record navigation", () => {
  const liveCoachDetail = app.slice(
    app.indexOf("function LiveCoachDetailTabs("),
    app.indexOf("function PriorityGapsCard(")
  )
  const liveCapture = app.slice(
    app.indexOf("function LiveRail("),
    app.indexOf("function LiveCaptureEmptyState(")
  )

  assert.match(liveCoachDetail, /<TabsTrigger value="gaps">Gaps<\/TabsTrigger>/)
  assert.match(liveCapture, /<TabsTrigger value="transcript">Transcript<\/TabsTrigger>/)
  assert.doesNotMatch(liveCoachDetail, /ResponsiveSectionTabs/)
  assert.doesNotMatch(liveCapture, /ResponsiveSectionTabs/)
})
