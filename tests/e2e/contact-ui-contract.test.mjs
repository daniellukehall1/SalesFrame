import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("account contacts use the shared responsive record-management UI", async () => {
  const app = await read("src/App.tsx")
  const contacts = await read("src/components/contact-management.tsx")
  const table = await read("src/components/ui/table.tsx")

  assert.match(app, /<TabsTrigger className="min-w-28" value="contacts">Contacts<\/TabsTrigger>/)
  assert.match(app, /<ContactsPanel/)
  assert.match(contacts, /<Dialog open=\{open\}/)
  assert.match(contacts, /<Drawer open=\{open\}/)
  assert.match(contacts, /Enrich after saving/)
  assert.match(contacts, /Discard unsaved contact changes\?/)
  assert.match(contacts, /Contact<\/TableHead>/)
  assert.match(contacts, /Title \/ function<\/TableHead>/)
  assert.match(contacts, /Linked opportunities<\/TableHead>/)
  assert.match(contacts, /Enrichment status<\/TableHead>/)
  assert.match(contacts, /Created date<\/TableHead>/)
  assert.match(table, /data-slot="table"/)
})

test("contact selectors are optional, multi-select, and mobile reachable", async () => {
  const app = await read("src/App.tsx")
  const contacts = await read("src/components/contact-management.tsx")

  assert.match(contacts, /aria-multiselectable="true"/)
  assert.match(contacts, /Select .*optional/)
  assert.match(contacts, /min-h-11 max-w-full/)
  assert.match(contacts, /className="flex size-11 .* md:size-7"/)
  assert.match(app, /clearContactSelection\(\)/)
  assert.match(app, /setSelectedContactIds\(\[\]\)/)
  assert.match(app, /Quick add/)
  assert.match(app, /quickContactPrimaryToken/)
  assert.doesNotMatch(app, /<Label htmlFor="customer-contact">/)
  assert.doesNotMatch(app, /<Label htmlFor="customer-role">/)
})

