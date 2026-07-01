import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("turn assembler suppresses duplicate realtime final events and keeps quality flags", async () => {
  const assembler = await read("src/lib/turn-assembler.ts")

  assert.match(assembler, /export function shouldSuppressFinalTranscript/)
  assert.match(assembler, /duplicate_realtime_event/)
  assert.match(assembler, /language_drift_or_low_confidence/)
  assert.match(assembler, /exactDuplicateTranscriptWindowMs = 90000/)
  assert.match(assembler, /normalizedEventText === normalizedText/)
  assert.match(assembler, /longer\.includes\(shorter\)/)
})

test("turn assembler merges only stable same-speaker turns", async () => {
  const assembler = await read("src/lib/turn-assembler.ts")

  assert.match(assembler, /export function canContinueTranscriptTurn/)
  assert.match(assembler, /turn\.attribution\.speakerLabel !== attributionSpeaker/)
  assert.match(assembler, /elapsedMs - turn\.lastActivityMs > speakerTurnPauseWindowMs/)
  assert.match(assembler, /turn\.text\.length \+ nextText\.length > maxMergedTurnCharacters/)
  assert.match(assembler, /export function joinTranscriptText/)
  assert.match(assembler, /export function appendTranscriptDelta/)
  assert.match(assembler, /existing\.endsWith\(next\)/)
  assert.match(assembler, /next\.startsWith\(existing\)/)
  assert.match(assembler, /needsJoiningSpace\(existing, delta\)/)
  assert.match(assembler, /\`\$\{existing\}\$\{needsJoiningSpace\(existing, delta\) \? " " : ""\}\$\{delta\}\`/)
})

test("realtime transcription preserves whitespace from streaming deltas", async () => {
  const realtime = await read("src/lib/realtime-transcription.ts")

  assert.match(realtime, /getRealtimeDeltaString\(event\.delta\)/)
  assert.match(realtime, /function getRealtimeDeltaString/)
  assert.match(realtime, /typeof value === "string" && value\.length > 0 \? value : ""/)
})
