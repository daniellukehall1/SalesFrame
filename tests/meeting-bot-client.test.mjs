import assert from "node:assert/strict"
import test from "node:test"

import {
  createMeetingBotPresenceController,
  createMeetingBotClientInstanceId,
  createMeetingBotClientRequestId,
  detectMeetingBotPlatform,
  getMeetingBotErrorPresentation,
  getMeetingBotStatusPresentation,
  mapMeetingBotToCallCaptureStatus,
  normalizeRecallMeetingBotStatus,
  shouldAcceptMeetingBotSnapshot,
  validateMeetingBotUrl,
} from "../src/lib/meeting-bot.ts"

test("meeting URLs detect and validate supported direct meeting platforms", () => {
  const cases = [
    ["https://us02web.zoom.us/j/123456789?pwd=secret", "zoom"],
    ["https://meet.google.com/abc-defg-hij", "google_meet"],
    ["https://teams.microsoft.com/l/meetup-join/19%3ameeting_example", "microsoft_teams"],
    ["https://teams.live.com/meet/1234567890123?p=example", "microsoft_teams"],
    ["https://teams.cloud.microsoft/meet/1234567890123?p=example", "microsoft_teams"],
    ["https://salesframe.webex.com/meet/dan", "webex"],
    ["https://salesframe.webex.com/salesframe/j.php?MTID=example", "webex"],
  ]

  for (const [url, platform] of cases) {
    assert.equal(detectMeetingBotPlatform(url), platform)
    const result = validateMeetingBotUrl(url)
    assert.equal(result.valid, true, url)
    assert.equal(result.platform, platform, url)
    assert.equal(result.normalizedUrl, url, url)
  }
})

test("meeting-bot client correlation identifiers are real UUIDs accepted by the server", () => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const instanceId = createMeetingBotClientInstanceId()
  const requestId = createMeetingBotClientRequestId()

  assert.match(instanceId, uuidPattern)
  assert.match(requestId, uuidPattern)
  assert.notEqual(instanceId, requestId)
})

test("ambiguous meeting-bot creation preserves records and reconciles the existing call", async () => {
  const app = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8")
  )
  const startHandler = app.slice(
    app.indexOf("const handleStartRecording = async"),
    app.indexOf("const handleCreateAccount = async")
  )

  assert.match(startHandler, /let meetingBotSessionMayExist = false/)
  assert.match(
    startHandler,
    /catch \(startError: unknown\)[\s\S]*getMeetingBotSessionForCall\(call\.id\)[\s\S]*meetingBotCapture\.restore\(snapshot\.sessionId\)/
  )
  assert.match(startHandler, /meetingBotSessionMayExist = !snapshot\.scopeCleanupSafe/)
  assert.match(startHandler, /startFailureWasAuthoritative[\s\S]*sessionWasNotFound/)
  assert.match(startHandler, /const canRollbackCreatedRecords = !isMeetingBot \|\| !meetingBotSessionMayExist/)
  assert.match(startHandler, /!captureStarted && \(!isMeetingBot \|\| !meetingBotSessionMayExist\)/)
  assert.match(startHandler, /if \(isMeetingBot && meetingBotSessionMayExist\)[\s\S]*meetingBotCapture\.stop/)
  assert.match(
    app,
    /\["provisioning", "joining", "waiting_room", "recording", "failed"\]\.includes\(snapshot\.status\)/
  )
})