test("start call persists selected contacts before asking the first question", async () => {
  const app = await read("src/App.tsx")
  const startFlow = app.slice(app.indexOf("const handleStartRecording"), app.indexOf("const handleCreateAccount"))
  const replaceCallContactsIndex = startFlow.indexOf("await replaceCallContacts(")
  const firstQuestionIndex = startFlow.indexOf("await requestLiveQuestion(")

  assert.ok(replaceCallContactsIndex > -1)
  assert.ok(firstQuestionIndex > replaceCallContactsIndex)
  assert.match(startFlow, /contactId: primaryContactId \|\| undefined/)
  assert.ok(startFlow.indexOf("savedOpportunityContactRows = await listOpportunityContacts(opportunityId)") > replaceCallContactsIndex)
  const runtimeBeforeCallRelationships = startFlow.slice(startFlow.indexOf("const startedAt ="), replaceCallContactsIndex)
  assert.doesNotMatch(runtimeBeforeCallRelationships, /await replaceOpportunityContacts\(/)
  assert.match(startFlow, /previousOpportunityContactRows = await listOpportunityContacts\(opportunityId\)/)
  assert.match(startFlow, /await restoreOpportunityContactsAfterFailedStart\(\)/)
  assert.match(startFlow, /start_call_contact_rollback_failed/)
  assert.match(startFlow, /setPersistentAppAlert\("Some opportunity contact changes may remain/)
})

test("speaker mapping is explicit and limited to selected call contacts", async () => {
  const app = await read("src/App.tsx")
  const panel = app.slice(app.indexOf("function SpeakerIdentityPanel"), app.indexOf("function LiveRail"))

  assert.match(panel, /callContacts\.filter\(\(relationship\) => relationship\.callId === activeCallId\)/)
  assert.match(panel, /Confirm mapping/)
  assert.match(panel, /await confirmSpeakerContact\(speakerId, contactId\)/)
  assert.match(panel, /Save this speaker once before confirming the contact/)
  assert.match(panel, /setSpeakerContactDrafts\(\{\}\)/)
  assert.match(panel, /\}, \[activeCallId\]\)/)
})

test("contact profile links are canonicalised and rendered only when safe", async () => {
  const contacts = await read("src/components/contact-management.tsx")

  assert.match(contacts, /url\.protocol !== "http:" && url\.protocol !== "https:"/)
  assert.ok(contacts.includes('replace(/^www\\./, "")'))
  assert.match(contacts, /endsWith\("\.linkedin\.com"\)/)
  assert.match(contacts, /Use a full http:\/\/ or https:\/\/ professional profile URL/)
  assert.match(contacts, /href=\{safeUrl\}/)
})

test("contact management keeps search, forms, filters, and async saves accessible", async () => {
  const app = await read("src/App.tsx")
  const contacts = await read("src/components/contact-management.tsx")

  assert.match(app, /focusContact\(contact\.id\)/)
  assert.match(contacts, /if \(!focusedContactId[\s\S]*setEmploymentFilter\("all"\)/)
  assert.match(contacts, /<form[\s\S]*onSubmit=/)
  assert.match(contacts, /<DialogContent dismissible/)
  assert.match(contacts, /id="contact-full-name"[\s\S]*aria-required="true"[\s\S]*required/)
  assert.match(contacts, /id="contact-email"[\s\S]*type="email"[\s\S]*aria-invalid=\{invalidEmail\}/)
  assert.match(contacts, /<SelectItem value="unknown">Unknown employment<\/SelectItem>/)
  assert.match(contacts, /Undo archive/)
  assert.match(contacts, /actionKind !== "enrich"/)
  assert.match(contacts, /await \(action === "archive" \? onArchive\(contact\) : onEnrich\(contact\)\)[\s\S]*setActionKind\(action\)/)
  assert.match(contacts, /role=\{\(actionMessage \? actionTone : externalStatusTone\) === "error" \? "alert" : "status"\}/)
  assert.match(contacts, /disabled=\{disabled\}[\s\S]*role="combobox"/)
  assert.match(contacts, /aria-label=\{`Buying roles for \$\{contactName\}`\}/)
  assert.match(contacts, /event\.key === "ArrowDown"[\s\S]*event\.key === "ArrowUp"[\s\S]*event\.key === "Home"[\s\S]*event\.key === "End"/)
})

test("contact selectors reset for new records and completed calls retain participant context", async () => {
  const app = await read("src/App.tsx")

  assert.match(app, /accountMode === "existing"[\s\S]*accountContacts/)
  assert.match(app, /accountMode === "existing" && opportunityMode === "existing"/)
  assert.match(app, /function CallParticipantsSummary/)
  assert.match(app, /Saved contact participation and seller-confirmed speaker mappings/)
  assert.match(app, /Participants: \{participantNames\.join\(", "\)\}/)
  assert.match(app, /attendance: "attended"/)
  assert.match(app, /contactConfirmedAt: savedSpeaker\.contact_confirmed_at \?\? undefined/)
  assert.match(app, /setTranscriptsByCallId/)
})

test("queued enrichment resumes bounded polling and exposes terminal states", async () => {
  const app = await read("src/App.tsx")

  assert.match(app, /const delays = \[3000, 8000, 20000, 45000, 90000, 180000, 300000\]/)
  assert.match(app, /status === "queued" \|\| status === "running"/)
  assert.match(app, /scheduleContactEnrichmentPoll\(contact\.id\)/)
  assert.match(app, /generation !== contactEnrichmentPollGenerationRef\.current/)
  const queueFlow = app.slice(app.indexOf("const handleQueueContactEnrichment"), app.indexOf("const handleArchiveContact"))
  assert.ok(queueFlow.indexOf("const generation = contactEnrichmentPollGenerationRef.current") < queueFlow.indexOf("const response = await requestContactEnrichment(contactId)"))
  assert.match(queueFlow, /if \(generation !== contactEnrichmentPollGenerationRef\.current\) return/)
  assert.match(app, /enrichmentStatus === "failed"/)
  assert.match(app, /enrichmentStatus === "ambiguous"/)
})
