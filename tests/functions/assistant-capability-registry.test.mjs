import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  ASSISTANT_CAPABILITY_REGISTRY,
  getAssistantCapabilityDefinition,
} from "../../src/lib/assistant-capability-registry.ts"

const root = new URL("../../", import.meta.url)
const capabilityFunction = await readFile(
  new URL("netlify/functions/assistant-capabilities.ts", root),
  "utf8"
)

test("conversation capabilities have one typed native or secure-handoff implementation", () => {
  assert.ok(ASSISTANT_CAPABILITY_REGISTRY.length >= 60)
  assert.equal(
    new Set(ASSISTANT_CAPABILITY_REGISTRY.map((capability) => capability.id)).size,
    ASSISTANT_CAPABILITY_REGISTRY.length
  )

  for (const capability of ASSISTANT_CAPABILITY_REGISTRY) {
    assert.match(capability.id, /^[a-z_]+\.[a-z_]+$/)
    assert.ok(["read", "navigate", "write", "background"].includes(capability.executionMode))
    assert.ok(["none", "standard", "costed", "destructive"].includes(capability.risk))
    assert.ok(["native", "secure_handoff"].includes(capability.surface))
  }
})

test("costed and destructive actions cannot present as ordinary writes", () => {
  assert.equal(getAssistantCapabilityDefinition("accounts.enrich")?.executionMode, "background")
  assert.equal(getAssistantCapabilityDefinition("accounts.enrich")?.risk, "costed")
  assert.equal(getAssistantCapabilityDefinition("contacts.enrich")?.risk, "costed")
  assert.equal(getAssistantCapabilityDefinition("accounts.delete")?.risk, "destructive")
  assert.equal(getAssistantCapabilityDefinition("opportunities.delete")?.risk, "destructive")
  assert.equal(getAssistantCapabilityDefinition("calls.delete")?.risk, "destructive")
})

test("capability discovery is authenticated and workspace-authorized", () => {
  assert.match(capabilityFunction, /requireUser\(request\)/)
  assert.match(capabilityFunction, /authorizeWorkspace\(user\.id, workspaceId, supabase, \{ token \}\)/)
  assert.match(capabilityFunction, /getAssistantCapabilityClientCatalog\(\)/)
  assert.doesNotMatch(capabilityFunction, /service[_-]?role/i)
})
