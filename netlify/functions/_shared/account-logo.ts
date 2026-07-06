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

export function buildAccountLogoFallbackUrl(domain: string | null | undefined) {
  const logoDomain = normalizeAccountLogoDomain(domain)
  const token = getEnv("VITE_LOGO_DEV_PUBLISHABLE_KEY").trim()

  if (!logoDomain || !token) return ""

  const params = new URLSearchParams({
    fallback: "404",
    retina: "true",
    size: "64",
    token,
  })

  return `https://img.logo.dev/${encodeURIComponent(logoDomain)}?${params.toString()}`
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
  }
}

type ExistingAccountLogoMetadata = {
  logo_domain?: string | null
  logo_status?: string | null
  logo_url?: string | null
}

function isResolvedLogoMetadata(
  metadata: ExistingAccountLogoMetadata,
  logoDomain: string
) {
  return metadata.logo_status === "resolved" &&
    Boolean(metadata.logo_url) &&
    normalizeAccountLogoDomain(metadata.logo_domain) === logoDomain
}

async function canLoadAccountLogoUrl(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3500)
  const siteUrl = process.env.URL || "https://salesframe.ai/"

  try {
    const response = await fetch(url, {
      headers: {
        accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*",
        referer: siteUrl,
      },
      method: "GET",
      signal: controller.signal,
    })
    const contentType = response.headers.get("content-type") ?? ""

    return (
      response.status === 403 ||
      (response.ok && (!contentType || contentType.toLowerCase().includes("image")))
    )
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export async function resolveAccountLogoMetadata(
  website: string | null | undefined,
  existingMetadata: ExistingAccountLogoMetadata = {}
) {
  const logoDomain = normalizeAccountLogoDomain(website)

  if (!logoDomain) return buildAccountLogoMetadata(website)

  if (
    isResolvedLogoMetadata(existingMetadata, logoDomain) &&
    existingMetadata.logo_url &&
    await canLoadAccountLogoUrl(existingMetadata.logo_url)
  ) {
    return {
      logo_checked_at: existingMetadata.logo_url ? new Date().toISOString() : null,
      logo_domain: logoDomain,
      logo_source: logoDevSource,
      logo_status: "resolved",
      logo_url: existingMetadata.logo_url,
    }
  }

  const candidateUrls = [
    buildAccountLogoUrl(logoDomain),
    buildAccountLogoFallbackUrl(logoDomain),
  ].filter((url, index, urls) => Boolean(url) && urls.indexOf(url) === index)

  for (const logoUrl of candidateUrls) {
    if (await canLoadAccountLogoUrl(logoUrl)) {
      return {
        logo_checked_at: new Date().toISOString(),
        logo_domain: logoDomain,
        logo_source: logoDevSource,
        logo_status: "resolved",
        logo_url: logoUrl,
      }
    }
  }

  return {
    logo_checked_at: new Date().toISOString(),
    logo_domain: logoDomain,
    logo_source: logoDevSource,
    logo_status: "fallback",
    logo_url: null,
  }
}
