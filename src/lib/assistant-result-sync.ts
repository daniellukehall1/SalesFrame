import type { AssistantArtifact } from "@/lib/assistant-types"

export type AssistantCreatedOpportunity = {
  accountId: string
  id: string
  name: string
  stage: string
}

/**
 * Returns the small, authoritative identity payload needed to make a newly
 * confirmed opportunity immediately navigable while the wider workspace
 * refresh reconciles the complete record in the background.
 */
export function getAssistantCreatedOpportunity(
  artifact: AssistantArtifact | undefined
): AssistantCreatedOpportunity | null {
  if (
    !artifact ||
    artifact.kind !== "record" ||
    artifact.status !== "completed" ||
    artifact.title.trim().toLowerCase() !== "opportunity created"
  ) return null

  const record = artifact.records.find((item) => item.kind === "opportunity")
  const openAction = record?.actions.find((action) =>
    action.capabilityId === "opportunities.open" &&
    action.risk === "none" &&
    action.behavior === "secure_handoff"
  )
  const accountId = openAction?.target.accountId?.trim() ?? ""
  const opportunityId = openAction?.target.opportunityId?.trim() ?? ""
  const name = record?.label.trim() ?? ""

  if (!record || !accountId || !opportunityId || record.id !== opportunityId || !name) return null

  const stage = record.fields.find((field) => field.id === "stage")?.value.trim() || "Discovery"
  return { accountId, id: opportunityId, name, stage }
}
