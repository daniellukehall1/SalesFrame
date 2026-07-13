import type { AssistantRouteContext } from "./assistant-core"

export type AssistantReadIntent = {
  accountQuery: string | null
  kind: "accounts" | "calls" | "contacts" | "opportunities"
  scopedAccountId: string | null
}

export function parseAssistantReadIntent(
  textValue: string,
  routeContext: AssistantRouteContext
): AssistantReadIntent | null {
  const text = textValue.replace(/\s+/g, " ").trim()
  const normalized = text.toLocaleLowerCase()
  const kind = getReadKind(normalized)
  if (!kind) return null
  if (!isReadRequest(normalized, kind)) return null
  const accountQuery = kind === "accounts" ? null : extractAccountQuery(text)
  const workspaceScoped = isWorkspaceScopedRequest(normalized)

  return {
    accountQuery,
    kind,
    scopedAccountId: accountQuery || workspaceScoped ? null : routeContext.accountId ?? null,
  }
}

function isWorkspaceScopedRequest(text: string) {
  return /\b(?:across (?:the )?workspace|workspace-wide|all active)\b/.test(text)
}

function isReadRequest(text: string, kind: AssistantReadIntent["kind"]) {
  if (/\b(delete|remove|archive|change|update|edit|create|add)\b/.test(text)) return false

  // Deterministic reads are deliberately limited to enumeration and lookup.
  // Questions about meaning, ownership, strategy, gaps, coaching, or what
  // happened need the reasoning path even when they mention a record type.
  if (
    /\b(risks?|next steps?|owns?|owner|strategy|missing|happened|why|prepare|brief|coach|coaching|ask|questions?|recommend|summari[sz]e|about this)\b/.test(text)
  ) return false

  const kindNouns = kind === "accounts"
    ? "accounts?|companies|customers"
    : kind === "opportunities"
      ? "opportunit(?:y|ies)|deals?|pipeline"
      : kind === "contacts"
        ? "contacts?|people|stakeholders?"
        : "calls?|meetings|conversations"

  return (
    /^(?:please\s+)?(?:show(?: me)?|list|find|display|give me|pull up|i want to see)\b/.test(text) ||
    /^(can|could|would) you (?:please )?(show(?: me)?|list|find|display|give me|pull up)\b/.test(text) ||
    new RegExp(`^how many\\s+(?:active\\s+)?(?:${kindNouns})\\b`).test(text) ||
    new RegExp(`^(?:what|which)\\s+(?:active\\s+)?(?:${kindNouns})\\b.*\\b(?:do i have|have i had|are there|are at|for|at|with|under)\\b`).test(text) ||
    (kind === "contacts" && /^(?:who are my contacts?|who are the stakeholders?|who do i know)\b/.test(text)) ||
    /^(my|recent|active)\s+(accounts?|companies|customers|opportunities|deals|pipeline|contacts?|people|stakeholders|calls?|meetings|conversations)\b/.test(text)
  )
}

function getReadKind(text: string): AssistantReadIntent["kind"] | null {
  const kinds: AssistantReadIntent["kind"][] = []
  if (/\b(opportunit(?:y|ies)|deals?|pipeline)\b/.test(text)) kinds.push("opportunities")
  if (/\b(contacts?|people|stakeholders?)\b/.test(text) || /\bwho do i know\b/.test(text)) kinds.push("contacts")
  if (/\b(calls?|meetings|conversations)\b/.test(text)) kinds.push("calls")

  const explicitAccountCollection = /\b(accounts|companies|customers)\b/.test(text)
  if (explicitAccountCollection || (kinds.length === 0 && /\baccount\b/.test(text))) {
    kinds.push("accounts")
  }
  return kinds.length === 1 ? kinds[0] : null
}

function extractAccountQuery(text: string) {
  const match = /\b(?:for|at|with|under)\s+(?:the\s+)?(?:account\s+)?(.+?)\s*[?.!]*$/i.exec(text)
  if (!match) return null
  const value = match[1]
    .replace(/[?.!,;:]+\s*$/g, "")
    .replace(/\b(?:please|thanks|thank you)\b\s*$/i, "")
    .replace(/[?.!,;:]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return value || null
}
