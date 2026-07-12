import { createHmac, timingSafeEqual } from "node:crypto"

import { getEnv, requireEnv } from "./env.ts"
import { AppError } from "./http.ts"

const POST_CALL_DISPATCH_TOLERANCE_SECONDS = 5 * 60
const POST_CALL_BACKGROUND_PATH = "/api/internal/meeting-bot-post-call"
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type MeetingBotPostCallDispatch = {
  issuedAt: number
  sessionId: string
}

function getDispatchMessage(payload: MeetingBotPostCallDispatch) {
  return `salesframe:meeting-bot-post-call:v1:${payload.issuedAt}:${payload.sessionId}`
}

function getDispatchSignature(payload: MeetingBotPostCallDispatch) {
  return createHmac("sha256", requireEnv("MEETING_BOT_CRYPTO_SECRET"))
    .update(getDispatchMessage(payload))
    .digest("hex")
}

export function createMeetingBotPostCallDispatch(
  sessionId: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!uuidPattern.test(sessionId)) {
    throw new AppError("meeting_bot_post_call_invalid", "Post-call request was not recognized.", 400)
  }

  const payload = { issuedAt: nowSeconds, sessionId }
  return {
    payload,
    signature: `v1=${getDispatchSignature(payload)}`,
  }
}

export function verifyMeetingBotPostCallDispatch({
  nowSeconds = Math.floor(Date.now() / 1000),
  payload,
  signature,
}: {
  nowSeconds?: number
  payload: MeetingBotPostCallDispatch
  signature: string | null
}) {
  if (
    !payload ||
    !uuidPattern.test(payload.sessionId) ||
    !Number.isSafeInteger(payload.issuedAt) ||
    Math.abs(nowSeconds - payload.issuedAt) > POST_CALL_DISPATCH_TOLERANCE_SECONDS
  ) {
    throw new AppError("meeting_bot_post_call_unverified", "Post-call request was not verified.", 401)
  }

  const receivedValue = signature?.match(/^v1=([a-f0-9]{64})$/i)?.[1]
  if (!receivedValue) {
    throw new AppError("meeting_bot_post_call_unverified", "Post-call request was not verified.", 401)
  }

  const expected = Buffer.from(getDispatchSignature(payload), "hex")
  const received = Buffer.from(receivedValue, "hex")
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new AppError("meeting_bot_post_call_unverified", "Post-call request was not verified.", 401)
  }

  return payload
}

function getInternalBaseUrl() {
  const value = (
    getEnv("DEPLOY_PRIME_URL") ||
    getEnv("URL") ||
    getEnv("RECALL_PUBLIC_BASE_URL")
  ).trim()
  if (!value) {
    throw new AppError(
      "meeting_bot_post_call_dispatch_unavailable",
      "Post-call processing needs another moment.",
      503
    )
  }

  const url = new URL(value)
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new AppError(
      "meeting_bot_post_call_dispatch_unavailable",
      "Post-call processing needs another moment.",
      503
    )
  }
  return url.origin
}

export async function dispatchMeetingBotPostCall(
  sessionId: string,
  options: {
    fetcher?: typeof fetch
    nowSeconds?: number
  } = {}
) {
  const dispatch = createMeetingBotPostCallDispatch(sessionId, options.nowSeconds)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000)
  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(
      new URL(POST_CALL_BACKGROUND_PATH, getInternalBaseUrl()),
      {
        body: JSON.stringify(dispatch.payload),
        headers: {
          "Content-Type": "application/json",
          "X-SalesFrame-Post-Call-Signature": dispatch.signature,
        },
        method: "POST",
        signal: controller.signal,
      }
    )
  } catch {
    throw new AppError(
      "meeting_bot_post_call_dispatch_failed",
      "Post-call processing needs another moment.",
      503
    )
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new AppError(
      "meeting_bot_post_call_dispatch_failed",
      "Post-call processing needs another moment.",
      503
    )
  }
}
