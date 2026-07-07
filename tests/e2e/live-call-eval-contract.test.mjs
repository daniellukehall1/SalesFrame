import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("live-call eval manifest covers the required elite pipeline scenarios", async () => {
  const manifest = JSON.parse(await read("tests/fixtures/live-call-evals.json"))
  const fixtureIds = new Set(manifest.fixtures.map((fixture) => fixture.id))

  assert.equal(manifest.acceptanceTargets.duplicateTranscriptRate, 0)
  assert.equal(manifest.acceptanceTargets.averageTurnFragmentationMax, 1.5)
  assert.equal(manifest.acceptanceTargets.buyerAnswerToNextQuestionMedianMsMax, 3000)
  assert.equal(manifest.acceptanceTargets.openingHeavyQuestionRate, 0)
  assert.equal(manifest.acceptanceTargets.methodologyEvidenceAccuracyMin, 0.85)
  assert.equal(manifest.acceptanceTargets.nextQuestionQualityMin, 0.8)

  assert.deepEqual(
    [...fixtureIds].sort(),
    [
      "in-person-mixed-room",
      "interruption-overlap",
      "long-seller-question-buyer-answer",
      "quiet-buyer-audio",
      "remote-single-seller-customer",
      "seller-mic-only",
      "tab-audio-plus-mic",
    ].sort()
  )
})

test("live-call implementation references the eval acceptance behaviors", async () => {
  const app = await read("src/App.tsx")
  const preflight = await read("src/lib/call-audio-preflight.ts")
  const deepgramClient = await read("src/lib/deepgram-live-transcription.ts")
  const assembler = await read("src/lib/turn-assembler.ts")
  const liveGuidance = await read("netlify/functions/live-guidance.ts")

  assert.match(preflight, /Buyer audio source connected: start call\./)
  assert.match(preflight, /Buyer audio is connected, but the meter is quiet right now/)
  assert.match(preflight, /Native app audio is not available through this browser/)
  assert.match(preflight, /function getMeetingAudioDisplayOptions/)
  assert.match(preflight, /systemAudio: "include"/)
  assert.match(preflight, /windowAudio: "system"/)
  assert.match(preflight, /function getSupportedAudioConstraints/)
  assert.match(preflight, /noiseSuppression: !isOneChannelRoomMic/)
  assert.match(preflight, /autoGainControl: isOneChannelRoomMic/)
  assert.match(deepgramClient, /createDeepgramTranscriptionToken/)
  assert.match(deepgramClient, /getDeepgramAuthProtocolAttempts/)
  assert.match(deepgramClient, /\["bearer", accessToken\]/)
  assert.match(deepgramClient, /Sec-WebSocket-Protocol: bearer, <temporary credential>/)
  assert.doesNotMatch(deepgramClient, /\["token", accessToken\]/)
  assert.match(deepgramClient, /const deepgramChunkMs = 80/)
  assert.match(deepgramClient, /const audioWorkletSetupTimeoutMs = 2500/)
  assert.match(deepgramClient, /waitForAudioWorkletSetup\(audioContext\.audioWorklet\.addModule\(workletUrl\)\)/)
  assert.match(deepgramClient, /eventName === "StartOfTurn"/)
  assert.match(deepgramClient, /eventName === "EagerEndOfTurn"/)
  assert.match(deepgramClient, /eventName === "TurnResumed"/)
  assert.match(deepgramClient, /eventName === "EndOfTurn"/)
  assert.match(deepgramClient, /diarizationSpeaker/)
  assert.match(deepgramClient, /providerSessionId/)
  assert.match(deepgramClient, /providerTurnIndex/)
  assert.match(deepgramClient, /endOfTurnConfidence/)
  assert.match(deepgramClient, /wordConfidence/)
  assert.match(deepgramClient, /isDelta: false/)
  assert.match(assembler, /shouldInferOneChannelCustomerTurn/)
  assert.doesNotMatch(deepgramClient, /sourceTranscriptionDelay/)
  assert.doesNotMatch(app, /latestTurnIsSeller && !feedbackCountChanged/)
  assert.match(app, /LIVE_COACH_FORCE_REFRESH_TURNS = 1/)
  assert.match(app, /turnsSinceLastFullGuidance >= LIVE_COACH_FORCE_REFRESH_TURNS/)
  assert.match(app, /shouldRefreshQuestion/)
  assert.match(assembler, /duplicate_provider_turn/)
  assert.match(liveGuidance, /buyer answered/)
  assert.match(liveGuidance, /Do not ask late-stage methodology questions/)
})
