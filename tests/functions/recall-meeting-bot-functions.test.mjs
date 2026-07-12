import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

async function loadValidationModule() {
  const source = await read("netlify/functions/_shared/meeting-bot-validation.ts")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

test("meeting URL validation accepts direct supported provider URLs only", async () => {
  const { parseMeetingUrl } = await loadValidationModule()

  assert.equal(parseMeetingUrl("https://meet.google.com/abc-defg-hij").platform, "google_meet")
  assert.equal(parseMeetingUrl("https://example.zoom.us/j/123456789?pwd=secret").platform, "zoom")
  assert.equal(
    parseMeetingUrl("https://teams.microsoft.com/l/meetup-join/19%3ameeting_test").platform,
    "microsoft_teams"
  )
  assert.equal(parseMeetingUrl("https://example.webex.com/meet/person").platform, "webex")
  assert.equal(parseMeetingUrl("https://example.webex.com/example/j.php?MTID=abc123").platform, "webex")

  for (const invalidUrl of [
    "http://meet.google.com/abc-defg-hij",
    "https://meet.google.com.evil.example/abc-defg-hij",
    "https://zoom.us.evil.example/j/1234",
    "https://zoom.us/my/personal-room",
    "https://zoom.us/j/1234",
    "https://localhost/j/1234",
    "https://example.com/redirect?to=https://meet.google.com/abc-defg-hij",
  ]) {
    assert.throws(() => parseMeetingUrl(invalidUrl))
  }
})

test("participant matching helpers normalize names and preserve a strict fuzzy threshold", async () => {
  const {
    arePersonNamesEquivalent,
    arePreferredNamesEquivalent,
    nameSimilarity,
    normalizeEmail,
    normalizePersonName,
    getMeetingBotTurnCommitAt,
    orderMeetingBotUtterances,
  } = await loadValidationModule()

  assert.equal(normalizePersonName(" Dr. José  Hall "), "jose hall")
  assert.equal(normalizeEmail(" Person@Example.COM "), "person@example.com")
  assert.equal(normalizeEmail("not-an-email"), "")
  assert.equal(nameSimilarity("Daniel Hall", "Daniel Hall"), 1)
  assert.ok(nameSimilarity("Matt Comyn", "Mat Comyn") >= 0.88)
  assert.ok(nameSimilarity("Alex Chen", "Jordan Smith") < 0.88)
  assert.equal(arePersonNamesEquivalent("Bob Smith", "Robert Smith"), true)
  assert.equal(arePersonNamesEquivalent("Bob Jones", "Robert Smith"), false)
  assert.equal(arePreferredNamesEquivalent("Liz", "Elizabeth"), true)
  assert.deepEqual(
    orderMeetingBotUtterances([
      { endMs: 2_400, eventId: "later", startMs: 2_000, text: "second" },
      { endMs: 1_400, eventId: "earlier", startMs: 1_000, text: "first" },
    ]).map((item) => item.text),
    ["first", "second"]
  )
  assert.equal(getMeetingBotTurnCommitAt("1970-01-01T00:00:01.000Z", 1_100), 1_600)
  assert.equal(getMeetingBotTurnCommitAt(null, 1_100), 4_100)
})

test("meeting bot APIs authorize calls and keep Recall credentials server-side", async () => {
  const api = await read("netlify/functions/meeting-bots.ts")
  const migration = await read("supabase/migrations/202607120001_recall_meeting_bot.sql")
  const correctionGrants = migration.slice(
    migration.indexOf("revoke all on function public.correct_meeting_bot_participant_attribution"),
    migration.indexOf("grant update (capture_method)")
  )
  const recall = await read("netlify/functions/_shared/recall-client.ts")
  const store = await read("netlify/functions/_shared/meeting-bot-store.ts")
  const types = await read("netlify/functions/_shared/meeting-bot-types.ts")
  const publicParticipant = types.slice(
    types.indexOf("export function toMeetingBotPublicParticipant"),
    types.indexOf("export function toMeetingBotPublicSession")
  )
  const publicSession = types.slice(types.indexOf("export function toMeetingBotPublicSession"))

  assert.match(api, /path: \[/)
  assert.match(api, /"\/api\/meeting-bots"/)
  assert.match(api, /"\/api\/meeting-bots\/:sessionId\/heartbeat"/)
  assert.match(api, /"\/api\/meeting-bots\/:sessionId\/disconnect"/)
  assert.match(api, /"\/api\/meeting-bots\/:sessionId\/participants\/:participantId\/attribution"/)
  assert.match(api, /requireMeetingBotEnabled\(\)/)
  assert.match(api, /authorizeCall\(user\.id, callId, supabase, \{ token \}\)/)
  assert.match(api, /assertCallIsLive/)
  assert.match(api, /clientInstanceId/)
  assert.match(api, /visibilityState !== "visible"/)
  assert.match(api, /visibilityState !== "hidden"/)
  assert.match(api, /context\.waitUntil/)
  assert.match(store, /rpc\("create_meeting_bot_session"/)
  assert.match(store, /target_client_instance_id/)
  assert.match(store, /target_user_rolling_creation_limit/)
  assert.match(store, /target_workspace_daily_minute_limit/)
  assert.match(store, /target_reserved_bot_minutes/)
  assert.match(store, /claim_due_meeting_bot_provisioning/)
  assert.match(store, /rpc\(\s*"correct_meeting_bot_participant_attribution"/)
  assert.match(store, /rpc\(\s*"reconnect_meeting_bot_session"/)
  assert.match(api, /session\.client_instance_id === clientInstanceId/)
  assert.match(api, /authorizeContact\(user\.id, contactId, supabase, \{ token \}\)/)
  assert.match(api, /contact\.workspace_id !== session\.workspace_id/)
  assert.match(api, /contact\.account_id !== session\.account_id/)
  assert.match(api, /contact\.archived_at/)
  assert.match(api, /listMeetingBotParticipants/)
  assert.match(publicParticipant, /callSpeakerId:/)
  assert.match(publicParticipant, /isSpeaking:/)
  assert.doesNotMatch(publicParticipant, /provider_participant_id|email/)
  assert.match(publicSession, /postCallStatus/)
  assert.match(publicSession, /postCallErrorCode/)
  assert.match(publicSession, /post_call_locked_at/)
  assert.match(publicSession, /reconciliationStatus/)
  assert.match(publicSession, /scopeCleanupSafe/)
  assert.match(migration, /create or replace function public\.correct_meeting_bot_participant_attribution/)
  assert.match(migration, /match_provenance = 'seller_corrected'/)
  assert.match(correctionGrants, /grant execute on function public\.correct_meeting_bot_participant_attribution[\s\S]*to service_role/)
  assert.doesNotMatch(correctionGrants, /correct_meeting_bot_participant_attribution[^;]+to authenticated/)
  assert.match(recall, /requireEnv\("RECALL_API_KEY"\)/)
  assert.match(recall, /requireEnv\("RECALL_MEDIA_DOWNLOAD_HOSTS"\)/)
  assert.match(recall, /getRecallMediaDownloadHosts\(\)\.has\(host\)/)
  assert.match(recall, /redirect: "error"/)
  assert.doesNotMatch(recall, /VITE_RECALL|RECALL_API_KEY\s*[:=]/)
  assert.match(recall, /bot_name: "SalesFrame AI Notetaker"/)
  assert.match(recall, /audio_mixed_mp3: \{\}/)
  assert.match(recall, /video_mixed_mp4: null/)
  assert.match(recall, /model: "nova-3"/)
  assert.match(recall, /use_separate_streams_when_available: true/)
  assert.match(recall, /hours: 24/)
  assert.match(recall, /in_call_recording_timeout: 7200/)
})

test("Recall webhooks verify raw bodies before parsing or persistence and process durably", async () => {
  const webhook = await read("netlify/functions/_shared/recall-webhook.ts")
  const crypto = await read("netlify/functions/_shared/meeting-bot-crypto.ts")
  const processing = await read("netlify/functions/_shared/meeting-bot-processing.ts")
  const status = await read("netlify/functions/recall-status-webhook.ts")
  const realtime = await read("netlify/functions/recall-realtime-webhook.ts")

  assert.ok(webhook.indexOf("verifyRecallWebhook") < webhook.indexOf("parseVerifiedPayload(rawBody)"))
  assert.ok(webhook.indexOf("verifyRecallWebhook") < webhook.indexOf("insertMeetingBotWebhookEvent"))
  assert.match(webhook, /request\.text\(\)/)
  assert.match(webhook, /context\.waitUntil/)
  assert.match(webhook, /RECALL_SVIX_WEBHOOK_SECRET/)
  assert.match(crypto, /timingSafeEqual/)
  assert.match(crypto, /Math\.abs\(nowSeconds - timestamp\)/)
  assert.match(crypto, /salesframe:meeting-bot:\$\{purpose\}:v1/)
  assert.match(crypto, /secrets\.some/)
  assert.match(processing, /claimMeetingBotWebhookEvent/)
  assert.match(processing, /markWebhookEventProcessed/)
  assert.match(processing, /markWebhookEventFailed/)
  assert.match(processing, /new AppError\([\s\S]*"recall_webhook_too_large"[\s\S]*413/)
  assert.match(status, /path: "\/api\/recall\/webhooks\/status"/)
  assert.match(realtime, /path: "\/api\/recall\/webhooks\/realtime"/)
})

test("Recall processing assembles stable turns, maps participants, and finalizes audio safely", async () => {
  const processing = await read("netlify/functions/_shared/meeting-bot-processing.ts")
  const recovery = await read("netlify/functions/recall-recovery.ts")

  assert.match(processing, /contactFuzzyThreshold = 0\.88/)
  assert.match(processing, /contactFuzzyMargin = 0\.1/)
  assert.match(processing, /automatic_email/)
  assert.match(processing, /automatic_exact_name/)
  assert.match(processing, /automatic_fuzzy_name/)
  assert.match(processing, /\$\{hybridPrefix\}-\$\{createHash\("sha256"\)/)
  assert.match(processing, /getHybridParentParticipantId/)
  assert.match(processing, /bridgeHybridParticipants/)
  assert.match(processing, /party: "unknown"/)
  assert.match(processing, /listRecallBotsByCorrelationToken/)
  assert.match(processing, /job\.attempt_count > 1/)
  assert.match(processing, /provider_duplicate_cleanup_pending/)
  assert.match(processing, /provider_state_reconciling_abandoned/)
  assert.match(processing, /meeting_bot_turn_buffers/)
  assert.match(processing, /status: "committing"/)
  assert.match(processing, /separatedAfter \|\| separatedBefore/)
  assert.match(processing, /orderMeetingBotUtterances/)
  assert.match(processing, /getMeetingBotTurnCommitAt/)
  assert.match(processing, /event\.event_type === "participant_events\.speech_on"/)
  assert.match(processing, /capture_provider: CAPTURE_PROVIDER/)
  assert.match(processing, /transcription_provider: PROVIDER_NAME/)
  assert.match(processing, /audio_source_kind: AUDIO_SOURCE_KIND/)
  assert.match(processing, /downloadRecallAudioToTempFile/)
  assert.match(processing, /createReadStream\(filePath\)/)
  assert.match(processing, /Readable\.fromWeb/)
  assert.doesNotMatch(processing, /existing\.data\.arrayBuffer|verification\.data\.arrayBuffer/)
  assert.match(processing, /createHash\("sha256"\)/)
  assert.match(processing, /deleteRecallBotMedia/)
  assert.match(processing, /session\.client_visibility === "visible"/)
  assert.match(processing, /expectedClientLease/)
  assert.match(processing, /leaveQuery\.eq\("last_heartbeat_at", expectedClientLease\.lastHeartbeatAt\)/)
  assert.match(processing, /media_transfer_status: "verified"/)
  assert.match(processing, /verification\.checksum !== checksum/)
  assert.match(processing, /retrieveRecallTranscript/)
  assert.match(processing, /downloadRecallTranscript/)
  assert.match(processing, /transcript_artifact_sha256: canonical\.checksum/)
  assert.match(processing, /transcript_completed_at: completionTimestamp/)
  assert.match(processing, /final_transcript_watermark_ms: watermarkMs/)
  assert.match(processing, /provider_turn_index: providerTurnIndex/)
  assert.match(processing, /turn_sequence: providerTurnIndex/)
  assert.match(processing, /transcript_finalization_pending/)
  const verifiedReceiptIndex = processing.indexOf("const verifiedSession")
  assert.ok(verifiedReceiptIndex > 0)
  assert.ok(
    verifiedReceiptIndex < processing.indexOf("await deleteRecallBotMedia(recallBotId)", verifiedReceiptIndex),
    "durable verified transfer state must be persisted before Recall deletion"
  )
  assert.match(processing, /call\?\.recording_storage_path === expectedPath/)
  assert.match(processing, /updated\.recording_started_at/)
  assert.match(recovery, /schedule: "\* \* \* \* \*"/)
})
