import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)

async function loadAssistantClientModule() {
  const source = await readFile(new URL("src/lib/assistant-client.ts", root), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

const assistantClientModule = await loadAssistantClientModule()
const {
  createAssistantClient,
  normalizeAssistantArtifact,
  normalizeAssistantCapabilityCatalog,
  readAssistantEventStream,
} = assistantClientModule

const opportunityId = "a9cf5138-d020-40c4-b96e-476a431afc12"

test("capability catalogs accept only reviewed local IDs and strict server metadata", () => {
  const localCatalog = [{
    id: "opportunities.open",
    title: "Open opportunity",
    description: "Open an opportunity.",
    group: "opportunities",
    keywords: ["deal"],
    mode: "navigate",
    presentation: "record",
    requiredContext: ["opportunity"],
    executionMode: "navigate",
    risk: "none",
    surface: "native",
  }]
  const valid = {
    capabilities: [{
      id: "opportunities.open",
      title: "Open opportunity",
      description: "Open the current opportunity record.",
      group: "opportunities",
      presentation: "record",
      requiredContext: ["opportunity"],
      executionMode: "navigate",
      risk: "none",
      surface: "native",
    }, {
      id: "admin.dump_workspace",
      title: "Unsafe",
      description: "Unknown server-only capability.",
      group: "workspace",
      presentation: "record",
      requiredContext: ["workspace"],
      executionMode: "read",
      risk: "none",
      surface: "native",
    }],
  }

  assert.deepEqual(normalizeAssistantCapabilityCatalog(valid, localCatalog), [{
    id: "opportunities.open",
    title: "Open opportunity",
    description: "Open the current opportunity record.",
    group: "opportunities",
    keywords: ["deal"],
    mode: "navigate",
    presentation: "record",
    requiredContext: ["opportunity"],
    executionMode: "navigate",
    risk: "none",
    surface: "native",
  }])
  assert.deepEqual(normalizeAssistantCapabilityCatalog({ capabilities: [{
    ...valid.capabilities[0],
    requiredContext: ["opportunity", "admin"],
  }] }, localCatalog), [])
  assert.deepEqual(normalizeAssistantCapabilityCatalog({ capabilities: [{
    ...valid.capabilities[0],
    risk: "standard",
  }] }, localCatalog), [])
})

function canonicalArtifact(overrides = {}) {
  return {
    id: "artifact:opportunities",
    kind: "collection",
    title: "Open opportunities",
    description: "A current, authorized workspace result.",
    status: "ready",
    data: {
      summary: "12 open opportunities",
      fields: Array.from({ length: 30 }, (_, index) => ({
        id: `metric-${index + 1}`,
        label: `Metric ${index + 1}`,
        value: index,
      })),
      records: Array.from({ length: 30 }, (_, index) => ({
        id: `opportunity-${index + 1}`,
        kind: "opportunity",
        label: `Opportunity ${index + 1}`,
        description: "Discovery",
      })),
      sections: Array.from({ length: 15 }, (_, index) => ({
        id: `section-${index + 1}`,
        title: `Section ${index + 1}`,
      })),
      steps: Array.from({ length: 20 }, (_, index) => ({
        id: `step-${index + 1}`,
        label: `Step ${index + 1}`,
        status: "pending",
      })),
    },
    actions: Array.from({ length: 7 }, (_, index) => ({
      id: `open:${index + 1}`,
      capabilityId: "opportunities.open",
      label: `Open opportunity ${index + 1}`,
      behavior: "secure_handoff",
      risk: index === 0 ? "destructive" : "none",
      target: { opportunityId },
    })),
    ...overrides,
  }
}

test("artifact normalization preserves the schema while enforcing calm rendering bounds", () => {
  const artifact = normalizeAssistantArtifact(canonicalArtifact())

  assert.ok(artifact)
  assert.equal(artifact.schemaVersion, 1)
  assert.equal(artifact.kind, "collection")
  assert.equal(artifact.fields.length, 24)
  assert.equal(artifact.records.length, 25)
  assert.equal(artifact.sections.length, 12)
  assert.equal(artifact.steps.length, 16)
  assert.equal(artifact.actions.length, 4)
  assert.deepEqual(artifact.actions[0], {
    id: "open:1",
    capabilityId: "opportunities.open",
    label: "Open opportunity 1",
    behavior: "secure_handoff",
    risk: "destructive",
    target: { opportunityId },
    prompt: undefined,
    artifactId: undefined,
    disabled: false,
  })
})

test("legacy artifact aliases replay into the v1 schema without reviving unsafe fields", () => {
  for (const [legacyKind, expectedKind] of [
    ["table", "collection"],
    ["metrics", "summary"],
    ["timeline", "summary"],
    ["clarification", "form"],
    ["action_plan", "workflow"],
  ]) {
    const artifact = normalizeAssistantArtifact({
      id: `legacy:${legacyKind}`,
      kind: legacyKind,
      title: "Legacy result",
      data: {
        rows: [{
          id: opportunityId,
          type: "opportunity",
          name: "Expansion",
          subtitle: "Discovery",
          values: { stage: "Discovery", active: true, amount: 125000 },
          actions: [{
            id: "open:legacy",
            kind: "open_resource",
            label: "Open opportunity",
            resource: { kind: "opportunity", id: opportunityId },
          }],
        }],
      },
    })

    assert.equal(artifact?.kind, expectedKind, legacyKind)
    assert.equal(artifact?.records[0]?.label, "Expansion", legacyKind)
    assert.deepEqual(
      artifact?.records[0]?.fields.map(({ label, value }) => [label, value]),
      [["stage", "Discovery"], ["active", "Yes"], ["amount", "125000"]],
      legacyKind
    )
    assert.deepEqual(artifact?.records[0]?.actions[0], {
      id: "open:legacy",
      capabilityId: "opportunities.open",
      label: "Open opportunity",
      behavior: "secure_handoff",
      risk: "none",
      target: { opportunityId },
      prompt: undefined,
      artifactId: undefined,
      disabled: false,
    }, legacyKind)
  }
})

test("artifact normalization is a defensive copy and drops malformed or oversized content", () => {
  const source = canonicalArtifact({
    actions: [{
      id: "open:stable",
      capabilityId: "opportunities.open",
      label: "Open opportunity",
      behavior: "secure_handoff",
      target: { opportunityId },
    }],
  })
  const artifact = normalizeAssistantArtifact(source)
  source.actions[0].target.opportunityId = "changed-after-normalization"

  assert.equal(artifact?.actions[0]?.target.opportunityId, opportunityId)
  assert.equal(normalizeAssistantArtifact(null), null)
  assert.equal(normalizeAssistantArtifact([]), null)
  assert.equal(normalizeAssistantArtifact({ id: "missing-title", kind: "record" }), null)
  assert.equal(normalizeAssistantArtifact({ id: "unsafe id", kind: "record", title: "Unsafe" }), null)
  assert.equal(normalizeAssistantArtifact({ id: "unknown", kind: "spreadsheet", title: "Unknown" }), null)
  assert.equal(normalizeAssistantArtifact({
    id: "oversized",
    kind: "summary",
    title: "Too large",
    description: "x".repeat(70_000),
  }), null)
})

test("task artifacts clamp progress and omit invalid status rather than inventing state", () => {
  const completed = normalizeAssistantArtifact({
    id: "task:one",
    kind: "task",
    title: "Preparing account research",
    data: { status: "completed", progress: 125, detail: "Ready" },
  })
  const invalid = normalizeAssistantArtifact({
    id: "task:two",
    kind: "task",
    title: "Preparing account research",
    data: { status: "almost", progress: -10 },
  })

  assert.deepEqual(completed?.task, { status: "completed", progress: 100, detail: "Ready" })
  assert.equal(completed?.status, "completed")
  assert.equal(invalid?.task, undefined)
  assert.equal(invalid?.status, undefined)
})

test("durable message replay normalizes artifacts and preserves the legacy action-message contract", async () => {
  const transport = {
    request: async (path) => {
      assert.match(path, /^\/api\/assistant\/threads\/thread-1\/messages\?limit=50$/)
      return {
        messages: [
          {
            id: "message-1",
            role: "action",
            content: "Change confirmed.",
            ordinal: 1,
            createdAt: "2026-07-13T00:00:00.000Z",
            artifacts: [
              canonicalArtifact(),
              { id: "bad artifact", kind: "record", title: "Dropped" },
            ],
          },
        ],
        proposals: [
          {
            id: "proposal-pending",
            capabilityId: "update_opportunity",
            summary: "Update Expansion",
            fields: [{ label: "Stage", value: "Validation" }],
            risk: "standard",
            status: "pending",
            expiresAt: "2026-07-13T00:10:00.000Z",
          },
          {
            id: "proposal-complete",
            capabilityId: "update_opportunity",
            summary: "Already complete",
            fields: [],
            risk: "standard",
            status: "completed",
            expiresAt: "2026-07-13T00:10:00.000Z",
          },
        ],
      }
    },
    stream: async () => undefined,
  }

  const replay = await createAssistantClient(transport).listMessages("thread-1")
  assert.equal(replay.messages[0].role, "status")
  assert.equal(replay.messages[0].artifacts.length, 1)
  assert.equal(replay.messages[0].artifacts[0].kind, "collection")
  assert.deepEqual(replay.proposals.map((proposal) => proposal.id), ["proposal-pending"])
  assert.equal(replay.proposals[0].summary, "Update Expansion")
})

test("artifact action preparation sends only immutable server-owned artifact and action IDs", async () => {
  let observed
  const transport = {
    request: async (path, init) => {
      observed = { path, init }
      return { artifact: canonicalArtifact({ id: "artifact:updated" }) }
    },
    stream: async () => undefined,
  }

  const prepared = await createAssistantClient(transport).prepareArtifactAction(
    "artifact:opportunities",
    "open:1"
  )
  assert.deepEqual(JSON.parse(observed.init.body), {
    actionId: "open:1",
    artifactId: "artifact:opportunities",
  })
  assert.equal(observed.path, "/api/assistant/actions/prepare")
  assert.equal(observed.init.method, "POST")
  assert.equal(prepared.artifact?.id, "artifact:updated")
})

test("fragmented event streams normalize artifacts and require one terminal event", async () => {
  const events = []
  const response = responseFromChunks([
    "data: {\"type\":\"status\",\"text\":\"Looking at your workspace\"}\n\n" +
      "data: {\"type\":\"artifact\",\"artifact\":{\"id\":\"legacy:table\",\"kind\":\"table\",",
    "\"title\":\"Opportunities\",\"data\":{\"rows\":[]}}}\n\n" +
      "data: {\"type\":\"complete\",\"messageId\":\"message-1\"}\n\n",
    "data: [DONE]\n\n",
  ])

  await readAssistantEventStream(response, (event) => events.push(event))
  assert.deepEqual(events.map((event) => event.type), ["status", "artifact", "complete"])
  assert.equal(events[1].artifact.kind, "collection")
})

test("event streams reject unsafe references before exposing them to navigation", async () => {
  for (const route of ["/calls/id\\escape", "/calls/id\nleak", "//external.example/call"]) {
    const events = []
    const response = responseFromChunks([
      `data: ${JSON.stringify({
        type: "reference",
        reference: { id: "ref-1", kind: "call", label: "Call", route },
      })}\n\n`,
    ])
    await assert.rejects(
      () => readAssistantEventStream(response, (event) => events.push(event)),
      /unexpected conversation update/i,
      route
    )
    assert.deepEqual(events, [], route)
  }
})

test("event streams reject invalid artifacts, trailing events, and interruption distinctly", async () => {
  await assert.rejects(
    () => readAssistantEventStream(responseFromChunks([
      "data: {\"type\":\"artifact\",\"artifact\":{\"id\":\"bad artifact\",\"kind\":\"record\",\"title\":\"Bad\"}}\n\n",
    ]), () => undefined),
    /unexpected conversation update/i
  )

  await assert.rejects(
    () => readAssistantEventStream(responseFromChunks([
      "data: {\"type\":\"complete\",\"messageId\":\"message-1\"}\n\n" +
        "data: {\"type\":\"text_delta\",\"text\":\"late\"}\n\n",
    ]), () => undefined),
    (error) => error?.code === "assistant_stream_protocol_error"
  )

  await assert.rejects(
    () => readAssistantEventStream(responseFromChunks([
      "data: {\"type\":\"text_delta\",\"text\":\"partial\"}\n\n",
    ]), () => undefined),
    (error) => error?.code === "assistant_stream_interrupted"
  )
})

function responseFromChunks(chunks) {
  const encoder = new TextEncoder()
  let index = 0
  const body = new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[index]))
      index += 1
    },
  })
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
    status: 200,
  })
}
