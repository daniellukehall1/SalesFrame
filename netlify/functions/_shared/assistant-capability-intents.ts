import { ASSISTANT_CAPABILITY_REGISTRY } from "../../../src/lib/assistant-capability-registry.ts"

import type { AssistantRouteContext } from "./assistant-core"
import {
  resolveServerAssistantArtifactCapability,
  type ServerAssistantArtifactTargetKey,
} from "./assistant-artifact-capabilities.ts"
import type { AssistantArtifactTarget } from "./assistant-artifacts"
import { normalizeAssistantSearchText } from "./assistant-search.ts"

export type AssistantCapabilityIntent = {
  capabilityId: string
  description?: string
  label?: string
  target: AssistantArtifactTarget
  text: string
  title?: string
}

const explicitAliases = new Map<string, string>([
  ["start a call", "calls.start"],
  ["start call", "calls.start"],
  ["open start call", "calls.start"],
  ["add a new account", "accounts.create"],
  ["create a new account", "accounts.create"],
  ["new account", "accounts.create"],
  ["add a new opportunity", "opportunities.create"],
  ["create a new opportunity", "opportunities.create"],
  ["new opportunity", "opportunities.create"],
  ["add a deal", "opportunities.create"],
  ["new deal", "opportunities.create"],
  ["add a new contact", "contacts.create"],
  ["create a new contact", "contacts.create"],
  ["new contact", "contacts.create"],
  ["prepare me for my next call", "opportunities.next_call"],
  ["prepare me for the next call", "opportunities.next_call"],
  ["show the next call brief", "opportunities.next_call"],
  ["show me the methodology", "opportunities.methodology"],
  ["review the methodology", "opportunities.methodology"],
  ["manage buying roles", "contacts.relationships"],
  ["show buying roles", "opportunities.contacts"],
  ["open ai settings", "settings.ai"],
  ["open capture settings", "settings.capture"],
  ["open session settings", "settings.session"],
  ["open retention settings", "settings.retention"],
  ["open billing", "settings.billing"],
  ["show my playbooks", "playbooks.list"],
  ["show playbooks", "playbooks.list"],
  ["browse playbooks", "playbooks.list"],
])

const titleAliases = new Map(
  ASSISTANT_CAPABILITY_REGISTRY.flatMap((capability) => {
    const normalizedTitle = normalizeAssistantSearchText(capability.title)
    return normalizedTitle ? [[normalizedTitle, capability.id] as const] : []
  })
)

export function parseAssistantCapabilityIntent(
  value: string,
  routeContext: AssistantRouteContext
): AssistantCapabilityIntent | null {
  const normalized = normalizeAssistantSearchText(value)
  if (!normalized || normalized.length > 180 || hasMultipleInstructions(normalized)) return null
  const direct = stripConversationWrapper(normalized)
  let capabilityId = explicitAliases.get(direct) ?? titleAliases.get(direct) ?? null

  if (!capabilityId && routeContext.contactId && /^(?:please )?enrich (?:him|her|them|this contact|the contact)$/.test(direct)) {
    capabilityId = "contacts.enrich"
  }
  if (!capabilityId && routeContext.accountId && /^(?:please )?enrich (?:it|this account|the account)$/.test(direct)) {
    capabilityId = "accounts.enrich"
  }
  if (!capabilityId) return null

  const availableTarget = routeTarget(routeContext)
  const capability = resolveServerAssistantArtifactCapability(capabilityId)
  const target = narrowTarget(availableTarget, capability.requiredTarget)
  if (hasRequiredTarget(target, capability.requiredTarget)) {
    return {
      capabilityId,
      target,
      text: `${capability.title} is ready when you are.`,
    }
  }

  const fallback = fallbackForMissingTarget(capability.requiredTarget, availableTarget)
  if (!fallback) return null
  const fallbackCapability = resolveServerAssistantArtifactCapability(fallback.capabilityId)
  return {
    capabilityId: fallback.capabilityId,
    description: fallback.description,
    label: fallback.label,
    target: fallback.target,
    text: fallback.description ?? fallbackCapability.description,
    title: fallback.title ?? fallbackCapability.title,
  }
}

function stripConversationWrapper(value: string) {
  return value
    .replace(/^(?:please |can you |could you |would you |i want to |i need to |take me to |go to )+/, "")
    .replace(/(?: please| for me| thanks| thank you)+$/, "")
    .trim()
}

function hasMultipleInstructions(value: string) {
  return /\b(?:and then|then|and also|after that)\b|[;,]/.test(value)
}

function routeTarget(route: AssistantRouteContext): AssistantArtifactTarget {
  return {
    accountId: route.accountId,
    callId: route.callId,
    contactId: route.contactId,
    opportunityId: route.opportunityId,
  }
}

function hasRequiredTarget(target: AssistantArtifactTarget, required: ServerAssistantArtifactTargetKey) {
  return required === "workspace" || Boolean(target[required])
}

function narrowTarget(
  target: AssistantArtifactTarget,
  required: ServerAssistantArtifactTargetKey
): AssistantArtifactTarget {
  if (required === "workspace") return {}
  const value = target[required]
  return value ? { [required]: value } : {}
}

function fallbackForMissingTarget(
  required: ServerAssistantArtifactTargetKey,
  target: AssistantArtifactTarget
): Omit<AssistantCapabilityIntent, "text"> | null {
  if (required === "accountId") {
    return {
      capabilityId: "accounts.list",
      description: "Choose an account first, then SalesFrame can continue with the exact record.",
      label: "Choose account",
      target: {},
      title: "Choose an account",
    }
  }
  if (required === "opportunityId") {
    return {
      capabilityId: "opportunities.list",
      description: "Choose an opportunity first, then SalesFrame can continue with the exact record.",
      label: "Choose opportunity",
      target: {},
      title: "Choose an opportunity",
    }
  }
  if (required === "contactId") {
    if (target.accountId) {
      return {
        capabilityId: "contacts.list",
        description: "Choose a contact first, then SalesFrame can continue with that person.",
        label: "Choose contact",
        target: { accountId: target.accountId },
        title: "Choose a contact",
      }
    }
    return {
      capabilityId: "accounts.list",
      description: "Choose an account and contact first, then SalesFrame can continue with that person.",
      label: "Choose account",
      target: {},
      title: "Choose an account",
    }
  }
  if (required === "callId") {
    return {
      capabilityId: "calls.list",
      description: "Choose a call first, then SalesFrame can open the exact call context.",
      label: "Choose call",
      target: {},
      title: "Choose a call",
    }
  }
  return null
}
