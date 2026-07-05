import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { Buffer } from "node:buffer"
import { test } from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)

async function importTurnAssembler() {
  const source = await readFile(new URL("src/lib/turn-assembler.ts", root), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

test("one-channel seller question followed by buyer answer starts a new turn", async () => {
  const {
    canContinueTranscriptTurn,
    shouldInferOneChannelCustomerTurn,
  } = await importTurnAssembler()
  const turn = {
    attribution: { speakerLabel: "Seller" },
    lastActivityMs: 1200,
    text: "What are the main issues with the current process?",
  }

  assert.equal(
    shouldInferOneChannelCustomerTurn({
      nextText: "We currently manage that manually in spreadsheets.",
      pauseMs: 1200,
      sourceKind: "in_person_microphone",
      turn,
    }),
    true
  )
  assert.equal(
    canContinueTranscriptTurn({
      attributionSpeaker: "Seller",
      elapsedMs: 2400,
      nextText: "We currently manage that manually in spreadsheets.",
      sourceKind: "in_person_microphone",
      turn,
    }),
    false
  )
})

test("one-channel seller continuation can still merge when it is not an answer pattern", async () => {
  const { canContinueTranscriptTurn } = await importTurnAssembler()
  const turn = {
    attribution: { speakerLabel: "Seller" },
    lastActivityMs: 1000,
    text: "I can give you a quick overview",
  }

  assert.equal(
    canContinueTranscriptTurn({
      attributionSpeaker: "Seller",
      elapsedMs: 2100,
      nextText: "and then we can talk about whether it is relevant.",
      sourceKind: "in_person_microphone",
      turn,
    }),
    true
  )
})

test("two-channel same speaker keeps the longer source-reliable merge window", async () => {
  const { canContinueTranscriptTurn } = await importTurnAssembler()
  const turn = {
    attribution: { speakerLabel: "Seller" },
    lastActivityMs: 1000,
    text: "Let me unpack that",
  }

  assert.equal(
    canContinueTranscriptTurn({
      attributionSpeaker: "Seller",
      elapsedMs: 4200,
      nextText: "because there are two parts to the answer.",
      sourceKind: "seller_mic",
      turn,
    }),
    true
  )
})
