import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("workspace navigation exposes one main landmark and keyboard-operable destinations", async () => {
  const app = await read("src/App.tsx")
  const appSidebar = await read("src/components/app-sidebar.tsx")
  const sidebar = await read("src/components/ui/sidebar.tsx")
  const breadcrumb = await read("src/components/ui/breadcrumb.tsx")
  const progress = await read("src/components/ui/progress.tsx")

  assert.match(sidebar, /function SidebarInset\([\s\S]*React\.ComponentProps<"div">[\s\S]*<div[\s\S]*data-slot="sidebar-inset"/)
  assert.match(sidebar, /function SidebarMenuSubButton[\s\S]*React\.ComponentProps<"button">[\s\S]*: "button"/)
  assert.doesNotMatch(sidebar, /\[&>button\]:hidden/)
  assert.match(sidebar, /showCloseButton[\s\S]*\[&_{1}\[data-sidebar=header\]\]:pr-14/)
  assert.match(appSidebar, /<nav aria-label="Workspace navigation" className="flex min-h-0 flex-1 flex-col">[\s\S]*<NavMain[\s\S]*<NavProjects[\s\S]*<\/nav>/)
  assert.match(breadcrumb, /React\.ComponentProps<"button">[\s\S]*: "button"/)
  assert.match(app, /<main[\s\S]*aria-label=\{viewLabels\[activeView\][\s\S]*tabIndex=\{-1\}/)
  assert.match(app, /appMainScrollRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(app, /<h1 className="truncate font-heading text-2xl[^"]*">\{accountDraft\.accountName\}<\/h1>/)
  assert.match(app, /<h1 className="font-heading text-2xl[^"]*">Settings<\/h1>/)
  assert.match(progress, /<ProgressPrimitive\.Root[\s\S]*value=\{value\}/)
})

test("workspace search retains results for keyboard focus and exposes combobox semantics", async () => {
  const app = await read("src/App.tsx")
  const search = app.slice(app.indexOf("function GlobalSearch("), app.indexOf("function CommandBar("))

  assert.match(search, /role="combobox"/)
  assert.match(search, /role="listbox"/)
  assert.match(search, /role="option"/)
  assert.match(search, /event\.relatedTarget[\s\S]*event\.currentTarget\.contains\(nextTarget\)/)
  assert.match(search, /event\.key === "ArrowDown"/)
  assert.match(search, /event\.key === "Escape"/)
  assert.match(search, /if \(mode === "mobile"\) \{[\s\S]*setMobileOpen\(false\)[\s\S]*setQuery\(""\)/)
  assert.match(search, /suppressDesktopFocusOpenRef\.current = true[\s\S]*desktopInputRef\.current\?\.focus\(\)[\s\S]*setFocused\(false\)/)
  assert.match(search, /if \(!suppressDesktopFocusOpenRef\.current\) setFocused\(true\)/)
  assert.doesNotMatch(search, /setTimeout\(\(\) => setFocused\(false\), 120\)/)
})

test("contacts remain restorable and editor errors are programmatically associated", async () => {
  const contacts = await read("src/components/contact-management.tsx")

  assert.match(contacts, /<SelectItem value="archived">Archived contacts<\/SelectItem>/)
  assert.match(contacts, /runContactAction\(contact, "restore"\)/)
  assert.match(contacts, /<Undo2Icon \/>Restore contact/)
  assert.match(contacts, /Archived contacts will appear here and can be restored later\./)
  assert.match(contacts, /id="contact-email-error"/)
  assert.match(contacts, /id="contact-linkedin-error"/)
  assert.match(contacts, /id="contact-duplicate-error"/)
  assert.match(contacts, /discardHeadingRef\.current\?\.focus\(\)/)
  assert.match(contacts, /Professional profile[\s\S]*target="_blank"/)
})

test("audio setup and live-call transports stop hanging or reconnecting after teardown", async () => {
  const app = await read("src/App.tsx")
  const capture = await read("src/hooks/use-call-capture.ts")
  const deepgram = await read("src/lib/deepgram-live-transcription.ts")

  assert.match(app, /const microphonePreviewPermissionTimeoutMs = 10_000/)
  assert.match(app, /Promise\.race\(\[[\s\S]*permissionRequest[\s\S]*microphonePreviewTimeoutCode/)
  assert.match(app, /Microphone access is still waiting\. Allow access in the browser/)
  assert.match(capture, /setStatus\(uploadFailed \? "upload-failed" : "stopped"\)[\s\S]*chunksRef\.current = \[\]/)
  assert.match(deepgram, /if \(closedByClient\) \{[\s\S]*audioBacklog = \[\][\s\S]*socket\.close\(1000, "call_stopped"\)/)
  assert.match(deepgram, /close: \(\) => \{[\s\S]*closedByClient = true[\s\S]*audioBacklog = \[\]/)
  assert.match(app, /liveCoachStateAbortControllerRef\.current\?\.abort\(\)/)
  assert.match(app, /requestLiveState\([\s\S]*\}, \{ signal: stateAbortController\.signal \}\)/)
  assert.match(app, /const meetingAudioRequestIdRef = React\.useRef\(0\)/)
  assert.match(app, /requestId !== meetingAudioRequestIdRef\.current \|\| !startCallOpenRef\.current[\s\S]*stopMediaStream\(stream\)/)
  assert.match(app, /clearMeetingAudioPreview\(\{ invalidateRequest: false \}\)/)
  assert.match(app, /handleOpenChange\(false\)[\s\S]*onOpenSettings\?\.\(\)/)
})

test("live question guidance never falls back to pre-call copy during an active call", async () => {
  const app = await read("src/App.tsx")
  const card = app.slice(app.indexOf("function NextQuestionCard("), app.indexOf("function LiveCoachDetailTabs("))

  assert.match(app, /<NextQuestionCard[\s\S]*isCallLive=\{isRecording\}/)
  assert.match(card, /const isLiveWithoutQuestion = isCallLive && !displayedQuestion/)
  assert.match(card, /const isLiveGuidanceRecovery = isLiveWithoutQuestion && coachStatus === "error"/)
  assert.match(card, /isLiveGuidanceRecovery[\s\S]*"Stay with the buyer"/)
  assert.match(card, /isLiveWithoutQuestion[\s\S]*"Listening for the next useful question"/)
  assert.match(card, /Keep listening and use your judgement\./)
})
