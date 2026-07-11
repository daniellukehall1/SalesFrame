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
  assert.match(contacts, /className="grid gap-2 xl:grid-cols-\[minmax\(0,1fr\)_180px_190px\]"/)
  assert.match(contacts, /className="grid gap-3 2xl:hidden" data-testid="account-contacts-mobile-list"/)
  assert.match(contacts, /className="hidden overflow-hidden rounded-lg border 2xl:block" data-testid="account-contacts-table"/)
  assert.match(contacts, /max-sm:!mx-0 max-sm:!mb-0 max-sm:rounded-xl/)
  assert.doesNotMatch(contacts, /className="grid gap-3 md:hidden" data-testid="account-contacts-mobile-list"/)
  assert.doesNotMatch(contacts, /className="hidden overflow-hidden rounded-lg border md:block" data-testid="account-contacts-table"/)
  assert.match(table, /data-slot="table"/)
})

test("contact enrichment distinguishes queued work from a true empty state", async () => {
  const contacts = await read("src/components/contact-management.tsx")
  const enrichmentDetails = contacts.slice(
    contacts.indexOf("function ContactEnrichmentDetails"),
    contacts.indexOf("function EnrichmentBadge")
  )

  assert.match(enrichmentDetails, /const enrichmentInProgress = enrichment\?\.status === "queued" \|\| enrichment\?\.status === "running"/)
  assert.match(enrichmentDetails, /enrichmentInProgress && !hasInsights/)
  assert.match(enrichmentDetails, /Enrichment is queued\. You can keep working while SalesFrame prepares professional insights\./)
  assert.match(enrichmentDetails, /Enrichment is in progress\. SalesFrame is reviewing public professional sources without overwriting seller-entered data\./)
  assert.match(enrichmentDetails, /role="status"/)
  assert.match(enrichmentDetails, /aria-live="polite"/)
})

test("contact identities open a complete responsive canonical record", async () => {
  const contacts = await read("src/components/contact-management.tsx")
  const detailOverlay = contacts.slice(
    contacts.indexOf("function ContactDetailsOverlay"),
    contacts.indexOf("export function ContactsPanel")
  )

  assert.match(contacts, /const \[detailContactId, setDetailContactId\] = React\.useState\(""\)/)
  assert.match(contacts, /const detailContact = contacts\.find\(\(contact\) => contact\.id === detailContactId\) \?\? null/)
  assert.match(contacts, /aria-label=\{`View \$\{contact\.fullName\} contact details`\}/)
  assert.match(detailOverlay, /if \(isMobile\)[\s\S]*<Drawer open=\{open\} onOpenChange=\{onOpenChange\}/)
  assert.match(detailOverlay, /<Dialog open=\{open\} onOpenChange=\{onOpenChange\}>/)
  assert.match(detailOverlay, /<dl className="grid min-w-0 gap-3 md:grid-cols-2">/)
  assert.match(detailOverlay, /overflow-x-hidden overflow-y-auto overscroll-contain/)
  assert.match(detailOverlay, /overflow-x-hidden overflow-y-hidden/)
  assert.match(detailOverlay, /w-\[calc\(100%_-_2rem\)\] min-w-0 max-w-4xl/)
  assert.match(detailOverlay, /\[overflow-wrap:anywhere\]/)
  assert.doesNotMatch(detailOverlay, /overflow-x-auto/)
  assert.doesNotMatch(detailOverlay, /max-w-\[calc\(100%-2rem\)\]/)
  for (const label of [
    "Full name",
    "Preferred name",
    "Job title",
    "Department / function",
    "Seniority",
    "Employment status",
    "Work email",
    "Business phone",
    "Professional profile",
    "Location",
    "Timezone",
    "Source",
    "Created",
    "Last updated",
    "Archive status",
  ]) {
    assert.ok(detailOverlay.includes(`label="${label}"`), `missing contact detail: ${label}`)
  }
  assert.match(detailOverlay, /Private seller notes/)
  assert.match(detailOverlay, /Linked opportunities/)
  assert.match(detailOverlay, /Primary contact/)
  assert.match(detailOverlay, /Deal-specific notes/)
  assert.match(detailOverlay, /Call participation/)
  assert.match(detailOverlay, /relationship\.attendance/)
  assert.match(detailOverlay, /Primary participant/)
  assert.match(detailOverlay, /<ContactEnrichmentDetails contact=\{contact\} showAll \/>/)
  assert.match(contacts, /grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,22rem\),1fr\)\)\]/)
  assert.match(contacts, /w-full min-w-0 max-w-full rounded-md bg-background\/70/)
  assert.match(detailOverlay, /<PencilIcon \/>[\s\S]*Edit/)
  assert.match(detailOverlay, /Refresh enrichment/)
  assert.match(detailOverlay, /<ArchiveIcon \/>[\s\S]*Archive/)
  assert.match(detailOverlay, /<Undo2Icon \/>[\s\S]*Restore contact/)
  assert.match(detailOverlay, /grid-rows-\[auto_auto_minmax\(0,1fr\)_auto\]/)
  assert.match(contacts, /const focusedContact = contacts\.find\(\(contact\) => contact\.id === focusedContactId\)/)
  assert.match(contacts, /setEmploymentFilter\(focusedContact\.archivedAtIso \? "archived" : "all"\)/)
  assert.match(contacts, /setDetailContactId\(focusedContactId\)/)
  assert.match(contacts, /detailInvokerRef\.current = invoker/)
  assert.match(contacts, /data-contact-detail-id=\{contact\.id\}/)
  assert.match(contacts, /if \(invoker\?\.isConnected\)[\s\S]*invoker\.focus\(\)/)
  assert.match(contacts, /visibleContactButton \?\? addContactButtonRef\.current/)
  assert.doesNotMatch(contacts, /<TableRow[^>]*role="button"/)
})

