import type { Config, Context } from "@netlify/functions"

import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeCall, requireUser } from "./_shared/supabase"

type SpeakerLabel =
  | "Seller"
  | "Customer"
  | "Customer 2"
  | "Customer 3"
  | "Unknown"

type RecentTranscriptLine = {
  speaker?: string
  text?: string
  time?: string
}

type SpeakerAttributionPayload = {
  callId?: string
  elapsedMs?: number
  recentTranscript?: RecentTranscriptLine[]
  segmentText?: string
  sourceHint?: string
}

type SpeakerAttributionResult = {
  confidence: number
  needsReview: boolean
  reason: string
  speakerLabel: SpeakerLabel
  source: string
}

const speakerLabels: SpeakerLabel[] = [
  "Seller",
  "Customer",
  "Customer 2",
  "Customer 3",
  "Unknown",
]

const speakerAttributionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["speakerLabel", "confidence", "needsReview", "reason", "source"],
  properties: {
    speakerLabel: { type: "string", enum: speakerLabels },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needsReview: { type: "boolean" },
    reason: { type: "string" },
    source: { type: "string", enum: ["model_realtime"] },
  },
}

function cleanText(value: unknown, defaultValue = "") {
  return typeof value === "string" && value.trim() ? value.trim() : defaultValue
}

function cleanTranscript(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((line) => line && typeof line === "object")
        .slice(-10)
        .map((line) => {
          const record = line as Record<string, unknown>

          return {
            speaker: cleanText(record.speaker, "Unknown"),
            time: cleanText(record.time),
            text: cleanText(record.text),
          }
        })
        .filter((line) => line.text)
    : []
}

function requiredText(value: unknown, message: string, code: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw upstreamFailure(message, code)
  }

  return value.trim()
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw upstreamFailure("Speaker attribution did not return confidence.", "openai_invalid_speaker_confidence")
  }

  return Math.max(0, Math.min(1, value))
}

function normalizeSpeakerLabel(value: unknown): SpeakerLabel {
  if (typeof value !== "string") {
    throw upstreamFailure("Speaker attribution did not return a speaker label.", "openai_invalid_speaker_label")
  }

  if (speakerLabels.includes(value as SpeakerLabel)) return value as SpeakerLabel

  throw upstreamFailure("Speaker attribution returned an unknown speaker label.", "openai_invalid_speaker_label")
}

function applySourceSpeakerPrior(label: SpeakerLabel, sourceHint: string): SpeakerLabel {
  if (sourceHint === "seller_mic") return "Seller"
  if (sourceHint !== "meeting_audio") return label

  if (label === "Customer 2" || label === "Customer 3") return label

  return "Customer"
}

function assertSpeakerAttributionResult(value: SpeakerAttributionResult, sourceHint: string): SpeakerAttributionResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw upstreamFailure("Speaker attribution returned an invalid shape.", "openai_invalid_speaker_attribution")
  }

  const confidence = normalizeConfidence(value.confidence)
  const source = requiredText(value.source, "Speaker attribution did not return a source.", "openai_empty_speaker_source")
  if (source !== "model_realtime") {
    throw upstreamFailure("Speaker attribution returned an invalid source.", "openai_invalid_speaker_source")
  }

  return {
    confidence,
    needsReview:
      value.needsReview === true ||
      confidence < 0.72 ||
      sourceHint === "in_person_microphone" ||
      sourceHint === "mixed_audio",
    reason: requiredText(value.reason, "Speaker attribution did not return a reason.", "openai_empty_speaker_reason"),
    speakerLabel: applySourceSpeakerPrior(normalizeSpeakerLabel(value.speakerLabel), sourceHint),
    source,
  }
}

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const payload = await readJson<SpeakerAttributionPayload>(request)
    const segmentText = cleanText(payload.segmentText)
    const sourceHint = cleanText(payload.sourceHint, "mixed_audio")

    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")
    if (!segmentText) throw badRequest("segmentText is required.", "segment_text_required")

    const { supabase, user } = await requireUser(request)
    const call = await authorizeCall(user.id, payload.callId)
    assertRateLimit({
      key: `${user.id}:${call.id}`,
      limit: 240,
      name: "speaker attribution",
      windowMs: 60 * 1000,
    })
    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, call.workspace_id)

    const attribution = assertSpeakerAttributionResult(
      await callOpenAiJson<SpeakerAttributionResult>({
        apiKey,
        model: getEnv("OPENAI_SPEAKER_ATTRIBUTION_MODEL", getEnv("OPENAI_TEXT_MODEL", "gpt-5.4-mini")),
        schema: speakerAttributionSchema,
        schemaName: "salesframe_speaker_attribution",
        system:
          "You label one transcript segment from a B2B sales call. Return only schema-valid JSON. Default to the normal two-person call: Seller and Customer. Use audio source hints, turn-taking, question/answer intent, sales wording, and recent context. sourceHint seller_mic means the computer microphone and must be Seller. sourceHint meeting_audio means shared window, tab, app, or system audio and must be the buyer side: Customer by default, or Customer 2/Customer 3 only when recent context strongly suggests a different customer-side voice. Do not label meeting_audio as Seller. sourceHint mixed_audio or in_person_microphone means one microphone is hearing everyone; still use Seller and Customer as the default labels, and use Customer 2 or Customer 3 only when a distinct additional buyer voice is strongly implied. Do not use generic Speaker 1 or Speaker 2 labels. Keep uncertain labels reviewable. Do not return Unknown unless the segment cannot be responsibly attributed from the audio source and recent context. Mark needsReview true when confidence is below 0.72, when the source is mixed_audio or in_person_microphone, when speaker identity is ambiguous, or when speakerLabel is Unknown.",
        input: JSON.stringify({
          call: {
            id: call.id,
            accountId: call.account_id,
            opportunityId: call.opportunity_id,
          },
          elapsedMs: Number.isFinite(payload.elapsedMs) ? payload.elapsedMs : null,
          recentTranscript: cleanTranscript(payload.recentTranscript),
          segmentText,
          sourceHint,
        }),
      }),
      sourceHint
    )

    return dataResponse({ attribution })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/speaker-attribution",
  method: ["POST"],
}
