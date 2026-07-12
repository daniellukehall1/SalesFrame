import type { Config, Context } from "@netlify/functions"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../src/lib/supabase/database.types"
import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { runMeetingBotPostCallGeneration } from "./_shared/meeting-bot-post-call"
import { findLatestMeetingBotSessionForCall } from "./_shared/meeting-bot-store"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeCall, requireUser } from "./_shared/supabase"

type PostCallPayload = {
  callId?: string
}

export type PostCallResult = {
  followUpEmail: string
  nextCallPlan: string
  accountUpdates: Record<string, string>
  opportunityUpdates: Record<string, string>
  missingInfo: string[]
  evidenceUpdates: {
    confidence: number
    framework: string
    label: string
    status: "missing" | "asked" | "weak" | "confirmed"
    summary: string
    value: string
  }[]
  nextCallBrief: {
    objective: string
    suggestedOpening: string
    focusQuestions: string[]
    missingEvidence: string[]
    riskNotes: string[]
    recommendedNextStep: string
  }
}

type SpeakerCorrection = {
  confidence: number
  reason: string
  segmentId: string
  speakerLabel: "Seller" | "Customer" | "Customer 2" | "Customer 3" | "Unknown"
}

type SpeakerCorrectionResult = {
  corrections: SpeakerCorrection[]
}

const speakerCorrectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["corrections"],
  properties: {
    corrections: {
      type: "array",
      maxItems: 120,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["segmentId", "speakerLabel", "confidence", "reason"],
        properties: {
          segmentId: { type: "string" },
          speakerLabel: { type: "string", enum: ["Seller", "Customer", "Customer 2", "Customer 3", "Unknown"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
      },
    },
  },
}
const postCallOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["followUpEmail", "nextCallPlan", "accountUpdates", "opportunityUpdates", "missingInfo", "evidenceUpdates", "nextCallBrief"],
  properties: {
    followUpEmail: { type: "string" },
    nextCallPlan: { type: "string" },
    accountUpdates: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "notes", "nextBestUpdate"],
      properties: {
        summary: { type: "string" },
        notes: { type: "string" },
        nextBestUpdate: { type: "string" },
      },
    },
    opportunityUpdates: {
      type: "object",
      additionalProperties: false,
      required: ["stage", "amount", "closeDate", "nextStep", "risk"],
      properties: {
        stage: { type: "string" },
        amount: { type: "string" },
        closeDate: { type: "string" },
        nextStep: { type: "string" },
        risk: { type: "string" },
      },
    },
    missingInfo: {
      type: "array",
      items: { type: "string" },
    },
    evidenceUpdates: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "framework", "status", "confidence", "summary", "value"],
        properties: {
          label: { type: "string" },
          framework: { type: "string" },
          status: { type: "string", enum: ["missing", "asked", "weak", "confirmed"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          summary: { type: "string" },
          value: { type: "string" },
        },
      },
    },
    nextCallBrief: {
      type: "object",
      additionalProperties: false,
      required: ["objective", "suggestedOpening", "focusQuestions", "missingEvidence", "riskNotes", "recommendedNextStep"],
      properties: {
        objective: { type: "string" },
        suggestedOpening: { type: "string" },
        focusQuestions: {
          type: "array",
          minItems: 1,
          items: { type: "string" },
        },
        missingEvidence: {
          type: "array",
          items: { type: "string" },
        },
        riskNotes: {
          type: "array",
          items: { type: "string" },
        },
        recommendedNextStep: { type: "string" },
      },
    },
  },
}

function requiredText(value: unknown, message: string, code: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw upstreamFailure(message, code)
  }

  return value.trim()
}

function requiredStringArray(value: unknown, message: string, code: string, minItems = 0) {
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : []

  if (items.length < minItems) {
    throw upstreamFailure(message, code)
  }

  return items
}

function stringRecord(value: unknown, message: string, code: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw upstreamFailure(message, code)
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key.trim(), typeof item === "string" ? item.trim() : ""] as const)
      .filter(([key, item]) => key && item)
  )
}

function requiredConfidence(value: unknown, message: string, code: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw upstreamFailure(message, code)
  }

  return Math.max(0, Math.min(1, value))
}

