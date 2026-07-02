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

  if (technicalErrorPatterns.some((pattern) => pattern.test(message))) {
    return fallback
  }

  if (actionableErrorPatterns.some((pattern) => pattern.test(message))) {
    return message
  }

  return message.length > 240 ? fallback : message
}
