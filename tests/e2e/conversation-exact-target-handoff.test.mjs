import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const appSource = fs.readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8")
const shellSource = fs.readFileSync(
  new URL("../../src/components/conversation-mode-shell.tsx", import.meta.url),
  "utf8"
)

test("saved conversation actions remain bound to their immutable resource targets", () => {
  assert.match(shellSource, /client\.prepareArtifactAction\(artifact\.id, action\.id\)/)
  assert.match(shellSource, /action\.behavior === "secure_handoff"[\s\S]*onInvokeCapability\(prepared\.capability\.id, prepared\.capability\.target\)/)
  assert.doesNotMatch(shellSource, /onInvokeCapability\(action\.capabilityId, action\.target\)/)
  assert.match(appSource, /immutableTarget: AssistantActionTarget/)
  assert.match(appSource, /workspaceContacts\.find\(\(contact\) => contact\.id === immutableTarget\.contactId\)/)
  assert.match(appSource, /workspaceOpportunities\.find\(\(opportunity\) => opportunity\.id === immutableTarget\.opportunityId\)/)
  assert.match(appSource, /workspaceCalls\.find\(\(call\) => call\.id === immutableTarget\.callId\)/)
  assert.match(appSource, /if \(hasImmutableTarget && targetIsMissing\)/)
  assert.match(appSource, /\(targetCall && !callOpportunity\)/)
  assert.match(appSource, /That saved action is no longer available/)
})

test("contact and opportunity actions open the exact related workspace surface", () => {
  assert.match(appSource, /openAccountSurface\("contacts", resolvedContactId\)/)
  assert.match(appSource, /openOpportunitySurface\("opportunity-contacts"\)/)
  assert.match(appSource, /openOpportunitySurface\("opportunity-intelligence"\)/)
  assert.match(appSource, /handleRequestArchiveOpportunity\(resolvedOpportunityId\)/)
  assert.doesNotMatch(appSource, /case "opportunities\.archive":[\s\S]{0,120}handleRequestArchiveOpportunity\(activeOpportunity\.id\)/)
})

test("costed enrichment capabilities hand off for explicit seller confirmation", () => {
  const accountEnrichmentCase = /case "accounts\.enrich":([\s\S]*?)case "accounts\.archive":/.exec(appSource)?.[1] ?? ""
  assert.match(accountEnrichmentCase, /openAccountSurface\(\)/)
  assert.doesNotMatch(accountEnrichmentCase, /handleRunActiveAccountEnrichment/)
})
