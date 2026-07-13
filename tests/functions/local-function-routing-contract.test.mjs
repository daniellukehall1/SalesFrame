import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const [viteConfig, serverFunctions] = await Promise.all([
  readFile(new URL("vite.config.ts", root), "utf8"),
  readFile(new URL("src/lib/server-functions.ts", root), "utf8"),
])

test("Vite routes every exact browser-used function to its local Netlify module", () => {
  const expectedRoutes = new Map([
    ["/api/assistant/briefing", "assistant-briefing"],
    ["/api/assistant/preferences", "assistant-preferences"],
    ["/api/assistant/threads", "assistant-threads"],
    ["/api/assistant/turns", "assistant-turns"],
    ["/api/assistant/voice-token", "assistant-voice-token"],
    ["/api/import/enrichment-status", "import-enrichment-status"],
    ["/api/meeting-bots", "meeting-bots"],
    ["/api/openai/contact-enrichment", "contact-enrichment"],
    ["/api/openai/live-question", "live-question"],
    ["/api/system/env", "env-check"],
  ])

  for (const [route, functionName] of expectedRoutes) {
    assert.ok(
      viteConfig.includes(`"${route}": "${functionName}"`),
      `${route} must resolve to ${functionName} during Vite development.`
    )
  }
})

test("Vite resolves dynamic browser routes and passes Netlify-style path params", () => {
  for (const functionName of [
    "assistant-messages",
    "assistant-thread",
    "assistant-action-confirm",
    "assistant-actions",
    "next-call-brief-evidence",
    "next-call-brief-apply",
    "next-call-brief",
    "meeting-bots",
  ]) {
    assert.ok(viteConfig.includes(`functionName: "${functionName}"`), `${functionName} needs a dynamic route.`)
  }

  assert.match(viteConfig, /parameterNames: \["threadId"\]/)
  assert.match(viteConfig, /parameterNames: \["proposalId"\]/)
  assert.match(viteConfig, /parameterNames: \["briefId", "itemId"\]/)
  assert.match(viteConfig, /parameterNames: \["opportunityId"\]/)
  assert.match(viteConfig, /parameterNames: \["sessionId", "participantId"\]/)
  assert.match(viteConfig, /resolveLocalFunctionRoute\(requestUrl\.pathname\)/)
  assert.match(viteConfig, /params: route\.params/)
  assert.match(viteConfig, /waitUntil\(promise: Promise<unknown>\)/)
})

test("successful function calls fail closed when Vite or a proxy returns HTML", () => {
  assert.match(serverFunctions, /if \(!response\.ok \|\| response\.status === 204\) return null/)
  assert.match(serverFunctions, /throw unexpectedFunctionResponseError\(\)/)
  assert.match(serverFunctions, /code: "unexpected_function_response"/)
  assert.match(serverFunctions, /status: 502/)
  assert.doesNotMatch(serverFunctions, /return text as T/)
})
