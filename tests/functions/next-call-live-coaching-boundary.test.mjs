import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

async function loadIntentHintModule() {
  const source = await read("src/lib/next-call-brief-intent-ledger.ts")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

function cluster({
  fieldIds = ["field-pain"],
  id = "pain_problem",
  label = "Pain and problem",
  status = "missing",
} = {}) {
  return {
    confirmedCount: status === "confirmed" ? fieldIds.length : 0,
    fields: fieldIds.map((playbookFieldId) => ({
      evidenceStandard: "Buyer-confirmed evidence",
      fieldDescription: "",
      fieldLabel: playbookFieldId,
      playbookFieldId,
      playbookId: "playbook-1",
      playbookLabel: "MEDDICC",
      playbookSlug: "meddicc",
      sortOrder: 1,
      status,
    })),
    guidance: "Learn the intent naturally.",
    id,
    label,
    missingCount: status === "confirmed" ? 0 : fieldIds.length,
    status,
    weakCount: 0,
  }
}

test("next-call brief questions become low-priority intent-only ledger suggestions", async () => {
  const { buildSuggestedIntentLedgerRowsFromNextCallBrief } = await loadIntentHintModule()
  const secretWording = "Ask this exact confidential preparation question"
  const rows = buildSuggestedIntentLedgerRowsFromNextCallBrief({
    callId: "call-1",
    existingIntentClusterIds: [],
    intentClusters: [cluster({ fieldIds: ["field-pain", "field-impact"] })],
    opportunityId: "opportunity-1",
    questions: [
      {
        basis: "transcript",
        intentClusterId: "pain_problem",
        kind: "question",
        learningTarget: "A private learning target",
        sources: [{ id: "private-source-id" }],
        text: secretWording,
      },
    ],
    workspaceId: "workspace-1",
  })

  assert.deepEqual(rows, [{
    call_id: "call-1",
    confidence: 0,
    expires_at: null,
    intent_cluster_id: "pain_problem",
    intent_label: "Pain and problem",
    last_answer: null,
    last_question: null,
    opportunity_id: "opportunity-1",
    reason: "pre_call_brief",
    related_playbook_field_ids: ["field-pain", "field-impact"],
    source_turn_ids: [],
    status: "suggested",
    summary: "",
    value: null,
    workspace_id: "workspace-1",
  }])

  const serialized = JSON.stringify(rows)
  assert.doesNotMatch(serialized, new RegExp(secretWording))
  assert.doesNotMatch(serialized, /private-source-id|private learning target/i)
})

test("intent hint conversion validates current clusters, deduplicates, and preserves stronger state", async () => {
  const { buildSuggestedIntentLedgerRowsFromNextCallBrief } = await loadIntentHintModule()
  const rows = buildSuggestedIntentLedgerRowsFromNextCallBrief({
    callId: "call-1",
    existingIntentClusterIds: ["decision_timing"],
    intentClusters: [
      cluster(),
      cluster({ id: "decision_timing", label: "Decision and timing" }),
      cluster({ id: "authority_influence", label: "Authority and influence", status: "confirmed" }),
    ],
    opportunityId: "opportunity-1",
    questions: [
      { intentClusterId: "pain_problem", kind: "question" },
      { intentClusterId: " pain_problem ", kind: "question" },
      { intentClusterId: "decision_timing", kind: "question" },
      { intentClusterId: "authority_influence", kind: "question" },
      { intentClusterId: "unknown_cluster", kind: "question" },
      { intentClusterId: null, kind: "question" },
    ],
    workspaceId: "workspace-1",
  })

  assert.equal(rows.length, 1)
  assert.equal(rows[0].intent_cluster_id, "pain_problem")
  assert.equal(rows[0].status, "suggested")
  assert.equal(rows[0].reason, "pre_call_brief")
})

test("the same preparation hint is re-ranked differently by live topic, feedback, mood, and call stage", async () => {
  const { derivePreparationHintDisposition } = await loadIntentHintModule()
  const briefIntentClusterId = "pain_problem"
  const cases = [
    {
      input: { briefIntentClusterId, hasLiveTranscript: false },
      expected: "opening_option",
    },
    {
      input: {
        briefIntentClusterId,
        currentIntentClusterId: "decision_timing",
        hasLiveTranscript: true,
      },
      expected: "follow_live_topic",
    },
    {
      input: {
        briefIntentClusterId,
        hasLiveTranscript: true,
        sellerFeedbackAction: "too_soon",
      },
      expected: "parked_by_feedback",
    },
    {
      input: {
        briefIntentClusterId,
        buyerMood: "defensive",
        hasLiveTranscript: true,
      },
      expected: "soften_for_buyer",
    },
    {
      input: {
        briefIntentClusterId,
        conversationStage: "wrap-up",
        hasLiveTranscript: true,
      },
      expected: "recover_only_if_natural",
    },
  ]
  const results = cases.map(({ input, expected }) => {
    const result = derivePreparationHintDisposition(input)
    assert.equal(result.disposition, expected)
    return result
  })

  assert.equal(new Set(results.map((result) => result.liveDirective)).size, cases.length)
  assert.ok(results.every((result) => !result.liveDirective.includes("Ask this exact")))
})

test("live coaching functions enforce the preparation boundary", async () => {
  const [liveQuestion, liveState, liveGuidance] = await Promise.all([
    read("netlify/functions/live-question.ts"),
    read("netlify/functions/live-state.ts"),
    read("netlify/functions/live-guidance.ts"),
  ])

  assert.doesNotMatch(liveQuestion, /priorPlannedQuestion|priorQuestionReason/)
  assert.doesNotMatch(liveQuestion, /opportunity\.next_question|opportunity\.question_reason/)
  assert.match(
    liveQuestion,
    /\(1\) live transcript, seller feedback, and question lifecycle; \(2\) active non-preparation intent-ledger state and customer-confirmed opportunity evidence; \(3\) call type, selected methodologies and playbooks, and seller-maintained selected contacts and opportunity buying roles; \(4\) suggested pre_call_brief learning-intent hints; \(5\) confidence-scored contact and account enrichment plus general opportunity and account context/
  )
  assert.match(liveQuestion, /status suggested and reason pre_call_brief are low-priority learning-intent hints/)
  assert.match(liveQuestion, /Never copy or reconstruct Next Call Preparation wording/)
  assert.match(liveQuestion, /\.order\("generated_at", \{ ascending: false \}\)/)
  assert.match(liveQuestion, /\.select\("intent_cluster_id,kind"\)/)
  assert.doesNotMatch(liveQuestion, /\.select\("intent_cluster_id,kind,text"\)/)
  assert.match(liveQuestion, /ignoreDuplicates: true/)
  assert.match(liveQuestion, /const refreshedLedgerResponse = await supabase/)
  assert.match(liveQuestion, /if \(!intentLedgerError\)/)
  assert.doesNotMatch(liveQuestion, /if \(!transcript\.length && !intentLedgerError\)/)
  assert.match(liveQuestion, /preparationHintPolicy/)
  assert.match(liveQuestion, /derivePreparationHintDisposition/)
  assert.match(liveState, /Next Call Preparation is a separate seller-facing planning artifact/)
  assert.match(liveState, /preparation hint is never question history, buyer evidence, methodology completion/)
  assert.match(liveGuidance, /active-call opening guidance, separate from Next Call Preparation/)
  assert.match(liveGuidance, /never copy or reconstruct its exact wording/)
})