test("opportunity account directory clearly opens contacts and keeps menus contact-specific", async () => {
  const contacts = await read("src/components/contact-management.tsx")
  const panel = contacts.slice(
    contacts.indexOf("export function ContactsPanel"),
    contacts.indexOf("function BuyingRoleMultiSelect")
  )

  assert.match(panel, /className=\{cn\([\s\S]*"cursor-pointer"/)
  assert.match(panel, /isContactDirectoryControl\(event\.target\)/)
  assert.match(panel, /event\.currentTarget\.querySelector<HTMLButtonElement>\("\[data-contact-detail-id\]"\)/)
  assert.match(panel, /<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" \/>/)
  assert.match(panel, /aria-label=\{`View \$\{contact\.fullName\} contact details`\}/)
  assert.doesNotMatch(panel, /<DropdownMenuItem key=\{opportunity!\.id\}/)
  assert.doesNotMatch(panel, /<ExternalLinkIcon \/>Open \{opportunity!\.name\}/)
})

test("deal-specific contact notes use explicit failure-safe drafts", async () => {
  const contacts = await read("src/components/contact-management.tsx")
  const opportunityContactsCard = contacts.slice(
    contacts.indexOf("export function OpportunityContactsCard"),
  )

  assert.match(opportunityContactsCard, /const \[noteDrafts, setNoteDrafts\] = React\.useState<Record<string, string>>\(\{\}\)/)
  assert.match(opportunityContactsCard, /const updateRelationship = async \(contactId: string, patch: OpportunityContactPatch\): Promise<boolean>/)
  assert.match(opportunityContactsCard, /if \(savingRef\.current\) return false/)
  assert.match(opportunityContactsCard, /await onRelationshipChange\(contactId, patch\)[\s\S]*return true/)
  assert.match(opportunityContactsCard, /catch \(error: unknown\)[\s\S]*return false/)
  assert.match(opportunityContactsCard, /retainNoteDraftsFor\(contactIds\)/)
  assert.match(opportunityContactsCard, /React\.useEffect\(\(\) => \{[\s\S]*retainNoteDraftsFor\(selectedIds\)/)
  assert.match(opportunityContactsCard, /const saved = await updateRelationship\(contact\.id, \{ notes \}\)[\s\S]*if \(!saved\) return[\s\S]*delete next\[contact\.id\]/)
  assert.match(opportunityContactsCard, /value=\{noteDraft\}/)
  assert.match(opportunityContactsCard, /onChange=\{\(event\) => \{[\s\S]*setNoteDrafts/)
  assert.match(opportunityContactsCard, /aria-label=\{`Save deal-specific notes for \$\{contact\.fullName\}`\}/)
  assert.match(opportunityContactsCard, /disabled=\{isSaving \|\| !hasUnsavedNotes\}/)
  assert.match(opportunityContactsCard, /Saving notes…[\s\S]*Save notes/)
  assert.match(opportunityContactsCard, /Deal-specific notes saved for \$\{contact\.fullName\}\./)
  assert.match(opportunityContactsCard, /window\.addEventListener\("beforeunload", preventUnsavedNoteLoss\)/)
  assert.match(opportunityContactsCard, /data-unsaved-contact-notes=\{hasUnsavedNoteDrafts \|\| undefined\}/)
  assert.match(opportunityContactsCard, /disabled=\{isSaving \|\| hasUnsavedNoteDrafts\}/)
  assert.match(opportunityContactsCard, /disabled=\{isSaving \|\| hasUnsavedNotes\}/)
  assert.match(opportunityContactsCard, /Save notes before removing/)
  assert.match(opportunityContactsCard, /Revert deal-specific notes for \$\{contact\.fullName\}/)
  assert.match(opportunityContactsCard, /role="status" aria-live="polite"/)
  assert.doesNotMatch(opportunityContactsCard, /defaultValue=\{relationship\.notes\}/)
  assert.doesNotMatch(opportunityContactsCard, /onBlur=\{\(event\) => \{[\s\S]*updateRelationship\(contact\.id, \{ notes:/)
})

test("opportunities expose the shared account directory beside deal-specific contact roles", async () => {
  const app = await read("src/App.tsx")
  const opportunityWorkspace = app.slice(
    app.indexOf("function OpportunityWorkspace"),
    app.indexOf("function OpportunitySummaryStrip")
  )

  assert.match(app, /opportunities=\{workspaceOpportunities\.filter\(\(item\) => item\.accountId === activeAccount\.id\)\}/)
  assert.match(opportunityWorkspace, /<TabsTrigger className="min-w-24" value="contacts">Contacts<\/TabsTrigger>/)
  assert.match(opportunityWorkspace, /<TabsContent forceMount value="contacts"/)
  assert.match(opportunityWorkspace, /<OpportunityContactsCard[\s\S]*<ContactsPanel/)
  assert.match(opportunityWorkspace, /relationship\.opportunityId === opportunity\.id/)
  assert.match(opportunityWorkspace, /relationship\.accountId === account\.id/)
  assert.match(opportunityWorkspace, /title="Account contact directory"/)
  assert.match(opportunityWorkspace, /onOpenContact=\{setFocusedOpportunityContactId\}/)
  assert.match(opportunityWorkspace, /focusedContactId=\{focusedOpportunityContactId\}/)
  assert.match(opportunityWorkspace, /onSelectionChange=\{\(contactIds\) => replaceOpportunityContactSelection\(opportunity\.id, contactIds\)\}/)
  assert.match(opportunityWorkspace, /updateOpportunityContactRelationship\(opportunity\.id, contactId, patch\)/)
  assert.match(opportunityWorkspace, /onOpenOpportunity=\{onOpportunitySelect\}/)
  assert.match(opportunityWorkspace, /onSave=\{saveContact\}/)
  assert.match(opportunityWorkspace, /callContacts=\{callContacts\.filter\(\(relationship\) => relationship\.accountId === account\.id\)\}/)
  assert.match(opportunityWorkspace, /calls=\{calls\}/)
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
  assert.match(contacts, /const focusedContact = contacts\.find[\s\S]*setEmploymentFilter\(focusedContact\.archivedAtIso \? "archived" : "all"\)/)
  assert.match(contacts, /<form[\s\S]*onSubmit=/)
  assert.match(contacts, /<DialogContent dismissible/)
  assert.match(contacts, /id="contact-full-name"[\s\S]*aria-required="true"[\s\S]*required/)
  assert.match(contacts, /id="contact-email"[\s\S]*type="email"[\s\S]*aria-invalid=\{invalidEmail \|\| Boolean\(duplicateEmail\)\}/)
  assert.match(contacts, /<SelectItem value="unknown">Unknown employment<\/SelectItem>/)
  assert.match(contacts, /Undo archive/)
  assert.match(contacts, /actionKind !== "enrich"/)
  assert.match(contacts, /await \(action === "archive" \? onArchive\(contact\) : action === "restore" \? onRestore\(contact\) : onEnrich\(contact\)\)[\s\S]*setActionKind\(action\)/)
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