function requiredEvidenceStatus(value: unknown, message: string, code: string): "missing" | "asked" | "weak" | "confirmed" {
  if (value === "missing" || value === "asked" || value === "weak" || value === "confirmed") return value

  throw upstreamFailure(message, code)
}

function assertPostCallResult(value: unknown): PostCallResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

  if (
    !record ||
    typeof record.followUpEmail !== "string" ||
    typeof record.nextCallPlan !== "string" ||
    !record.nextCallBrief ||
    typeof record.nextCallBrief !== "object" ||
    Array.isArray(record.nextCallBrief)
  ) {
    throw upstreamFailure("Post-call output returned an invalid shape.", "openai_invalid_post_call_output")
  }

  const nextCallBrief = record.nextCallBrief as Record<string, unknown>
  if (!Array.isArray(record.evidenceUpdates)) {
    throw upstreamFailure("Post-call output did not return evidence updates.", "openai_invalid_post_call_evidence_updates")
  }

  return {
    followUpEmail: requiredText(record.followUpEmail, "Post-call output did not return a follow-up email.", "openai_empty_follow_up_email"),
    nextCallPlan: requiredText(record.nextCallPlan, "Post-call output did not return a next-call plan.", "openai_empty_next_call_plan"),
    accountUpdates: stringRecord(record.accountUpdates, "Post-call output did not return account updates.", "openai_invalid_account_updates"),
    opportunityUpdates: stringRecord(record.opportunityUpdates, "Post-call output did not return opportunity updates.", "openai_invalid_opportunity_updates"),
    missingInfo: requiredStringArray(record.missingInfo, "Post-call output returned invalid missing info.", "openai_invalid_missing_info"),
    evidenceUpdates: record.evidenceUpdates
      .slice(0, 12).map((item, index) => {
          const update = item && typeof item === "object" && !Array.isArray(item)
            ? item as Record<string, unknown>
            : null

          if (!update) {
            throw upstreamFailure(`Post-call evidence update ${index + 1} was invalid.`, "openai_invalid_post_call_evidence_update")
          }

          return {
            label: requiredText(update.label, `Post-call evidence update ${index + 1} did not return a label.`, "openai_empty_post_call_evidence_label"),
            framework: requiredText(update.framework, `Post-call evidence update ${index + 1} did not return a framework.`, "openai_empty_post_call_evidence_framework"),
            status: requiredEvidenceStatus(update.status, `Post-call evidence update ${index + 1} returned invalid status.`, "openai_invalid_post_call_evidence_status"),
            confidence: requiredConfidence(update.confidence, `Post-call evidence update ${index + 1} did not return confidence.`, "openai_invalid_post_call_evidence_confidence"),
            summary: requiredText(update.summary, `Post-call evidence update ${index + 1} did not return a summary.`, "openai_empty_post_call_evidence_summary"),
            value: typeof update.value === "string" ? update.value.trim() : "",
          }
        }),
    nextCallBrief: {
      objective: requiredText(nextCallBrief.objective, "Post-call output did not return a next-call objective.", "openai_empty_next_call_objective"),
      suggestedOpening: requiredText(nextCallBrief.suggestedOpening, "Post-call output did not return a suggested opening.", "openai_empty_next_call_opening"),
      focusQuestions: requiredStringArray(nextCallBrief.focusQuestions, "Post-call output did not return focus questions.", "openai_empty_focus_questions", 1),
      missingEvidence: requiredStringArray(nextCallBrief.missingEvidence, "Post-call output returned invalid missing evidence.", "openai_invalid_missing_evidence"),
      riskNotes: requiredStringArray(nextCallBrief.riskNotes, "Post-call output returned invalid risk notes.", "openai_invalid_risk_notes"),
      recommendedNextStep: requiredText(nextCallBrief.recommendedNextStep, "Post-call output did not return a recommended next step.", "openai_empty_next_step"),
    },
  }
}

function normalizeSpeakerLabel(value: string) {
  if (value === "Seller" || value === "Customer" || value === "Customer 2" || value === "Customer 3" || value === "Unknown") {
    return value
  }

  throw upstreamFailure("Speaker correction returned an invalid label.", "openai_invalid_speaker_correction_label")
}

