import { createHash, randomUUID } from "node:crypto"
import { createWriteStream } from "node:fs"
import { unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import { isIP } from "node:net"

import { getEnv, requireEnv } from "./env"
import { AppError, fetchWithTimeout } from "./http"
import type {
  RecallBot,
  RecallBotList,
  RecallMixedAudioList,
  RecallTranscriptArtifact,
  RecallTranscriptUtterance,
} from "./meeting-bot-types"

const RECALL_REQUEST_TIMEOUT_MS = 20_000
const RECALL_MEDIA_DOWNLOAD_TIMEOUT_MS = 45_000
const RECALL_IMAGE_MAX_BYTES = 1_300_000
const RECALL_AUDIO_MAX_BYTES = 128 * 1024 * 1024
const RECALL_TRANSCRIPT_MAX_BYTES = 16 * 1024 * 1024
const retryableRecallStatuses = new Set([429, 502, 503, 504, 507])
let cachedBotImage: string | null = null

function getCapacityLimit(name: string, fallback: number, maximum: number) {
  const value = getEnv(name, String(fallback)).trim()
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer.`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} is outside its safe range.`)
  }
  return parsed
}

function getBoundedMeetingBotLimit(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const value = getEnv(name, String(fallback)).trim()
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer.`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} is outside its safe range.`)
  }
  return parsed
}

export function getMeetingBotCapacityLimits() {
  const perUser = getCapacityLimit("MEETING_BOT_MAX_PER_USER", 1, 5)
  const perWorkspace = getCapacityLimit("MEETING_BOT_MAX_PER_WORKSPACE", 5, 25)
  const global = getCapacityLimit("MEETING_BOT_MAX_GLOBAL", 25, 100)
  const rateWindowMinutes = getBoundedMeetingBotLimit("MEETING_BOT_RATE_WINDOW_MINUTES", 60, 10, 1440)
  const userRollingCreationLimit = getBoundedMeetingBotLimit("MEETING_BOT_USER_ROLLING_CREATION_LIMIT", 3, 1, 50)
  const workspaceRollingCreationLimit = getBoundedMeetingBotLimit("MEETING_BOT_WORKSPACE_ROLLING_CREATION_LIMIT", 15, 1, 500)
  const userDailyBotLimit = getBoundedMeetingBotLimit("MEETING_BOT_USER_DAILY_BOT_LIMIT", 12, 1, 200)
  const workspaceDailyBotLimit = getBoundedMeetingBotLimit("MEETING_BOT_WORKSPACE_DAILY_BOT_LIMIT", 60, 1, 5000)
  const reservedBotMinutes = getBoundedMeetingBotLimit("MEETING_BOT_RESERVED_MINUTES", 120, 1, 120)
  const userDailyMinuteLimit = getBoundedMeetingBotLimit("MEETING_BOT_USER_DAILY_MINUTE_LIMIT", 480, 1, 1440)
  const workspaceDailyMinuteLimit = getBoundedMeetingBotLimit("MEETING_BOT_WORKSPACE_DAILY_MINUTE_LIMIT", 2400, 1, 100000)
  if (perUser > perWorkspace || perWorkspace > global) {
    throw new Error("Meeting bot capacity limits must increase from user to workspace to global.")
  }
  if (
    userRollingCreationLimit > workspaceRollingCreationLimit ||
    userDailyBotLimit > workspaceDailyBotLimit ||
    reservedBotMinutes > userDailyMinuteLimit ||
    userDailyMinuteLimit > workspaceDailyMinuteLimit
  ) {
    throw new Error("Meeting bot rate and usage limits must increase from user to workspace.")
  }
  return {
    global,
    perUser,
    perWorkspace,
    rateWindowMinutes,
    reservedBotMinutes,
    userDailyBotLimit,
    userDailyMinuteLimit,
    userRollingCreationLimit,
    workspaceDailyBotLimit,
    workspaceDailyMinuteLimit,
    workspaceRollingCreationLimit,
  }
}

export class RecallApiError extends Error {
  readonly ambiguous: boolean
  readonly httpStatus: number
  readonly retryAfterSeconds: number | null
  readonly retryable: boolean
  readonly safeCode: string

  constructor({
    httpStatus,
    ambiguous,
    retryAfterSeconds,
    safeCode,
  }: {
    httpStatus: number
    ambiguous?: boolean
    retryAfterSeconds?: number | null
    safeCode: string
  }) {
    super("Recall request failed.")
    this.name = "RecallApiError"
    this.ambiguous = ambiguous ?? [502, 503, 504].includes(httpStatus)
    this.httpStatus = httpStatus
    this.retryAfterSeconds = retryAfterSeconds ?? null
    this.retryable = retryableRecallStatuses.has(httpStatus)
    this.safeCode = safeCode
  }
}

