import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parseAssistantCapabilityIntent } from "../../netlify/functions/_shared/assistant-capability-intents.ts"
import {
  listServerAssistantArtifactCapabilities,
  resolveServerAssistantArtifactCapability,
} from "../../netlify/functions/_shared/assistant-artifact-capabilities.ts"
import { ASSISTANT_CAPABILITY_REGISTRY } from "../../src/lib/assistant-capability-registry.ts"

const accountId = "ad7b3432-1f7b-4dcf-bd4d-57c68f68dc68"
const opportunityId = "be7b3432-1f7b-4dcf-bd4d-57c68f68dc69"
const contactId = "ce7b3432-1f7b-4dcf-bd4d-57c68f68dc6a"
const callId = "de7b3432-1f7b-4dcf-bd4d-57c68f68dc6b"

test("common free-text workspace commands produce safe clickable handoffs", () => {
  assert.equal(parseAssistantCapabilityIntent("Can you start a call?", { path: "/app" })?.capabilityId, "calls.start")
  assert.equal(parseAssistantCapabilityIntent("open settings", { path: "/app" })?.capabilityId, "settings.open")
  assert.equal(parseAssistantCapabilityIntent("Please add a new account", { path: "/app" })?.capabilityId, "accounts.create")
  assert.equal(parseAssistantCapabilityIntent("show my playbooks", { path: "/app" })?.capabilityId, "playbooks.list")
})

test("record commands remain bound to the authorized route target", () => {
  assert.deepEqual(
    parseAssistantCapabilityIntent("add contact", { path: "/app", accountId })?.target,
    { accountId }
  )
  assert.deepEqual(
    parseAssistantCapabilityIntent("enrich him", { path: "/app", accountId, contactId })?.target,
    { contactId }
  )
  assert.deepEqual(
    parseAssistantCapabilityIntent("prepare me for my next call", { path: "/app", accountId, opportunityId })?.target,
    { opportunityId }
  )
  assert.deepEqual(
    parseAssistantCapabilityIntent("open transcript", { path: "/app", accountId, opportunityId, callId })?.target,
    { callId }
  )
})

test("missing record context returns a narrow selection handoff instead of guessing", () => {
  const contact = parseAssistantCapabilityIntent("add contact", { path: "/app" })
  assert.equal(contact?.capabilityId, "accounts.list")
  assert.equal(contact?.label, "Choose account")

  const opportunity = parseAssistantCapabilityIntent("add opportunity", { path: "/app" })
  assert.equal(opportunity?.capabilityId, "accounts.list")

  const transcript = parseAssistantCapabilityIntent("open transcript", { path: "/app" })
  assert.equal(transcript?.capabilityId, "calls.list")
})

test("compound or ambiguous requests stay on the reasoning path", () => {
  for (const prompt of [
    "add a contact and then enrich them",
    "open settings, then delete the account",
    "show me something useful",
    "do that",
  ]) {
    assert.equal(parseAssistantCapabilityIntent(prompt, { path: "/app", accountId }), null, prompt)
  }
})

test("the server handoff registry covers the advertised catalog and derives immutable safety metadata", async () => {
  const serverCapabilities = listServerAssistantArtifactCapabilities()
  assert.equal(serverCapabilities.length, ASSISTANT_CAPABILITY_REGISTRY.length)
  assert.equal(new Set(serverCapabilities.map((capability) => capability.id)).size, serverCapabilities.length)

  const migration = await readFile(
    new URL("../../supabase/migrations/202607130003_conversation_mode_artifacts.sql", import.meta.url),
    "utf8"
  )
  for (const advertised of ASSISTANT_CAPABILITY_REGISTRY) {
    const server = resolveServerAssistantArtifactCapability(advertised.id)
    assert.equal(server.behavior, "secure_handoff")
    assert.equal(server.risk, advertised.risk)
    assert.match(migration, new RegExp(`'${advertised.id.replace(".", "\\.")}'`), advertised.id)
  }
})
