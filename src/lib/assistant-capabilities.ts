import type {
  AssistantCapability,
  AssistantCapabilityGroup,
  AssistantContextKind,
  AssistantRouteContext,
} from "@/lib/assistant-types"

export const ASSISTANT_CAPABILITIES = [
  capability("workspace.search", "Search workspace", "Find accounts, opportunities, contacts, calls, and playbooks.", "workspace", "read", "list", ["workspace"], ["search", "find"]),
  capability("workspace.switch", "Switch workspace", "Move to another workspace without losing the current conversation.", "workspace", "navigate", "list", ["workspace"], ["switch", "organisation"]),
  capability("workspace.create", "Create workspace", "Set up another SalesFrame workspace.", "workspace", "propose_write", "form", ["workspace"], ["new", "organisation"]),
  capability("workspace.edit", "Edit workspace", "Update workspace details and identity.", "workspace", "propose_write", "form", ["workspace"], ["rename", "logo"]),
  capability("workspace.duplicate", "Duplicate workspace", "Create a reviewed copy of this workspace.", "workspace", "propose_write", "form", ["workspace"], ["copy"]),
  capability("workspace.import", "Import workspace data", "Review and import records from CSV.", "workspace", "propose_write", "form", ["workspace"], ["csv", "upload"]),
  capability("workspace.import_accounts", "Import accounts", "Review and import account records from CSV.", "workspace", "propose_write", "form", ["workspace"], ["csv", "companies"]),
  capability("workspace.import_opportunities", "Import opportunities", "Review and import opportunity records from CSV.", "workspace", "propose_write", "form", ["workspace"], ["csv", "deals"]),
  capability("workspace.onboarding", "Workspace setup", "Continue workspace onboarding and initial configuration.", "workspace", "navigate", "form", ["workspace"], ["setup", "getting started"]),
  capability("workspace.delete", "Delete workspace", "Permanently delete a workspace after explicit confirmation.", "workspace", "propose_write", "form", ["workspace"], ["remove", "destructive"]),

  capability("accounts.list", "Browse accounts", "See and filter all accounts in this workspace.", "accounts", "read", "list", ["workspace"], ["companies", "customers"]),
  capability("accounts.open", "Open account", "Open an account record and its related work.", "accounts", "navigate", "record", ["account"], ["view"]),
  capability("accounts.create", "Add account", "Create an account with reviewed details.", "accounts", "propose_write", "form", ["workspace"], ["new", "company"]),
  capability("accounts.edit", "Edit account", "Update the current account record.", "accounts", "propose_write", "form", ["account"], ["change", "details"]),
  capability("accounts.enrich", "Enrich account", "Research public company context in the background.", "accounts", "propose_write", "record", ["account"], ["research", "ai"]),
  capability("accounts.archive", "Archive account", "Remove an account from active work while preserving history.", "accounts", "propose_write", "form", ["account"], ["remove"]),
  capability("accounts.restore", "Restore account", "Return an archived account to active work.", "accounts", "propose_write", "form", ["account"], ["unarchive"]),
  capability("accounts.delete", "Delete account", "Permanently delete an account after explicit confirmation.", "accounts", "propose_write", "form", ["account"], ["remove", "destructive"]),

  capability("contacts.list", "Browse contacts", "See the account contact directory.", "contacts", "read", "list", ["account"], ["people", "stakeholders"]),
  capability("contacts.open", "Open contact", "Review a contact profile, relationships, and professional insights.", "contacts", "navigate", "record", ["account"], ["person", "profile"]),
  capability("contacts.create", "Add contact", "Add a person to the current account.", "contacts", "propose_write", "form", ["account"], ["new", "person"]),
  capability("contacts.edit", "Edit contact", "Update professional and seller-maintained contact details.", "contacts", "propose_write", "form", ["account"], ["change", "profile"]),
  capability("contacts.enrich", "Enrich contact", "Research public professional context in the background.", "contacts", "propose_write", "record", ["account"], ["research", "ai"]),
  capability("contacts.relationships", "Manage buying roles", "Link contacts to an opportunity and manage buying roles.", "contacts", "propose_write", "form", ["opportunity"], ["champion", "buyer", "stakeholder"]),
  capability("contacts.archive", "Archive contact", "Hide a contact from new selection while preserving history.", "contacts", "propose_write", "form", ["account"], ["remove"]),
  capability("contacts.restore", "Restore contact", "Return an archived contact to active selection.", "contacts", "propose_write", "form", ["account"], ["unarchive"]),

  capability("opportunities.list", "Browse opportunities", "See and filter opportunities across the workspace.", "opportunities", "read", "list", ["workspace"], ["deals", "pipeline"]),
  capability("opportunities.open", "Open opportunity", "Open the current opportunity record.", "opportunities", "navigate", "record", ["opportunity"], ["deal", "view"]),
  capability("opportunities.create", "Add opportunity", "Create an opportunity for the current account.", "opportunities", "propose_write", "form", ["account"], ["new", "deal"]),
  capability("opportunities.edit", "Edit opportunity", "Update stage, value, timing, and next steps.", "opportunities", "propose_write", "form", ["opportunity"], ["change", "next step"]),
  capability("opportunities.next_call", "Prepare next call", "Review calm, evidence-linked preparation for the next conversation.", "opportunities", "read", "evidence", ["opportunity"], ["brief", "prepare"]),
  capability("opportunities.methodology", "Review methodology", "Inspect methodology fields, evidence, gaps, and exit criteria.", "opportunities", "read", "evidence", ["opportunity"], ["meddicc", "coverage", "evidence"]),
  capability("opportunities.contacts", "Review opportunity contacts", "Review stakeholders and deal-specific buying roles.", "opportunities", "read", "list", ["opportunity"], ["people", "roles"]),
  capability("opportunities.history", "Review opportunity history", "See calls and activity for the opportunity.", "opportunities", "read", "list", ["opportunity"], ["timeline", "activity"]),
  capability("opportunities.archive", "Archive opportunity", "Remove an opportunity from active work while preserving history.", "opportunities", "propose_write", "form", ["opportunity"], ["remove", "deal"]),
  capability("opportunities.restore", "Restore opportunity", "Return an archived opportunity to active work.", "opportunities", "propose_write", "form", ["opportunity"], ["unarchive"]),
  capability("opportunities.delete", "Delete opportunity", "Permanently delete an opportunity after explicit confirmation.", "opportunities", "propose_write", "form", ["opportunity"], ["remove", "destructive"]),

  capability("calls.list", "Browse calls", "See live, processing, and completed calls.", "calls", "read", "list", ["workspace"], ["meetings", "history"]),
  capability("calls.start", "Start call", "Start one-channel, two-channel, or Meeting bot capture.", "calls", "propose_write", "live_call", ["workspace"], ["record", "meeting bot", "audio"]),
  capability("calls.open", "Open call", "Open a call cockpit or completed call review.", "calls", "navigate", "record", ["call"], ["review", "cockpit"]),
  capability("calls.transcript", "Open transcript", "Search and inspect timestamped call transcript evidence.", "calls", "read", "evidence", ["call"], ["speaker", "quote"]),
  capability("calls.notes", "Edit call notes", "Review or update seller-owned notes.", "calls", "propose_write", "form", ["call"], ["summary", "notes"]),
  capability("calls.recording", "Play recording", "Open the private call recording and playback controls.", "calls", "navigate", "record", ["call"], ["audio", "replay"]),
  capability("calls.speakers", "Map speakers", "Review and confirm transcript speaker identities.", "calls", "propose_write", "form", ["call"], ["participants", "attribution"]),
  capability("calls.outputs", "Review call outputs", "Review post-call summary, evidence, and follow-up work.", "calls", "read", "evidence", ["call"], ["summary", "post call"]),
  capability("calls.retry_outputs", "Retry post-call processing", "Retry incomplete post-call outputs without duplicating completed work.", "calls", "propose_write", "record", ["call"], ["retry", "processing"]),
  capability("calls.feedback", "Give coaching feedback", "Tell SalesFrame whether the current live guidance was useful.", "calls", "propose_write", "live_call", ["call"], ["helpful", "skip", "feedback"]),
  capability("calls.manual_question", "Request another question", "Ask the live coach to recommend another natural move.", "calls", "propose_write", "live_call", ["call"], ["manual", "next question"]),
  capability("calls.delete", "Delete call", "Permanently delete a call after explicit confirmation.", "calls", "propose_write", "form", ["call"], ["remove", "destructive"]),

  capability("playbooks.list", "Browse playbooks", "Review system and custom sales methodologies.", "playbooks", "read", "list", ["workspace"], ["methodologies", "frameworks"]),
  capability("playbooks.open", "Open playbook", "Inspect a playbook's fields and guidance.", "playbooks", "navigate", "record", ["workspace"], ["methodology", "framework"]),
  capability("playbooks.create", "Create playbook", "Create a custom methodology for this workspace.", "playbooks", "propose_write", "form", ["workspace"], ["custom", "new"]),
  capability("playbooks.edit", "Edit playbook", "Update a custom playbook's fields and exit criteria.", "playbooks", "propose_write", "form", ["workspace"], ["custom", "change"]),
  capability("playbooks.assign", "Assign playbooks", "Choose methodologies for an opportunity or call.", "playbooks", "propose_write", "form", ["opportunity"], ["methodology", "select"]),

  capability("settings.open", "Open settings", "Review workspace, AI, capture, and retention settings.", "settings", "navigate", "record", ["workspace"], ["preferences"]),
  capability("settings.ai", "AI settings", "Manage the workspace OpenAI connection.", "settings", "propose_write", "form", ["workspace"], ["openai", "model", "key"]),
  capability("settings.capture", "Capture settings", "Manage browser-tab and call-capture preferences.", "settings", "propose_write", "form", ["workspace"], ["audio", "microphone"]),
  capability("settings.retention", "Retention settings", "Review data and recording retention controls.", "settings", "propose_write", "form", ["workspace"], ["privacy", "delete"]),
  capability("settings.session", "Session settings", "Manage idle sign-out and workspace session policy.", "settings", "propose_write", "form", ["workspace"], ["logout", "timeout"]),
  capability("settings.theme", "Appearance", "Switch between light, dark, and system appearance.", "settings", "propose_write", "form", ["workspace"], ["dark mode", "theme", "light"]),
  capability("settings.profile", "Profile", "Review and update your personal profile.", "settings", "propose_write", "form", ["workspace"], ["user", "avatar", "name"]),
  capability("settings.billing", "Billing", "Open billing and subscription settings.", "settings", "navigate", "record", ["workspace"], ["plan", "subscription"]),
  capability("settings.support", "Get support", "Open SalesFrame support and privacy resources.", "settings", "navigate", "record", ["workspace"], ["help", "contact"]),
  capability("settings.roadmap", "Product roadmap", "Open SalesFrame's product roadmap and updates.", "settings", "navigate", "record", ["workspace"], ["features", "coming soon"]),
  capability("settings.logout", "Sign out", "Safely end this SalesFrame session.", "settings", "propose_write", "form", ["workspace"], ["log out", "session"]),
] as const satisfies readonly AssistantCapability[]

