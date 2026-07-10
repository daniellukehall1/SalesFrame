import { renderToString } from "react-dom/server"

import {
  getPublicMarketingPageMetadata,
  PublicMarketingPage,
} from "@/components/public-marketing-page"
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
