import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

async function loadConversationModeHelpers() {
  const source = await read("src/lib/conversation-mode.ts")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

test("the standard workspace remains the default and is reused as the conversation canvas", async () => {
  const app = await read("src/App.tsx")
  const sidebar = await read("src/components/app-sidebar.tsx")

  assert.match(app, /useState<WorkspaceInterfaceMode>\("workspace"\)/)
  assert.match(app, /function normalizeWorkspaceInterfaceMode\([\s\S]*value === "conversation" \|\| value === "workspace"/)
  assert.match(app, /normalizeWorkspaceInterfaceMode\(preference\?\.interfaceMode, cachedMode\)/)
  assert.match(app, /workspaceInterfaceModeChangeRef\.current !== modeChangeVersion/)
  assert.match(app, /workspaceInterfaceModeChangeRef\.current \+= 1/)
  assert.match(app, /workspaceInterfaceModeSaveQueueRef\.current = workspaceInterfaceModeSaveQueueRef\.current/)
  assert.match(app, /\.then\(async \(\) => \{[\s\S]*saveAssistantWorkspacePreference\(workspaceId/)
  assert.match(app, /workspaceInterfaceMode === "workspace" \? \(\s*<AppSidebar/)
  assert.match(app, /workspaceInterfaceMode === "workspace" \|\| conversationCanvasOpen \? \(/)
  assert.match(app, /<ConversationModeShell/)
  assert.match(app, /onSwitchToWorkspaceView=\{\(\) => handleWorkspaceInterfaceModeChange\("workspace"\)\}/)
  assert.match(app, /Sign out of SalesFrame\?/)
  assert.match(app, /reference\.route\?\.startsWith\("\/calls\/"\)/)
  assert.match(app, /const conversationHasOpportunityContext = workspaceViews\.includes\(activeView\)/)
  assert.match(app, /accountId: conversationHasAccountContext \? activeAccount\.id \|\| undefined : undefined/)
  assert.match(app, /opportunityId: conversationHasOpportunityContext \? activeOpportunity\.id \|\| undefined : undefined/)
  assert.match(app, /if \(!capability\) return/)
  assert.match(app, /const missingAccount = capability\.requiredContext\.includes\("account"\) && !conversationRouteContext\.accountId/)
  assert.match(app, /if \(missingCall\) \{[\s\S]*openView\("calls"\)/)
  assert.match(app, /if \(missingOpportunity\) \{[\s\S]*openView\("opportunities"\)/)
  assert.match(sidebar, />Conversation mode</)
})

test("conversation preparation stays calm, bounded, and explicit about live-call precedence", async () => {
  const { buildConversationBriefing } = await loadConversationModeHelpers()
  const briefing = buildConversationBriefing({
    activeAccount: { id: "account-1", name: "Acme" },
    activeCall: null,
    activeOpportunity: {
      id: "opportunity-1",
      missing: 2,
      name: "Expansion",
      stage: "Discovery",
      weak: 1,
    },
    accountCount: 4,
    nextStep: "Agree a technical validation date",
    opportunityCount: 7,
  })

  assert.equal(briefing.title, "What would you like to move forward?")
  assert.ok(briefing.findings.length <= 3)
  assert.ok(briefing.actions.length <= 4)
  assert.match(briefing.findings.map((finding) => finding.detail).join(" "), /live coaching will follow what the buyer actually says/i)
  assert.equal(briefing.actions[0].capabilityId, "calls.start")
})

test("contextual actions are limited to four and follow the current record", async () => {
  const { buildConversationContextualActions } = await loadConversationModeHelpers()
  const opportunityActions = buildConversationContextualActions("opportunity-record", {
    path: "/opportunities/opportunity-1",
    workspaceId: "workspace-1",
    accountId: "account-1",
    opportunityId: "opportunity-1",
  })

  assert.deepEqual(
    opportunityActions.map((action) => action.capabilityId),
    ["calls.start", "opportunities.next_call", "opportunities.methodology", "opportunities.contacts"]
  )
  assert.ok(opportunityActions.length <= 4)
})

test("voice input requests permission only when invoked, has a hard stop, and resets between workspaces", async () => {
  const hook = await read("src/hooks/use-assistant-voice-input.ts")

  assert.match(hook, /const maximumVoiceCommandMs = 30_000/)
  assert.match(hook, /const start = React\.useCallback\(async \(\) => \{/)
  assert.match(hook, /navigator\.mediaDevices\.getUserMedia/)
  assert.match(hook, /tokenProvider: \(\) => createAssistantVoiceToken\(workspaceId\)/)
  assert.match(hook, /stopTimerRef\.current = window\.setTimeout/)
  assert.match(hook, /onTranscriptError: \(\) => \{[\s\S]*operationIdRef\.current \+= 1[\s\S]*setState\("error"\)/)
  assert.match(hook, /React\.useEffect\(\(\) => \{[\s\S]*operationIdRef\.current \+= 1[\s\S]*releaseCapture\(\)[\s\S]*setTranscript\(""\)[\s\S]*setErrorMessage\(""\)[\s\S]*setState\("idle"\)[\s\S]*\}, \[releaseCapture, workspaceId\]\)/)
  assert.doesNotMatch(hook.slice(0, hook.indexOf("const start =")), /getUserMedia/)
})
