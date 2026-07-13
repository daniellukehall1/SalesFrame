import * as React from "react"
import { ArrowLeftIcon, MoonIcon, SunIcon } from "lucide-react"

import {
  legalBusinessAbn,
  legalBusinessName,
  legalContactEmail,
  legalEffectiveDate,
  privacySections,
  termsSections,
  type LegalPageId,
} from "@/data/legal-documents"
import { getPublicLegalPageMetadata } from "@/lib/public-legal-routes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LegalDocumentPage({
  darkMode,
  document,
  onBack,
  onDarkModeChange,
}: {
  darkMode: boolean
  document: LegalPageId
  onBack: () => void
  onDarkModeChange: (value: boolean) => void
}) {
  const isTerms = document === "terms"
  const sections = isTerms ? termsSections : privacySections
  const title = isTerms ? "Terms of Service" : "Privacy Policy"

  React.useEffect(() => {
    const canonicalUrl = `https://salesframe.ai/${document}`
    const metadata = getPublicLegalPageMetadata(`/${document}`)
    const description = isTerms
      ? "Review the terms that govern access to and use of SalesFrame's real-time sales coaching service."
      : "Learn how SalesFrame handles workspace data, contacts, call recordings, transcripts, AI prompts, and generated coaching outputs."
    const robots = metadata?.robots ?? "index, follow, max-snippet:-1"
    const setMeta = (selector: string, attribute: "content" | "href", value: string) => {
      globalThis.document.head.querySelector(selector)?.setAttribute(attribute, value)
    }

    globalThis.document.title = `${title} · SalesFrame`
    setMeta('meta[name="description"]', "content", description)
    setMeta('meta[name="keywords"]', "content", metadata?.keywords ?? "")
    setMeta('meta[name="robots"]', "content", robots)
    setMeta('link[rel="canonical"]', "href", canonicalUrl)
    setMeta('meta[property="og:url"]', "content", canonicalUrl)
    setMeta('meta[property="og:title"]', "content", `${title} · SalesFrame`)
    setMeta('meta[property="og:description"]', "content", description)
    setMeta('meta[name="twitter:title"]', "content", `${title} · SalesFrame`)
    setMeta('meta[name="twitter:description"]', "content", description)
    if (metadata) {
      setMeta('meta[property="og:image"]', "content", metadata.imageUrl)
      setMeta('meta[property="og:image:alt"]', "content", metadata.imageAlt)
      setMeta('meta[property="og:image:width"]', "content", String(metadata.imageWidth))
      setMeta('meta[property="og:image:height"]', "content", String(metadata.imageHeight))
      setMeta('meta[name="twitter:image"]', "content", metadata.imageUrl)
      setMeta('meta[name="twitter:image:alt"]', "content", metadata.imageAlt)

      let schema = globalThis.document.getElementById("salesframe-public-page-schema") as HTMLScriptElement | null
      if (!schema) {
        schema = globalThis.document.createElement("script")
        schema.id = "salesframe-public-page-schema"
        schema.type = "application/ld+json"
        globalThis.document.head.appendChild(schema)
      }
      schema.textContent = JSON.stringify(metadata.schema)
    }

    return () => {
      globalThis.document.getElementById("salesframe-public-page-schema")?.remove()
    }
  }, [document, isTerms, title])

  return (
    <main className="h-svh overflow-y-auto bg-background px-4 py-8 text-foreground">
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" className="h-11 gap-2 px-3 md:h-8">
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault()
                onBack()
              }}
            >
              <ArrowLeftIcon />
              Back to SalesFrame
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-11 md:size-7"
            aria-label="Toggle theme"
            onClick={() => onDarkModeChange(!darkMode)}
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardDescription>
              {legalBusinessName} - {legalBusinessAbn} - Effective {legalEffectiveDate}
            </CardDescription>
            <CardTitle><h1>{title}</h1></CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 text-sm leading-relaxed text-muted-foreground">
            <div className="rounded-lg bg-muted/40 p-4 text-foreground">
              <p className="font-medium">
                {isTerms
                  ? "These terms are governed by the laws of New South Wales, Australia."
                  : "This policy is designed for Australian privacy law and SalesFrame's actual product workflows."}
              </p>
              <p className="mt-2 text-muted-foreground">
                {isTerms
                  ? "Important: users remain responsible for call recording consent, customer notices, AI output review, and lawful use of all captured or generated information."
                  : "Important: SalesFrame can process call recordings, transcripts, customer records, AI prompts, OpenAI-powered outputs, and technical logs as described below."}
              </p>
            </div>
            {sections.map((section) => (
              <section key={section.title} className="grid gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <div className="rounded-lg bg-muted/40 p-4">
              <p>
                For questions about this document, contact{" "}
                <a className="font-medium text-foreground underline underline-offset-4" href={`mailto:${legalContactEmail}`}>
                  {legalContactEmail}
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

const colorModeStorageKey = "salesframe.color-mode"

export function PublicLegalDocumentPage({ document }: { document: LegalPageId }) {
  const [darkMode, setDarkMode] = React.useState(false)
  const [storedModeLoaded, setStoredModeLoaded] = React.useState(false)

  React.useEffect(() => {
    let storedDarkMode = false
    try {
      storedDarkMode = window.localStorage.getItem(colorModeStorageKey) === "dark"
    } catch {
      // The legal page remains usable when browser storage is unavailable.
    }

    setDarkMode(storedDarkMode)
    setStoredModeLoaded(true)
  }, [])

  React.useEffect(() => {
    if (!storedModeLoaded) return

    documentElement().classList.toggle("dark", darkMode)
    try {
      window.localStorage.setItem(colorModeStorageKey, darkMode ? "dark" : "light")
    } catch {
      // The in-memory theme toggle still works in restricted browser modes.
    }
  }, [darkMode, storedModeLoaded])

  return (
    <LegalDocumentPage
      darkMode={darkMode}
      document={document}
      onBack={() => window.location.assign("/")}
      onDarkModeChange={setDarkMode}
    />
  )
}

function documentElement() {
  return globalThis.document.documentElement
}