export function isMeetingBotEnabled() {
  return /^(?:1|true|yes|on)$/i.test(getEnv("RECALL_MEETING_BOT_ENABLED"))
}

export function requireMeetingBotEnabled() {
  if (!isMeetingBotEnabled()) {
    throw new AppError(
      "meeting_bot_temporarily_unavailable",
      "Meeting bot is taking a short pause. Use one or two channel capture for now.",
      503
    )
  }

  const apiKey = getEnv("RECALL_API_KEY")
  const cryptoSecret = getEnv("MEETING_BOT_CRYPTO_SECRET")
  const verificationSecret = getEnv("RECALL_WORKSPACE_VERIFICATION_SECRET")
  getRecallMediaDownloadHosts()
  const verificationSecrets = verificationSecret.split(/[\s,]+/).filter(Boolean)
  if (
    !apiKey ||
    cryptoSecret.length < 32 ||
    verificationSecrets.length === 0 ||
    verificationSecrets.some((value) => !value.startsWith("whsec_"))
  ) {
    throw new AppError(
      "meeting_bot_setup_incomplete",
      "Meeting bot is still being prepared. Use one or two channel capture for now.",
      503
    )
  }
  getMeetingBotCapacityLimits()
  getPublicWebhookBaseUrl()
}

export function getRecallRegion() {
  const region = getEnv("RECALL_REGION", "us-west-2").trim().toLowerCase()
  if (region !== "us-west-2") {
    throw new Error("Recall region must be us-west-2 for this rollout.")
  }

  return region
}

function getRecallBaseUrl() {
  return `https://${getRecallRegion()}.recall.ai`
}

function getPublicWebhookBaseUrl() {
  const value = getEnv("RECALL_PUBLIC_BASE_URL") || getEnv("URL")
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error("Recall public webhook base URL is missing or invalid.")
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Recall public webhook base URL must be a canonical HTTPS origin.")
  }

  return url.origin
}

function getRecallHeaders() {
  return {
    Accept: "application/json",
    Authorization: requireEnv("RECALL_API_KEY"),
    "Content-Type": "application/json",
  }
}

function parseRetryAfter(response: Response) {
  const value = response.headers.get("retry-after")
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(120, Math.ceil(seconds))
  const date = Date.parse(value)
  if (Number.isNaN(date)) return null

  return Math.min(120, Math.max(0, Math.ceil((date - Date.now()) / 1000)))
}

async function recallJson<T>(path: string, init: RequestInit = {}, expectedStatuses = [200]) {
  let response: Response
  try {
    response = await fetchWithTimeout(
      `${getRecallBaseUrl()}${path}`,
      {
        ...init,
        headers: {
          ...getRecallHeaders(),
          ...init.headers,
        },
      },
      RECALL_REQUEST_TIMEOUT_MS
    )
  } catch (error) {
    if (error instanceof AppError && error.code === "upstream_timeout") {
      throw new RecallApiError({ ambiguous: true, httpStatus: 504, safeCode: "provider_timeout" })
    }
    throw new RecallApiError({ ambiguous: true, httpStatus: 503, safeCode: "provider_unreachable" })
  }

  if (!expectedStatuses.includes(response.status)) {
    throw new RecallApiError({
      httpStatus: response.status,
      retryAfterSeconds: parseRetryAfter(response),
      safeCode: mapRecallHttpStatus(response.status),
    })
  }

  try {
    const text = await response.text()
    return text ? JSON.parse(text) as T : undefined as T
  } catch {
    throw new RecallApiError({ ambiguous: true, httpStatus: 502, safeCode: "provider_response_invalid" })
  }
}

export function mapRecallHttpStatus(status: number) {
  if (status === 400 || status === 422) return "meeting_link_invalid"
  if (status === 401 || status === 403) return "provider_auth_failed"
  if (status === 404) return "meeting_not_found"
  if (status === 429 || status === 507) return "provider_capacity"
  if (status >= 500) return "provider_unavailable"
  return "provider_request_failed"
}

