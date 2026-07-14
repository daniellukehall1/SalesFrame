import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

test("conversation mode is an injected shell rather than a second data layer", async () => {
  const component = await read("src/components/conversation-workspace.tsx")
  const types = await read("src/lib/assistant-types.ts")

  assert.match(component, /export type ConversationWorkspaceProps = \{/)
  assert.match(component, /data-interface-mode="conversation"/)
  assert.match(component, /<main\s+id="salesframe-conversation"/)
  assert.match(component, /onSubmit: \(text: string\) => void \| boolean \| Promise<void \| boolean>/)
  assert.match(component, /onInvokeCapability:/)
  assert.match(component, /onConfirmProposal\?:/)
  assert.match(component, /onSwitchToWorkspaceView: \(\) => void/)
  assert.doesNotMatch(component, /supabase/i)
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/)
  assert.match(types, /export type InterfaceMode = "workspace" \| "conversation"/)
})

test("the calm shell keeps deterministic briefing and contextual actions bounded", async () => {
  const component = await read("src/components/conversation-workspace.tsx")

  assert.match(component, /messages\.length === 0 && !isLoadingMessages/)
  assert.match(component, /briefing\.findings\.slice\(0, 3\)/)
  assert.match(component, /briefing\.actions\.slice\(0, 4\)/)
  assert.match(component, /const visibleContextualActions = contextualActions\.slice\(0, 4\)/)
  assert.match(component, /SalesFrame will ask before it changes anything\./)
  assert.match(component, /Everything in SalesFrame remains within reach\./)
})

test("conversation mode uses calm prose, references, and deliberate write previews", async () => {
  const component = await read("src/components/conversation-workspace.tsx")
  const proposal = component.slice(component.indexOf("function ProposalPreview"), component.indexOf("function ConversationComposer"))

  assert.match(component, /variant=\{fromSeller \? "secondary" : "ghost"\}/)
  assert.match(component, /onOpenReference\?\.\(reference\)/)
  assert.match(proposal, /Nothing will change until you confirm\./)
  assert.match(proposal, /This cannot be undone\. Review the details before confirming\./)
  assert.match(proposal, /onConfirm\?\.\(proposal\.id\)/)
  assert.match(proposal, /onCancel\?\.\(proposal\.id\)/)
  assert.doesNotMatch(proposal, /onConfirm\?\.\(proposal\.id\)[\s\S]*useEffect/)
})

test("threads and all actions remain available without an AI response", async () => {
  const component = await read("src/components/conversation-workspace.tsx")

  assert.match(component, /New conversation/)
  assert.match(component, /Search conversations/)
  assert.match(component, /placeholder="Search conversations"[^>]*className="!pl-10"/)
  assert.match(component, /Rename/)
  assert.match(component, /Archive/)
  assert.match(component, /Delete this conversation\?/)
  assert.match(component, /Search all actions/)
  assert.match(component, /placeholder="Search actions"[^>]*className="!pl-10"/)
  assert.match(component, /autoFocus=\{titleKind === "dialog"\}/)
  assert.match(component, /SalesFrame will help you choose the right record\./)
  assert.match(component, /onInvoke\(item\.id\)/)
  assert.match(component, /titleKind=\{isMobile \? "drawer" : "dialog"\}/)
  assert.doesNotMatch(component, /<DrawerHeader className="sr-only">/)
})

test("the capability registry provides discoverable parity fallbacks", async () => {
  const capabilities = await read("src/lib/assistant-capabilities.ts")

  for (const capabilityId of [
    "workspace.onboarding",
    "workspace.import_accounts",
    "workspace.import_opportunities",
    "accounts.delete",
    "contacts.restore",
    "opportunities.delete",
    "calls.feedback",
    "calls.manual_question",
    "calls.retry_outputs",
    "settings.profile",
    "settings.theme",
    "settings.roadmap",
    "settings.logout",
  ]) {
    assert.ok(capabilities.includes(`capability("${capabilityId}"`), `missing ${capabilityId}`)
  }

  assert.match(capabilities, /Math\.min\(4, limit\)/)
  assert.match(capabilities, /hasAssistantCapabilityContext/)
})