function speakerRoleForLabel(value: string) {
  if (value === "Seller") return "seller"
  if (value === "Customer 2") return "customer_2"
  if (value === "Customer 3") return "customer_3"
  if (value === "Unknown") return "unknown"

  return "customer"
}

function normalizeKey(value: unknown) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : ""
}

function nestedPlaybookName(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ""

  const playbooks = (value as Record<string, unknown>).playbooks
  if (!playbooks || typeof playbooks !== "object" || Array.isArray(playbooks)) return ""

  const name = (playbooks as Record<string, unknown>).name
  return typeof name === "string" ? name : ""
}

async function persistPostCallEvidenceUpdates({
  call,
  callPlaybooks,
  playbookFields,
  result,
  supabase,
}: {
  call: { id: string; opportunity_id: string }
  callPlaybooks: Record<string, unknown>[]
  playbookFields: Record<string, unknown>[]
  result: PostCallResult
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]
}) {
  const playbookNameById = new Map(
    callPlaybooks.flatMap((row) => {
      const id = typeof row.playbook_id === "string" ? row.playbook_id : ""
      const name = normalizeKey(nestedPlaybookName(row))
      return id && name ? [[id, name]] : []
    })
  )
  const fieldsByLabel = new Map<string, Record<string, unknown>[]>()

  playbookFields.forEach((field) => {
    const key = normalizeKey(field.label)
    if (!key) return
    fieldsByLabel.set(key, [...(fieldsByLabel.get(key) ?? []), field])
  })

  for (const update of result.evidenceUpdates) {
    const candidateFields = fieldsByLabel.get(normalizeKey(update.label)) ?? []
    const frameworkKey = normalizeKey(update.framework)
    const matchingField =
      candidateFields.find((field) => playbookNameById.get(typeof field.playbook_id === "string" ? field.playbook_id : "") === frameworkKey) ??
      candidateFields[0]
    const playbookFieldId = typeof matchingField?.id === "string" ? matchingField.id : ""
    if (!playbookFieldId) continue

    const { error } = await supabase
      .from("opportunity_field_evidence")
      .upsert(
        {
          opportunity_id: call.opportunity_id,
          playbook_field_id: playbookFieldId,
          status: update.status,
          value: update.value || null,
          evidence_summary: update.summary,
          confidence: update.confidence,
          source: "post_call_correction",
          source_call_id: call.id,
        },
        { onConflict: "opportunity_id,playbook_field_id" }
      )

    if (error) throw new Error(error.message)
  }
}

function getSpeakerNameById(speakers: { id: string; display_name: string | null; label: string }[]) {
  return new Map(speakers.map((speaker) => [speaker.id, speaker.display_name || speaker.label]))
}

function assertSpeakerCorrectionResult(value: SpeakerCorrectionResult): SpeakerCorrectionResult {
  if (!value || typeof value !== "object" || !Array.isArray(value.corrections)) {
    throw upstreamFailure("Speaker correction returned an invalid shape.", "openai_invalid_speaker_correction")
  }

  return {
    corrections: value.corrections.slice(0, 120).map((correction) => {
      if (!correction || typeof correction !== "object") {
        throw upstreamFailure("Speaker correction returned an invalid correction.", "openai_invalid_speaker_correction_item")
      }

      return {
        confidence:
          typeof correction.confidence === "number" && Number.isFinite(correction.confidence)
            ? Math.max(0, Math.min(1, correction.confidence))
            : (() => {
                throw upstreamFailure("Speaker correction did not return confidence.", "openai_invalid_speaker_correction_confidence")
              })(),
        reason: requiredText(correction.reason, "Speaker correction did not return a reason.", "openai_empty_speaker_correction_reason"),
        segmentId: requiredText(correction.segmentId, "Speaker correction did not return a segment id.", "openai_empty_speaker_correction_segment"),
        speakerLabel: normalizeSpeakerLabel(correction.speakerLabel),
      }
    }),
  }
}

