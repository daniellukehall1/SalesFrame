import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

import { requireEnv } from "./env"
import { AppError } from "./http"

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

export type EncryptedMeetingBotValue = {
  authTag: string
  ciphertext: string
  iv: string
}

function deriveKey(purpose: "encryption" | "url-fingerprint") {
  return createHmac("sha256", requireEnv("MEETING_BOT_CRYPTO_SECRET"))
    .update(`salesframe:meeting-bot:${purpose}:v1`)
    .digest()
}

function getEncryptionKey() {
  return deriveKey("encryption")
}

export function encryptMeetingBotValue(value: string): EncryptedMeetingBotValue {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])

  return {
    authTag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
  }
}

export function decryptMeetingBotValue(value: EncryptedMeetingBotValue) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(value.iv, "base64url")
  )
  decipher.setAuthTag(Buffer.from(value.authTag, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export function fingerprintMeetingUrl(value: string) {
  return createHmac("sha256", deriveKey("url-fingerprint")).update(value).digest("hex")
}

export function hashWebhookPayload(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function verifyRecallWebhook({
  nowSeconds = Math.floor(Date.now() / 1000),
  rawBody,
  request,
  secret,
}: {
  nowSeconds?: number
  rawBody: string
  request: Request
  secret: string
}) {
  const webhookId = request.headers.get("webhook-id") ?? request.headers.get("svix-id")
  const timestampValue = request.headers.get("webhook-timestamp") ?? request.headers.get("svix-timestamp")
  const signatureHeader = request.headers.get("webhook-signature") ?? request.headers.get("svix-signature")
  const timestamp = Number(timestampValue)

  const secrets = secret
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
  if (
    secrets.length === 0 ||
    secrets.some((value) => !value.startsWith("whsec_")) ||
    !webhookId ||
    !timestampValue ||
    !signatureHeader
  ) {
    throw new AppError("recall_webhook_unverified", "Webhook verification failed.", 401)
  }

  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new AppError("recall_webhook_stale", "Webhook verification failed.", 401)
  }

  const signatures = signatureHeader
    .split(" ")
    .map((versionedSignature) => versionedSignature.split(","))
    .filter(([version, signature]) => version === "v1" && Boolean(signature))
    .map(([, signature]) => signature)

  const verified = secrets.some((verificationSecret) => {
    const key = Buffer.from(verificationSecret.slice("whsec_".length), "base64")
    if (key.length < 16) return false
    const expected = createHmac("sha256", key)
      .update(`${webhookId}.${timestampValue}.${rawBody}`)
      .digest()

    return signatures.some((signature) => {
      try {
        const received = Buffer.from(signature, "base64")
        return received.length === expected.length && timingSafeEqual(received, expected)
      } catch {
        return false
      }
    })
  })

  if (!verified) {
    throw new AppError("recall_webhook_unverified", "Webhook verification failed.", 401)
  }

  return { timestamp, webhookId }
}
