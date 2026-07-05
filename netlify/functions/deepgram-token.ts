import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, upstreamFailure } from "./_shared/http"
import { getEnv, requireEnv } from "./_shared/env"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeCall, requireUser } from "./_shared/supabase"

type DeepgramTokenPayload = {
  callId?: string
  sourceKind?: string
}

type DeepgramGrantResponse = {
  access_token?: string
  expires_in?: number
}

const deepgramGrantUrl = "https://api.deepgram.com/v1/auth/grant"
const deepgramListenUrl = "wss://api.deepgram.com/v2/listen"

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const payload = await request.json().catch(() => ({})) as DeepgramTokenPayload
    if (!payload.callId) throw badRequest("callId is required.", "call_id_required")

    const { user } = await requireUser(request)
    const call = await authorizeCall(user.id, payload.callId)
    assertRateLimit({
      key: `${user.id}:${call.id}:${payload.sourceKind ?? "source"}`,
      limit: 40,
      name: "deepgram transcription setup",
      windowMs: 10 * 60 * 1000,
    })

    const config = getFluxConfig()
    const token = await createDeepgramTemporaryToken()
    const websocketUrl = createDeepgramListenUrl(config)

    return dataResponse({
      accessToken: token.accessToken,
      config,
      expiresIn: token.expiresIn,
      websocketUrl,
    })
  } catch (error) {
    return errorResponse(error, "SalesFrame needs another moment to start Deepgram live transcription. Try again in a moment.")
  }
}

export const config: Config = {
  path: "/api/deepgram/token",
  method: ["POST"],
}

async function createDeepgramTemporaryToken() {
  const response = await fetch(deepgramGrantUrl, {
    method: "POST",
    headers: {
      Authorization: `Token ${requireEnv("DEEPGRAM_API_KEY")}`,
    },
  })
  const payload = await response.json().catch(() => ({})) as DeepgramGrantResponse

  if (!response.ok || !payload.access_token) {
    throw upstreamFailure("Deepgram did not return a live transcription token.", "deepgram_token_failed")
  }

  return {
    accessToken: payload.access_token,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : 30,
  }
}

function getFluxConfig() {
  return {
    diarizeModel: "latest",
    eagerEotThreshold: getNumberEnv("DEEPGRAM_FLUX_EAGER_EOT_THRESHOLD", 0.4, 0.3, 0.9),
    encoding: "linear16",
    eotThreshold: getNumberEnv("DEEPGRAM_FLUX_EOT_THRESHOLD", 0.75, 0.5, 0.9),
    eotTimeoutMs: Math.round(getNumberEnv("DEEPGRAM_FLUX_EOT_TIMEOUT_MS", 5000, 500, 10000)),
    model: getEnv("DEEPGRAM_FLUX_MODEL", "flux-general-en"),
    sampleRate: 16000,
  }
}

function createDeepgramListenUrl(config: ReturnType<typeof getFluxConfig>) {
  const url = new URL(deepgramListenUrl)

  url.searchParams.set("model", config.model)
  url.searchParams.set("encoding", config.encoding)
  url.searchParams.set("sample_rate", String(config.sampleRate))
  url.searchParams.set("eager_eot_threshold", String(config.eagerEotThreshold))
  url.searchParams.set("eot_threshold", String(config.eotThreshold))
  url.searchParams.set("eot_timeout_ms", String(config.eotTimeoutMs))
  url.searchParams.set("diarize_model", config.diarizeModel)

  return url.toString()
}

function getNumberEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(getEnv(name, String(fallback)))
  if (!Number.isFinite(value)) return fallback

  return Math.max(min, Math.min(max, value))
}
