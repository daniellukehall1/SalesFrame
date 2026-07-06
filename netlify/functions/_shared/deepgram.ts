import { AppError, logSafeEvent } from "./http"
import { getEnv } from "./env"

type DeepgramGrantResponse = {
  access_token?: string
  expires_in?: number
}

export type DeepgramGrantResult = {
  accessToken: string
  expiresIn: number
}

export const deepgramGrantUrl = "https://api.deepgram.com/v1/auth/grant"
export const deepgramListenUrl = "wss://api.deepgram.com/v2/listen"

export async function createDeepgramTemporaryToken(context: Record<string, unknown> = {}): Promise<DeepgramGrantResult> {
  const apiKey = getEnv("DEEPGRAM_API_KEY")
  if (!apiKey) {
    throw new AppError(
      "deepgram_key_missing",
      "SalesFrame transcription is not configured yet. Add the Deepgram key in Netlify.",
      503
    )
  }

  let response: Response
  try {
    response = await fetch(deepgramGrantUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    })
  } catch (error) {
    logSafeEvent("warn", "deepgram_token_network_error", {
      ...context,
      message: error instanceof Error ? error.message : String(error),
    })
    throw new AppError("deepgram_token_network_error", "Deepgram needs another moment. Try again shortly.", 502)
  }

  const payload = await response.json().catch(() => ({})) as DeepgramGrantResponse

  if (!response.ok || !payload.access_token) {
    const code = getDeepgramTokenFailureCode(response.status)
    logSafeEvent(response.status >= 500 ? "warn" : "error", "deepgram_token_grant_failed", {
      ...context,
      code,
      status: response.status,
    })
    throw new AppError(code, getDeepgramTokenFailureMessage(code), getDeepgramTokenFailureStatus(response.status))
  }

  return {
    accessToken: payload.access_token,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : 30,
  }
}

function getDeepgramTokenFailureCode(status: number) {
  if (status === 401 || status === 403) return "deepgram_auth_failed"
  if (status === 429) return "deepgram_rate_limited"
  if (status >= 500) return "deepgram_unavailable"
  return "deepgram_token_grant_failed"
}

function getDeepgramTokenFailureMessage(code: string) {
  if (code === "deepgram_auth_failed") return "SalesFrame cannot authenticate with Deepgram."
  if (code === "deepgram_rate_limited") return "Deepgram is busy right now. Wait a moment, then try again."
  if (code === "deepgram_unavailable") return "Deepgram needs another moment. Try again shortly."
  return "SalesFrame transcription needs another setup check."
}

function getDeepgramTokenFailureStatus(status: number) {
  if (status === 401 || status === 403) return 503
  if (status === 429) return 429
  if (status >= 500) return 502
  return 502
}
