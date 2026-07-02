import { normalizeSellerDomain } from "@/lib/research-profile"

export type AccountLogoStatus = "resolved" | "fallback" | "missing"

export const logoDevSource = "logo_dev"

const accountLogoDomainPattern = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,}$/i

export function normalizeAccountLogoDomain(value: string | null | undefined) {
  const domain = normalizeSellerDomain(value ?? "")

  if (!domain || !accountLogoDomainPattern.test(domain)) return ""

  return domain
}

export function getLogoDevPublishableKey() {
  return import.meta.env.VITE_LOGO_DEV_PUBLISHABLE_KEY?.trim() ?? ""
}

export function buildAccountLogoUrl(
  domain: string | null | undefined,
  {
    size = 64,
    token = getLogoDevPublishableKey(),
  }: {
    size?: number
    token?: string
  } = {}
) {
  const normalizedDomain = normalizeAccountLogoDomain(domain)
  const normalizedToken = token.trim()

  if (!normalizedDomain || !normalizedToken) return ""

  const params = new URLSearchParams({
    fallback: "404",
    format: "webp",
    retina: "true",
    size: String(size),
    theme: "auto",
    token: normalizedToken,
  })

  return `https://img.logo.dev/${encodeURIComponent(normalizedDomain)}?${params.toString()}`
}

export function buildAccountLogoFallbackUrl(
  domain: string | null | undefined,
  {
    size = 64,
    token = getLogoDevPublishableKey(),
  }: {
    size?: number
    token?: string
  } = {}
) {
  const normalizedDomain = normalizeAccountLogoDomain(domain)
  const normalizedToken = token.trim()

  if (!normalizedDomain || !normalizedToken) return ""

  const params = new URLSearchParams({
    fallback: "404",
    retina: "true",
    size: String(size),
    token: normalizedToken,
  })

  return `https://img.logo.dev/${encodeURIComponent(normalizedDomain)}?${params.toString()}`
}

export function buildAccountLogoMetadata(website: string | null | undefined) {
  const logoDomain = normalizeAccountLogoDomain(website)
  const logoUrl = buildAccountLogoUrl(logoDomain) || buildAccountLogoFallbackUrl(logoDomain)

  return {
    logo_checked_at: logoDomain ? new Date().toISOString() : null,
    logo_domain: logoDomain || null,
    logo_source: logoDevSource,
    logo_status: logoDomain ? (logoUrl ? "resolved" : "fallback") : "missing",
    logo_url: logoUrl || null,
  } satisfies {
    logo_checked_at: string | null
    logo_domain: string | null
    logo_source: string
    logo_status: AccountLogoStatus
    logo_url: string | null
  }
}

export function getAccountLogoInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!words.length) return "SF"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
}
