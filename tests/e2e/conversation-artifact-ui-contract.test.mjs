import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

test("conversation artifacts use one bounded allowlisted client contract", async () => {
  const types = await read("src/lib/assistant-types.ts")
  const client = await read("src/lib/assistant-client.ts")

  for (const kind of ["collection", "record", "summary", "relationship", "evidence", "form", "workflow", "task"]) {
    assert.ok(types.includes(`| "${kind}"`) || types.includes(`= "${kind}"`), `missing ${kind}`)
  }
  for (const behavior of ["open_artifact", "open_form", "submit_prompt", "prepare_action", "secure_handoff"]) {
    assert.ok(types.includes(`| "${behavior}"`) || types.includes(`= "${behavior}"`), `missing ${behavior}`)
  }

  assert.match(client, /withinSerializedLimit\(artifact, 65_536\)/)
  assert.match(client, /normalizeArtifactRecords\(data\.records \?\? data\.rows, 25\)/)
  assert.match(client, /normalizeArtifactActions\(artifact\.actions \?\? data\.actions, 4\)/)
  assert.match(client, /opportunity: "opportunities\.open"/)
  assert.match(client, /case "artifact":[\s\S]*case "task"/)
  assert.match(client, /isSafeAssistantPath\(reference\.route\)/)
  assert.doesNotMatch(client, /target\.route/)
})

test("artifact UI is adaptive, exact-target, responsive, and calm", async () => {
  const artifact = await read("src/components/assistant-artifact.tsx")
  const workspace = await read("src/components/conversation-workspace.tsx")
  const shell = await read("src/components/conversation-mode-shell.tsx")

  assert.match(artifact, /artifact\.records\.slice\(0, 2\)/)
  assert.match(artifact, /data-assistant-artifact-kind=\{artifact\.kind\}/)
  assert.match(artifact, /AssistantArtifactCanvasView/)
  assert.match(artifact, /min-h-11/)
  assert.match(artifact, /break-words/)
  assert.match(artifact, /motion-reduce:transition-none/)
  assert.match(artifact, /<AssistantActionChip[\s\S]*View details/)
  assert.match(artifact, /<DropdownMenu[\s\S]*More actions for \$\{artifact\.title\}/)
  assert.doesNotMatch(artifact, /overflow-x-auto/)
  assert.doesNotMatch(artifact, /dangerouslySetInnerHTML/)
  const recordRow = artifact.slice(
    artifact.indexOf("function ArtifactRecordRow"),
    artifact.indexOf("function ArtifactStep")
  )
  assert.equal((recordRow.match(/\{content\}/g) ?? []).length, 2, "record content renders once per action branch")

  assert.match(workspace, /message\.artifacts\?\.map/)
  assert.match(workspace, /<AssistantArtifactPreview/)
  assert.match(shell, /client\.prepareArtifactAction\(artifact\.id, action\.id\)/)
  assert.match(shell, /onInvokeCapability\(prepared\.capability\.id, prepared\.capability\.target\)/)
  assert.match(shell, /action\.behavior === "secure_handoff"[\s\S]*action\.risk === "none"[\s\S]*\["read", "navigate"\]/)
  assert.match(shell, /if \(canOpenImmediately\) \{[\s\S]*onInvokeCapability\(action\.capabilityId, action\.target\)[\s\S]*client\.prepareArtifactAction\(artifact\.id, action\.id\)/)
  assert.match(shell, /client\.queryArtifact\(artifact\.id, \{ cursor: artifact\.cursor \}\)/)
  assert.doesNotMatch(shell, /text: "Change confirmed\."/)
})

test("opaque thread and artifact URLs restore without leaking record content", async () => {
  const shell = await read("src/components/conversation-mode-shell.tsx")

  assert.match(shell, /readAssistantQueryId\("thread"\)/)
  assert.match(shell, /readAssistantQueryId\("artifact"\)/)
  assert.match(shell, /window\.addEventListener\("popstate", handlePopState\)/)
  assert.match(shell, /window\.history\.back\(\)/)
  assert.match(shell, /replaceAssistantQuery\(\{ artifact: null \}\)/)
  assert.match(shell, /restoreArtifactOriginFocus\(artifactFocusReturnRef\)/)
  assert.match(shell, /client\.getArtifact\(artifactId\)/)
  assert.match(shell, /\^\[a-zA-Z0-9\]\[a-zA-Z0-9\._:-\]\{0,179\}\$/)
  assert.doesNotMatch(shell, /searchParams\.set\([^\n]*(?:title|name|prompt|content|transcript)/)
})

test("the server capability catalog is strictly normalized with a reviewed local fallback", async () => {
  const client = await read("src/lib/assistant-client.ts")
  const shell = await read("src/components/conversation-mode-shell.tsx")

  assert.match(client, /listCapabilities: async \(workspaceId: string\)/)
  assert.match(client, /`\/api\/assistant\/capabilities\?\$\{query\}`/)
  assert.match(client, /const localCapabilities = new Map<string, LocalAssistantCapabilityDefinition>/)
  assert.match(client, /!id \|\| !local \|\| seen\.has\(id\)/)
  assert.match(client, /\["read", "navigate", "write", "background"\]/)
  assert.match(client, /\["native", "secure_handoff"\]/)
  assert.match(client, /return capabilities\.length \? capabilities : \[\.\.\.localCapabilities\]/)

  assert.match(shell, /setCapabilities\(ASSISTANT_CAPABILITIES\)/)
  assert.match(shell, /client\.listCapabilities\(workspaceId\)/)
  assert.match(shell, /createAssistantClient\(createSalesFrameAssistantTransport\(\), ASSISTANT_CAPABILITY_REGISTRY\)/)
  assert.match(shell, /capabilities=\{capabilities\}/)
  assert.match(shell, /The reviewed local catalog remains available/)
})

test("working context is quiet, dismissible, and never serialized into requests or URLs", async () => {
  const workspace = await read("src/components/conversation-workspace.tsx")
  const shell = await read("src/components/conversation-mode-shell.tsx")

  assert.match(workspace, /data-testid="conversation-working-context"/)
  assert.match(workspace, />Working in</)
  assert.match(workspace, /className="relative ml-0\.5 !size-7[^"]*after:-inset-2/)
  assert.match(workspace, /Dismiss working context:/)
  assert.match(shell, /workingContextLabel=\{activeArtifact\?\.title \?\? workingContextLabel\}/)
  assert.doesNotMatch(shell, /searchParams\.set\("(?:context|label|title)"/)
  assert.doesNotMatch(shell, /routeContext: \{[\s\S]*workingContextLabel/)
})

test("collection canvases search through the authorized artifact endpoint without replacing usable results on failure", async () => {
  const artifact = await read("src/components/assistant-artifact.tsx")
  const shell = await read("src/components/conversation-mode-shell.tsx")

  assert.match(artifact, /artifact\.kind === "collection" && onSearch && onSearchValueChange/)
  assert.match(artifact, /role="search"/)
  assert.match(artifact, /className="min-h-11 !pl-10"/)
  assert.match(artifact, /maxLength=\{160\}/)
  assert.match(shell, /client\.queryArtifact\(artifact\.id, \{ search \}\)/)
  assert.match(shell, /replace\(\/\\s\+\/g, " "\)/)
  assert.match(shell, /Your previous results remain available\./)
  assert.doesNotMatch(shell, /queryArtifact\(artifact\.id, \{[\s\S]{0,100}(?:filters|route):/)
})
