import { createHmac, timingSafeEqual } from "node:crypto"

import { getEnv, requireEnv } from "./env.ts"
import { AppError } from "./http.ts"

const DISPATCH_TOLERANCE_SECONDS = 5 * 60
const BACKGROUND_PATH = "/api/internal/next-call-brief-work"
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type NextCallBriefWorkDispatch = {
  attemptId: string
  issuedAt: number
}

function dispatchMessage(payload: NextCallBriefWorkDispatch) {
  return `salesframe:next-call-brief-work:v1:${payload.issuedAt}:${payload.attemptId}`
}

function signatureFor(payload: NextCallBriefWorkDispatch) {
  return createHmac("sha256", requireEnv("OPENAI_KEY_ENCRYPTION_SECRET"))
    .update(dispatchMessage(payload))
    .digest("hex")
}

export function createNextCallBriefWorkDispatch(
  attemptId: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!uuidPattern.test(attemptId)) {
    throw new AppError("next_call_work_invalid", "Next call work was not recognized.", 400)
  }
  const payload = { attemptId, issuedAt: nowSeconds }
  return { payload, signature: `v1=${signatureFor(payload)}` }
}

export function verifyNextCallBriefWorkDispatch({
  nowSeconds = Math.floor(Date.now() / 1000),
  payload,
  signature,
}: {
  nowSeconds?: number
  payload: NextCallBriefWorkDispatch
  signature: string | null
}) {
  if (
    !payload ||
    !uuidPattern.test(payload.attemptId) ||
    !Number.isSafeInteger(payload.issuedAt) ||
    Math.abs(nowSeconds - payload.issuedAt) > DISPATCH_TOLERANCE_SECONDS
  ) {
    throw new AppError("next_call_work_unverified", "Next call work was not verified.", 401)
  }

  const receivedValue = signature?.match(/^v1=([a-f0-9]{64})$/i)?.[1]
  if (!receivedValue) {
    throw new AppError("next_call_work_unverified", "Next call work was not verified.", 401)
  }
  const expected = Buffer.from(signatureFor(payload), "hex")
  const received = Buffer.from(receivedValue, "hex")
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new AppError("next_call_work_unverified", "Next call work was not verified.", 401)
  }
  return payload
}

function internalBaseUrl() {
  const value = (getEnv("DEPLOY_PRIME_URL") || getEnv("URL")).trim()
  if (!value) throw new AppError("next_call_work_dispatch_unavailable", "Next call work needs another moment.", 503)
  const url = new URL(value)
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new AppError("next_call_work_dispatch_unavailable", "Next call work needs another moment.", 503)
  }
  return url.origin
}

export async function dispatchNextCallBriefWork(
  attemptId: string,
  options: { fetcher?: typeof fetch; nowSeconds?: number } = {}
) {
  const dispatch = createNextCallBriefWorkDispatch(attemptId, options.nowSeconds)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await (options.fetcher ?? fetch)(new URL(BACKGROUND_PATH, internalBaseUrl()), {
      body: JSON.stringify(dispatch.payload),
      headers: {
        "Content-Type": "application/json",
        "X-SalesFrame-Next-Call-Work-Signature": dispatch.signature,
      },
      method: "POST",
      signal: controller.signal,
    })
    if (!response.ok) throw new Error("dispatch rejected")
  } catch {
    throw new AppError("next_call_work_dispatch_failed", "Next call work needs another moment.", 503)
  } finally {
    clearTimeout(timeoutId)
  }
}
