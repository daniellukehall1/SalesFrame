import type { Config, Context } from "@netlify/functions"

import {
  createDeepgramTemporaryToken,
  getDeepgramFluxConfig,
  verifyDeepgramListenSocket,
} from "./_shared/deepgram"
import { dataResponse, errorResponse, logSafeEvent, methodNotAllowed } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { requireUser } from "./_shared/supabase"

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()

    const { user } = await requireUser(request)
    assertRateLimit({
      key: `${user.id}:deepgram-health`,
      limit: 20,
      name: "deepgram health",
      windowMs: 10 * 60 * 1000,
    })

    const token = await createDeepgramTemporaryToken({
      check: "health",
      userId: user.id,
    })
    const shouldVerifySocket = new URL(request.url).searchParams.get("socket") === "1"
    const socket = shouldVerifySocket
      ? await verifyDeepgramListenSocket(getDeepgramFluxConfig(), token.accessToken)
      : null

    logSafeEvent("info", "deepgram_health_ready", {
      socketHost: socket?.host ?? "",
      socketProtocol: socket?.protocol ?? "",
      userId: user.id,
    })

    return dataResponse({
      provider: "deepgram_flux",
      ready: true,
      ...(socket ? { socket } : {}),
    })
  } catch (error) {
    return errorResponse(error, "Deepgram needs another moment. Try again shortly.", {
      functionName: "deepgram-health",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/deepgram/health",
  method: ["GET"],
}
