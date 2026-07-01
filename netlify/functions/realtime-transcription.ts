import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { createRealtimeTranscriptionSession } from "./_shared/openai"
import { authorizeCall, requireUser } from "./_shared/supabase"

type RealtimePayload = {
  callId?: string
  sourceKind?: string
  transcriptionDelay?: string
}

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const payload = await readJson<RealtimePayload>(request)
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")

    const { supabase, user } = await requireUser(request)
    const call = await authorizeCall(user.id, payload.callId)

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, call.workspace_id)
    const session = await createRealtimeTranscriptionSession(apiKey, {
      sourceKind: payload.sourceKind,
      transcriptionDelay: payload.transcriptionDelay,
    })

    return dataResponse(session)
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/realtime-transcription",
  method: ["POST"],
}
