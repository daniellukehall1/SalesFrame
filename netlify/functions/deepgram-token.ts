import type { Config, Context } from "@netlify/functions"

import { createDeepgramListenUrls, createDeepgramTemporaryToken, getDeepgramFluxConfig } from "./_shared/deepgram"
import { badRequest, dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeCall, requireUser } from "./_shared/supabase"

type DeepgramTokenPayload = {
  callId?: string
  sourceKind?: string
}

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const payload = await request.json().catch(() => ({})) as DeepgramTokenPayload
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")

    const { token: authToken, user } = await requireUser(request)
    const call = await authorizeCall(user.id, payload.callId, undefined, { token: authToken })
    assertRateLimit({
      key: `${user.id}:${call.id}:${payload.sourceKind ?? "source"}`,
      limit: 40,
      name: "deepgram transcription setup",
      windowMs: 10 * 60 * 1000,
    })

    const config = getDeepgramFluxConfig()
    const deepgramToken = await createDeepgramTemporaryToken({
      callId: call.id,
      sourceKind: payload.sourceKind ?? "source",
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