test("meeting bot joins while the initial question is prepared in the background", async () => {
  const app = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8")
  )
  const startHandler = app.slice(
    app.indexOf("const handleStartRecording = async"),
    app.indexOf("const handleCreateAccount = async")
  )

  assert.ok(startHandler.indexOf("const meetingBotStartPromise") < startHandler.indexOf("const initialGuidancePromise"))
  assert.match(startHandler, /await meetingBotStartPromise[\s\S]*void initialGuidanceResultPromise/)
  assert.doesNotMatch(startHandler, /Promise\.allSettled\(\[\s*initialGuidancePromise,\s*meetingBotStartPromise/)
  assert.match(startHandler, /!isMeetingBot && payload\.audioCaptureMode === "meeting_audio"[\s\S]*\? "browser_two_channel"[\s\S]*: "browser_one_channel"/)
  assert.doesNotMatch(
    startHandler.slice(startHandler.indexOf("const call = await createSupabaseCall"), startHandler.indexOf("createdCallId = call.id")),
    /capture_method:[\s\S]*"recall_meeting_bot"/
  )
})

test("meeting bot branding reuses the exact SalesFrame AudioLines mark", async () => {
  const fs = await import("node:fs/promises")
  const [app, botTile, favicon] = await Promise.all([
    fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../public/media/salesframe-meeting-bot.svg", import.meta.url), "utf8"),
    fs.readFile(new URL("../public/favicon.svg", import.meta.url), "utf8"),
  ])
  const iconPaths = (source) => [...source.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1])
  const meetingBotPanel = app.slice(
    app.indexOf("selectedAudioSourceChoice === \"meeting_bot\" ?"),
    app.indexOf("Who is joining?", app.indexOf("selectedAudioSourceChoice === \"meeting_bot\" ?"))
  )

  assert.deepEqual(iconPaths(botTile), iconPaths(favicon))
  assert.equal(iconPaths(botTile).length, 6)
  assert.match(meetingBotPanel, /<AudioLinesIcon className="size-4" \/>/)
  assert.doesNotMatch(meetingBotPanel, /AudioWaveformIcon/)
})

test("meeting participant correction is server-authoritative and shown as one calm prompt", async () => {
  const [app, functions] = await Promise.all([
    import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8")),
    import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/lib/server-functions.ts", import.meta.url), "utf8")),
  ])

  assert.match(functions, /export function correctMeetingBotParticipantAttribution/)
  assert.match(functions, /participants\/\$\{encodeURIComponent\(participantId\)\}\/attribution/)
  assert.match(app, /Who is \{participantNeedingReview\.displayName\}\?/)
  assert.match(app, /Review speaker/)
  assert.match(app, /onMeetingBotParticipantAttribution\([\s\S]*participantId:/)
})

test("live meeting transcript events are applied incrementally instead of refetching the full call", async () => {
  const [app, data] = await Promise.all([
    import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8")),
    import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/lib/supabase/salesframe-data.ts", import.meta.url), "utf8")),
  ])
  const realtimeEffect = app.slice(
    app.indexOf("const publishMeetingBotTranscript"),
    app.indexOf("React.useEffect(() => {", app.indexOf("const publishMeetingBotTranscript") + 1)
  )

  assert.match(realtimeEffect, /const applyTranscriptSegmentChange/)
  assert.match(realtimeEffect, /upsertTranscriptLine\(currentTranscript, attributedLine\)/)
  assert.match(realtimeEffect, /table: "transcript_segments"[\s\S]*applyTranscriptSegmentChange/)
  assert.match(realtimeEffect, /slice\(-meetingBotLiveTranscriptWindowSize\)/)
  assert.match(data, /export async function listRecentTranscriptSegments[\s\S]*\.limit\(safeLimit\)/)
})

test("destructive account, opportunity, and call flows wait for provider cleanup", async () => {
  const app = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8")
  )
  const deleteHandler = app.slice(
    app.indexOf("const handleConfirmDeleteRecord = async"),
    app.indexOf("const handleRecordingChange = async")
  )

  assert.match(deleteHandler, /pendingDeleteRecord\.type === "account"[\s\S]*meetingSessionOpportunity\?\.accountId/)
  assert.match(deleteHandler, /await meetingBotCapture\.stop\(\{ endedReason: "seller_stopped" \}\)/)
  assert.match(deleteHandler, /Delete this record after the call is ready/)
})

