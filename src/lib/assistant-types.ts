export type InterfaceMode = "workspace" | "conversation"

export type AssistantContextKind =
  | "workspace"
  | "account"
  | "opportunity"
  | "call"

export type AssistantCapabilityMode = "read" | "navigate" | "propose_write"

export type AssistantCapabilityPresentation =
  | "message"
  | "list"
  | "record"
  | "form"
  | "evidence"
  | "live_call"

export type AssistantCapabilityGroup =
  | "workspace"
  | "accounts"
  | "contacts"
  | "opportunities"
  | "calls"
  | "playbooks"
  | "settings"

export type AssistantCapability = {
  id: string
  title: string
  description: string
  group: AssistantCapabilityGroup
  keywords: string[]
  mode: AssistantCapabilityMode
  presentation: AssistantCapabilityPresentation
  requiredContext: AssistantContextKind[]
}

export type AssistantRouteContext = {
  path: string
  workspaceId?: string
  accountId?: string
  opportunityId?: string
  contactId?: string
  callId?: string
}

export type AssistantThreadSummary = {
  id: string
  title: string
  updatedAtIso: string
  archived?: boolean
  archivedAtIso?: string | null
  createdAtIso?: string
}

export type AssistantWorkspacePreference = {
  interfaceMode: InterfaceMode
  activeThreadId: string | null
  lastStandardPath: string
}

export type AssistantThreadCollection = {
  threads: AssistantThreadSummary[]
  preference: AssistantWorkspacePreference | null
}

export type AssistantThreadMessages = {
  messages: AssistantMessage[]
  proposals: AssistantActionProposal[]
}

export type AssistantArtifactKind =
  | "collection"
  | "record"
  | "summary"
  | "relationship"
  | "evidence"
  | "form"
  | "workflow"
  | "task"

export type AssistantArtifactStatus =
  | "ready"
  | "loading"
  | "stale"
  | "queued"
  | "running"
  | "completed"
  | "failed"

export type AssistantArtifactActionBehavior =
  | "open_artifact"
  | "open_form"
  | "submit_prompt"
  | "prepare_action"
  | "secure_handoff"

export type AssistantActionTarget = {
  accountId?: string
  opportunityId?: string
  contactId?: string
  callId?: string
}

export type AssistantArtifactAction = {
  id: string
  capabilityId: string
  label: string
  behavior: AssistantArtifactActionBehavior
  risk: "none" | "standard" | "costed" | "destructive"
  target: AssistantActionTarget
  prompt?: string
  artifactId?: string
  disabled?: boolean
}

export type AssistantArtifactField = {
  id: string
  label: string
  value: string
  detail?: string
  tone?: "neutral" | "positive" | "attention" | "critical"
}

export type AssistantArtifactRecord = {
  id: string
  kind: "account" | "opportunity" | "contact" | "call" | "playbook" | "other"
  label: string
  description?: string
  fields: AssistantArtifactField[]
  actions: AssistantArtifactAction[]
}

export type AssistantArtifactSection = {
  id: string
  title?: string
  description?: string
  fields: AssistantArtifactField[]
  records: AssistantArtifactRecord[]
}

export type AssistantArtifactStep = {
  id: string
  label: string
  description?: string
  status?: "pending" | "active" | "completed" | "failed"
}

export type AssistantArtifactTask = {
  status: "queued" | "running" | "completed" | "failed"
  progress?: number
  detail?: string
}

export type AssistantArtifact = {
  id: string
  kind: AssistantArtifactKind
  schemaVersion: 1
  title: string
  description?: string
  status?: AssistantArtifactStatus
  summary?: string
  fields: AssistantArtifactField[]
  records: AssistantArtifactRecord[]
  sections: AssistantArtifactSection[]
  steps: AssistantArtifactStep[]
  task?: AssistantArtifactTask
  emptyState?: string
  cursor?: string
  actions: AssistantArtifactAction[]
}

export type AssistantResolvedContext = AssistantActionTarget & {
  artifactId?: string
  source: "explicit" | "selection" | "route" | "thread"
}

export type AssistantPreparedAction = {
  capability?: {
    id: string
    target: AssistantActionTarget
  }
  proposal?: AssistantActionProposal
  artifact?: AssistantArtifact
  reference?: AssistantMessageReference
}

export type AssistantMessageReference = {
  id: string
  kind:
    | "account"
    | "opportunity"
    | "contact"
    | "call"
    | "transcript"
    | "methodology"
    | "brief"
  label: string
  description?: string
  route?: string
}

export type AssistantMessage = {
  id: string
  role: "user" | "assistant" | "status"
  text: string
  createdAtIso: string
  references?: AssistantMessageReference[]
  artifacts?: AssistantArtifact[]
}

export type AssistantContextualAction = {
  id: string
  capabilityId: string
  label: string
  description?: string
  disabled?: boolean
  emphasis?: "primary" | "secondary" | "quiet"
}

export type AssistantBriefingFinding = {
  id: string
  title: string
  detail?: string
  capabilityId?: string
}

export type AssistantBriefing = {
  title: string
  description: string
  findings: AssistantBriefingFinding[]
  actions: AssistantContextualAction[]
}

export type AssistantActionProposal = {
  id: string
  capabilityId: string
  summary: string
  fields: Array<{ label: string; value: string }>
  risk: "standard" | "costed" | "destructive"
  expiresAt: string
  state?: "ready" | "confirming" | "failed"
  errorMessage?: string
}

export type AssistantVoiceState =
  | "idle"
  | "requesting"
  | "listening"
  | "transcribing"
  | "error"

export type AssistantVoiceInput = {
  state: AssistantVoiceState
  transcript?: string
  statusText?: string
  errorMessage?: string
  onStart: () => void | Promise<void>
  onStop: () => void | Promise<void>
  onDiscard?: () => void
}

export type AssistantTurnRequest = {
  threadId: string
  text: string
  clientRequestId: string
  routeContext: AssistantRouteContext
}

export type AssistantStreamEvent =
  | { type: "status"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "reference"; reference: AssistantMessageReference }
  | { type: "canvas"; capabilityId: string; title: string }
  | { type: "artifact"; artifact: AssistantArtifact }
  | { type: "task"; artifact: AssistantArtifact }
  | { type: "proposal"; proposal: AssistantActionProposal }
  | { type: "complete"; messageId: string }
  | { type: "error"; code: string; message: string }
