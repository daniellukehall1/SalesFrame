import type { Config, Context } from "@netlify/functions"

import { createDeepgramListenUrls, createDeepgramTemporaryToken, getDeepgramFluxConfig } from "./_shared/deepgram"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, tooManyRequests } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { assertCallIsLive, authorizeCall, requireUser } from "./_shared/supabase"

type DeepgramTokenPayload = {
  callId?: string
  sourceKind?: string
}

const supportedSourceKinds = new Set([
  "meeting_audio",
  "seller_mic",
  "mixed_audio",
  "in_person_microphone",
])

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const payload = await request.json().catch(() => ({})) as DeepgramTokenPayload
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")
    if (!payload.sourceKind || !supportedSourceKinds.has(payload.sourceKind)) {
      throw badRequest("sourceKind is not recognized.", "deepgram_source_kind_invalid")
    }

    const { supabase, token: authToken, user } = await requireUser(request)
    const call = await authorizeCall(user.id, payload.callId, supabase, { token: authToken })
    assertCallIsLive(call, {
      code: "deepgram_call_not_active",
      message: "This call is no longer live. Start a new call before opening live transcript.",
    })
    assertRateLimit({
      key: `${user.id}:${call.id}`,
      limit: 40,
      name: "deepgram transcription setup",
      windowMs: 10 * 60 * 1000,
    })

    const durableQuota = await supabase.rpc("claim_deepgram_token_grant", {
      grant_limit: 40,
      target_call_id: call.id,
      target_user_id: user.id,
      target_workspace_id: call.workspace_id,
      window_seconds: 10 * 60,
    })
    if (durableQuota.error) throw new Error(durableQuota.error.message)
    if (!durableQuota.data) {
      throw tooManyRequests("That is a lot of transcription setup activity at once. Wait a moment, then try again.")
    }

    const config = getDeepgramFluxConfig()
    const deepgramToken = await createDeepgramTemporaryToken({
      callId: call.id,
      sourceKind: payload.sourceKind,
      userId: user.id,
    })
    const websocketUrls = createDeepgramListenUrls(config)
    const websocketUrl = websocketUrls[0]

    return dataResponse({
      accessToken: deepgramToken.accessToken,
      config,
      expiresIn: deepgramToken.expiresIn,
      websocketUrl,
      websocketUrls,
    })
  } catch (error) {
    return errorResponse(error, "Deepgram needs another moment. Try again shortly.", {
      functionName: "deepgram-token",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/deepgram/token",
  method: ["POST"],
}
