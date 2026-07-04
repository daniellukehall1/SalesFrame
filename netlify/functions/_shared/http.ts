export class AppError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 500) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
  }
}

type ErrorResponseOptions = {
  context?: {
    requestId?: string
  }
  functionName?: string
  metadata?: Record<string, unknown>
  request?: Request
}

type LogLevel = "error" | "info" | "warn"

export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      ...headers,
    },
  })
}

export function dataResponse(data: unknown, status = 200) {
  return jsonResponse({ data }, status)
}

export function errorResponse(
  error: unknown,
  defaultMessage = "SalesFrame needs another moment with that request. Try again shortly.",
  options: ErrorResponseOptions = {}
) {
  const appError = toAppError(error, defaultMessage)
  const publicMessage = getPublicAppErrorMessage(appError, defaultMessage)
  const traceId = createTraceId()
  const requestId = options.context?.requestId
  const clientRequestId = options.request?.headers.get("x-salesframe-client-request-id") || undefined

  logSafeEvent("error", "salesframe_function_error", {
    clientRequestId,
    code: appError.code,
    functionName: options.functionName ?? getFunctionNameFromRequest(options.request),
    message: getDiagnosticErrorMessage(error),
    metadata: options.metadata ?? {},
    publicMessage,
    requestId,
    stack: getDiagnosticErrorStack(error),
    status: appError.status,
    traceId,
  })

  return jsonResponse(
    {
      error: {
        code: appError.code,
        clientRequestId,
        message: publicMessage,
        requestId,
        traceId,
      },
    },
    appError.status,
    {
      "X-SalesFrame-Trace-Id": traceId,
      ...(clientRequestId ? { "X-SalesFrame-Client-Request-Id": clientRequestId } : {}),
      ...(requestId ? { "X-Netlify-Request-Id": requestId } : {}),
    }
  )
}

export function logSafeEvent(level: LogLevel, event: string, payload: Record<string, unknown> = {}) {
  const logEntry = sanitizeLogValue({
    event,
    payload,
    timestamp: new Date().toISOString(),
  })
  const line = JSON.stringify(logEntry)

  if (level === "info") {
    console.info(line)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.error(line)
}

export function getPublicErrorMessageForError(error: unknown, defaultMessage = "SalesFrame needs another moment with that request. Try again shortly.") {
  if (!(error instanceof AppError) && error instanceof Error) {
    const message = error.message.trim()

    if (message && !isMissingServerConfiguration(error) && !isTechnicalErrorMessage(message)) {
      return message
    }
  }

  return getPublicAppErrorMessage(toAppError(error, defaultMessage), defaultMessage)
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw badRequest("Request body must be valid JSON.")
  }
}

export function badRequest(message: string, code = "bad_request") {
  return new AppError(code, message, 400)
}

export function unauthorized(message = "Sign in before using this feature.") {
  return new AppError("unauthorized", message, 401)
}

export function forbidden(message = "You do not have access to this workspace data.") {
  return new AppError("forbidden", message, 403)
}

export function notFound(message = "Record was not found.") {
  return new AppError("not_found", message, 404)
}

export function tooManyRequests(message = "That is a lot of activity at once. Wait a moment, then try again.") {
  return new AppError("rate_limit_exceeded", message, 429)
}

export function methodNotAllowed() {
  return new AppError("method_not_allowed", "That action is not available here.", 405)
}

export function upstreamFailure(message: string, code = "upstream_failure") {
  return new AppError(code, message, 502)
}

function isMissingServerConfiguration(error: unknown) {
  return (
    error instanceof Error &&
    /^Missing required environment variable: /.test(error.message)
  )
}

function toAppError(error: unknown, defaultMessage: string) {
  if (error instanceof AppError) return error

  if (isMissingServerConfiguration(error)) {
    return new AppError(
      "server_configuration_missing",
      "SalesFrame could not reach its AI services. Contact support if this keeps happening.",
      503
    )
  }

  return new AppError("server_error", defaultMessage)
}

function getPublicAppErrorMessage(error: AppError, defaultMessage: string) {
  const message = error.message.trim() || defaultMessage

  if (error.code === "server_configuration_missing") return message

  const requiredContextMessage = getMissingContextMessage(error)
  if (requiredContextMessage) return requiredContextMessage

  if (error.status >= 500) {
    if (error.status === 502 || /^openai_|_openai_|upstream/.test(error.code)) {
      return getPublicAiProviderMessage(message)
    }

    return defaultMessage
  }

  return isTechnicalErrorMessage(message) ? defaultMessage : message
}

