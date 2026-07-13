import assert from "node:assert/strict"
import test from "node:test"

import { parseAssistantReadIntent } from "../../netlify/functions/_shared/assistant-read-intents.ts"
import {
  normalizeAssistantSearchText,
  rankAssistantSearch,
  scoreAssistantSearchRecord,
} from "../../netlify/functions/_shared/assistant-search.ts"

const routeContext = { path: "/app" }
const accountRouteContext = {
  accountId: "7d0df7a2-caf4-4f92-a54f-130f249334c5",
  path: "/accounts/7d0df7a2-caf4-4f92-a54f-130f249334c5",
}

const entityGroups = [
  { kind: "accounts", labels: ["accounts", "companies", "customers"] },
  { kind: "opportunities", labels: ["opportunities", "deals", "pipeline"] },
  { kind: "contacts", labels: ["contacts", "stakeholders", "people"] },
  { kind: "calls", labels: ["calls", "meetings", "conversations"] },
]

const globalReadFrames = [
  (entity) => `Show my ${entity}`,
  (entity) => `List my ${entity}`,
  (entity) => `Find my ${entity}`,
  (entity) => `Display my ${entity}`,
  (entity) => `Give me my ${entity}`,
  (entity) => `I want to see my ${entity}`,
  (entity) => `Can you please show my ${entity}?`,
  (entity) => `Please list my ${entity}`,
]

const scopedReadFrames = [
  (entity, account) => `Show ${entity} for ${account}`,
  (entity, account) => `List ${entity} at ${account}`,
  (entity, account) => `Find ${entity} with ${account}`,
  (entity, account) => `Display ${entity} under ${account}`,
  (entity, account) => `Can you show ${entity} for ${account}?`,
  (entity, account) => `Could you please list ${entity} at ${account}?`,
  (entity, account) => `I want to see ${entity} under ${account}`,
  (entity, account) => `Please show ${entity} for the account ${account}`,
]

const generatedGlobalReadCorpus = entityGroups.flatMap(({ kind, labels }) =>
  labels.flatMap((entity) => globalReadFrames.map((frame) => ({
    accountQuery: null,
    kind,
    text: frame(entity),
  })))
)

const generatedScopedReadCorpus = entityGroups
  .filter(({ kind }) => kind !== "accounts")
  .flatMap(({ kind, labels }) => labels.flatMap((entity) =>
    ["CBA", "Commonwealth Bank", "Canva"].flatMap((account) =>
      scopedReadFrames.map((frame) => ({
        accountQuery: account,
        kind,
        text: frame(entity, account),
      })))
  ))

const deterministicReadCorpus = [
  ["List my accounts", "accounts", null],
  ["Show active companies", "accounts", null],
  ["How many customers do I have?", "accounts", null],
  ["What opportunities do I have for CBA?", "opportunities", "CBA"],
  ["Could you please list deals at Commonwealth Bank?", "opportunities", "Commonwealth Bank"],
  ["Give me active pipeline under the account Canva", "opportunities", "Canva"],
  ["Who are my contacts at Canva?", "contacts", "Canva"],
  ["Please show stakeholders for Atlassian, thanks", "contacts", "Atlassian"],
  ["Active contacts", "contacts", null],
  ["What calls have I had with Atlassian?", "calls", "Atlassian"],
  ["Find recent meetings for Acme", "calls", "Acme"],
  ["Recent conversations under Gong", "calls", "Gong"],
]

test("deterministic reads pass a generated evaluation of at least 300 seller-like requests", () => {
  const corpus = [...generatedGlobalReadCorpus, ...generatedScopedReadCorpus]
  assert.ok(corpus.length >= 300, `expected at least 300 requests, received ${corpus.length}`)

  for (const { text, kind, accountQuery } of corpus) {
    const actual = parseAssistantReadIntent(text, routeContext)
    assert.deepEqual(actual, {
      accountQuery,
      kind,
      scopedAccountId: null,
    }, text)
  }
})

test("deterministic reads handle punctuation, courtesy language, possession, and counts", () => {
  for (const [text, kind, accountQuery] of deterministicReadCorpus) {
    const actual = parseAssistantReadIntent(text, routeContext)
    assert.deepEqual(actual, {
      accountQuery,
      kind,
      scopedAccountId: null,
    }, text)
  }
})

test("deterministic reads inherit the current account only when no account was named", () => {
  for (const { kind, labels } of entityGroups.filter(({ kind }) => kind !== "accounts")) {
    for (const entity of labels) {
      assert.deepEqual(parseAssistantReadIntent(`Show my ${entity}`, accountRouteContext), {
        accountQuery: null,
        kind,
        scopedAccountId: accountRouteContext.accountId,
      }, entity)
    }
  }
  assert.deepEqual(parseAssistantReadIntent("List contacts for Canva", accountRouteContext), {
    accountQuery: "Canva",
    kind: "contacts",
    scopedAccountId: null,
  })
})

