import { renderToString } from "react-dom/server"

import {
  getPublicMarketingPageMetadata,
  PublicMarketingPage,
} from "@/components/public-marketing-page"
import { PublicLegalDocumentPage } from "@/components/legal-document-page"
import {
  getPublicLegalDocument,
  getPublicLegalPageMetadata,
  publicLegalPaths,
} from "@/lib/public-legal-routes"
import { publicMarketingPaths } from "@/lib/public-marketing-routes"

export function prerenderPublicMarketingPages() {
  return publicMarketingPaths.map((path) => {
    const metadata = getPublicMarketingPageMetadata(path)
    if (!metadata) throw new Error(`Missing public marketing metadata for ${path}`)

    return {
      html: renderToString(<PublicMarketingPage path={path} />),
      metadata,
      path,
    }
  })
}

export function prerenderPublicLegalPages() {
  return publicLegalPaths.map((path) => {
    const document = getPublicLegalDocument(path)
    const metadata = getPublicLegalPageMetadata(path)
    if (!document || !metadata) throw new Error(`Missing public legal metadata for ${path}`)

    return {
      html: renderToString(<PublicLegalDocumentPage document={document} />),
      metadata,
      path,
    }
  })
}
