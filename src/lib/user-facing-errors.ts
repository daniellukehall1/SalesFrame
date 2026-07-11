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
  /request body must be valid json/i,
  /malformed json/i,
  /invalid json/i,
  /invalid url \(post/i,
  /parameter is not supported/i,
  /internal server error/i,
  /bad gateway/i,
  /gateway timeout/i,
  /unexpected token/i,
  /<!doctype/i,
  /<html/i,
  /stack trace|traceback/i,
  /cannot read properties/i,
  /is not a function/i,
]

const actionableErrorPatterns = [
  /openai api key is required/i,
  /add an openai key/i,
  /save an openai api key/i,
  /sign in before/i,
  /choose .* before/i,
  /select .* before/i,
  /account name .* required/i,
  /opportunity name .* required/i,
  /microphone/i,
  /audio/i,
  /recording link/i,
  /csv/i,
  /close date/i,
  /this browser/i,
  /content blocker/i,
]

function getRawErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim()
  if (typeof error === "string") return error.trim()
  return ""
}

function getRawErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return ""

  const code = (error as { code?: unknown }).code
  return typeof code === "string" ? code.trim().toLowerCase() : ""
}

export function isWorkspaceSessionExpiredError(error: unknown) {
  const code = getRawErrorCode(error)
  if (
    code === "workspace_session_expired" ||
    code === "session_expired" ||
    code === "refresh_token_not_found" ||
    code === "bad_jwt"
  ) return true

  const message = getRawErrorMessage(error)
  return /workspace_session_expired|we signed you out to keep your workspace safe|your session has expired\. sign in again to continue|\bjwt\b.*\bexpired\b|\b(refresh|access) token\b.*\b(expired|not found)\b/i.test(message)
}

export function isPermissionDeniedError(error: unknown) {
  const message = getRawErrorMessage(error)

  return /permission denied|row-level security|rls|not authorized|forbidden|violates row-level security policy/i.test(message)
}

export function getUserFacingErrorMessage(error: unknown, fallback: string) {
  const message = getRawErrorMessage(error)
  if (!message) return fallback

  if (/workspace_session_expired|we signed you out to keep your workspace safe/i.test(message)) {
    return "We signed you out to keep your workspace safe."
  }

  if (/jwt|refresh token|access token|token.*expired|session.*expired/i.test(message)) {
    return "Your session has expired. Sign in again to continue."
  }

  if (/failed to fetch|networkerror|network request failed|load failed|internet connection/i.test(message)) {
    return "SalesFrame cannot reach the service right now. Check your connection, then try again."
  }

  if (/incorrect api key|invalid api key|authentication.*openai/i.test(message)) {
    return "The connected OpenAI key did not work. Check it in Settings, then try again."
  }

  if (/insufficient_quota|quota|billing|hard limit|usage limit|credits/i.test(message)) {
    return "The connected OpenAI key needs billing or quota attention. Check it in Settings, then try again."
  }

  if (/rate.?limit|too many requests|\b429\b/i.test(message)) {
    return "The AI is busy right now. Wait a moment, then try again."
  }

  if (/model_not_found|model .* does not exist|unsupported model|model .* unavailable/i.test(message)) {
    return "SalesFrame's live AI model is not available right now. Contact support if this keeps happening."
  }

  if (/timeout|timed out|service unavailable|temporarily unavailable|overloaded/i.test(message)) {
    return "SalesFrame is taking longer than expected. Give it a moment, then try again."
  }

  if (technicalErrorPatterns.some((pattern) => pattern.test(message))) {
    return fallback
  }

  if (actionableErrorPatterns.some((pattern) => pattern.test(message))) {
    return message
  }

  return message.length > 240 ? fallback : message
}
