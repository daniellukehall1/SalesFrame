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

export type DeepgramSocketVerificationResult = {
  host: string
  protocol: string
}

export const deepgramGrantUrl = "https://api.deepgram.com/v1/auth/grant"
export const deepgramListenUrl = "wss://api.deepgram.com/v2/listen"
const defaultDeepgramListenHosts = ["api.deepgram.com", "api.au.deepgram.com"]

type DeepgramFluxConfig = {
  diarizeModel: string
  eagerEotThreshold: number
  encoding: string
  eotThreshold: number
  eotTimeoutMs: number
  model: string
  sampleRate: number
}

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

export function getDeepgramFluxConfig() {
  return {
    diarizeModel: getEnv("DEEPGRAM_DIARIZE_MODEL", "latest").trim(),
    eagerEotThreshold: getNumberEnv("DEEPGRAM_FLUX_EAGER_EOT_THRESHOLD", 0.4, 0.3, 0.9),
    encoding: "linear16",
    eotThreshold: getNumberEnv("DEEPGRAM_FLUX_EOT_THRESHOLD", 0.75, 0.5, 0.9),
    eotTimeoutMs: Math.round(getNumberEnv("DEEPGRAM_FLUX_EOT_TIMEOUT_MS", 5000, 500, 10000)),
    model: getEnv("DEEPGRAM_FLUX_MODEL", "flux-general-en"),
    sampleRate: 16000,
  }
}

export function createDeepgramListenUrls(config: DeepgramFluxConfig) {
  return getDeepgramListenHosts().map((host) => {
    const url = new URL(`wss://${host}/v2/listen`)

    url.searchParams.set("model", config.model)
    url.searchParams.set("encoding", config.encoding)
    url.searchParams.set("sample_rate", String(config.sampleRate))
    url.searchParams.set("eager_eot_threshold", String(config.eagerEotThreshold))
    url.searchParams.set("eot_threshold", String(config.eotThreshold))
    url.searchParams.set("eot_timeout_ms", String(config.eotTimeoutMs))
    if (config.diarizeModel && !config.model.startsWith("flux-")) {
      url.searchParams.set("diarize_model", config.diarizeModel)
    }

    return url.toString()
  })
}

export async function verifyDeepgramListenSocket(
  config: DeepgramFluxConfig,
  accessToken: string
): Promise<DeepgramSocketVerificationResult> {
  const WebSocketCtor = globalThis.WebSocket
  if (!WebSocketCtor) {
    throw new AppError("deepgram_socket_unavailable", "Deepgram socket verification is not available in this runtime.", 503)
  }

  const failures: string[] = []

  for (const websocketUrl of createDeepgramListenUrls(config)) {
    for (const protocols of getDeepgramAuthProtocolAttempts(accessToken)) {
      let socket: WebSocket | null = null
      try {
        socket = new WebSocketCtor(websocketUrl, protocols)
        await waitForSocketOpen(socket)
        socket.close(1000, "health_check")

        return {
          host: new URL(websocketUrl).host,
          protocol: protocols[0],
        }
      } catch (error) {
        failures.push(`${getDeepgramSocketHost(websocketUrl)} ${protocols[0]}: ${getErrorMessage(error)}`)
        try {
          socket?.close()
        } catch {
          // The socket may already be closed after a failed handshake.
        }
      }
    }
  }

  logSafeEvent("error", "deepgram_socket_verification_failed", {
    attempts: failures,
  })
  throw new AppError(
    "deepgram_socket_failed",
    "Deepgram accepted the key, but the live transcript socket did not open.",
    503
  )
}

function getDeepgramAuthProtocolAttempts(accessToken: string) {
  return [["bearer", accessToken]]
}

function waitForSocketOpen(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error("socket open timeout"))
    }, 7000)
    const cleanup = () => {
      clearTimeout(timeoutId)
      socket.removeEventListener("open", handleOpen)
      socket.removeEventListener("close", handleClose)
      socket.removeEventListener("error", handleError)
    }
    const handleOpen = () => {
      cleanup()
      resolve()
    }
    const handleClose = (event: CloseEvent) => {
      cleanup()
      reject(new Error(`closed ${event.code} ${event.reason}`.trim()))
    }
    const handleError = () => {
      cleanup()
      reject(new Error("socket error"))
    }

    socket.addEventListener("open", handleOpen)
    socket.addEventListener("close", handleClose)
    socket.addEventListener("error", handleError)
  })
}

function getDeepgramSocketHost(websocketUrl: string) {
  try {
    return new URL(websocketUrl).host
  } catch {
    return "deepgram"
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error.trim()) return error

  return "unknown"
}

function getDeepgramListenHosts() {
  const hosts = getEnv("DEEPGRAM_LISTEN_HOSTS", defaultDeepgramListenHosts.join(","))
    .split(",")
    .map(normalizeDeepgramListenHost)
    .filter((host): host is string => Boolean(host))

  const uniqueHosts = Array.from(new Set(hosts))

  return uniqueHosts.length > 0 ? uniqueHosts : defaultDeepgramListenHosts
}

function normalizeDeepgramListenHost(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `wss://${trimmed}`)
    return url.host
  } catch {
    return ""
  }
}

function getNumberEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(getEnv(name, String(fallback)))
  if (!Number.isFinite(value)) return fallback

  return Math.max(min, Math.min(max, value))
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
