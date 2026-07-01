import { getEnv } from "./env"

const logoDevSource = "logo_dev"
const accountLogoDomainPattern = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,}$/i

export function normalizeAccountLogoDomain(value: string | null | undefined) {
  const domain = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]

  if (!domain || !accountLogoDomainPattern.test(domain)) return ""

  return domain
}

export function buildAccountLogoUrl(domain: string | null | undefined) {
  const logoDomain = normalizeAccountLogoDomain(domain)
  const token = getEnv("VITE_LOGO_DEV_PUBLISHABLE_KEY").trim()

  if (!logoDomain || !token) return ""

  const params = new URLSearchParams({
    fallback: "404",
    format: "webp",
    retina: "true",
    size: "64",
    theme: "auto",
    token,
  })

  return `https://img.logo.dev/${encodeURIComponent(logoDomain)}?${params.toString()}`
}

export function buildAccountLogoMetadata(website: string | null | undefined) {
  const logoDomain = normalizeAccountLogoDomain(website)
  const logoUrl = buildAccountLogoUrl(logoDomain)

  return {
    logo_checked_at: logoDomain ? new Date().toISOString() : null,
    logo_domain: logoDomain || null,
    logo_source: logoDevSource,
    logo_status: logoDomain ? (logoUrl ? "resolved" : "fallback") : "missing",
    logo_url: logoUrl || null,
  }
}
