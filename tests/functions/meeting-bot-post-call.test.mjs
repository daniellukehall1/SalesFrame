import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createMeetingBotPostCallDispatch,
  dispatchMeetingBotPostCall,
  verifyMeetingBotPostCallDispatch,
} from "../../netlify/functions/_shared/meeting-bot-post-call-dispatch.ts"

const cryptoSecret = "meeting-bot-post-call-test-secret-with-sufficient-entropy"
const sessionId = "123e4567-e89b-42d3-a456-426614174000"

test("meeting-bot post-call background dispatch is short-lived and tamper evident", () => {
  const previousSecret = process.env.MEETING_BOT_CRYPTO_SECRET
  process.env.MEETING_BOT_CRYPTO_SECRET = cryptoSecret

  try {
    const dispatch = createMeetingBotPostCallDispatch(sessionId, 2_000)
    assert.equal(
      verifyMeetingBotPostCallDispatch({
        nowSeconds: 2_240,
        payload: dispatch.payload,
        signature: dispatch.signature,
      }).sessionId,
      sessionId
    )

    assert.throws(
      () =>
        verifyMeetingBotPostCallDispatch({
          nowSeconds: 2_301,
          payload: dispatch.payload,
          signature: dispatch.signature,
        }),
      (error) => error?.code === "meeting_bot_post_call_unverified"
    )
    assert.throws(
      () =>
        verifyMeetingBotPostCallDispatch({
          nowSeconds: 2_000,
          payload: { ...dispatch.payload, sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
          signature: dispatch.signature,
        }),
      (error) => error?.code === "meeting_bot_post_call_unverified"
    )
  } finally {
    if (previousSecret === undefined) delete process.env.MEETING_BOT_CRYPTO_SECRET
    else process.env.MEETING_BOT_CRYPTO_SECRET = previousSecret
  }
})

test("meeting-bot post-call dispatch sends only the signed opaque session request", async () => {
  const previousSecret = process.env.MEETING_BOT_CRYPTO_SECRET
  const previousUrl = process.env.URL
  process.env.MEETING_BOT_CRYPTO_SECRET = cryptoSecret
  process.env.URL = "https://salesframe.example"
  let capturedUrl = ""
  let capturedInit = null

  try {
    await dispatchMeetingBotPostCall(sessionId, {
      nowSeconds: 3_000,
      fetcher: async (url, init) => {
        capturedUrl = String(url)
        capturedInit = init
        return new Response(null, { status: 202 })
      },
    })

    assert.equal(capturedUrl, "https://salesframe.example/api/internal/meeting-bot-post-call")
    assert.equal(capturedInit.method, "POST")
    const body = JSON.parse(capturedInit.body)
    assert.deepEqual(body, { issuedAt: 3_000, sessionId })
    assert.match(capturedInit.headers["X-SalesFrame-Post-Call-Signature"], /^v1=[a-f0-9]{64}$/)
    assert.deepEqual(Object.keys(body).sort(), ["issuedAt", "sessionId"])
  } finally {
    if (previousSecret === undefined) delete process.env.MEETING_BOT_CRYPTO_SECRET
    else process.env.MEETING_BOT_CRYPTO_SECRET = previousSecret
    if (previousUrl === undefined) delete process.env.URL
    else process.env.URL = previousUrl
  }
})

test("meeting-bot post-call generation is database-idempotent across recovery and manual retry", async () => {
  const [generatorSource, bridgeSource, migrationSource] = await Promise.all([
    readFile(new URL("../../netlify/functions/post-call-outputs.ts", import.meta.url), "utf8"),
    readFile(new URL("../../netlify/functions/_shared/meeting-bot-post-call.ts", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/migrations/202607120001_recall_meeting_bot.sql", import.meta.url), "utf8"),
  ])

  assert.match(generatorSource, /onConflict: "source_meeting_bot_session_id"/)
  assert.match(generatorSource, /source_meeting_bot_session_id: sourceMeetingBotSessionId/g)
  assert.match(generatorSource, /generation_result: result/)
  assert.match(generatorSource, /canonicalResult = assertPostCallResult/)
  assert.ok(
    generatorSource.indexOf("let canonicalResult") <
      generatorSource.indexOf("if (!canonicalResult && correctedTranscriptSegments.length > 0)"),
    "a retry must load the canonical result before any further OpenAI correction work"
  )
  assert.ok(
    generatorSource.indexOf("generation_result: result") <
      generatorSource.indexOf("await persistPostCallEvidenceUpdates"),
    "the canonical model result must be durable before evidence side effects"
  )
  assert.match(bridgeSource, /const existingOutput = await getExistingMeetingBotPostCallOutput/)
  assert.match(bridgeSource, /\.eq\("previous_call_id", session\.call_id\)[\s\S]*\.eq\("schema_version", 2\)/)
  assert.doesNotMatch(bridgeSource, /\.from\("next_call_briefs"\)[\s\S]*\.eq\("source_meeting_bot_session_id", sessionId\)/)
  assert.match(generatorSource, /apiKeyUserId: string/)
  assert.match(bridgeSource, /apiKeyUserId: keyUserId/)
  assert.ok(
    bridgeSource.indexOf("if (existingOutput)") <
      bridgeSource.indexOf("const apiKey = await getDecryptedOpenAiKey"),
    "recovered source rows must complete the claim before another OpenAI request"
  )
  assert.match(migrationSource, /create unique index post_call_outputs_source_meeting_bot_session_key\s+on public\.post_call_outputs\(source_meeting_bot_session_id\);/)
  assert.match(migrationSource, /create unique index next_call_briefs_source_meeting_bot_session_key\s+on public\.next_call_briefs\(source_meeting_bot_session_id\);/)
  assert.match(migrationSource, /create or replace function public\.claim_meeting_bot_post_call/)
  assert.match(migrationSource, /and session\.media_transfer_status = 'verified'/)
  assert.match(migrationSource, /and session\.provider_media_deleted_at is not null/)
})

test("background post-call generation never trusts webhook identifiers for call scope", async () => {
  const bridgeSource = await readFile(
    new URL("../../netlify/functions/_shared/meeting-bot-post-call.ts", import.meta.url),
    "utf8"
  )

  assert.match(bridgeSource, /\.eq\("id", session\.call_id\)/)
  assert.match(bridgeSource, /\.eq\("workspace_id", session\.workspace_id\)/)
  assert.match(bridgeSource, /\.eq\("account_id", session\.account_id\)/)
  assert.match(bridgeSource, /\.eq\("opportunity_id", session\.opportunity_id\)/)
  assert.match(bridgeSource, /call\.capture_method !== "recall_meeting_bot"/)
  assert.doesNotMatch(bridgeSource, /webhookId|webhook_id/)
})