async function getSalesFrameBotImage() {
  const envImage = getEnv("RECALL_BOT_IMAGE_B64").trim()
  if (envImage) return validateBotImage(envImage)
  if (cachedBotImage) return cachedBotImage

  const baseUrl = getPublicWebhookBaseUrl()
  const configuredImageUrl = getEnv("RECALL_BOT_IMAGE_URL").trim()
  const imageUrl = new URL(configuredImageUrl || "/media/salesframe-meeting-bot.jpg", baseUrl)

  if (imageUrl.protocol !== "https:" || imageUrl.origin !== baseUrl) {
    throw new Error("Recall bot image URL must use the configured SalesFrame origin.")
  }

  const response = await fetchWithTimeout(imageUrl, { headers: { Accept: "image/jpeg" } }, 10_000)
  if (!response.ok) throw new Error("Recall bot image is unavailable.")

  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > RECALL_IMAGE_MAX_BYTES) {
    throw new Error("Recall bot image exceeds the provider size limit.")
  }

  const image = Buffer.from(await response.arrayBuffer())
  if (
    image.length === 0 ||
    image.length > RECALL_IMAGE_MAX_BYTES ||
    image[0] !== 0xff ||
    image[1] !== 0xd8 ||
    image.at(-2) !== 0xff ||
    image.at(-1) !== 0xd9
  ) {
    throw new Error("Recall bot image must be a valid JPEG under 1.3 MB.")
  }

  cachedBotImage = validateBotImage(image.toString("base64"))
  return cachedBotImage
}

function validateBotImage(value: string) {
  let image: Buffer
  try {
    image = Buffer.from(value, "base64")
  } catch {
    throw new Error("Recall bot image must be valid base64 JPEG data.")
  }
  if (
    image.length === 0 ||
    image.length > RECALL_IMAGE_MAX_BYTES ||
    image[0] !== 0xff ||
    image[1] !== 0xd8 ||
    image.at(-2) !== 0xff ||
    image.at(-1) !== 0xd9
  ) {
    throw new Error("Recall bot image must be a valid JPEG under 1.3 MB.")
  }

  return image.toString("base64")
}

export async function createRecallBot({
  correlationToken,
  meetingUrl,
}: {
  correlationToken: string
  meetingUrl: string
}) {
  const image = await getSalesFrameBotImage()
  const realtimeUrl = `${getPublicWebhookBaseUrl()}/api/recall/webhooks/realtime`

  return recallJson<RecallBot>("/api/v1/bot/", {
    body: JSON.stringify({
      automatic_leave: {
        everyone_left_timeout: { activate_after: 0, timeout: 30 },
        in_call_not_recording_timeout: 600,
        in_call_recording_timeout: 7200,
        noone_joined_timeout: 600,
        recording_permission_denied_timeout: 30,
        waiting_room_timeout: 600,
      },
      automatic_video_output: {
        in_call_not_recording: { b64_data: image, kind: "jpeg" },
        in_call_recording: { b64_data: image, kind: "jpeg" },
      },
      bot_name: "SalesFrame AI Notetaker",
      meeting_url: meetingUrl,
      metadata: { salesframe_session: correlationToken },
      recording_config: {
        audio_mixed_mp3: {},
        participant_events: {},
        realtime_endpoints: [
          {
            events: [
              "transcript.data",
              "participant_events.join",
              "participant_events.leave",
              "participant_events.update",
              "participant_events.speech_on",
              "participant_events.speech_off",
            ],
            type: "webhook",
            url: realtimeUrl,
          },
        ],
        retention: { hours: 24, type: "timed" },
        start_recording_on: "call_join",
        transcript: {
          diarization: { use_separate_streams_when_available: true },
          provider: {
            deepgram_streaming: {
              language: "en",
              mip_opt_out: true,
              model: "nova-3",
            },
          },
        },
        video_mixed_layout: "audio_only",
        video_mixed_mp4: null,
      },
    }),
    method: "POST",
  }, [201])
}

export async function retrieveRecallBot(botId: string) {
  return recallJson<RecallBot>(`/api/v1/bot/${encodeURIComponent(botId)}/`)
}

export async function listRecallBotsByCorrelationToken(correlationToken: string) {
  return recallJson<RecallBotList>(
    `/api/v1/bot/?metadata__salesframe_session=${encodeURIComponent(correlationToken)}`
  )
}

export async function leaveRecallBot(botId: string) {
  return recallJson<void>(
    `/api/v1/bot/${encodeURIComponent(botId)}/leave_call/`,
    { body: "{}", method: "POST" },
    [200, 204, 400, 404, 409]
  )
}

export async function deleteRecallBotMedia(botId: string) {
  return recallJson<void>(
    `/api/v1/bot/${encodeURIComponent(botId)}/delete_media/`,
    { body: "{}", method: "POST" },
    [200, 204, 404]
  )
}

export async function listRecallMixedAudio(recordingId: string) {
  return recallJson<RecallMixedAudioList>(
    `/api/v1/audio_mixed?recording_id=${encodeURIComponent(recordingId)}`
  )
}

