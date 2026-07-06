import type { Config, Context } from "@netlify/functions"

import { createDeepgramTemporaryToken } from "./_shared/deepgram"
import { dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
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

    await createDeepgramTemporaryToken({
      check: "health",
      userId: user.id,
    })

    return dataResponse({
      provider: "deepgram_flux",
      ready: true,
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
