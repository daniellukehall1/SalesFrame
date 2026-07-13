import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")
const encoder = new TextEncoder()

async function loadAssistantClientModule() {
  const source = await read("src/lib/assistant-client.ts")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

test("assistant streams require a terminal event and cancel after completion", async () => {
  const { readAssistantEventStream } = await loadAssistantClientModule()
  const events = []
  let cancelled = false
  const body = new ReadableStream({
    cancel() {
      cancelled = true
    },
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"complete","messageId":"message-1"}\n\n'))
    },
  })

  await readAssistantEventStream(
    new Response(body),
    (event) => events.push(event),
    { inactivityTimeoutMs: 100, totalTimeoutMs: 200 }
  )

  assert.deepEqual(events, [{ type: "complete", messageId: "message-1" }])
  assert.equal(cancelled, true)
})

test("assistant streams reject clean EOF when complete or error never arrived", async () => {
  const { AssistantStreamError, readAssistantEventStream } = await loadAssistantClientModule()
  const response = new Response('data: {"type":"status","text":"Working"}\n\n')

  await assert.rejects(
    readAssistantEventStream(response, () => undefined, { inactivityTimeoutMs: 100, totalTimeoutMs: 200 }),
    (error) => error instanceof AssistantStreamError && error.code === "assistant_stream_interrupted"
  )
})

test("assistant error events are accepted as explicit terminal outcomes", async () => {
  const { readAssistantEventStream } = await loadAssistantClientModule()
  const events = []
  const response = new Response('data: {"type":"error","code":"assistant_run_failed","message":"Try again."}\n\n')

  await readAssistantEventStream(response, (event) => events.push(event), {
    inactivityTimeoutMs: 100,
    totalTimeoutMs: 200,
  })

  assert.equal(events.at(-1)?.type, "error")
})

test("assistant streams reject updates after a terminal event", async () => {
  const { AssistantStreamError, readAssistantEventStream } = await loadAssistantClientModule()
  const response = new Response([
    'data: {"type":"complete","messageId":"message-1"}',
    "",
    'data: {"type":"status","text":"Unexpected"}',
    "",
  ].join("\n"))

  await assert.rejects(
    readAssistantEventStream(response, () => undefined, { inactivityTimeoutMs: 100, totalTimeoutMs: 200 }),
    (error) => error instanceof AssistantStreamError && error.code === "assistant_stream_protocol_error"
  )
})

test("assistant stream inactivity and total watchdogs cancel stalled readers", async () => {
  const { AssistantStreamError, readAssistantEventStream } = await loadAssistantClientModule()
  let inactivityCancelled = false
  const inactiveBody = new ReadableStream({
    cancel() {
      inactivityCancelled = true
    },
  })

  await assert.rejects(
    readAssistantEventStream(new Response(inactiveBody), () => undefined, {
      inactivityTimeoutMs: 20,
      totalTimeoutMs: 200,
    }),
    (error) => error instanceof AssistantStreamError && error.code === "assistant_stream_inactivity_timeout"
  )
  assert.equal(inactivityCancelled, true)

  let interval
  let totalCancelled = false
  const activeBody = new ReadableStream({
    cancel() {
      totalCancelled = true
      clearInterval(interval)
    },
    start(controller) {
      interval = setInterval(() => {
        controller.enqueue(encoder.encode('data: {"type":"status","text":"Still working"}\n\n'))
      }, 5)
    },
  })

  await assert.rejects(
    readAssistantEventStream(new Response(activeBody), () => undefined, {
      inactivityTimeoutMs: 25,
      totalTimeoutMs: 60,
    }),
    (error) => error instanceof AssistantStreamError && error.code === "assistant_stream_total_timeout"
  )
  assert.equal(totalCancelled, true)
})

test("assistant stream consumers can abort without converting cancellation into a failure", async () => {
  const { readAssistantEventStream } = await loadAssistantClientModule()
  const controller = new AbortController()
  const response = new Response(new ReadableStream({}))
  setTimeout(() => controller.abort(), 10)

  await assert.rejects(
    readAssistantEventStream(response, () => undefined, {
      inactivityTimeoutMs: 100,
      signal: controller.signal,
      totalTimeoutMs: 200,
    }),
    (error) => error instanceof Error && error.name === "AbortError"
  )
})

test("the browser transport links caller cancellation and maps watchdog failures safely", async () => {
  const serverFunctions = await read("src/lib/server-functions.ts")

  assert.match(serverFunctions, /const controller = new AbortController\(\)/)
  assert.match(serverFunctions, /init\.signal\?\.addEventListener\("abort", abortFromCaller/)
  assert.match(serverFunctions, /ASSISTANT_STREAM_TOTAL_TIMEOUT_MS/)
  assert.match(serverFunctions, /ASSISTANT_STREAM_INACTIVITY_TIMEOUT_MS/)
  assert.match(serverFunctions, /waitForAssistantStreamStep\(getFunctionAccessToken\(\), controller\.signal\)/)
  assert.match(serverFunctions, /error instanceof AssistantStreamError/)
  assert.match(serverFunctions, /assistant_stream_interrupted/)
  assert.doesNotMatch(serverFunctions, /console\.(?:log|info|warn|error).*assistant/i)
})
