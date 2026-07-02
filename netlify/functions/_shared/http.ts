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

export function jsonResponse(data: unknown, status = 200) {
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
    },
  })
}

export function dataResponse(data: unknown, status = 200) {
  return jsonResponse({ data }, status)
}

export function errorResponse(error: unknown, defaultMessage = "SalesFrame could not finish that request. Try again in a moment.") {
  const appError = toAppError(error, defaultMessage)
  const publicMessage = getPublicAppErrorMessage(appError, defaultMessage)

  return jsonResponse(
    {
      error: {
        code: appError.code,
        message: publicMessage,
      },
    },
    appError.status
  )
}

export function getPublicErrorMessageForError(error: unknown, defaultMessage = "SalesFrame could not finish that request. Try again in a moment.") {
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

  if (error.status >= 500) {
    if (error.status === 502 || /^openai_|_openai_|upstream/.test(error.code)) {
      return getPublicAiProviderMessage(message)
    }

    return defaultMessage
  }

  return isTechnicalErrorMessage(message) ? defaultMessage : message
}

function isTechnicalErrorMessage(message: string) {
  return technicalErrorPatterns.some((pattern) => pattern.test(message))
}

function getPublicAiProviderMessage(message: string) {
  if (/incorrect api key|invalid api key|authentication.*openai/i.test(message)) {
    return "OpenAI could not use that key. Check the key in Settings, then try again."
  }

  if (/insufficient_quota|quota|billing|hard limit|usage limit|credits/i.test(message)) {
    return "OpenAI could not run this step because the workspace key needs billing or quota attention. Check the key in Settings, then try again."
  }

  if (/rate.?limit|too many requests|\b429\b/i.test(message)) {
    return "OpenAI is receiving too many requests at once. Wait a moment, then try again."
  }

  if (/model_not_found|model .* does not exist|unsupported model|model .* unavailable/i.test(message)) {
    return "OpenAI could not use the selected model. Contact support if this keeps happening."
  }

  if (/timeout|timed out|service unavailable|temporarily unavailable|overloaded/i.test(message)) {
    return "OpenAI is taking longer than expected. Try again in a moment."
  }

  if (isTechnicalErrorMessage(message)) {
    return "SalesFrame could not finish the AI step. Try again in a moment."
  }

  return "SalesFrame could not finish the AI step. Try again in a moment."
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
