import type { Config, Context } from "@netlify/functions"

import { dataResponse, errorResponse, logSafeEvent, methodNotAllowed, readJson } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"

type ClientErrorPayload = {
  eventName?: string
  message?: string
  metadata?: Record<string, unknown>
  route?: string
}

export default async function handler(request: Request, context: Context) {
  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const payload = await readJson<ClientErrorPayload>(request)
    const rateLimitKey =
      request.headers.get("x-nf-client-connection-ip") ||
      request.headers.get("x-forwarded-for")?.split(",").at(0) ||
      request.headers.get("user-agent") ||
      "unknown"

    assertRateLimit({
      key: rateLimitKey,
      limit: 60,
      name: "client error logging",
      windowMs: 60 * 1000,
    })

    logSafeEvent("error", "salesframe_client_error", {
      eventName: normalizeClientErrorEventName(payload.eventName),
      functionName: "client-error",
      hasAuthorization: Boolean(request.headers.get("Authorization")),
      message: sanitizeClientErrorMessage(payload.message),
      metadata: sanitizeClientErrorMetadata(payload.metadata),
      requestId: context.requestId,
      route: sanitizeClientRoute(payload.route),
    })

    return dataResponse({ ok: true })
  } catch (error) {
    return errorResponse(error, undefined, {
      context,
      functionName: "client-error",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/client-error",
  method: ["POST"],
}

function normalizeClientErrorEventName(value: unknown) {
  if (typeof value !== "string") return "client_error"

  const normalized = value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64)

  return normalized || "client_error"
}

function sanitizeClientErrorMessage(value: unknown) {
  if (typeof value !== "string") return "Client error"

  const cleaned = sanitizeDiagnosticText(value)

  return cleaned || "Client error"
}

function sanitizeClientRoute(value: unknown) {
  if (typeof value !== "string") return ""

  const route = value.startsWith("/") ? value : ""

  return route.slice(0, 160)
}

function sanitizeClientErrorMetadata(value: unknown) {
  if (!value || typeof value !== "object") return {}

  const metadata = value as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  if (typeof metadata.filename === "string") {
    sanitized.filename = sanitizeDiagnosticText(metadata.filename)
  }

  if (typeof metadata.line === "number" && Number.isFinite(metadata.line)) {
    sanitized.line = metadata.line
  }

  if (typeof metadata.column === "number" && Number.isFinite(metadata.column)) {
    sanitized.column = metadata.column
  }

  if (typeof metadata.componentStack === "string") {
    sanitized.componentStack = sanitizeComponentStack(metadata.componentStack)
  }

  return sanitized
}

function sanitizeComponentStack(value: string) {
  return value
    .split("\n")
    .slice(0, 12)
    .map((line) => sanitizeDiagnosticText(line))
    .filter(Boolean)
    .join("\n")
    .slice(0, 1000)
}

function sanitizeDiagnosticText(value: string) {
  return value
    .replace(/sk-(proj-)?[A-Za-z0-9_-]{16,}/g, "[redacted-openai-key]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted-supabase-secret]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "[redacted-supabase-publishable]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-token]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500)
}