test("meeting URL validation rejects redirects, aliases, insecure URLs, and unsupported hosts", () => {
  const cases = [
    ["", "empty"],
    ["meet.google.com/abc-defg-hij", "invalid"],
    ["http://meet.google.com/abc-defg-hij", "https_required"],
    ["https://calendar.google.com/calendar/event?eid=example", "unsupported_platform"],
    ["https://meet.google.com/lookup/team-alias", "not_direct_meeting_url"],
    ["https://zoom.us/my/salesframe", "not_direct_meeting_url"],
    ["https://example.com/j/123456789", "unsupported_platform"],
    ["https://zoom.us:8443/j/123456789", "invalid"],
  ]

  for (const [url, code] of cases) {
    const result = validateMeetingBotUrl(url)
    assert.equal(result.valid, false, url)
    assert.equal(result.code, code, url)
  }
})

test("Recall provider lifecycle maps to calm SalesFrame capture states", () => {
  const cases = [
    ["bot.joining_call", "joining"],
    ["in_waiting_room", "waiting_room"],
    ["in_call_not_recording", "joining"],
    ["in_call_recording", "recording"],
    ["call_ended", "processing"],
    ["done", "completed"],
    ["fatal", "failed"],
    ["recording_permission_denied", "failed"],
    ["unexpected_future_status", "failed"],
  ]

  for (const [providerStatus, status] of cases) {
    assert.equal(normalizeRecallMeetingBotStatus(providerStatus), status)
  }

  assert.deepEqual(getMeetingBotStatusPresentation("waiting_room"), {
    detail: "Ask the host to admit SalesFrame when it appears in the lobby.",
    isTerminal: false,
    title: "Waiting to be admitted",
    tone: "calm",
  })
  assert.equal(
    getMeetingBotStatusPresentation({
      callId: "call-1",
      providerStatus: "in_call_not_recording",
      sessionId: "session-1",
      status: "joining",
    }).title,
    "Waiting for recording permission"
  )

  assert.deepEqual(
    ["idle", "provisioning", "joining", "waiting_room", "recording", "leaving", "processing", "completed", "failed"].map(
      mapMeetingBotToCallCaptureStatus
    ),
    ["idle", "connecting", "connecting", "connecting", "recording", "stopping", "stopping", "stopped", "error"]
  )
})

test("meeting-bot errors stay specific, safe, and offer the right recovery", () => {
  assert.deepEqual(getMeetingBotErrorPresentation({ code: "meeting_password_incorrect" }), {
    canFallback: true,
    canRetry: false,
    code: "meeting_password_incorrect",
    message: "Use the full meeting link with the correct passcode included.",
    title: "The meeting passcode did not work",
  })

  assert.equal(getMeetingBotErrorPresentation({ code: "meeting_locked" }).title, "The meeting is locked")
  assert.equal(
    getMeetingBotErrorPresentation({ code: "meeting_bot_temporarily_unavailable" }).canRetry,
    false
  )
  assert.match(
    getMeetingBotErrorPresentation({ code: "provider_capacity" }).message,
    /within two minutes/
  )
  assert.match(
    getMeetingBotErrorPresentation({ code: "provider_state_reconciling_abandoned" }).message,
    /late bot will be removed safely/
  )

  const unknownError = getMeetingBotErrorPresentation(new Error("provider leaked details"))
  assert.equal(unknownError.code, "unknown")
  assert.equal(unknownError.message.includes("provider leaked details"), false)
  assert.equal(unknownError.canFallback, true)
})

test("meeting-bot client source keeps every supported call end reason in its public contract", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/lib/meeting-bot.ts", import.meta.url), "utf8")
  )

  for (const reason of [
    "seller_stopped",
    "time_limit_reached",
    "bot_removed",
    "client_disconnected",
    "meeting_ended",
    "provider_failed",
  ]) {
    assert.match(source, new RegExp(`\\| \\"${reason}\\"`), reason)
  }
})

