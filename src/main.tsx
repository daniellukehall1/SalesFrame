import { StrictMode, type ReactNode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import "./index.css"
import { AppErrorBoundary } from "@/components/app-error-boundary"
import { installGlobalClientErrorReporting } from "@/lib/client-error-reporting"
import { getPublicLegalDocument, normalizePublicLegalPath } from "@/lib/public-legal-routes"
import { normalizePublicMarketingPath } from "@/lib/public-marketing-routes"

installGlobalClientErrorReporting()

const rootElement = document.getElementById("root")!

function withAppBoundary(content: ReactNode) {
  return (
    <StrictMode>
      <AppErrorBoundary>{content}</AppErrorBoundary>
    </StrictMode>
  )
}

async function startSalesFrame() {
  const publicLegalPath = normalizePublicLegalPath(window.location.pathname)
  const publicMarketingPath = normalizePublicMarketingPath(window.location.pathname)

  if (publicLegalPath) {
    const document = getPublicLegalDocument(publicLegalPath)
    if (!document) throw new Error(`Missing legal document for ${publicLegalPath}`)
    const { PublicLegalDocumentPage } = await import("@/components/legal-document-page")
    const content = withAppBoundary(<PublicLegalDocumentPage document={document} />)

    if (rootElement.dataset.prerenderedPublicRoute === publicLegalPath) {
      hydrateRoot(rootElement, content)
    } else {
      createRoot(rootElement).render(content)
    }
    return
  }

  if (publicMarketingPath) {
    const { PublicMarketingPage } = await import("@/components/public-marketing-page")
    const content = withAppBoundary(<PublicMarketingPage path={publicMarketingPath} />)

    if (rootElement.dataset.prerenderedPublicRoute === publicMarketingPath) {
      hydrateRoot(rootElement, content)
    } else {
      createRoot(rootElement).render(content)
    }
    return
  }

  const { default: App } = await import("./App")
  createRoot(rootElement).render(withAppBoundary(<App />))
}

void startSalesFrame()
