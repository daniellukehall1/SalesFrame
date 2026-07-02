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

  return (
    <main className="h-svh overflow-y-auto bg-background px-4 py-8 text-foreground">
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" className="gap-2" onClick={onBack}>
            <ArrowLeftIcon />
            Back to SalesFrame
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-10 md:size-7"
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
            <CardTitle>{isTerms ? "Terms of Service" : "Privacy Policy"}</CardTitle>
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
