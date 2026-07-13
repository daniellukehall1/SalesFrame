import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

const [workspace, artifactRenderer, shell, app] = await Promise.all([
  read("src/components/conversation-workspace.tsx"),
  read("src/components/assistant-artifact.tsx"),
  read("src/components/conversation-mode-shell.tsx"),
  read("src/App.tsx"),
])

test("conversation mode has one landmark, a bounded canvas, and no horizontal-scroll dependency", () => {
  assert.match(workspace, /<h1 className="sr-only">SalesFrame conversation mode<\/h1>/)
  assert.match(workspace, /<main[\s\S]*id="salesframe-conversation"[\s\S]*aria-label="SalesFrame conversation"/)
  assert.match(workspace, /data-interface-mode="conversation"/)
  assert.match(workspace, /grid h-full min-h-0 w-full min-w-0 overflow-hidden/)
  assert.match(workspace, /<ScrollArea className="min-h-0 flex-1"/)
  assert.match(app, /const WorkspaceContentElement = workspaceInterfaceMode === "conversation" \? "section" : "main"/)

  assert.match(workspace, /function DesktopCanvas[\s\S]*overflow-x-hidden overflow-y-auto/)
  assert.match(workspace, /function MobileCanvas[\s\S]*<SheetContent side="right"[\s\S]*w-full max-w-none[\s\S]*overflow-x-hidden overflow-y-auto/)
  assert.doesNotMatch(`${workspace}\n${artifactRenderer}`, /overflow-x-auto/)
  assert.doesNotMatch(`${workspace}\n${artifactRenderer}`, /whitespace-nowrap/)
})