test("desktop and mobile receive purpose-built canvas and overlay presentations", async () => {
  const component = await read("src/components/conversation-workspace.tsx")

  assert.match(component, /grid-cols-\[minmax\(280px,320px\)_minmax\(0,1fr\)\]/)
  assert.match(component, /window\.matchMedia\("\(max-width: 1119px\)"\)/)
  assert.match(component, /data-testid="conversation-desktop-canvas"/)
  assert.match(component, /<Drawer open=\{open\} onOpenChange=\{onOpenChange\} showSwipeHandle>/)
  assert.match(component, /<SheetContent side="right" className="grid w-full max-w-none/)
  assert.match(component, /overflow-x-hidden overflow-y-auto overscroll-contain/)
  assert.match(component, /env\(safe-area-inset-bottom\)/)
  assert.doesNotMatch(component, /overflow-x-auto/)
})

test("controlled overlays restore focus to their header triggers", async () => {
  const component = await read("src/components/conversation-workspace.tsx")

  assert.match(component, /const threadsTriggerRef = React\.useRef<HTMLButtonElement \| null>\(null\)/)
  assert.match(component, /const actionsTriggerRef = React\.useRef<HTMLButtonElement \| null>\(null\)/)
  assert.match(component, /onCloseAutoFocus=\{\(event\) => \{[\s\S]*threadsTriggerRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(component, /onCloseAutoFocus=\{onCloseAutoFocus\}/)
  assert.match(component, /ref=\{threadsTriggerRef\}[\s\S]*aria-label="Open conversations"/)
  assert.match(component, /ref=\{actionsTriggerRef\}[\s\S]*aria-label="Open all actions"/)
})

test("push-to-talk is explicit, editable, and never submits itself", async () => {
  const component = await read("src/components/conversation-workspace.tsx")
  const composer = component.slice(component.indexOf("function ConversationComposer"), component.indexOf("function ThreadsOverlay"))

  assert.match(component, /voice\?\.state === "idle" \? voice\.transcript\?\.trim\(\) : ""/)
  assert.match(composer, /aria-label=\{voiceActive \? "Stop voice input" : voiceRequesting \? "Cancel voice input" : "Start voice input"\}/)
  assert.match(composer, /if \(voiceActive\) void voice\.onStop\(\)[\s\S]*else if \(voiceRequesting\) voice\.onDiscard\?\.\(\)/)
  assert.match(composer, /type="button"/)
  assert.match(composer, /aria-label="Message SalesFrame"/)
  assert.match(composer, /value=\{draft\}[\s\S]*readOnly=\{isBusy\}[\s\S]*aria-busy=\{isBusy\}/)
  assert.doesNotMatch(composer, /voice\.onStart\(\)[\s\S]*requestSubmit/)
  assert.match(composer, /event\.currentTarget\.form\?\.requestSubmit\(\)/)
})

test("composer drafts stay private to their workspace and conversation", async () => {
  const component = await read("src/components/conversation-workspace.tsx")

  assert.match(component, /const \[internalDrafts, setInternalDrafts\] = React\.useState<Record<string, string>>\(\{\}\)/)
  assert.match(component, /const draftContextKey = `\$\{routeContext\.workspaceId \?\? "workspace"\}:\$\{activeThreadId \|\| "opening"\}`/)
  assert.match(component, /const draft = draftText \?\? internalDrafts\[draftContextKey\] \?\? ""/)
  assert.match(component, /\{ \.\.\.current, \[draftContextKey\]: value \}/)
  assert.match(component, /previousDraftContextKeyRef\.current === draftContextKey/)
  assert.match(component, /voice\.onDiscard\?\.\(\)/)
})

test("completed answers are announced once without exposing streamed deltas to the live region", async () => {
  const component = await read("src/components/conversation-workspace.tsx")
  const messages = component.slice(component.indexOf("function ConversationMessages"), component.indexOf("function ContextualActions"))
  const composer = component.slice(component.indexOf("function ConversationComposer"), component.indexOf("function ThreadsOverlay"))

  assert.match(messages, /const announcedCompletionIdRef = React\.useRef\(""\)/)
  assert.match(messages, /if \(announcedCompletionIdRef\.current === completedMessageId\) return/)
  assert.match(messages, /message\.id === completedMessageId && message\.role === "assistant"/)
  assert.match(messages, /if \(!completedMessageId\) \{[\s\S]*setCompletionAnnouncement\(null\)/)
  assert.match(messages, /role="log"/)
  assert.match(messages, /aria-live="off"/)
  assert.match(messages, /role="status" aria-live="polite" aria-atomic="true"/)
  assert.match(messages, /SalesFrame replied: \{completionAnnouncement\.text\}/)
  assert.match(composer, /onStopResponse\?: \(\) => void/)
  assert.match(composer, /isResponding && onStopResponse/)
  assert.match(composer, /min-h-11[\s\S]*Stop response/)
  assert.match(composer, /restoreComposerFocusRef\.current = true[\s\S]*onStopResponse\(\)/)
  assert.match(composer, /composerInputRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
})

test("assistant streaming accepts only allowlisted event shapes", async () => {
  const client = await read("src/lib/assistant-client.ts")

  assert.match(client, /listThreads: async \(workspaceId: string/)
  assert.match(client, /createThread: async \(workspaceId: string, title\?: string, threadId\?: string\)/)
  assert.match(client, /getThread: async \(threadId: string\)/)
  assert.match(client, /updateThread: async/)
  assert.match(client, /archiveThread: async/)
  assert.match(client, /restoreThread: async/)
  assert.match(client, /deleteThread:/)
  assert.match(client, /normalizeThreadCollection/)
  assert.match(client, /normalizeThreadMessages/)
  assert.match(client, /proposal\.status === "pending"/)
  assert.match(client, /if \(!isAssistantStreamEvent\(event\)\) throw new Error/)
  assert.match(client, /assistantReferenceKinds\.has\(reference\.kind as AssistantMessageReference\["kind"\]\)/)
  assert.match(client, /case "text_delta"/)
  assert.match(client, /case "proposal"/)
  assert.match(client, /case "complete"/)
  assert.match(client, /case "error"/)
  assert.match(client, /encodeURIComponent\(proposalId\)/)
})

test("browse actions open native collections without inheriting the current record", async () => {
  const shell = await read("src/components/conversation-mode-shell.tsx")
  const app = await read("src/App.tsx")

  assert.match(shell, /"accounts\.list": "Show all active accounts across the workspace"/)
  assert.match(shell, /"opportunities\.list": "Show all active opportunities across the workspace"/)
  assert.match(shell, /"contacts\.list": "Show me contacts"/)
  assert.match(shell, /"calls\.list": "Show all calls across the workspace"/)
  assert.match(shell, /collectionPrompt && activeThreadIdRef\.current[\s\S]*void submitTurn\(collectionPrompt\)/)
  assert.match(shell, /onInvokeCapability=\{handleCapabilityInvocation\}/)

  const accountsListCase = app.slice(
    app.indexOf('case "accounts.list":'),
    app.indexOf('case "accounts.open":')
  )
  assert.match(accountsListCase, /openView\("home"\)/)
  assert.doesNotMatch(accountsListCase, /openAccountSurface/)
})

test("thread changes isolate stale messages, streams, and proposals", async () => {
  const shell = await read("src/components/conversation-mode-shell.tsx")

  assert.match(shell, /const messageRequestIdRef = React\.useRef\(0\)/)
  assert.match(shell, /loadThreads\(\)[\s\S]*requestGenerationRef\.current !== generation/)
  assert.match(shell, /activeThreadIdRef\.current !== threadId/)
  assert.match(shell, /activeTurnRef\.current !== controller/)
  assert.match(shell, /setMessages\(\[\]\)\s*\n\s*setProposals\(\[\]\)/)
  assert.match(shell, /activeThreadIdRef\.current === proposalThreadId/)
  assert.match(shell, /isComposerDisabled=\{isLoadingThreads \|\| isLoadingMessages \|\| !activeThreadId\}/)
})

test("conversation deletion removes immediately while the exact server deletion continues in the background", async () => {
  const shell = await read("src/components/conversation-mode-shell.tsx")
  const deletion = shell.slice(
    shell.indexOf("const deleteThread = React.useCallback"),
    shell.indexOf("const restoreArtifactFromLocation")
  )

  assert.match(deletion, /const deletedThread = threads\[deletedIndex\]/)
  assert.match(deletion, /setThreads\(remaining\)/)
  assert.match(deletion, /void deletion\.then/)
  assert.doesNotMatch(deletion, /await deletion/)
  assert.ok(deletion.indexOf("setThreads(remaining)") < deletion.indexOf("void deletion.then"))
  assert.match(deletion, /restoreThreadAtIndex\(items, deletedThread, deletedIndex\)/)
  assert.match(deletion, /It has been restored\./)
  assert.match(deletion, /needsReplacementThread[\s\S]*createThread\(\)/)
  assert.match(shell, /const replacementThreadAfterDeleteRef = React\.useRef\(""\)/)
  assert.match(deletion, /replacementThreadAfterDeleteRef\.current !== threadId/)
  assert.match(shell, /const createThread = React\.useCallback[\s\S]*replacementThreadAfterDeleteRef\.current = ""/)
})

test("new conversations open immediately while durable creation continues in order", async () => {
  const shell = await read("src/components/conversation-mode-shell.tsx")
  const creation = shell.slice(
    shell.indexOf("const createThread = React.useCallback"),
    shell.indexOf("const selectThread = React.useCallback")
  )

  assert.match(creation, /const optimisticThreadId = crypto\.randomUUID\(\)/)
  assert.match(creation, /activeThreadIdRef\.current = optimisticThreadId/)
  assert.match(creation, /setActiveThreadId\(optimisticThreadId\)/)
  assert.match(creation, /replaceAssistantQuery\(\{ thread: optimisticThreadId, artifact: null \}\)/)
  assert.match(creation, /client\.createThread\(workspaceId, undefined, optimisticThreadId\)/)
  assert.ok(creation.indexOf("setActiveThreadId(optimisticThreadId)") < creation.indexOf("client.createThread"))
  assert.match(creation, /pendingThreadCreationsRef\.current\.set\(optimisticThreadId, creation\)/)
  assert.match(shell, /const pendingCreation = pendingThreadCreationsRef\.current\.get\(threadId\)[\s\S]*await pendingCreation/)
  assert.match(creation, /SalesFrame couldn't start a new conversation yet\. Your previous conversation is unchanged\./)
})

test("failed requests preserve the draft and reconcile optimistic messages", async () => {
  const workspace = await read("src/components/conversation-workspace.tsx")
  const shell = await read("src/components/conversation-mode-shell.tsx")

  assert.match(workspace, /if \(submitted === false\) \{[\s\S]*setDraft\(text\)[\s\S]*return/)
  assert.match(workspace, /const submittedDraftContextKey = draftContextKeyRef\.current/)
  assert.match(workspace, /draftContextKeyRef\.current === submittedDraftContextKey/)
  assert.match(shell, /return false/)
  assert.match(shell, /client\.listMessages\(threadId\)/)
  assert.match(shell, /message\.id !== pendingUserMessageId && message\.id !== pendingMessageId/)
})

test("conversation selection, bootstrap, response stopping, and proposals remain race-safe", async () => {
  const shell = await read("src/components/conversation-mode-shell.tsx")
  const client = await read("src/lib/assistant-client.ts")
  const workspace = await read("src/components/conversation-workspace.tsx")

  assert.match(shell, /nextThreads\.length === 0[\s\S]*client\.ensureDefaultThread\(workspaceId\)/)
  assert.match(client, /ensureDefaultThread: async \(workspaceId: string\)/)
  assert.match(shell, /const preferenceSaveQueueRef = React\.useRef<Promise<void>>\(Promise\.resolve\(\)\)/)
  assert.match(shell, /const preferenceSaveVersionRef = React\.useRef\(0\)/)
  assert.match(shell, /preferenceSaveQueueRef\.current = preferenceSaveQueueRef\.current[\s\S]*saveAssistantWorkspacePreference\(workspaceId, \{ activeThreadId: threadId \}\)/)
  assert.match(shell, /const \[proposals, setProposals\] = React\.useState<AssistantActionProposal\[\]>\(\[\]\)/)
  assert.match(shell, /items\.filter\(\(item\) => item\.id !== event\.proposal\.id\)[\s\S]*event\.proposal/)
  assert.match(shell, /setProposals\(\(items\) => items\.filter\(\(item\) => item\.id !== proposalId\)\)/)
  assert.match(shell, /const userStoppedTurnsRef = React\.useRef\(new WeakSet<AbortController>\(\)\)/)
  assert.match(shell, /userStoppedTurnsRef\.current\.add\(controller\)[\s\S]*controller\.abort\(\)/)
  assert.match(shell, /setIsResponseStoppable\(true\)[\s\S]*handleStreamEvent\(event, pendingMessageId\)/)
  assert.match(shell, /onStopResponse=\{isResponseStoppable \? stopResponse : undefined\}/)
  assert.match(shell, /const messageMutationVersionRef = React\.useRef\(0\)/)
  assert.match(shell, /messageMutationVersionRef\.current !== reconciliationVersion/)
  assert.match(shell, /const proposalRevisionRef = React\.useRef\(0\)/)
  assert.match(shell, /proposalRevisionRef\.current === proposalRevision/)
  assert.match(shell, /const proposalMutationKeysRef = React\.useRef\(new Set<string>\(\)\)/)
  assert.match(shell, /!hasProposalMutationForThread\(proposalMutationKeysRef\.current, threadId\)/)
  assert.match(shell, /proposalMutationKeysRef\.current\.add\(proposalMutationKey\)[\s\S]*proposalMutationKeysRef\.current\.delete\(proposalMutationKey\)/)
  assert.match(shell, /setCompletedMessageId\(event\.messageId\)[\s\S]*setIsResponseStoppable\(false\)/)
  assert.match(workspace, /<ProposalPreview[\s\S]*key=\{proposal\.id\}/)
})
