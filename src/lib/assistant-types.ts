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
  | { type: "proposal"; proposal: AssistantActionProposal }
  | { type: "complete"; messageId: string }
  | { type: "error"; code: string; message: string }
