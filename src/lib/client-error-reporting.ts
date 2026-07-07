import { createClient } from "@/lib/supabase/client"

type ClientErrorReport = {
  eventName: string
  error?: unknown
  metadata?: Record<string, unknown>
}

let globalErrorReportingInstalled = false

export function installGlobalClientErrorReporting() {
  if (typeof window === "undefined" || globalErrorReportingInstalled) return

  globalErrorReportingInstalled = true

  window.addEventListener("error", (event) => {
    void reportClientError({
      error: event.error ?? event.message,
      eventName: "window_error",
      metadata: {
        column: event.colno,
        filename: event.filename,
        line: event.lineno,
      },
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    void reportClientError({
      error: event.reason,
      eventName: "unhandled_rejection",
    })
  })
}

export async function reportClientError({ eventName, error, metadata = {} }: ClientErrorReport) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    await fetch("/api/client-error", {
      body: JSON.stringify({
        eventName: normalizeClientErrorEventName(eventName),
        message: getSafeErrorMessage(error),
        metadata: sanitizeClientErrorMetadata(metadata),
        route: typeof window !== "undefined" ? window.location.pathname : "",
      }),
      headers,
      method: "POST",
    })
  } catch {
    // Error reporting must never become another user-facing error.
  }
}

function normalizeClientErrorEventName(value: string) {
  const normalized = value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64)

  return normalized || "client_error"
}

function getSafeErrorMessage(error: unknown) {
  const name = error instanceof Error && error.name ? error.name : "ClientError"
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  const cleaned = sanitizeDiagnosticText(message)

  if (!cleaned) return name

  return `${name}: ${cleaned}`.slice(0, 240)
}

function sanitizeClientErrorMetadata(metadata: Record<string, unknown>) {
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
