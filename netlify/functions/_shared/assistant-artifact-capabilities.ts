import {
  ASSISTANT_CAPABILITY_REGISTRY,
  type AssistantCapabilityRisk,
} from "../../../src/lib/assistant-capability-registry.ts"

import { AppError } from "./http.ts"

export type ServerAssistantArtifactTargetKey =
  | "workspace"
  | "accountId"
  | "opportunityId"
  | "contactId"
  | "callId"

export type ServerAssistantArtifactCapability = {
  behavior: "secure_handoff"
  description: string
  executionMode: "read" | "navigate" | "write" | "background"
  id: string
  requiredTarget: ServerAssistantArtifactTargetKey
  risk: AssistantCapabilityRisk
  title: string
}

// The shared catalog is the single advertised capability source. This server
// projection deliberately supports handoff actions only: it can open an exact
// existing SalesFrame surface, but it cannot mutate records or start billable
// work. Native writes remain in the separately confirmed proposal pipeline.
const serverAssistantArtifactCapabilities = new Map<string, ServerAssistantArtifactCapability>(
  ASSISTANT_CAPABILITY_REGISTRY.map((capability) => [
    capability.id,
    {
      behavior: "secure_handoff" as const,
      description: capability.description,
      executionMode: capability.executionMode,
      id: capability.id,
      requiredTarget: requiredTargetForCapability(capability.id),
      risk: capability.risk,
      title: capability.title,
    },
  ])
)

export function resolveServerAssistantArtifactCapability(value: string) {
  const capability = serverAssistantArtifactCapabilities.get(value)
  if (!capability) {
    throw new AppError(
      "assistant_artifact_capability_invalid",
      "That conversation action is not available.",
      409
    )
  }
  return capability
}

export function listServerAssistantArtifactCapabilities() {
  return [...serverAssistantArtifactCapabilities.values()]
}

function requiredTargetForCapability(id: string): ServerAssistantArtifactTargetKey {
  if (id === "accounts.list" || id === "accounts.create" || id === "accounts.restore") return "workspace"
  if (id.startsWith("accounts.")) return "accountId"

  if (id === "contacts.list" || id === "contacts.create") return "accountId"
  if (id === "contacts.relationships") return "opportunityId"
  if (id === "contacts.restore") return "workspace"
  if (id.startsWith("contacts.")) return "contactId"

  if (id === "opportunities.list" || id === "opportunities.restore") return "workspace"
  if (id === "opportunities.create") return "accountId"
  if (id.startsWith("opportunities.")) return "opportunityId"

  if (id === "calls.list" || id === "calls.start") return "workspace"
  if (id.startsWith("calls.")) return "callId"

  if (id === "playbooks.assign") return "opportunityId"
  return "workspace"
}
