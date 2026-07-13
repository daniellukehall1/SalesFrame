declare const Netlify: {
  env: {
    get(name: string): string | undefined
  }
} | undefined

export const requiredFrontendEnvNames = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const

export const optionalFrontendEnvNames = [
  "VITE_CONVERSATION_UI_ENABLED",
  "VITE_LOGO_DEV_PUBLISHABLE_KEY",
] as const

export const requiredServerEnvNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_KEY_ENCRYPTION_SECRET",
  "DEEPGRAM_API_KEY",
] as const

export const optionalServerEnvNames = [
  "DEEPGRAM_FLUX_EAGER_EOT_THRESHOLD",
  "DEEPGRAM_FLUX_EOT_THRESHOLD",
  "DEEPGRAM_FLUX_EOT_TIMEOUT_MS",
  "DEEPGRAM_FLUX_MODEL",
  "DEEPGRAM_DIARIZE_MODEL",
  "DEEPGRAM_LISTEN_HOSTS",
  "OPENAI_LIVE_COACH_MODEL",
  "OPENAI_LIVE_QUESTION_MODEL",
  "OPENAI_LIVE_STATE_MODEL",
  "OPENAI_NEXT_CALL_BRIEF_MODEL",
  "OPENAI_ACCOUNT_ENRICHMENT_MODEL",
  "OPENAI_SPEAKER_ATTRIBUTION_MODEL",
  "OPENAI_TEXT_MODEL",
  "OPENAI_WORKSPACE_ASSISTANT_MODEL",
  "WORKSPACE_ASSISTANT_ENABLED",
  "OPENAI_RESEARCH_WEB_SEARCH",
  "RECALL_API_KEY",
  "RECALL_MEDIA_DOWNLOAD_HOSTS",
  "RECALL_BOT_IMAGE_B64",
  "RECALL_BOT_IMAGE_URL",
  "RECALL_MEETING_BOT_ENABLED",
  "RECALL_PUBLIC_BASE_URL",
  "RECALL_REGION",
  "RECALL_SVIX_WEBHOOK_SECRET",
  "RECALL_WORKSPACE_VERIFICATION_SECRET",
  "MEETING_BOT_CRYPTO_SECRET",
  "MEETING_BOT_MAX_PER_USER",
  "MEETING_BOT_MAX_PER_WORKSPACE",
  "MEETING_BOT_MAX_GLOBAL",
  "MEETING_BOT_RATE_WINDOW_MINUTES",
  "MEETING_BOT_USER_ROLLING_CREATION_LIMIT",
  "MEETING_BOT_WORKSPACE_ROLLING_CREATION_LIMIT",
  "MEETING_BOT_USER_DAILY_BOT_LIMIT",
  "MEETING_BOT_WORKSPACE_DAILY_BOT_LIMIT",
  "MEETING_BOT_USER_DAILY_MINUTE_LIMIT",
  "MEETING_BOT_WORKSPACE_DAILY_MINUTE_LIMIT",
  "MEETING_BOT_RESERVED_MINUTES",
] as const

export const meetingBotServerEnvNames = [
  "RECALL_API_KEY",
  "RECALL_MEDIA_DOWNLOAD_HOSTS",
  "RECALL_WORKSPACE_VERIFICATION_SECRET",
  "MEETING_BOT_CRYPTO_SECRET",
] as const

export const optionalEnvNames = [
  ...optionalFrontendEnvNames,
  ...optionalServerEnvNames,
] as const

export const requiredEnvNames = [
  ...requiredFrontendEnvNames,
  ...requiredServerEnvNames,
] as const

export function getEnv(name: string, defaultValue = "") {
  const netlifyValue =
    typeof Netlify !== "undefined" ? Netlify?.env?.get(name) : undefined

  return netlifyValue ?? process.env[name] ?? defaultValue
}

export function requireEnv(name: string) {
  const value = getEnv(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}
