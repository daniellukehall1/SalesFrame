import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("turn assembler suppresses duplicate provider final turns and keeps quality flags", async () => {
  const assembler = await read("src/lib/turn-assembler.ts")

  assert.match(assembler, /export function shouldSuppressFinalTranscript/)
  assert.match(assembler, /duplicate_provider_turn/)
  assert.match(assembler, /language_drift_or_low_confidence/)
  assert.match(assembler, /exactDuplicateTranscriptWindowMs = 90000/)
  assert.match(assembler, /normalizedEventText === normalizedText/)
  assert.match(assembler, /longer\.includes\(shorter\)/)
})

test("turn assembler merges only stable same-speaker turns", async () => {
  const assembler = await read("src/lib/turn-assembler.ts")

  assert.match(assembler, /export function canContinueTranscriptTurn/)
  assert.match(assembler, /turn\.attribution\.speakerLabel !== attributionSpeaker/)
  assert.match(assembler, /oneChannelSpeakerTurnPauseWindowMs = 2200/)
  assert.match(assembler, /oneChannelQuestionAnswerBoundaryMs = 900/)
  assert.match(assembler, /shouldInferOneChannelCustomerTurn/)
  assert.match(assembler, /isQuestionLikeTranscript/)
  assert.match(assembler, /isAnswerLikeTranscript/)
  assert.match(assembler, /shouldSplitOneChannelQuestionAnswerTurn/)
  assert.match(assembler, /pauseMs > oneChannelSpeakerTurnPauseWindowMs/)
  assert.match(assembler, /pauseMs > speakerTurnPauseWindowMs/)
  assert.match(assembler, /turn\.text\.length \+ nextText\.length > maxMergedTurnCharacters/)
  assert.match(assembler, /export function joinTranscriptText/)
  assert.match(assembler, /export function appendTranscriptDelta/)
  assert.match(assembler, /existing\.endsWith\(next\)/)
  assert.match(assembler, /next\.startsWith\(existing\)/)
  assert.match(assembler, /needsJoiningSpace\(existing, delta\)/)
  assert.match(assembler, /\`\$\{existing\}\$\{needsJoiningSpace\(existing, delta\) \? " " : ""\}\$\{delta\}\`/)
})

test("Deepgram Flux updates replace one live row and final turns are explicit", async () => {
  const deepgramClient = await read("src/lib/deepgram-live-transcription.ts")

  assert.match(deepgramClient, /eventName === "Update"/)
  assert.match(deepgramClient, /eventName === "StartOfTurn"/)
  assert.match(deepgramClient, /eventName === "EagerEndOfTurn"/)
  assert.match(deepgramClient, /eventName === "TurnResumed"/)
  assert.match(deepgramClient, /eventName === "EndOfTurn"/)
  assert.match(deepgramClient, /isDelta: false/)
  assert.match(deepgramClient, /isFinal: normalizedKind === "end_of_turn"/)
  assert.doesNotMatch(deepgramClient, /getRealtimeDeltaString/)
})
