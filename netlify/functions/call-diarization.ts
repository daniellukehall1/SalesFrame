import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { transcribeDiarizedAudio } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { authorizeCall, requireUser } from "./_shared/supabase"

const maxChunkSizeBytes = 6 * 1024 * 1024

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const formData = await request.formData()
    const callId = getFormString(formData, "callId")
    const chunkStartedAtMs = Number(getFormString(formData, "chunkStartedAtMs") || "0")
    const sourceHint = getFormString(formData, "sourceHint") || "mixed_audio"
    const audio = formData.get("audio")

    if (!callId) throw badRequest("callId is required.", "call_id_required")
    if (!(audio instanceof Blob)) throw badRequest("audio is required.", "audio_required")
    if (audio.size <= 0) throw badRequest("audio is empty.", "audio_empty")
    if (audio.size > maxChunkSizeBytes) throw badRequest("audio chunk is too large.", "audio_chunk_too_large")

    const { supabase, user } = await requireUser(request)
    const call = await authorizeCall(user.id, callId)

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, call.workspace_id)
    const diarized = await transcribeDiarizedAudio({
      apiKey,
      audio,
      filename: audio instanceof File ? audio.name : `salesframe-${callId}.webm`,
      mimeType: audio.type,
    })

    return dataResponse({
      chunkStartedAtMs: Number.isFinite(chunkStartedAtMs) ? Math.max(0, Math.round(chunkStartedAtMs)) : 0,
      sourceHint,
      segments: diarized.segments,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === "string" ? value.trim() : ""
}

export const config: Config = {
  path: "/api/openai/call-diarization",
  method: ["POST"],
}
