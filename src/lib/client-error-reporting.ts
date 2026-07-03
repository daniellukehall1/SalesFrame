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
        eventName,
        message: getErrorMessage(error),
        metadata,
        route: typeof window !== "undefined" ? window.location.pathname : "",
        stack: getErrorStack(error),
      }),
      headers,
      method: "POST",
    })
  } catch {
    // Error reporting must never become another user-facing error.
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error

  return "Unknown client error"
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack ?? "" : ""
}