test("desktop and mobile overlays use the appropriate calm shadcn surface and restore focus", () => {
  assert.match(workspace, /if \(isMobile\) \{[\s\S]*<Drawer open=\{open\}/)
  assert.match(workspace, /<Sheet open=\{open\}[\s\S]*side="left"/)
  assert.match(workspace, /<Dialog open=\{open\}[\s\S]*sm:max-w-2xl/)
  assert.match(workspace, /onCloseAutoFocus=\{\(event\) => \{[\s\S]*threadsTriggerRef\.current\?\.focus/)
  assert.match(workspace, /onCloseAutoFocus=\{\(event\) => \{[\s\S]*actionsTriggerRef\.current\?\.focus/)
  assert.match(workspace, /<DrawerTitle asChild><h2[\s\S]*Conversations/)
  assert.match(workspace, /<SheetTitle asChild><h2[\s\S]*Conversations/)
  assert.match(workspace, /<DialogTitle asChild><h2[\s\S]*All actions/)
  assert.match(workspace, /<DrawerDescription asChild>/)
  assert.match(workspace, /<DialogDescription asChild>/)
})

test("message announcements avoid replaying the whole transcript to screen readers", () => {
  assert.match(workspace, /aria-label="Conversation messages"[\s\S]*aria-live="off"[\s\S]*role="log"/)
  assert.match(workspace, /<span className="sr-only">\{fromSeller \? "You said:" : "SalesFrame replied:"\}<\/span>/)
  assert.match(workspace, /SalesFrame is thinking…/)
  assert.match(workspace, /className="sr-only" role="status" aria-live="polite" aria-atomic="true"/)
  assert.match(workspace, /SalesFrame replied: \{completionAnnouncement\.text\}/)
  assert.match(workspace, /announcedCompletionIdRef\.current === completedMessageId/)
  assert.match(workspace, /message\.artifacts\?\.map[\s\S]*<AssistantArtifactPreview/)
})

test("composer, search, thread, and artifact controls meet mobile touch and focus expectations", () => {
  assert.match(workspace, /aria-label="Message SalesFrame"/)
  assert.match(workspace, /aria-describedby=\{statusId\}/)
  assert.match(workspace, /className="max-h-32 min-h-11 min-w-0 flex-1/)
  assert.match(workspace, /className="h-11 min-h-11 shrink-0 px-3"/)
  assert.match(workspace, /aria-label="Send message"/)
  assert.match(workspace, /aria-label=\{voiceActive \? "Stop voice input"/)
  assert.match(workspace, /className="flex min-h-12 min-w-0 flex-1[\s\S]*aria-current=/)
  assert.match(workspace, /<SearchIcon[\s\S]*aria-hidden="true"[\s\S]*className="!pl-10"/)

  assert.match(artifactRenderer, /className="flex min-h-11 min-w-0 flex-1/)
  assert.match(artifactRenderer, /className="min-h-11 max-w-full"/)
  assert.match(artifactRenderer, /className="min-h-11 w-full sm:w-auto"/)
  assert.match(artifactRenderer, /focus-visible:ring-3 focus-visible:ring-ring\/50/)
})

test("the composer respects mobile safe areas and returns focus after stopping a response", () => {
  assert.match(workspace, /pb-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/)
  assert.match(workspace, /restoreComposerFocusRef\.current = true[\s\S]*onStopResponse\(\)/)
  assert.match(workspace, /composerInputRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(workspace, /role="status" aria-live="polite"[\s\S]*SalesFrame will ask before it changes anything/)
  assert.match(workspace, /event\.nativeEvent\.isComposing/)
})

test("proposal confirmation is explicit, expiring, and visually distinguishes destructive work", () => {
  assert.match(workspace, /Review change/)
  assert.match(workspace, /Nothing will change until you confirm\./)
  assert.match(workspace, /This cannot be undone\. Review the details before confirming\./)
  assert.match(workspace, /This change expired\. Ask SalesFrame to prepare it again\./)
  assert.match(workspace, /variant=\{proposal\.risk === "destructive" \? "destructive" : "default"\}/)
  assert.match(workspace, /disabled=\{isConfirming \|\| isExpired \|\| !onConfirm\}/)
  assert.match(workspace, /\{isConfirming \? "Confirming…" : "Confirm"\}/)
  assert.match(workspace, /onClick=\{\(\) => onCancel\?\.\(proposal\.id\)\}/)
  assert.match(workspace, /proposal\.errorMessage[\s\S]*role="alert"/)
  assert.match(workspace, /whitespace-pre-wrap break-words[\s\S]*\[overflow-wrap:anywhere\]/)
})

test("artifact rendering is plain-text, bounded, responsive, and reduced-motion aware", () => {
  assert.match(artifactRenderer, /artifact\.records\.slice\(0, 3\)/)
  assert.match(artifactRenderer, /artifact\.fields\.slice\(0, 4\)/)
  assert.match(artifactRenderer, /actions\.slice\(0, 4\)/)
  assert.match(artifactRenderer, /grid-cols-1[\s\S]*sm:grid-cols-2/)
  assert.match(artifactRenderer, /break-words/)
  assert.match(artifactRenderer, /min-w-0/)
  assert.match(artifactRenderer, /motion-reduce:transition-none/)
  assert.match(artifactRenderer, /role="status" aria-live="polite"/)
  assert.match(artifactRenderer, /aria-label=\{`Actions for \$\{artifact\.title\}`\}/)
  assert.doesNotMatch(artifactRenderer, /dangerouslySetInnerHTML/)
  assert.doesNotMatch(artifactRenderer, /target="_blank"|window\.open\(/)
})

test("artifact history survives refresh and Back/Forward without putting private prose in URLs", () => {
  assert.match(shell, /readAssistantQueryId\("artifact"\)/)
  assert.match(shell, /\^\[a-zA-Z0-9\]\[a-zA-Z0-9\._:-\]\{0,179\}\$/)
  assert.match(shell, /window\.addEventListener\("popstate", handlePopState\)/)
  assert.match(shell, /return \(\) => window\.removeEventListener\("popstate", handlePopState\)/)
  assert.match(shell, /embeddedArtifact[\s\S]*openArtifact\(embeddedArtifact, \{ updateHistory: false \}\)/)
  assert.match(shell, /client\.getArtifact\(artifactId\)/)
  assert.match(shell, /window\.history\.pushState\(state, "", nextPath\)/)
  assert.match(shell, /window\.history\.replaceState\(state, "", nextPath\)/)
  assert.match(shell, /const closeArtifact[\s\S]*replaceAssistantQuery\(\{ artifact: null \}\)/)
  assert.doesNotMatch(shell, /searchParams\.set\([^,]+,\s*(?:artifact\.title|artifact\.summary|action\.prompt)/)
})

test("artifact interactions carry exact IDs and never bypass the proposal confirmation path", () => {
  const interaction = shell.slice(
    shell.indexOf("const handleArtifactAction"),
    shell.indexOf("const stopResponse")
  )
  assert.match(interaction, /action\.disabled \|\| isArtifactWorking/)
  assert.match(interaction, /action\.behavior === "submit_prompt"[\s\S]*submitTurn\(action\.prompt\)/)
  assert.match(interaction, /client\.prepareArtifactAction\(artifact\.id, action\.id\)/)
  assert.match(interaction, /action\.behavior === "secure_handoff"[\s\S]*onInvokeCapability\(prepared\.capability\.id, prepared\.capability\.target\)/)
  assert.match(interaction, /action\.behavior === "open_form"[\s\S]*onInvokeCapability\(prepared\.capability\.id, prepared\.capability\.target\)/)
  assert.doesNotMatch(interaction, /onInvokeCapability\(action\.capabilityId, action\.target\)/)
  assert.match(interaction, /if \(prepared\.proposal\)[\s\S]*setProposals/)
  assert.doesNotMatch(interaction, /confirmProposal|onActionCompleted|execute/)
})
