import {
  ASSISTANT_CAPABILITIES,
  type AssistantCapabilityId,
} from "./assistant-capabilities.ts"
import type {
  AssistantCapability,
  AssistantContextKind,
} from "./assistant-types.ts"

export type AssistantCapabilityExecutionMode =
  | "read"
  | "navigate"
  | "write"
  | "background"

export type AssistantCapabilityRisk =
  | "none"
  | "standard"
  | "costed"
  | "destructive"

export type AssistantCapabilitySurface = "native" | "secure_handoff"

export type AssistantCapabilityDefinition = AssistantCapability & {
  executionMode: AssistantCapabilityExecutionMode
  risk: AssistantCapabilityRisk
  surface: AssistantCapabilitySurface
}

const costedCapabilityIds = new Set<AssistantCapabilityId>([
  "accounts.enrich",
  "contacts.enrich",
  "calls.retry_outputs",
])

const destructiveCapabilityIds = new Set<AssistantCapabilityId>([
  "workspace.delete",
  "accounts.delete",
  "opportunities.delete",
  "calls.delete",
])

// This list is intentionally conservative. A capability is marked native only
// when Conversation mode has a server-authorized read/action implementation.
// Everything else remains usable through an exact, context-preserving handoff
// to the established workspace surface instead of a dead assistant control.
const nativeCapabilityIds = new Set<AssistantCapabilityId>([
  "accounts.list",
  "accounts.open",
  "contacts.list",
  "contacts.open",
  "opportunities.list",
  "opportunities.open",
  "opportunities.contacts",
  "opportunities.history",
  "calls.list",
  "calls.transcript",
])

export const ASSISTANT_CAPABILITY_REGISTRY = ASSISTANT_CAPABILITIES.map(
  (capability): AssistantCapabilityDefinition => ({
    ...capability,
    executionMode: getExecutionMode(capability),
    risk: getRisk(capability.id),
    surface: nativeCapabilityIds.has(capability.id) ? "native" : "secure_handoff",
  })
)

export function getAssistantCapabilityDefinition(id: string) {
  return ASSISTANT_CAPABILITY_REGISTRY.find((capability) => capability.id === id) ?? null
}

export function getAssistantCapabilityClientCatalog() {
  return ASSISTANT_CAPABILITY_REGISTRY.map((capability) => ({
    description: capability.description,
    executionMode: capability.executionMode,
    group: capability.group,
    id: capability.id,
    presentation: capability.presentation,
    requiredContext: [...capability.requiredContext] as AssistantContextKind[],
    risk: capability.risk,
    surface: capability.surface,
    title: capability.title,
  }))
}

function getExecutionMode(capability: AssistantCapability): AssistantCapabilityExecutionMode {
  if (costedCapabilityIds.has(capability.id as AssistantCapabilityId)) return "background"
  if (capability.mode === "read") return "read"
  if (capability.mode === "navigate") return "navigate"
  return "write"
}

function getRisk(id: string): AssistantCapabilityRisk {
  const capabilityId = id as AssistantCapabilityId
  if (destructiveCapabilityIds.has(capabilityId)) return "destructive"
  if (costedCapabilityIds.has(capabilityId)) return "costed"
  const capability = ASSISTANT_CAPABILITIES.find((item) => item.id === id)
  return capability?.mode === "propose_write" ? "standard" : "none"
}
