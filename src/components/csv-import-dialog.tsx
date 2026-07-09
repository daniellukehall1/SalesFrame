import * as React from "react"
import * as Papa from "papaparse"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  ListChecksIcon,
  SparklesIcon,
  Table2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"

import type { AccountNavItem } from "@/components/nav-projects"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DialogActions } from "@/components/ui/dialog-actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  applyCsvRowDecisions,
  buildCsvColumnAutoMapping,
  buildCsvImportPreview,
  csvImportLimits,
  filterCsvImportRows,
  getCsvImportCounts,
  getCsvImportFieldLabel,
  getCsvImportFields,
  makeFailedRowsCsv,
  normalizeCsvHeader,
  type CsvImportAction,
  type CsvImportColumnMapping,
  type CsvImportFilter,
  type CsvImportPreviewRow,
  type CsvImportRow,
  type CsvImportRowDecision,
  type CsvImportSummary,
  type CsvImportType,
} from "@/lib/csv-import"
import type { CurrencyCode, Opportunity } from "@/lib/salesframe-core"
import { requestAccountCsvImport, requestOpportunityCsvImport } from "@/lib/server-functions"
import type { PlaybookRow } from "@/lib/supabase/salesframe-data"
import { getUserFacingErrorMessage } from "@/lib/user-facing-errors"
import { cn } from "@/lib/utils"

type CsvImportStep = "upload" | "map" | "validate" | "review" | "summary"

const importSteps: Array<{ icon: React.ElementType; label: string; value: CsvImportStep }> = [
  { value: "upload", label: "Upload", icon: UploadIcon },
  { value: "map", label: "Map columns", icon: Table2Icon },
  { value: "validate", label: "Validate", icon: ListChecksIcon },
  { value: "review", label: "Review", icon: FileSpreadsheetIcon },
  { value: "summary", label: "Summary", icon: CheckCircle2Icon },
]

function getCsvParseErrorMessage(error: { code?: string; message?: string } | undefined) {
  const code = error?.code ?? ""
  const message = error?.message ?? ""

  if (/FieldMismatch/i.test(code) || /Too few fields|Too many fields/i.test(message)) {
    return "One or more rows do not line up with the header columns. Check commas, quotes, and blank columns, then upload the CSV again."
  }

  if (/UndetectableDelimiter/i.test(code) || /delimiter/i.test(message)) {
    return "SalesFrame needs a standard comma-separated CSV. Export the file as CSV, then upload it again."
  }

  return "SalesFrame needs a cleaner CSV file. Check the format, then upload it again."
}