function getMissingContextMessage(error: AppError) {
  const code = error.code.toLowerCase()
  const message = error.message.toLowerCase()

  if (code === "workspace_id_required" || /workspaceid is required/.test(message)) {
    return "Choose a workspace before continuing."
  }

  if (code === "account_id_required" || /accountid is required/.test(message)) {
    return "Choose an account before continuing."
  }

  if (code === "opportunity_id_required" || /opportunityid is required/.test(message)) {
    return "Choose an opportunity before continuing."
  }

  if (code === "call_id_required" || /callid is required/.test(message)) {
    return "Choose a call before continuing."
  }

  return ""
}

function isTechnicalErrorMessage(message: string) {
  return technicalErrorPatterns.some((pattern) => pattern.test(message))
}

function getPublicAiProviderMessage(message: string) {
  if (/incorrect api key|invalid api key|authentication.*openai/i.test(message)) {
    return "This OpenAI key did not work. Check the key in Settings, then try again."
  }

  if (/insufficient_quota|quota|billing|hard limit|usage limit|credits/i.test(message)) {
    return "This workspace key needs billing or quota attention. Check the key in Settings, then try again."
  }

  if (/rate.?limit|too many requests|\b429\b/i.test(message)) {
    return "OpenAI is receiving too many requests at once. Wait a moment, then try again."
  }

  if (/model_not_found|model .* does not exist|unsupported model|model .* unavailable/i.test(message)) {
    return "The selected OpenAI model is not available. Contact support if this keeps happening."
  }

  if (/timeout|timed out|service unavailable|temporarily unavailable|overloaded/i.test(message)) {
    return "SalesFrame is taking longer than expected. Try again in a moment."
  }

  if (isTechnicalErrorMessage(message)) {
    return "SalesFrame needs another moment to prepare this. Try again in a moment."
  }

  return "SalesFrame needs another moment to prepare this. Try again in a moment."
}

const technicalErrorPatterns = [
  /schema cache/i,
  /could not find .* column/i,
  /could not find .* table/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /duplicate key value violates/i,
  /violates .* constraint/i,
  /invalid input syntax/i,
  /permission denied for (table|schema|relation)/i,
  /row-level security|rls/i,
  /postgrest|postgres|supabase/i,
  /response_format|json_schema|schema validation/i,
  /required .* properties/i,
  /\b(workspace|account|opportunity|call|user|project)Id is required\b/i,
  /invalid url \(post/i,
  /parameter is not supported/i,
  /internal server error/i,
  /bad gateway/i,
  /gateway timeout/i,
  /unexpected token/i,
  /<!doctype/i,
  /<html/i,
  /stack trace|traceback/i,
  /malformed json/i,
  /cannot read properties/i,
  /is not a function/i,
]

function createTraceId() {
  return `sf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function getFunctionNameFromRequest(request: Request | undefined) {
  if (!request) return "unknown"

  try {
    const pathname = new URL(request.url).pathname
    return pathname.split("/").filter(Boolean).at(-1) ?? "unknown"
  } catch {
    return "unknown"
  }
}

function getDiagnosticErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error

  return "Unknown error"
}

function getDiagnosticErrorStack(error: unknown) {
  if (!(error instanceof Error) || !error.stack) return ""

  return error.stack
    .split("\n")
    .slice(0, 8)
    .map((line) => line.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, "data:text/javascript;base64,[redacted]"))
    .join("\n")
}

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth-limit]"
  if (typeof value === "undefined") return undefined
  if (value === null || typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "string") return redactSensitiveText(value).slice(0, 1200)
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeLogValue(item, depth + 1))

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 80)
        .map(([key, item]) => [
          key,
          sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeLogValue(item, depth + 1),
        ])
    )
  }

  return String(value)
}

function redactSensitiveText(value: string) {
  return value
    .replace(/sk-(proj-)?[A-Za-z0-9_-]{16,}/g, "[redacted-openai-key]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted-supabase-secret]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "[redacted-supabase-publishable]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-token]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
}

const sensitiveKeyPattern = /(apiKey|authorization|password|secret|serviceRole|token|openAiKey|supabaseKey)/i
