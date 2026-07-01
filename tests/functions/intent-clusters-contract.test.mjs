import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)

async function loadIntentClusterModule() {
  const source = await readFile(new URL("src/lib/salesframe-intent-clusters.ts", root), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

function playbook(id, slug, name) {
  return { id, slug, name }
}

function field(id, playbookId, label) {
  return { id, playbook_id: playbookId, label, description: `${label} description` }
}

test("intent cluster builder merges pain and problem fields across selected playbooks", async () => {
  const { buildPlaybookIntentClusters } = await loadIntentClusterModule()
  const clusters = buildPlaybookIntentClusters({
    playbooks: [
      playbook("p-meddicc", "meddicc", "MEDDICC"),
      playbook("p-spin", "spin", "SPIN Selling"),
      playbook("p-force", "force-management", "Force Management / Command of the Message"),
      playbook("p-gap", "gap-selling", "Gap Selling"),
      playbook("p-spiced", "spiced", "SPICED (Winning by Design)"),
    ],
    playbookFields: [
      field("f-meddicc-pain", "p-meddicc", "Identify Pain"),
      field("f-spin-problem", "p-spin", "Problem"),
      field("f-force-business-pain", "p-force", "Business Pain"),
      field("f-gap-current", "p-gap", "Current State"),
      field("f-gap-gap", "p-gap", "Gap"),
      field("f-spiced-pain", "p-spiced", "Pain"),
    ],
  })
  const painCluster = clusters.find((cluster) => cluster.id === "pain_problem")

  assert.ok(painCluster)
  assert.deepEqual(
    painCluster.fields.map((item) => item.playbookFieldId).sort(),
    ["f-force-business-pain", "f-gap-current", "f-gap-gap", "f-meddicc-pain", "f-spiced-pain", "f-spin-problem"]
  )
})

test("intent cluster builder merges authority and economic influence fields", async () => {
  const { buildPlaybookIntentClusters } = await loadIntentClusterModule()
  const clusters = buildPlaybookIntentClusters({
    playbooks: [
      playbook("p-bant", "bant", "BANT"),
      playbook("p-meddicc", "meddicc", "MEDDICC"),
      playbook("p-strategic", "strategic-selling", "Strategic Selling (Miller Heiman)"),
    ],
    playbookFields: [
      field("f-bant-authority", "p-bant", "Authority"),
      field("f-meddicc-economic", "p-meddicc", "Economic Buyer"),
      field("f-strategic-economic", "p-strategic", "Economic Buying Influence"),
    ],
  })
  const authorityCluster = clusters.find((cluster) => cluster.id === "authority_influence")

  assert.ok(authorityCluster)
  assert.deepEqual(
    authorityCluster.fields.map((item) => item.playbookFieldId).sort(),
    ["f-bant-authority", "f-meddicc-economic", "f-strategic-economic"]
  )
})

test("intent cluster builder keeps unknown custom fields standalone unless exact alias matches", async () => {
  const { buildPlaybookIntentClusters } = await loadIntentClusterModule()
  const clusters = buildPlaybookIntentClusters({
    playbooks: [playbook("p-custom", "custom", "Custom framework")],
    playbookFields: [
      field("f-custom-unknown", "p-custom", "Internal Readiness"),
      field("f-custom-impact", "p-custom", "Impact"),
    ],
  })

  assert.ok(clusters.some((cluster) => cluster.id === "field_f_custom_unknown"))
  assert.ok(clusters.find((cluster) => cluster.id === "impact_value_metrics")?.fields.some((item) => item.playbookFieldId === "f-custom-impact"))
})

test("intent cluster builder preserves repeated labels by playbook field id", async () => {
  const { buildPlaybookIntentClusters } = await loadIntentClusterModule()
  const clusters = buildPlaybookIntentClusters({
    opportunityEvidence: [
      { playbook_field_id: "f-meddicc-metrics", status: "confirmed", confidence: 0.91 },
      { playbook_field_id: "f-force-metrics", status: "weak", confidence: 0.54 },
    ],
    playbooks: [
      playbook("p-meddicc", "meddicc", "MEDDICC"),
      playbook("p-force", "force-management", "Force Management / Command of the Message"),
    ],
    playbookFields: [
      field("f-meddicc-metrics", "p-meddicc", "Metrics"),
      field("f-force-metrics", "p-force", "Metrics"),
    ],
  })
  const impactCluster = clusters.find((cluster) => cluster.id === "impact_value_metrics")

  assert.ok(impactCluster)
  assert.deepEqual(
    impactCluster.fields.map((item) => [item.playbookFieldId, item.status, item.confidence]),
    [
      ["f-meddicc-metrics", "confirmed", 0.91],
      ["f-force-metrics", "weak", 0.54],
    ]
  )
})