const assistantReasoningCorpus = [
  "Are there risks in this opportunity?",
  "What is the next step for this opportunity?",
  "Who owns this opportunity?",
  "Tell me about this account",
  "Tell me the account strategy",
  "What contacts are missing from this opportunity?",
  "What happened in my last call?",
  "What should I ask in my next call?",
  "Tell me how to coach this call",
  "Prepare me for the meeting",
  "Explain the decision process for this deal",
  "Summarise the last conversation",
  "Why is this account at risk?",
  "When should I contact the buyer?",
  "Where did we leave the opportunity?",
  "Draft a follow-up for this contact",
  "Compare these accounts",
  "Help me qualify this opportunity",
  "What does the customer care about?",
  "Which stakeholder has the most influence?",
]

test("semantic, coaching, and detail questions stay on the conversational reasoning path", () => {
  for (const text of assistantReasoningCorpus) {
    assert.equal(parseAssistantReadIntent(text, accountRouteContext), null, text)
  }
})

test("ambiguous fragments and multi-entity requests ask for reasoning instead of guessing a list", () => {
  for (const text of [
    "Show them",
    "What about CBA?",
    "List",
    "Recent",
    "Who is Alex?",
    "Show pipeline or contacts for Canva",
    "List accounts and contacts",
    "Show calls and opportunities for Acme",
    "Show people and meetings",
  ]) {
    assert.equal(parseAssistantReadIntent(text, accountRouteContext), null, text)
  }
})

test("multi-turn scope uses authorized route context but never guesses an elliptical follow-up", () => {
  const firstTurn = parseAssistantReadIntent("Show contacts for Canva", routeContext)
  const contextualFollowUp = parseAssistantReadIntent("Show my opportunities", accountRouteContext)
  const ambiguousFollowUp = parseAssistantReadIntent("What about Atlassian?", accountRouteContext)

  assert.deepEqual(firstTurn, {
    accountQuery: "Canva",
    kind: "contacts",
    scopedAccountId: null,
  })
  assert.deepEqual(contextualFollowUp, {
    accountQuery: null,
    kind: "opportunities",
    scopedAccountId: accountRouteContext.accountId,
  })
  assert.equal(ambiguousFollowUp, null)
})

test("deterministic reads never absorb a request that also asks to mutate data", () => {
  for (const text of [
    "Show accounts and archive the old ones",
    "List contacts, then delete Alex",
    "Find opportunities and update the close dates",
    "Create a list of accounts",
    "Please remove the calls for Acme",
  ]) {
    assert.equal(parseAssistantReadIntent(text, routeContext), null, text)
  }
})

test("search normalization is stable across accents, punctuation, and domains", () => {
  assert.equal(normalizeAssistantSearchText("  Société Générale — ANZ  "), "societe generale anz")
  assert.equal(normalizeAssistantSearchText("HTTPS://COMM-BANK.COM.AU/"), "https comm bank com au")
  assert.equal(normalizeAssistantSearchText(null), "")
})

test("search tiers preserve exact, phrase, alias, prefix, and typo precedence", () => {
  const keys = ["name", "region"]
  const exact = scoreAssistantSearchRecord({ name: "Banking Australia" }, "Banking Australia", keys)
  const phrase = scoreAssistantSearchRecord({ name: "Best Banking Australia Group" }, "Banking Australia", keys)
  const alias = scoreAssistantSearchRecord({ name: "Commonwealth Bank", region: "Australia" }, "CBA", keys)
  const splitTokens = scoreAssistantSearchRecord(
    { name: "Banking Group", region: "Australia" },
    "Banking Australia",
    keys
  )
  const prefix = scoreAssistantSearchRecord({ name: "Canterbury" }, "Cant", keys)
  const typo = scoreAssistantSearchRecord({ name: "Atlassian" }, "Atlassain", keys)

  assert.ok(exact > phrase, { exact, phrase })
  assert.ok(phrase > alias, { alias, phrase })
  assert.ok(alias > splitTokens, { alias, splitTokens })
  assert.ok(splitTokens > prefix, { prefix, splitTokens })
  assert.ok(prefix > typo, { prefix, typo })
})

test("search requires every meaningful query token and keeps ties deterministic", () => {
  const rows = [
    { id: "first", name: "Sydney Banking" },
    { id: "second", name: "Sydney Banking" },
    { id: "software", name: "Sydney Software" },
  ]

  assert.deepEqual(
    rankAssistantSearch(rows, "Sydney Banking", ["name"], 10).map((match) => match.item.id),
    ["first", "second"]
  )
  assert.deepEqual(rankAssistantSearch(rows, "Sydney Medical", ["name"], 10), [])
  assert.deepEqual(rankAssistantSearch(rows, "Sydney", ["name"], 0), [])
  assert.deepEqual(rankAssistantSearch(rows, "Sydney", ["name"], -3), [])
})

test("company aliases remain useful without turning weak noise into a match", () => {
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
  ]
  const keys = ["name", "website", "industry", "region"]

  for (const query of ["CBA", "commbank", "commbank.com.au", "Commonwelth Bank"]) {
    assert.equal(rankAssistantSearch(accounts, query, keys, 3)[0]?.item.id, "commonwealth", query)
  }
  assert.deepEqual(rankAssistantSearch(accounts, "medical devices", keys, 3), [])
  assert.deepEqual(rankAssistantSearch(accounts, "x", keys, 3), [])
})
