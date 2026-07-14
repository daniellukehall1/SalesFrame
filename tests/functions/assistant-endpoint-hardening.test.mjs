import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

test("untrusted client request IDs are accepted only as opaque UUID v4 values", async () => {
  const http = await read("netlify/functions/_shared/http.ts")
  assert.match(http, /normalizeClientRequestId\(/)
  assert.match(http, /\^\[0-9a-f\]\{8\}.*-4\[0-9a-f\]\{3\}.*\[89ab\]\[0-9a-f\]\{3\}/s)
  assert.match(http, /const clientRequestId = normalizeClientRequestId\(/)
  assert.doesNotMatch(http, /const clientRequestId = options\.request\?\.headers\.get\([^\n]+\) \|\| undefined/)
})

test("artifact, task, action, and capability endpoints have bounded per-user reads", async () => {
  for (const path of [
    "netlify/functions/assistant-artifact.ts",
    "netlify/functions/assistant-artifact-query.ts",
    "netlify/functions/assistant-action-prepare.ts",
    "netlify/functions/assistant-task.ts",
    "netlify/functions/assistant-capabilities.ts",
  ]) {
    const source = await read(path)
    assert.match(source, /assertRateLimit\(/, path)
    assert.match(source, /key: (?:`\$\{workspaceId\}:\$\{user\.id\}`|user\.id)/, path)
    assert.match(source, /windowMs: 60_000/, path)
  }
})

test("prepared handoffs return server-derived capability IDs and immutable targets", async () => {
  const store = await read("netlify/functions/_shared/assistant-store.ts")
  const shell = await read("src/components/conversation-mode-shell.tsx")
  const client = await read("src/lib/assistant-client.ts")

  assert.match(store, /capability:\s*\{[\s\S]*id: capability\.id,[\s\S]*target:/)
  assert.match(client, /normalizePreparedCapability\(rawCapability\)/)
  assert.match(shell, /onInvokeCapability\(prepared\.capability\.id, prepared\.capability\.target\)/)
  assert.match(shell, /action\.behavior === "secure_handoff"[\s\S]*action\.risk === "none"[\s\S]*\["read", "navigate"\]/)
  assert.match(shell, /if \(canOpenImmediately\) \{[\s\S]*onInvokeCapability\(action\.capabilityId, action\.target\)[\s\S]*client\.prepareArtifactAction\(artifact\.id, action\.id\)/)
})
