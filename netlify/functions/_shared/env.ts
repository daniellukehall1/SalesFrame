declare const Netlify: {
  env: {
    get(name: string): string | undefined
  }
} | undefined

export const requiredFrontendEnvNames = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const

export const requiredServerEnvNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_KEY_ENCRYPTION_SECRET",
] as const

export const optionalServerEnvNames = [
  "OPENAI_LIVE_COACH_MODEL",
  "OPENAI_SPEAKER_ATTRIBUTION_MODEL",
  "OPENAI_TEXT_MODEL",
  "OPENAI_TRANSCRIPTION_MODEL",
  "OPENAI_RESEARCH_WEB_SEARCH",
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
