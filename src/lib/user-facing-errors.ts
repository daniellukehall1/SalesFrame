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
]

function getRawErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim()
  if (typeof error === "string") return error.trim()
  return ""
}

export function getUserFacingErrorMessage(error: unknown, fallback: string) {
  const message = getRawErrorMessage(error)
  if (!message) return fallback

  if (/jwt|refresh token|access token|token.*expired|session.*expired/i.test(message)) {
    return "Your session has expired. Sign in again to continue."
  }

  if (/failed to fetch|networkerror|network request failed|load failed|internet connection/i.test(message)) {
    return "SalesFrame could not reach the service. Check your connection, then try again."
  }

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

  if (technicalErrorPatterns.some((pattern) => pattern.test(message))) {
    return fallback
  }

  if (actionableErrorPatterns.some((pattern) => pattern.test(message))) {
    return message
  }

  return message.length > 240 ? fallback : message
}