export function CsvImportDialog({
  accounts,
  defaultCurrency,
  mode,
  onImportComplete,
  onOpenChange,
  open,
  opportunities,
  playbooks,
  workspaceId,
  workspaceName,
}: {
  accounts: AccountNavItem[]
  defaultCurrency: CurrencyCode
  mode: CsvImportType
  onImportComplete: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  opportunities: Opportunity[]
  playbooks: PlaybookRow[]
  workspaceId: string
  workspaceName: string
}) {
  const [step, setStep] = React.useState<CsvImportStep>("upload")
  const [fileName, setFileName] = React.useState("")
  const [headers, setHeaders] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<CsvImportRow[]>([])
  const [mapping, setMapping] = React.useState<CsvImportColumnMapping>({})
  const [decisions, setDecisions] = React.useState<Record<string, CsvImportAction>>({})
  const [filter, setFilter] = React.useState<CsvImportFilter>("all")
  const [page, setPage] = React.useState(1)
  const [parseMessage, setParseMessage] = React.useState("")
  const [isImporting, setIsImporting] = React.useState(false)
  const [enrichmentEnabled, setEnrichmentEnabled] = React.useState(true)
  const [summary, setSummary] = React.useState<CsvImportSummary | null>(null)
  const lastWorkspaceIdRef = React.useRef(workspaceId)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const fields = getCsvImportFields(mode)
  const progress = getStepProgress(step)
  const activeStepIndex = Math.max(0, importSteps.findIndex((item) => item.value === step))
  const currentStep = importSteps[activeStepIndex] ?? importSteps[0]
  const previewRows = React.useMemo(
    () =>
      applyCsvRowDecisions(
        buildCsvImportPreview({
          defaultCurrency,
          existingAccounts: accounts.map((account) => ({
            currency: account.currency,
            id: account.id,
            name: account.name,
            website: account.website,
          })),
          existingOpportunities: opportunities.map((opportunity) => ({
            accountId: opportunity.accountId,
            id: opportunity.id,
            name: opportunity.name,
          })),
          mapping,
          rows,
          type: mode,
        }),
        Object.entries(decisions).map(([rowId, action]) => ({ action, rowId }))
      ),
    [accounts, decisions, defaultCurrency, mapping, mode, opportunities, rows]
  )
  const counts = getCsvImportCounts(previewRows)
  const filteredRows = filterCsvImportRows(previewRows, filter)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / csvImportLimits.reviewPageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * csvImportLimits.reviewPageSize, safePage * csvImportLimits.reviewPageSize)
  const importableRows = previewRows.filter((row) => row.action !== "skip" && !row.issues.some((issue) => issue.severity === "error"))

  React.useEffect(() => {
    if (!open) {
      lastWorkspaceIdRef.current = workspaceId
      return
    }

    if (lastWorkspaceIdRef.current !== workspaceId) {
      lastWorkspaceIdRef.current = workspaceId
      resetImportState()
      onOpenChange(false)
    }
  }, [onOpenChange, open, workspaceId])

  React.useEffect(() => {
    if (open) return
    resetImportState()
  }, [open, mode])

  React.useEffect(() => {
    setPage(1)
  }, [filter, step])

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return

    if (!/\.csv$/i.test(file.name)) {
      clearSelectedFile()
      setParseMessage("Choose a .csv file.")
      return
    }

    if (file.size > csvImportLimits.maxFileSizeBytes) {
      clearSelectedFile()
      setParseMessage("CSV imports are limited to 5MB. Split this file and try again.")
      return
    }

    parseCsvInput(file, file.name)
  }

  const clearSelectedFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    setFileName("")
    setHeaders([])
    setRows([])
    setMapping({})
    setDecisions({})
    setFilter("all")
    setPage(1)
    setParseMessage("")
    setSummary(null)
  }

  const parseCsvInput = (input: File | string, sourceName: string) => {
    setParseMessage("")
    setSummary(null)

    Papa.parse<CsvImportRow>(input, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeCsvHeader,
      transform: (value) => (typeof value === "string" ? value.trim() : String(value ?? "")),
      complete: (result) => {
        handleParseComplete(result, sourceName)
      },
      error: (error) => {
        setParseMessage(getCsvParseErrorMessage(error))
      },
    })
  }

  const handleParseComplete = (result: Papa.ParseResult<CsvImportRow>, sourceName: string) => {
    const nextHeaders = (result.meta.fields ?? []).map(normalizeCsvHeader).filter(Boolean)
    const nextRows = result.data.filter((row) =>
      Object.values(row).some((value) => typeof value === "string" && value.trim())
    )

    if (result.errors.length) {
      setParseMessage(getCsvParseErrorMessage(result.errors[0]))
      return
    }

    if (nextHeaders.length === 0 || nextRows.length === 0) {
      setParseMessage("CSV file did not include any rows.")
      return
    }

    if (nextRows.length > csvImportLimits.maxRows) {
      setParseMessage("CSV imports are limited to 5,000 rows. Split this file and try again.")
      return
    }

    setFileName(sourceName)
    setHeaders(nextHeaders)
    setRows(nextRows)
    setMapping(buildCsvColumnAutoMapping(nextHeaders, mode))
    setDecisions({})
    setFilter("all")
    setPage(1)
  }

  const handleDecisionChange = (row: CsvImportPreviewRow, action: CsvImportAction) => {
    setDecisions((current) => ({
      ...current,
      [row.id]: action,
    }))
  }

  const handleImport = async () => {
    if (isImporting || importableRows.length === 0) return

    setIsImporting(true)
    setParseMessage("")

    try {
      const rowDecisions: CsvImportRowDecision[] = previewRows.map((row) => ({
        action: row.action,
        rowId: row.id,
      }))
      const result = mode === "accounts"
        ? await requestAccountCsvImport({
            decisions: rowDecisions,
            defaultCurrency,
            enrichmentEnabled,
            fileName,
            mapping,
            rows,
            workspaceId,
          })
        : await requestOpportunityCsvImport({
            decisions: rowDecisions,
            defaultCurrency,
            enrichmentEnabled,
            fileName,
            mapping,
            rows,
            workspaceId,
          })

      setSummary(result)
      setStep("summary")
      onImportComplete()
    } catch (error) {
      setParseMessage(getUserFacingErrorMessage(error, "SalesFrame needs another look at this CSV before it can import."))
    } finally {
      setIsImporting(false)
    }
  }

  const downloadFailedRows = () => {
    if (!summary || summary.failures.length === 0) return

    const blob = new Blob([makeFailedRowsCsv(summary)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${mode}-import-review.csv`
    link.style.display = "none"
    document.body.appendChild(link)

    try {
      link.click()
    } finally {
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }

  function resetImportState() {
    setStep("upload")
    setFileName("")
    setHeaders([])
    setRows([])
    setMapping({})
    setDecisions({})
    setFilter("all")
    setPage(1)
    setParseMessage("")
    setEnrichmentEnabled(true)
    setIsImporting(false)
    setSummary(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid max-h-[calc(100svh-2rem)] overflow-hidden max-sm:max-h-[calc(100svh-0.75rem)] max-sm:max-w-[calc(100%-0.75rem)] max-sm:[&_[data-slot=button]]:min-h-11 max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=input]]:min-h-11 max-sm:[&_[data-slot=select-trigger]]:min-h-11 sm:max-w-4xl sm:grid-rows-[auto_auto_minmax(0,1fr)_auto]"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{mode === "accounts" ? "Import accounts" : "Import opportunities"}</DialogTitle>
          <DialogDescription>
            Import into {workspaceName}. This only affects the selected workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <p className="sr-only" aria-live="polite">
            Step {activeStepIndex + 1} of {importSteps.length}: {currentStep.label}
          </p>
          <Progress value={progress} aria-label={`CSV import progress: ${currentStep.label}`} />
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="list" aria-label="CSV import steps">
            {importSteps.map(({ value, label, icon: Icon }) => {
              const itemIndex = importSteps.findIndex((item) => item.value === value)
              const isActive = step === value
              const isComplete = activeStepIndex > itemIndex

              return (
                <div
                  key={value}
                  role="listitem"
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex min-w-0 items-center justify-center rounded-lg border px-1.5 py-2 text-sm sm:justify-start sm:gap-2 sm:px-2",
                    isActive && "border-primary bg-primary/5",
                    isComplete && "bg-muted/50"
                  )}
                  title={label}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background",
                      isActive && "border-primary text-primary"
                    )}
                  >
                    {isComplete ? <CheckCircle2Icon className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className="hidden truncate font-medium sm:inline">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto pr-1">
          {step === "upload" ? (
            <div className="grid gap-4 rounded-lg bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileSpreadsheetIcon className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Upload a CSV file</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This import only affects {workspaceName}. Switch workspace to import a different dataset.
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="csv-import-file" className="sr-only">CSV file</Label>
                <Input
                  ref={fileInputRef}
                  id="csv-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  <span className={cn("min-w-0 flex-1 truncate text-sm", fileName ? "text-foreground" : "text-muted-foreground")}>
                    {fileName || "No file selected"}
                  </span>
                  {fileName ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-11 md:size-7"
                      aria-label="Remove selected CSV"
                      onClick={clearSelectedFile}
                    >
                      <XIcon />
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Maximum 5MB and 5,000 rows.</p>
              </div>
            </div>
          ) : null}

          {step === "map" ? (
            <div className="grid gap-4">
              <div className="rounded-lg border">
                <div className="hidden grid-cols-[minmax(0,1fr)_minmax(13rem,16.25rem)] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>CSV column</span>
                  <span>SalesFrame field</span>
                </div>
                <div className="divide-y">
                  {headers.map((header) => (
                    <div key={header} className="grid min-w-0 gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(13rem,16.25rem)] md:items-center md:py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{header}</p>
                        <p className="truncate text-xs text-muted-foreground">{rows[0]?.[header] || "No sample value"}</p>
                      </div>
                      <Select
                        value={mapping[header] ?? "ignore"}
                        onValueChange={(value) =>
                          setMapping((current) => ({ ...current, [header]: value as CsvImportColumnMapping[string] }))
                        }
                      >
                        <SelectTrigger className="w-full" aria-label={`Map CSV column ${header}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">Ignore column</SelectItem>
                          {fields.map((field) => (
                            <SelectItem key={field.key} value={field.key}>
                              {field.label}{field.required ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === "validate" ? (
            <div className="grid gap-4">
              <ImportMeta fileName={fileName} rowCount={rows.length} workspaceName={workspaceName} />
              <ImportCounts counts={counts} total={previewRows.length} />
              <IssueList rows={previewRows} />
            </div>
          ) : null}

          {step === "review" ? (
            <div className="grid gap-4">
              <ImportCounts counts={counts} total={previewRows.length} />
              <Tabs value={filter} onValueChange={(value) => setFilter(value as CsvImportFilter)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="errors">Fix first</TabsTrigger>
                  <TabsTrigger value="warnings">Review notes</TabsTrigger>
                  <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
                  <TabsTrigger value="ready">Ready</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="rounded-lg border">
                <div className="hidden grid-cols-[3rem_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.35fr)_8rem] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>Row</span>
                  <span>Name</span>
                  <span>Match</span>
                  <span>Issues</span>
                  <span>Action</span>
                </div>
                <div className="divide-y">
                  {pagedRows.map((row) => {
                    const hasRowError = row.issues.some((issue) => issue.severity === "error")
                    return (
                      <div
                        key={row.id}
                        className="grid gap-3 px-3 py-3 text-sm md:grid-cols-[3rem_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.35fr)_8rem]"
                      >
                        <div className="text-xs font-medium text-muted-foreground md:text-sm md:text-foreground">
                          <span className="md:hidden">Row </span>
                          {row.rowNumber}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {mode === "accounts" ? row.values.accountName : row.values.opportunityName}
                          </p>
                          {mode === "opportunities" ? (
                            <p className="truncate text-xs text-muted-foreground">{row.values.accountName}</p>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {row.matchedOpportunityName ?? row.matchedAccountName ?? "New record"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{row.duplicateKind === "none" ? "No duplicate found" : `${row.duplicateKind} match`}</p>
                        </div>
                        <div className="min-w-0">
                          {row.issues.length ? (
                            <div className="grid gap-1">
                              {row.issues.slice(0, 3).map((issue, index) => (
                                <p
                                  key={`${row.id}-${index}`}
                                  className={cn("text-xs", issue.severity === "error" ? "text-destructive" : "text-muted-foreground")}
                                >
                                  {issue.message}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Ready</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Select
                            value={row.action}
                            disabled={hasRowError}
                            onValueChange={(value) => handleDecisionChange(row, value as CsvImportAction)}
                          >
                            <SelectTrigger className="w-full" aria-label={`Import action for row ${row.rowNumber}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="create">Create</SelectItem>
                              <SelectItem value="update" disabled={mode === "accounts" ? !row.matchedAccountId : !row.matchedOpportunityId}>
                                Update
                              </SelectItem>
                              <SelectItem value="skip">Skip</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </p>
                <div className="grid gap-2 sm:flex">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                    Next
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-lg bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <Label htmlFor="csv-import-enrichment" className="text-sm font-medium">
                      Enrich accounts after import
                    </Label>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      SalesFrame imports the file now, then researches account fields quietly in the background.
                    </p>
                  </div>
                </div>
                <Switch
                  id="csv-import-enrichment"
                  checked={enrichmentEnabled}
                  disabled={isImporting}
                  onCheckedChange={setEnrichmentEnabled}
                />
              </div>
            </div>
          ) : null}

          {step === "summary" && summary ? (
            <div className="grid gap-4">
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-emerald-600" />
                  <p className="font-medium">Import complete</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getEnrichmentSummaryMessage(summary)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <SummaryTile label="Created" value={summary.created} />
                <SummaryTile label="Updated" value={summary.updated} />
                <SummaryTile label="Skipped" value={summary.skipped} />
                <SummaryTile label="Needs review" value={summary.failed} destructive={summary.failed > 0} />
              </div>
              {summary.enrichment.enabled && summary.enrichment.status !== "none" ? (
                <div className="rounded-lg bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <SparklesIcon className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">AI enrichment</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getEnrichmentDetailMessage(summary)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              {summary.failures.length ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="alert">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-destructive">Some rows need a quick review</p>
                      <p className="text-sm text-muted-foreground">Download the review CSV, fix those rows, then import again.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadFailedRows}>
                      <DownloadIcon />
                      Download review CSV
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {parseMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {parseMessage}
          </div>
        ) : null}

        <DialogActions
          cancelAction={step === "summary" ? <span aria-hidden="true" /> : undefined}
          cancelDisabled={isImporting}
          onCancel={() => onOpenChange(false)}
          primaryAction={
            step === "upload" ? (
              <Button disabled={rows.length === 0} onClick={() => setStep("map")}>
                Next
              </Button>
            ) : step === "map" ? (
              <Button onClick={() => setStep("validate")}>Validate rows</Button>
            ) : step === "validate" ? (
              <Button disabled={previewRows.length === 0} onClick={() => setStep("review")}>
                Review rows
              </Button>
            ) : step === "review" ? (
              <Button disabled={isImporting || importableRows.length === 0} onClick={handleImport}>
                <UploadIcon />
                {isImporting ? "Importing..." : `Import ${importableRows.length} rows`}
              </Button>
            ) : (
              <Button disabled={isImporting} onClick={() => onOpenChange(false)}>
                Done
              </Button>
            )
          }
        >
          {step !== "upload" && step !== "summary" ? (
            <Button
              variant="outline"
              disabled={isImporting}
              onClick={() => setStep(getPreviousStep(step))}
            >
              Back
            </Button>
          ) : null}
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

function ImportMeta({ fileName, rowCount, workspaceName }: { fileName: string; rowCount: number; workspaceName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span className="truncate font-medium text-foreground">{fileName}</span>
      <span aria-hidden="true">/</span>
      <span>{rowCount} rows</span>
      <span aria-hidden="true">/</span>
      <span className="min-w-0 truncate">Workspace: {workspaceName}</span>
    </div>
  )
}

function ImportCounts({
  counts,
  total,
}: {
  counts: ReturnType<typeof getCsvImportCounts>
  total: number
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-5">
      <SummaryTile label="Rows" value={total} />
      <SummaryTile label="Ready" value={counts.ready} />
      <SummaryTile label="Duplicates" value={counts.duplicates} />
      <SummaryTile label="Review notes" value={counts.warnings} />
      <SummaryTile label="Fix first" value={counts.errors} destructive={counts.errors > 0} />
    </div>
  )
}

function IssueList({ rows }: { rows: CsvImportPreviewRow[] }) {
  const issueRows = rows.filter((row) => row.issues.length > 0).slice(0, 12)

  if (issueRows.length === 0) {
    return (
      <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
        Everything important looks ready. Review the rows before importing.
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {issueRows.map((row) => (
        <div key={row.id} className="rounded-lg bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-amber-600" />
            <p className="text-sm font-medium">Row {row.rowNumber}</p>
            <span className="truncate text-sm text-muted-foreground">{modeAgnosticName(row)}</span>
          </div>
          <div className="grid gap-1">
            {row.issues.map((issue, index) => (
              <p
                key={`${row.id}-${index}`}
                className={cn("text-sm", issue.severity === "error" ? "text-destructive" : "text-muted-foreground")}
              >
                {issue.severity === "error" ? "Fix first" : "Review"}: {issue.message}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SummaryTile({ destructive, label, value }: { destructive?: boolean; label: string; value: number }) {
  return (
    <div className={cn("rounded-lg bg-muted/30 p-3", destructive && "bg-destructive/10")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", destructive && "text-destructive")}>{value}</p>
    </div>
  )
}

function getEnrichmentSummaryMessage(summary: CsvImportSummary) {
  if (!summary.enrichment.enabled) {
    return "SalesFrame refreshed the selected workspace after the import completed."
  }

  if (summary.enrichment.status === "paused_missing_key") {
    return `Import complete. ${summary.enrichment.paused} accounts are paused until an OpenAI key is saved.`
  }

  if (summary.enrichment.status === "queued") {
    return `Import complete. ${summary.enrichment.queued} accounts are queued for enrichment.`
  }

  if (summary.enrichment.status === "unavailable") {
    return "Import complete. Enrichment status needs another check from the Data import section."
  }

  return "SalesFrame refreshed the selected workspace after the import completed."
}

function getEnrichmentDetailMessage(summary: CsvImportSummary) {
  if (summary.enrichment.status === "paused_missing_key") {
    return "Enrichment is paused while this workspace waits for an OpenAI key. Save a key in Settings and SalesFrame will pick the queue back up."
  }

  if (summary.enrichment.status === "queued") {
    const tracked = summary.enrichment.alreadyTracked
      ? ` ${summary.enrichment.alreadyTracked} were already in the queue.`
      : ""

    return `SalesFrame will research those accounts in the background.${tracked}`
  }

  if (summary.enrichment.status === "unavailable") {
    return "The import succeeded. SalesFrame needs another moment to update the enrichment queue, so check Data import again shortly."
  }

  return "No new accounts needed enrichment from this import."
}

function getStepProgress(step: CsvImportStep) {
  const index = ["upload", "map", "validate", "review", "summary"].indexOf(step)
  return ((index + 1) / 5) * 100
}

function getPreviousStep(step: CsvImportStep): CsvImportStep {
  if (step === "map") return "upload"
  if (step === "validate") return "map"
  if (step === "review") return "validate"
  return "upload"
}

function modeAgnosticName(row: CsvImportPreviewRow) {
  return row.values.opportunityName ?? row.values.accountName ?? `Row ${row.rowNumber}`
}