test("stale or regressive lifecycle snapshots cannot replace newer state", () => {
  const current = {
    callId: "call-1",
    revision: 4,
    sessionId: "session-1",
    status: "recording",
    updatedAt: "2026-07-12T10:00:04.000Z",
  }

  assert.equal(shouldAcceptMeetingBotSnapshot(current, { ...current, revision: 3, status: "joining" }), false)
  assert.equal(shouldAcceptMeetingBotSnapshot(current, { ...current, revision: 4 }), false)
  assert.equal(shouldAcceptMeetingBotSnapshot(current, { ...current, revision: 5, status: "processing" }), true)
  assert.equal(
    shouldAcceptMeetingBotSnapshot({ ...current, status: "completed" }, { ...current, revision: 6, status: "recording" }),
    false
  )
  assert.equal(
    shouldAcceptMeetingBotSnapshot(current, { ...current, sessionId: "session-2", revision: 1, status: "joining" }),
    true
  )
})

test("participant changes advance the public session revision without no-op polling churn", async () => {
  const [app, serverTypes] = await Promise.all([
    import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8")),
    import("node:fs/promises").then((fs) => fs.readFile(new URL("../netlify/functions/_shared/meeting-bot-types.ts", import.meta.url), "utf8")),
  ])

  assert.match(serverTypes, /Math\.max\([\s\S]*participants\.map\(\(participant\) => Date\.parse\(participant\.updated_at\)/)
  assert.match(app, /const meetingBotParticipantRevision =/)
  assert.match(app, /\[meetingBotCapture\.session\?\.callId, meetingBotParticipantRevision, meetingBotContactIdentityRevision\]/)
})

class FakePresenceEnvironment {
  intervalCallback = null
  listeners = new Map()
  visibilityState = "visible"

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  clearInterval() {
    this.intervalCallback = null
  }

  emit(type) {
    for (const listener of this.listeners.get(type) ?? []) listener()
  }

  getVisibilityState() {
    return this.visibilityState
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  runInterval() {
    this.intervalCallback?.()
  }

  setInterval(callback) {
    this.intervalCallback = callback
    return 1
  }
}

test("browser presence disconnects on true page exit but not on tab hiding", () => {
  const environment = new FakePresenceEnvironment()
  const events = []
  const session = {
    callId: "call-1",
    sessionId: "session-1",
    status: "recording",
  }

  const cleanup = createMeetingBotPresenceController({
    disconnect: () => events.push("disconnect"),
    environment,
    getSession: () => session,
    heartbeat: (_session, visibilityState) => events.push(`heartbeat:${visibilityState}`),
    heartbeatIntervalMs: 10_000,
  })

  assert.deepEqual(events, ["heartbeat:visible"])

  environment.visibilityState = "hidden"
  environment.emit("visibilitychange")
  assert.deepEqual(events, ["heartbeat:visible", "heartbeat:hidden"])

  environment.visibilityState = "visible"
  environment.emit("visibilitychange")
  environment.runInterval()
  assert.deepEqual(events, ["heartbeat:visible", "heartbeat:hidden", "heartbeat:visible", "heartbeat:visible"])

  environment.emit("pagehide")
  environment.emit("beforeunload")
  environment.runInterval()
  assert.deepEqual(events, ["heartbeat:visible", "heartbeat:hidden", "heartbeat:visible", "heartbeat:visible", "disconnect"])

  environment.emit("pageshow")
  assert.deepEqual(events, [
    "heartbeat:visible",
    "heartbeat:hidden",
    "heartbeat:visible",
    "heartbeat:visible",
    "disconnect",
    "heartbeat:visible",
  ])

  cleanup()
  environment.runInterval()
  environment.emit("pagehide")
  assert.deepEqual(events, [
    "heartbeat:visible",
    "heartbeat:hidden",
    "heartbeat:visible",
    "heartbeat:visible",
    "disconnect",
    "heartbeat:visible",
  ])
})

test("presence controller ignores terminal and processing sessions", () => {
  for (const status of ["processing", "completed", "failed"]) {
    const environment = new FakePresenceEnvironment()
    const events = []
    const cleanup = createMeetingBotPresenceController({
      disconnect: () => events.push("disconnect"),
      environment,
      getSession: () => ({ callId: "call-1", sessionId: "session-1", status }),
      heartbeat: () => events.push("heartbeat"),
    })

    environment.emit("pagehide")
    environment.emit("pageshow")
    environment.runInterval()
    assert.deepEqual(events, [], status)
    cleanup()
  }
})
