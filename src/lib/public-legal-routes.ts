export type PublicLegalDocument = "terms" | "privacy"
export type PublicLegalPath = `/${PublicLegalDocument}`

export type PublicLegalPageMetadata = {
  canonicalUrl: string
  description: string
  imageAlt: string
  imageHeight: number
  imageUrl: string
  imageWidth: number
  keywords: string
  robots: string
  schema: Record<string, unknown>
  title: string
}

const siteUrl = "https://salesframe.ai"
const sharedImageUrl = `${siteUrl}/media/salesframe-hero-poster.png`
const sharedImageWidth = 1600
const sharedImageHeight = 904
const legalDate = "2026-07-12"
const legalRobots = "index, follow, max-snippet:-1"

const legalRouteDefinitions: Record<PublicLegalDocument, {
  description: string
  imageAlt: string
  keywords: string
  title: string
}> = {
  terms: {
    description: "Review the terms that govern access to and use of SalesFrame's real-time sales coaching service.",
    imageAlt: "SalesFrame Terms of Service",
    keywords: "SalesFrame terms of service, AI sales coaching terms, call recording consent, sales software terms",
    title: "Terms of Service · SalesFrame",
  },
  privacy: {
    description: "Learn how SalesFrame handles workspace data, contacts, call recordings, transcripts, AI prompts, and generated coaching outputs.",
    imageAlt: "SalesFrame Privacy Policy",
    keywords: "SalesFrame privacy policy, AI sales coaching privacy, call recording privacy, transcript data protection",
    title: "Privacy Policy · SalesFrame",
  },
}

export const publicLegalPaths: PublicLegalPath[] = ["/terms", "/privacy"]

function buildLegalPageSchema(document: PublicLegalDocument) {
  const definition = legalRouteDefinitions[document]
  const canonicalUrl = `${siteUrl}/${document}`

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: definition.title,
        description: definition.description,
        datePublished: legalDate,
        dateModified: legalDate,
        inLanguage: "en-AU",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#software`,
        },
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "SalesFrame",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: document === "terms" ? "Terms of Service" : "Privacy Policy",
            item: canonicalUrl,
          },
        ],
      },
    ],
  }
}

export function normalizePublicLegalPath(pathname: string): PublicLegalPath | null {
  if (!pathname || pathname === "/") return null

  let normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname
  if (normalized.endsWith(".html")) normalized = normalized.slice(0, -5)

  return publicLegalPaths.includes(normalized as PublicLegalPath)
    ? normalized as PublicLegalPath
    : null
}

export function getPublicLegalDocument(pathname: string): PublicLegalDocument | null {
  const path = normalizePublicLegalPath(pathname)
  return path ? path.slice(1) as PublicLegalDocument : null
}

export function getPublicLegalPageMetadata(pathname: string): PublicLegalPageMetadata | null {
  const document = getPublicLegalDocument(pathname)
  if (!document) return null
  const definition = legalRouteDefinitions[document]

  return {
    canonicalUrl: `${siteUrl}/${document}`,
    description: definition.description,
    imageAlt: definition.imageAlt,
    imageHeight: sharedImageHeight,
    imageUrl: sharedImageUrl,
    imageWidth: sharedImageWidth,
    keywords: definition.keywords,
    robots: legalRobots,
    schema: buildLegalPageSchema(document),
    title: definition.title,
  }
}
