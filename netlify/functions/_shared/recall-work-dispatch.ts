import { createHmac, timingSafeEqual } from "node:crypto"

import { getEnv, requireEnv } from "./env.ts"
import { AppError } from "./http.ts"

const DISPATCH_TOLERANCE_SECONDS = 5 * 60
const RECALL_WORK_BACKGROUND_PATH = "/api/internal/recall-work"
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type RecallWorkRequest =
  | { kind: "provision_session"; sessionId: string }
  | { kind: "scheduled_sweep" }
  | { kind: "webhook_event"; region: string; webhookId: string }
export type RecallWorkDispatch = RecallWorkRequest & { issuedAt: number }

function serializeDispatch(payload: RecallWorkDispatch) {
  return JSON.stringify(payload)
}

function signDispatch(payload: RecallWorkDispatch) {
  return createHmac("sha256", requireEnv("MEETING_BOT_CRYPTO_SECRET"))
    .update(`salesframe:recall-work:v1:${serializeDispatch(payload)}`)
    .digest("hex")
}

export function createRecallWorkDispatch(
  work: RecallWorkRequest,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const payload = { ...work, issuedAt: nowSeconds } as RecallWorkDispatch
  assertRecallWorkDispatch(payload, nowSeconds)
  return { payload, signature: `v1=${signDispatch(payload)}` }
}

function assertRecallWorkDispatch(payload: RecallWorkDispatch, nowSeconds: number) {
  if (
    !payload ||
    !Number.isSafeInteger(payload.issuedAt) ||
    Math.abs(nowSeconds - payload.issuedAt) > DISPATCH_TOLERANCE_SECONDS
  ) {
    throw new AppError("recall_work_unverified", "Recall work request was not verified.", 401)
  }
  if (payload.kind === "provision_session" && !uuidPattern.test(payload.sessionId)) {
    throw new AppError("recall_work_invalid", "Recall work request was not recognized.", 400)
  }
  if (
    payload.kind === "webhook_event" &&
    (!/^[a-z0-9-]{2,32}$/.test(payload.region) ||
      !/^[A-Za-z0-9_.:-]{1,200}$/.test(payload.webhookId))
  ) {
    throw new AppError("recall_work_invalid", "Recall work request was not recognized.", 400)
  }
  if (!new Set(["provision_session", "scheduled_sweep", "webhook_event"]).has(payload.kind)) {
    throw new AppError("recall_work_invalid", "Recall work request was not recognized.", 400)
  }
}

export function verifyRecallWorkDispatch({
  nowSeconds = Math.floor(Date.now() / 1000),
  payload,
  signature,
}: {
  nowSeconds?: number
  payload: RecallWorkDispatch
  signature: string | null
}) {
  assertRecallWorkDispatch(payload, nowSeconds)
  const receivedValue = signature?.match(/^v1=([a-f0-9]{64})$/i)?.[1]
  if (!receivedValue) {
    throw new AppError("recall_work_unverified", "Recall work request was not verified.", 401)
  }
  const expected = Buffer.from(signDispatch(payload), "hex")
  const received = Buffer.from(receivedValue, "hex")
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new AppError("recall_work_unverified", "Recall work request was not verified.", 401)
  }
  return payload
}

function getInternalBaseUrl() {
  const value = (getEnv("DEPLOY_PRIME_URL") || getEnv("URL") || getEnv("RECALL_PUBLIC_BASE_URL")).trim()
  if (!value) throw new AppError("recall_work_dispatch_unavailable", "Recall work needs another moment.", 503)
  const url = new URL(value)
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new AppError("recall_work_dispatch_unavailable", "Recall work needs another moment.", 503)
  }
  return url.origin
}

export async function dispatchRecallWork(
  work: RecallWorkRequest,
  options: { fetcher?: typeof fetch; nowSeconds?: number } = {}
) {
  const dispatch = createRecallWorkDispatch(work, options.nowSeconds)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await (options.fetcher ?? fetch)(
      new URL(RECALL_WORK_BACKGROUND_PATH, getInternalBaseUrl()),
      {
        body: JSON.stringify(dispatch.payload),
        headers: {
          "Content-Type": "application/json",
          "X-SalesFrame-Recall-Work-Signature": dispatch.signature,
        },
        method: "POST",
        signal: controller.signal,
      }
    )
    if (!response.ok) throw new Error("dispatch rejected")
  } catch {
    throw new AppError("recall_work_dispatch_failed", "Recall work needs another moment.", 503)
  } finally {
    clearTimeout(timeoutId)
  }
}