export async function generatePostCallOutputs({
  apiKey,
  callId,
  sourceMeetingBotSessionId = null,
  supabase,
}: {
  apiKey: string
  callId: string
  sourceMeetingBotSessionId?: string | null
  supabase: SupabaseClient<Database>
}) {
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .single()

    if (callError) throw new Error(callError.message)

    await supabase.from("calls").update({ status: "processing" }).eq("id", call.id)

    const [
      { data: account, error: accountError },
      { data: opportunity, error: opportunityError },
      { data: transcriptSegments, error: transcriptError },
      { data: callSpeakers, error: speakerError },
      { data: notes, error: notesError },
      { data: callPlaybooks, error: playbookError },
      { data: liveGuidanceEvents, error: guidanceError },
    ] = await Promise.all([
      supabase.from("accounts").select("*").eq("id", call.account_id).single(),
      supabase.from("opportunities").select("*").eq("id", call.opportunity_id).single(),
      supabase
        .from("transcript_segments")
        .select("id,speaker_id,text,start_ms,end_ms,is_final,speaker_attribution,speaker_confidence,speaker_needs_review,speaker_source")
        .eq("call_id", call.id)
        .order("start_ms", { ascending: true }),
      supabase.from("call_speakers").select("id,label,display_name,role").eq("call_id", call.id),
      supabase.from("call_notes").select("note_type,text").eq("call_id", call.id).order("created_at", { ascending: true }),
      supabase.from("call_playbooks").select("playbook_id, playbooks(name)").eq("call_id", call.id),
      supabase
        .from("live_guidance_events")
        .select("recommended_question,reason,conversation_state,conversation_flow,created_at")
        .eq("call_id", call.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ])

    if (accountError) throw new Error(accountError.message)
    if (opportunityError) throw new Error(opportunityError.message)
    if (transcriptError) throw new Error(transcriptError.message)
    if (speakerError) throw new Error(speakerError.message)
    if (notesError) throw new Error(notesError.message)
    if (playbookError) throw new Error(playbookError.message)
    if (guidanceError) throw new Error(guidanceError.message)

    const playbookIds = (callPlaybooks ?? [])
      .map((row) => row.playbook_id)
      .filter((id): id is string => typeof id === "string")
    const playbookFieldResponse = playbookIds.length
      ? await supabase
          .from("playbook_fields")
          .select("*")
          .in("playbook_id", playbookIds)
          .order("sort_order", { ascending: true })
      : { data: [], error: null }

    if (playbookFieldResponse.error) throw new Error(playbookFieldResponse.error.message)

    const speakerById = getSpeakerNameById(callSpeakers ?? [])
    let correctedTranscriptSegments = (transcriptSegments ?? []).map((segment) => ({
      ...segment,
      speaker: segment.speaker_id ? speakerById.get(segment.speaker_id) ?? "Unknown" : "Unknown",
    }))
    let canonicalResult: PostCallResult | null = null
    if (sourceMeetingBotSessionId) {
      const { data: canonicalOutput, error: canonicalError } = await supabase
        .from("post_call_outputs")
        .select("*")
        .eq("source_meeting_bot_session_id", sourceMeetingBotSessionId)
        .maybeSingle()
      if (canonicalError) throw new Error(canonicalError.message)
      const storedResult = (canonicalOutput as Record<string, unknown> | null)?.generation_result
      if (storedResult) canonicalResult = assertPostCallResult(storedResult as PostCallResult)
    }

    if (!canonicalResult && correctedTranscriptSegments.length > 0) {
      const correctionResult = assertSpeakerCorrectionResult(
        await callOpenAiJson<SpeakerCorrectionResult>({
          apiKey,
          model: getEnv("OPENAI_SPEAKER_ATTRIBUTION_MODEL", getEnv("OPENAI_TEXT_MODEL", "gpt-5.4-mini")),
          schema: speakerCorrectionSchema,
          schemaName: "salesframe_speaker_correction",
          system:
            "You are SalesFrame's post-call speaker diarization corrector. Return only schema-valid JSON. Review the full transcript, source hints, current labels, turn-taking, sales questions, buyer answers, and speaker continuity. Correct labels to Seller, Customer, Customer 2, Customer 3, or Unknown. Preserve manual labels unless they are impossible. Use Customer 2/Customer 3 only when there is clear evidence of separate customer voices. Use Unknown only when the full transcript still does not support responsible attribution. Do not rewrite transcript text.",
          input: JSON.stringify({
            account,
            opportunity,
            call,
            transcript: correctedTranscriptSegments.map((segment) => ({
              currentSpeaker: segment.speaker,
              endMs: segment.end_ms,
              segmentId: segment.id,
              source: segment.speaker_source,
              startMs: segment.start_ms,
              text: segment.text,
            })),
          }),
        })
      )

      for (const correction of correctionResult.corrections) {
        const existing = correctedTranscriptSegments.find((segment) => segment.id === correction.segmentId)
        if (!existing || existing.speaker_attribution === "manual") continue

        const speakerLabel = normalizeSpeakerLabel(correction.speakerLabel)
        const { data: speaker, error: correctionSpeakerError } = await supabase
          .from("call_speakers")
          .upsert(
            {
              call_id: call.id,
              display_name: speakerLabel,
              label: speakerLabel,
              role: speakerRoleForLabel(speakerLabel),
            },
            { onConflict: "call_id,label" }
          )
          .select("id,label,display_name")
          .single()

        if (correctionSpeakerError) throw new Error(correctionSpeakerError.message)

        const { error: segmentUpdateError } = await supabase
          .from("transcript_segments")
          .update({
            speaker_attribution: "post_call_correction",
            speaker_attribution_reason: correction.reason,
            speaker_confidence: correction.confidence,
            speaker_id: speaker.id,
            speaker_needs_review: correction.confidence < 0.72 || speakerLabel === "Unknown",
          })
          .eq("id", correction.segmentId)

        if (segmentUpdateError) throw new Error(segmentUpdateError.message)

        correctedTranscriptSegments = correctedTranscriptSegments.map((segment) =>
          segment.id === correction.segmentId
            ? {
                ...segment,
                speaker: speaker.display_name || speaker.label,
                speaker_attribution: "post_call_correction",
                speaker_confidence: correction.confidence,
                speaker_needs_review: correction.confidence < 0.72 || speakerLabel === "Unknown",
              }
            : segment
        )
      }
    }

    const result = canonicalResult ?? assertPostCallResult(
      await callOpenAiJson<PostCallResult>({
        apiKey,
        schema: postCallOutputSchema,
        schemaName: "salesframe_post_call_outputs",
        system:
          "You are SalesFrame's post-call analyst. Return only valid JSON. Use strict sales methodology evidence. Do not invent customer facts. Mark missing information clearly instead of guessing. Use live guidance lifecycle and parkedIntents to distinguish information that was missed from information that was intentionally parked because the conversation moved on. The next-call brief should recover high-value parked or revisit_before_close intents naturally, without making the seller sound like a checklist.",
        input: JSON.stringify({
          account,
          opportunity,
          call,
          playbooks: callPlaybooks,
          transcript: correctedTranscriptSegments,
          notes,
          liveGuidanceEvents,
          requiredJsonShape: {
            followUpEmail: "Ready-to-send concise follow-up email.",
            nextCallPlan: "Seller-facing next-call plan.",
            accountUpdates: { fieldName: "suggested value" },
            opportunityUpdates: { fieldName: "suggested value" },
            missingInfo: ["missing methodology evidence"],
            evidenceUpdates: [
              {
                label: "Methodology field label",
                framework: "Selected playbook name",
                status: "confirmed | asked | weak | missing",
                confidence: 0.82,
                summary: "Customer-sourced evidence summary",
                value: "Short captured value when available",
              },
            ],
            nextCallBrief: {
              objective: "One sentence objective",
              suggestedOpening: "Suggested opening talk track",
              focusQuestions: ["question"],
              missingEvidence: ["gap"],
              riskNotes: ["risk"],
              recommendedNextStep: "Next commitment",
            },
          },
        }),
      })
    )

    const postCallOutputValues = {
      call_id: call.id,
      follow_up_email: result.followUpEmail,
      next_call_plan: result.nextCallPlan,
      account_updates: result.accountUpdates,
      opportunity_updates: result.opportunityUpdates,
      missing_info: result.missingInfo,
      ...(sourceMeetingBotSessionId ? { generation_result: result } : {}),
      ...(sourceMeetingBotSessionId
        ? { source_meeting_bot_session_id: sourceMeetingBotSessionId }
        : {}),
    }
    const outputWrite = sourceMeetingBotSessionId
      ? (supabase as any)
          .from("post_call_outputs")
          .upsert(postCallOutputValues, { onConflict: "source_meeting_bot_session_id" })
      : (supabase as any).from("post_call_outputs").insert(postCallOutputValues)
    const { data: postCallOutput, error: outputError } = await outputWrite
      .select("*")
      .single()

    if (outputError) throw new Error(outputError.message)

    await persistPostCallEvidenceUpdates({
      call,
      callPlaybooks: (callPlaybooks ?? []) as Record<string, unknown>[],
      playbookFields: (playbookFieldResponse.data ?? []) as Record<string, unknown>[],
      result,
      supabase,
    })

    const nextCallBriefValues = {
      opportunity_id: call.opportunity_id,
      previous_call_id: call.id,
      objective: result.nextCallBrief.objective,
      suggested_opening: result.nextCallBrief.suggestedOpening,
      focus_questions: result.nextCallBrief.focusQuestions,
      missing_evidence: result.nextCallBrief.missingEvidence,
      risk_notes: result.nextCallBrief.riskNotes,
      recommended_next_step: result.nextCallBrief.recommendedNextStep,
      ...(sourceMeetingBotSessionId
        ? { source_meeting_bot_session_id: sourceMeetingBotSessionId }
        : {}),
    }
    const briefWrite = sourceMeetingBotSessionId
      ? supabase
          .from("next_call_briefs")
          .upsert(nextCallBriefValues, { onConflict: "source_meeting_bot_session_id" })
      : supabase.from("next_call_briefs").insert(nextCallBriefValues)
    const { data: nextCallBrief, error: briefError } = await briefWrite
      .select("*")
      .single()

    if (briefError) throw new Error(briefError.message)

    await supabase.from("calls").update({ status: "post_call_draft" }).eq("id", call.id)

    return {
      nextCallBrief,
      postCallOutput,
      result,
    }
}

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const payload = await readJson<PostCallPayload>(request)
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")

    const { supabase, token, user } = await requireUser(request)
    const authorizedCall = await authorizeCall(user.id, payload.callId, supabase, { token })
    assertRateLimit({
      key: `${user.id}:${authorizedCall.id}`,
      limit: 10,
      name: "post-call generation",
      windowMs: 10 * 60 * 1000,
    })

    const { data: captureCall, error: captureCallError } = await supabase
      .from("calls")
      .select("capture_method")
      .eq("id", payload.callId)
      .eq("workspace_id", authorizedCall.workspace_id)
      .single()
    if (captureCallError) throw new Error(captureCallError.message)
    const meetingBotSession = captureCall.capture_method === "recall_meeting_bot"
      ? await findLatestMeetingBotSessionForCall(supabase, payload.callId)
      : null
    const meetingBotSessionId = meetingBotSession?.id ?? null

    if (meetingBotSessionId) {
      const generated = await runMeetingBotPostCallGeneration({
        apiKeyUserId: user.id,
        forceRetry: true,
        generateOutputs: generatePostCallOutputs,
        sessionId: meetingBotSessionId,
        supabase,
        workerId: `manual:${user.id}:${payload.callId}`,
      })
      if (!generated.output) {
        throw upstreamFailure(
          "The meeting recording is still being prepared. Try the post-call brief again shortly.",
          "meeting_bot_post_call_not_ready"
        )
      }
      return dataResponse(generated.output)
    }

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, authorizedCall.workspace_id)
    const output = await generatePostCallOutputs({
      apiKey,
      callId: payload.callId,
      supabase,
    })
    return dataResponse(output)
  } catch (error) {
    return errorResponse(error, undefined, {
      functionName: "post-call-outputs",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/openai/post-call-outputs",
  method: ["POST"],
}