function getRecallMediaDownloadHosts() {
  const hosts = requireEnv("RECALL_MEDIA_DOWNLOAD_HOSTS")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean)
  if (
    hosts.length === 0 ||
    hosts.some((host) =>
      host.includes("*") ||
      host.includes(":") ||
      host.includes("/") ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      isIP(host) !== 0 ||
      !/^[a-z0-9.-]+$/.test(host)
    )
  ) {
    throw new Error("RECALL_MEDIA_DOWNLOAD_HOSTS must contain exact public hostnames.")
  }
  return new Set(hosts)
}

function validateRecallDownloadUrl(downloadUrl: string) {
  let url: URL
  try {
    url = new URL(downloadUrl)
  } catch {
    throw new RecallApiError({ httpStatus: 502, safeCode: "media_url_invalid" })
  }

  const host = url.hostname.toLowerCase()
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(host) !== 0 ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    !getRecallMediaDownloadHosts().has(host)
  ) {
    throw new RecallApiError({ httpStatus: 502, safeCode: "media_url_invalid" })
  }
  return url
}

export async function downloadRecallAudioToTempFile(downloadUrl: string) {
  const url = validateRecallDownloadUrl(downloadUrl)
  const path = join(tmpdir(), `salesframe-recall-${randomUUID()}.mp3`)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RECALL_MEDIA_DOWNLOAD_TIMEOUT_MS)
  const hash = createHash("sha256")
  let sizeBytes = 0

  try {
    const response = await fetch(url, { redirect: "error", signal: controller.signal })
    if (!response.ok || !response.body) {
      throw new RecallApiError({ httpStatus: response.status, safeCode: "media_download_failed" })
    }
    const contentLength = Number(response.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > RECALL_AUDIO_MAX_BYTES) {
      throw new RecallApiError({ httpStatus: 413, safeCode: "media_too_large" })
    }
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        sizeBytes += bytes.length
        if (sizeBytes > RECALL_AUDIO_MAX_BYTES) {
          controller.abort()
          callback(new RecallApiError({ httpStatus: 413, safeCode: "media_too_large" }))
          return
        }
        hash.update(bytes)
        callback(null, bytes)
      },
    })
    await pipeline(Readable.fromWeb(response.body as any), meter, createWriteStream(path, { flags: "wx" }))
    if (sizeBytes === 0) throw new RecallApiError({ httpStatus: 502, safeCode: "media_empty" })
    return {
      checksum: hash.digest("hex"),
      cleanup: () => unlink(path).catch(() => undefined),
      path,
      sizeBytes,
    }
  } catch (error) {
    await unlink(path).catch(() => undefined)
    if (error instanceof RecallApiError) throw error
    throw new RecallApiError({ httpStatus: 502, safeCode: "media_download_failed" })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function downloadRecallTranscript(downloadUrl: string) {
  const url = validateRecallDownloadUrl(downloadUrl)

  const response = await fetchWithTimeout(url, { redirect: "error" }, RECALL_MEDIA_DOWNLOAD_TIMEOUT_MS)
  if (!response.ok) {
    throw new RecallApiError({ httpStatus: response.status, safeCode: "media_download_failed" })
  }

  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > RECALL_TRANSCRIPT_MAX_BYTES) {
    throw new RecallApiError({ httpStatus: 413, safeCode: "media_too_large" })
  }

  if (!response.body) {
    throw new RecallApiError({ httpStatus: 502, safeCode: "media_empty" })
  }
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > RECALL_TRANSCRIPT_MAX_BYTES) {
      await reader.cancel()
      throw new RecallApiError({ httpStatus: 413, safeCode: "media_too_large" })
    }
    chunks.push(Buffer.from(value))
  }
  if (totalBytes === 0) {
    throw new RecallApiError({ httpStatus: 502, safeCode: "media_empty" })
  }

  const bytes = Buffer.concat(chunks, totalBytes)
  let transcript: unknown
  try {
    transcript = JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new RecallApiError({ httpStatus: 502, safeCode: "transcript_artifact_invalid" })
  }
  if (!Array.isArray(transcript)) {
    throw new RecallApiError({ httpStatus: 502, safeCode: "transcript_artifact_invalid" })
  }
  return {
    checksum: createHash("sha256").update(bytes).digest("hex"),
    utterances: transcript as RecallTranscriptUtterance[],
  }
}

export async function retrieveRecallTranscript(transcriptId: string) {
  return recallJson<RecallTranscriptArtifact>(
    `/api/v1/transcript/${encodeURIComponent(transcriptId)}/`
  )
}
