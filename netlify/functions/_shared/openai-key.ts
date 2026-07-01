import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../../src/lib/supabase/database.types"
import { requireEnv } from "./env"
import { badRequest } from "./http"

const provider = "openai"

type SavedKeyStatus = {
  connected: boolean
  fingerprint: string | null
  keyLastFour: string | null
  maskedKey: string | null
  savedAt: string | null
}

export function getMaskedKey(value: string) {
  if (!value) return null

  return value.startsWith("sk-")
    ? `${value.slice(0, Math.min(7, value.length - 4))}...${value.slice(-4)}`
    : `...${value.slice(-4)}`
}

export function getKeyFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16).toUpperCase()
}

export function encryptOpenAiKey(value: string) {
  const secret = requireEnv("OPENAI_KEY_ENCRYPTION_SECRET")
  const key = createHash("sha256").update(secret).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":")
}

export function decryptOpenAiKey(value: string) {
  const [version, ivValue, authTagValue, ciphertextValue] = value.split(":")

  if (version !== "v1" || !ivValue || !authTagValue || !ciphertextValue) {
    throw new Error("Stored OpenAI key cannot be decrypted.")
  }

  const secret = requireEnv("OPENAI_KEY_ENCRYPTION_SECRET")
  const key = createHash("sha256").update(secret).digest()
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"))
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export async function getOpenAiKeyStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string
): Promise<SavedKeyStatus> {
  const { data, error } = await supabase
    .from("user_ai_settings")
    .select("key_fingerprint,key_last_four,openai_api_key_encrypted,updated_at")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return {
    connected: Boolean(data?.openai_api_key_encrypted),
    fingerprint: data?.key_fingerprint ?? null,
    keyLastFour: data?.key_last_four ?? null,
    maskedKey: data?.key_last_four ? `sk-...${data.key_last_four}` : null,
    savedAt: data?.updated_at ?? null,
  }
}

export async function saveOpenAiKey({
  apiKey,
  supabase,
  userId,
  workspaceId,
}: {
  apiKey: string
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) throw badRequest("OpenAI API key is required.", "openai_key_required")

  const { data, error } = await supabase
    .from("user_ai_settings")
    .upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        provider,
        openai_api_key_encrypted: encryptOpenAiKey(trimmedKey),
        key_last_four: trimmedKey.slice(-4),
        key_fingerprint: getKeyFingerprint(trimmedKey),
      },
      {
        onConflict: "workspace_id,user_id,provider",
      }
    )
    .select("key_fingerprint,key_last_four,updated_at")
    .single()

  if (error) throw new Error(error.message)

  return {
    connected: true,
    fingerprint: data.key_fingerprint,
    keyLastFour: data.key_last_four,
    maskedKey: getMaskedKey(trimmedKey),
    savedAt: data.updated_at,
  }
}

export async function removeOpenAiKey(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string
) {
  const { error } = await supabase
    .from("user_ai_settings")
    .delete()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)

  if (error) throw new Error(error.message)
}

export async function getDecryptedOpenAiKey(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string
) {
  const { data, error } = await supabase
    .from("user_ai_settings")
    .select("openai_api_key_encrypted")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.openai_api_key_encrypted) {
    throw new Error("Save an OpenAI API key in Settings before using AI workflows.")
  }

  return decryptOpenAiKey(data.openai_api_key_encrypted)
}
