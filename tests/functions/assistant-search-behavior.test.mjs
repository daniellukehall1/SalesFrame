import assert from "node:assert/strict"
import test from "node:test"

import { parseAssistantReadIntent } from "../../netlify/functions/_shared/assistant-read-intents.ts"
import { rankAssistantSearch } from "../../netlify/functions/_shared/assistant-search.ts"

const accounts = [
  {
    id: "commonwealth",
    industry: "Banking",
    name: "Commonwealth Bank",
    region: "Sydney, Australia",
    website: "https://commbank.com.au",
  },
  {
    id: "canva",
    industry: "Software",
    name: "Canva",
    region: "Sydney, Australia",
    website: "https://canva.com",
  },
  {
    id: "atlassian",
    industry: "Software",
    name: "Atlassian",
    region: "Sydney, Australia",
    website: "https://atlassian.com",
  },
]

const accountKeys = ["name", "website", "industry", "region"]

test("assistant account matching understands full names, domains, acronyms, and small typos", () => {
  for (const query of ["Commonwealth Bank", "commbank", "CBA", "Commonwelth Bank"]) {
    const [match] = rankAssistantSearch(accounts, query, accountKeys, 3)
    assert.equal(match?.item.id, "commonwealth", query)
  }
})

test("assistant account matching rejects unrelated weak text", () => {
  assert.deepEqual(rankAssistantSearch(accounts, "medical devices", accountKeys, 3), [])
})

test("assistant opportunity read intent covers natural company-scoped phrasing", () => {
  for (const [text, accountQuery] of [
    ["what opportunities do i have for cba", "cba"],
    ["Which deals are at Commonwealth Bank?", "Commonwealth Bank"],
    ["show me the pipeline for the account Canva please", "Canva"],
    ["How many opportunities are there for CBA?", "CBA"],
    ["Can you please show the deals for Canva?", "Canva"],
    ["Pull up my pipeline for Atlassian", "Atlassian"],
  ]) {
    assert.deepEqual(parseAssistantReadIntent(text, { path: "/app" }), {
      accountQuery,
      kind: "opportunities",
      scopedAccountId: null,
    })
  }
})

test("assistant read intent covers contacts, calls, accounts, and current account context", () => {
  assert.deepEqual(parseAssistantReadIntent("Who do I know at Canva?", { path: "/app" }), {
    accountQuery: "Canva",
    kind: "contacts",
    scopedAccountId: null,
  })
  assert.deepEqual(parseAssistantReadIntent("What calls have I had with Atlassian?", { path: "/app" }), {
    accountQuery: "Atlassian",
    kind: "calls",
    scopedAccountId: null,
  })
  assert.deepEqual(parseAssistantReadIntent("List my accounts", { path: "/app" }), {
    accountQuery: null,
    kind: "accounts",
    scopedAccountId: null,
  })
  assert.deepEqual(parseAssistantReadIntent("Show my opportunities", {
    accountId: "7d0df7a2-caf4-4f92-a54f-130f249334c5",
    path: "/accounts/7d0df7a2-caf4-4f92-a54f-130f249334c5",
  }), {
    accountQuery: null,
    kind: "opportunities",
    scopedAccountId: "7d0df7a2-caf4-4f92-a54f-130f249334c5",
  })

  assert.deepEqual(parseAssistantReadIntent("Show all active opportunities across the workspace", {
    path: "/opportunities/8916471e-69f0-4f35-980a-2432a3a464c3",
    accountId: "7d0df7a2-caf4-4f92-a54f-130f249334c5",
    opportunityId: "8916471e-69f0-4f35-980a-2432a3a464c3",
  }), {
    accountQuery: null,
    kind: "opportunities",
    scopedAccountId: null,
  })
})

test("assistant read intent does not intercept writes or live coaching questions", () => {
  assert.equal(parseAssistantReadIntent("Delete the opportunities for CBA", { path: "/app" }), null)
  assert.equal(parseAssistantReadIntent("What should I ask in my next call?", { path: "/app" }), null)
})