export type AssistantCapabilityId = (typeof ASSISTANT_CAPABILITIES)[number]["id"]

function capability<const CapabilityId extends string>(
  id: CapabilityId,
  title: string,
  description: string,
  group: AssistantCapabilityGroup,
  mode: AssistantCapability["mode"],
  presentation: AssistantCapability["presentation"],
  requiredContext: AssistantContextKind[],
  keywords: string[]
): AssistantCapability & { id: CapabilityId } {
  return { id, title, description, group, mode, presentation, requiredContext, keywords }
}

export function getAssistantCapability(id: string) {
  return ASSISTANT_CAPABILITIES.find((item) => item.id === id) ?? null
}

export function hasAssistantCapabilityContext(
  capabilityItem: AssistantCapability,
  context: AssistantRouteContext
) {
  return capabilityItem.requiredContext.every((requiredContext) => {
    if (requiredContext === "workspace") return Boolean(context.workspaceId)
    if (requiredContext === "account") return Boolean(context.accountId)
    if (requiredContext === "opportunity") return Boolean(context.opportunityId)
    return Boolean(context.callId)
  })
}

export function filterAssistantCapabilities(
  query: string,
  context: AssistantRouteContext,
  capabilities: readonly AssistantCapability[] = ASSISTANT_CAPABILITIES
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return capabilities.filter((item) => {
    if (!hasAssistantCapabilityContext(item, context)) return false
    if (!normalizedQuery) return true

    return [item.title, item.description, item.group, ...item.keywords]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  })
}

export function getContextualAssistantCapabilities(
  preferredIds: readonly string[],
  context: AssistantRouteContext,
  limit = 4,
  capabilities: readonly AssistantCapability[] = ASSISTANT_CAPABILITIES
) {
  const safeLimit = Math.max(0, Math.min(4, limit))
  const preferredOrder = new Map(preferredIds.map((id, index) => [id, index]))

  return capabilities
    .filter((item) => preferredOrder.has(item.id) && hasAssistantCapabilityContext(item, context))
    .sort((left, right) => (preferredOrder.get(left.id) ?? 0) - (preferredOrder.get(right.id) ?? 0))
    .slice(0, safeLimit)
}
