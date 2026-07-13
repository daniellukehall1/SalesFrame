import type {
  AssistantBriefing,
  AssistantContextualAction,
  AssistantRouteContext,
} from "@/lib/assistant-types"

type ConversationBriefingInput = {
  activeAccount?: { id: string; name: string } | null
  activeCall?: { id: string; status: string; title: string } | null
  activeOpportunity?: {
    id: string
    missing: number
    name: string
    stage: string
    weak: number
  } | null
  accountCount: number
  nextStep?: string
  opportunityCount: number
}

export function buildConversationBriefing({
  activeAccount,
  activeCall,
  activeOpportunity,
  accountCount,
  nextStep,
  opportunityCount,
}: ConversationBriefingInput): AssistantBriefing {
  const findings: AssistantBriefing["findings"] = []
  const actions: AssistantBriefing["actions"] = []
  const callIsLive = Boolean(activeCall && ["live", "recording", "active"].includes(activeCall.status.toLowerCase()))

  if (callIsLive && activeCall) {
    findings.push({
      id: `live-call-${activeCall.id}`,
      title: `${activeCall.title} is live`,
      detail: "Open the focused cockpit to keep coaching in step with the conversation.",
      capabilityId: "calls.open",
    })
    actions.push(action("continue-call", "calls.open", "Continue call", "primary"))
  }

  if (activeOpportunity?.id) {
    const unresolvedMethodology = Math.max(0, activeOpportunity.missing + activeOpportunity.weak)
    findings.push({
      id: `opportunity-${activeOpportunity.id}`,
      title: activeOpportunity.name,
      detail: nextStep?.trim()
        ? `Next step: ${nextStep.trim()}`
        : `${activeOpportunity.stage || "Open"} opportunity with no saved next step yet.`,
      capabilityId: "opportunities.open",
    })

    if (unresolvedMethodology > 0) {
      findings.push({
        id: `methodology-${activeOpportunity.id}`,
        title: `${unresolvedMethodology} methodology ${unresolvedMethodology === 1 ? "area" : "areas"} still need evidence`,
        detail: "Use these as preparation themes; live coaching will follow what the buyer actually says.",
        capabilityId: "opportunities.methodology",
      })
    }

    if (!callIsLive) {
      actions.push(action("start-call", "calls.start", "Start a call", "primary"))
      actions.push(action("next-call", "opportunities.next_call", "Prepare next call"))
      actions.push(action("contacts", "opportunities.contacts", "Review contacts", "quiet"))
    }
  } else if (activeAccount?.id) {
    findings.push({
      id: `account-${activeAccount.id}`,
      title: activeAccount.name,
      detail: "This account is ready for its next opportunity or contact update.",
      capabilityId: "accounts.open",
    })
    actions.push(action("add-opportunity", "opportunities.create", "Add opportunity", "primary"))
    actions.push(action("contacts", "contacts.list", "Review contacts"))
  } else {
    findings.push({
      id: "workspace-shape",
      title: `${accountCount} ${accountCount === 1 ? "account" : "accounts"} · ${opportunityCount} ${opportunityCount === 1 ? "opportunity" : "opportunities"}`,
      detail: accountCount > 0
        ? "Ask SalesFrame to find a record or show what needs attention."
        : "Add the first account to start building live, evidence-led coaching context.",
      capabilityId: accountCount > 0 ? "accounts.list" : "accounts.create",
    })
    actions.push(
      action(
        accountCount > 0 ? "browse-opportunities" : "add-account",
        accountCount > 0 ? "opportunities.list" : "accounts.create",
        accountCount > 0 ? "Browse opportunities" : "Add account",
        "primary"
      )
    )
  }

  return {
    title: callIsLive ? "Stay with the conversation." : "What would you like to move forward?",
    description: callIsLive
      ? "SalesFrame keeps the live call focused while the rest of the workspace stays one request away."
      : "Ask in plain language, or choose a useful place to begin. SalesFrame will always show you a change before making it.",
    findings: findings.slice(0, 3),
    actions: actions.slice(0, 4),
  }
}

export function buildConversationContextualActions(
  activeView: string,
  context: AssistantRouteContext
): AssistantContextualAction[] {
  if (context.callId && activeView === "workspace") {
    return [
      action("open-call", "calls.open", "Focused cockpit", "primary"),
      action("map-speakers", "calls.speakers", "Map speakers"),
      action("call-notes", "calls.notes", "Call notes"),
    ]
  }

  if (context.opportunityId) {
    return [
      action("start-call", "calls.start", "Start a call", "primary"),
      action("next-call", "opportunities.next_call", "Next call"),
      action("methodology", "opportunities.methodology", "Methodology"),
      action("opportunity-contacts", "opportunities.contacts", "Contacts"),
    ]
  }

  if (context.accountId) {
    return [
      action("add-opportunity", "opportunities.create", "Add opportunity", "primary"),
      action("account-contacts", "contacts.list", "Contacts"),
      action("edit-account", "accounts.edit", "Edit account"),
      action("enrich-account", "accounts.enrich", "Enrich account", "quiet"),
    ]
  }

  return [
    action("start-call", "calls.start", "Start a call", "primary"),
    action("opportunities", "opportunities.list", "Opportunities"),
    action("accounts", "accounts.list", "Accounts"),
    action("playbooks", "playbooks.list", "Playbooks", "quiet"),
  ]
}

function action(
  id: string,
  capabilityId: string,
  label: string,
  emphasis: AssistantContextualAction["emphasis"] = "secondary"
): AssistantContextualAction {
  return { id, capabilityId, label, emphasis }
}
