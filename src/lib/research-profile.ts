import {
  defaultSellerResearchProfile,
  knownSellerResearchProfiles,
  type SellerResearchProfile,
} from "@/lib/salesframe-core"

export function areSellerResearchProfilesEqual(
  left: SellerResearchProfile,
  right: SellerResearchProfile
) {
  return (
    left.sellerCompany === right.sellerCompany &&
    left.sellerDomain === right.sellerDomain &&
    left.productContext === right.productContext
  )
}

export function inferSellerResearchProfile(value: string): SellerResearchProfile {
  const normalizedDomain = normalizeSellerDomain(value)
  const knownProfile = findKnownSellerResearchProfile(normalizedDomain)

  if (knownProfile) {
    return knownProfile
  }

  const sellerCompany = inferCompanyNameFromDomain(normalizedDomain || value)

  return {
    sellerCompany,
    sellerDomain: normalizedDomain || value.trim(),
    productContext: `${sellerCompany} provides products and services that help customers improve operational efficiency, visibility, collaboration, and measurable business outcomes. Edit this description to make the research more specific to what you sell.`,
  }
}

function findKnownSellerResearchProfile(normalizedDomain: string) {
  if (!normalizedDomain) return undefined

  for (const candidate of getDomainCandidates(normalizedDomain)) {
    const knownProfile = knownSellerResearchProfiles[candidate]
    if (knownProfile) return knownProfile
  }

  return undefined
}

function getDomainCandidates(normalizedDomain: string) {
  const candidates = new Set<string>()
  const addCandidate = (candidate: string) => {
    if (!candidate) return

    candidates.add(candidate)

    const commercialCountryCodeMatch = candidate.match(/^(.+)\.com\.[a-z]{2}$/)
    if (commercialCountryCodeMatch?.[1]) {
      candidates.add(`${commercialCountryCodeMatch[1]}.com`)
    }
  }

  addCandidate(normalizedDomain)

  const domainParts = normalizedDomain.split(".")
  for (let index = 1; index < domainParts.length - 1; index += 1) {
    addCandidate(domainParts.slice(index).join("."))
  }

  return [...candidates]
}

export function normalizeSellerDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
}

export function normalizeComparableText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

export function inferCompanyNameFromDomain(value: string) {
  const domain = normalizeSellerDomain(value)
  const root = domain.split(".")[0] || "Your company"

  return root
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}
