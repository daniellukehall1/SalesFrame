import assert from "node:assert/strict"
import { test } from "node:test"

import { getAssistantCreatedOpportunity } from "../src/lib/assistant-result-sync.ts"

const artifact = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "record",
  schemaVersion: 1,
  status: "completed",
  title: "Opportunity created",
  fields: [],
  sections: [],
  steps: [],
  actions: [],
  records: [{
    id: "00000000-0000-4000-8000-000000000002",
    kind: "opportunity",
    label: "Test 2",
    description: "",
    fields: [{ id: "stage", label: "Stage", value: "Discovery" }],
    actions: [{
      id: "00000000-0000-4000-8000-000000000003",
      behavior: "secure_handoff",
      capabilityId: "opportunities.open",
      label: "Open opportunity",
      risk: "none",
      target: {
        accountId: "00000000-0000-4000-8000-000000000004",
        opportunityId: "00000000-0000-4000-8000-000000000002",
      },
    }],
  }],
}

test("a confirmed created opportunity is available for immediate local navigation", () => {
  assert.deepEqual(getAssistantCreatedOpportunity(artifact), {
    accountId: "00000000-0000-4000-8000-000000000004",
    id: "00000000-0000-4000-8000-000000000002",
    name: "Test 2",
    stage: "Discovery",
  })
})

test("only authoritative created-opportunity artifacts can seed local navigation", () => {
  assert.equal(getAssistantCreatedOpportunity({ ...artifact, title: "Opportunity updated" }), null)
  assert.equal(getAssistantCreatedOpportunity({
    ...artifact,
    records: [{
      ...artifact.records[0],
      actions: [{
        ...artifact.records[0].actions[0],
        target: {
          ...artifact.records[0].actions[0].target,
          opportunityId: "00000000-0000-4000-8000-000000000099",
        },
      }],
    }],
  }), null)
})
