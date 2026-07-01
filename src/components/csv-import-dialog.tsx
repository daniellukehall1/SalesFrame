import * as React from "react"
import * as Papa from "papaparse"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  ListChecksIcon,
  Loader2Icon,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { cn } from "@/lib/utils"

type CsvImportStep = "upload" | "map" | "validate" | "review" | "summary"

const importSteps: Array<{ icon: React.ElementType; label: string; value: CsvImportStep }> = [
  { value: "upload", label: "Upload", icon: UploadIcon },
  { value: "map", label: "Map columns", icon: Table2Icon },
  { value: "validate", label: "Validate", icon: ListChecksIcon },
  { value: "review", label: "Review", icon: FileSpreadsheetIcon },
  { value: "summary", label: "Summary", icon: CheckCircle2Icon },
]

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
  const [summary, setSummary] = React.useState<CsvImportSummary | null>(null)
  const lastWorkspaceIdRef = React.useRef(workspaceId)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const fields = getCsvImportFields(mode)
  const progress = getStepProgress(step)
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
  const pagedRows = filteredRows.slice((page - 1) * csvImportLimits.reviewPageSize, page * csvImportLimits.reviewPageSize)
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
        setParseMessage(error.message || "CSV could not be parsed.")
      },
    })
  }

  const handleParseComplete = (result: Papa.ParseResult<CsvImportRow>, sourceName: string) => {
    const nextHeaders = (result.meta.fields ?? []).map(normalizeCsvHeader).filter(Boolean)
    const nextRows = result.data.filter((row) =>
      Object.values(row).some((value) => typeof value === "string" && value.trim())
    )

    if (result.errors.length) {
      setParseMessage(result.errors[0]?.message ?? "CSV could not be parsed.")
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
            mapping,
            rows,
            workspaceId,
          })
        : await requestOpportunityCsvImport({
            decisions: rowDecisions,
            defaultCurrency,
            mapping,
            rows,
            workspaceId,
          })

      setSummary(result)
      setStep("summary")
      onImportComplete()
    } catch (error) {
      setParseMessage(error instanceof Error ? error.message : "CSV import failed.")
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
    link.download = `${mode}-import-errors.csv`
    link.click()
    URL.revokeObjectURL(url)
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
    setIsImporting(false)
    setSummary(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-4xl sm:grid-rows-[auto_auto_minmax(0,1fr)_auto]"
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
          <Progress value={progress} />
          <div className="grid grid-cols-5 gap-2">
            {importSteps.map(({ value, label, icon: Icon }) => {
              const itemIndex = importSteps.findIndex((item) => item.value === value)
              const activeIndex = importSteps.findIndex((item) => item.value === step)
              const isActive = step === value
              const isComplete = activeIndex > itemIndex

              return (
                <div
                  key={value}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-sm",
                    isActive && "border-primary bg-primary/5",
                    isComplete && "bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background",
                      isActive && "border-primary text-primary"
                    )}
                  >
                    {isComplete ? <CheckCircle2Icon className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className="truncate font-medium">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto pr-1">
          {step === "upload" ? (
            <div className="grid gap-4 rounded-lg border p-4">
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
                <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>CSV column</span>
                  <span>SalesFrame field</span>
                </div>
                <div className="divide-y">
                  {headers.map((header) => (
                    <div key={header} className="grid grid-cols-[minmax(0,1fr)_260px] items-center gap-3 px-3 py-2">
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
                        <SelectTrigger className="w-full">
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
                  <TabsTrigger value="errors">Errors</TabsTrigger>
                  <TabsTrigger value="warnings">Warnings</TabsTrigger>
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
                            <SelectTrigger className="w-full">
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                    Next
                  </Button>
                </div>
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
                  SalesFrame refreshed the selected workspace after the import completed.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <SummaryTile label="Created" value={summary.created} />
                <SummaryTile label="Updated" value={summary.updated} />
                <SummaryTile label="Skipped" value={summary.skipped} />
                <SummaryTile label="Failed" value={summary.failed} destructive={summary.failed > 0} />
              </div>
              {summary.failures.length ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-destructive">Some rows could not be imported</p>
                      <p className="text-sm text-muted-foreground">Download the failed rows and correct them before trying again.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadFailedRows}>
                      <DownloadIcon />
                      Download error CSV
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

        <DialogFooter className="sm:justify-between">
          {step === "summary" ? (
            <span aria-hidden="true" />
          ) : (
            <Button variant="outline" disabled={isImporting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {step !== "upload" && step !== "summary" ? (
              <Button
                variant="outline"
                disabled={isImporting}
                onClick={() => setStep(getPreviousStep(step))}
              >
                Back
              </Button>
            ) : null}
            {step === "upload" ? (
              <Button disabled={rows.length === 0} onClick={() => setStep("map")}>
                Next
              </Button>
            ) : null}
            {step === "map" ? (
              <Button onClick={() => setStep("validate")}>Validate rows</Button>
            ) : null}
            {step === "validate" ? (
              <Button disabled={previewRows.length === 0} onClick={() => setStep("review")}>
                Review rows
              </Button>
            ) : null}
            {step === "review" ? (
              <Button disabled={isImporting || importableRows.length === 0} onClick={handleImport}>
                {isImporting ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                {isImporting ? "Importing..." : `Import ${importableRows.length} rows`}
              </Button>
            ) : null}
            {step === "summary" ? (
              <Button disabled={isImporting} onClick={() => onOpenChange(false)}>
                Done
              </Button>
            ) : null}
          </div>
        </DialogFooter>
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
      <SummaryTile label="Warnings" value={counts.warnings} />
      <SummaryTile label="Errors" value={counts.errors} destructive={counts.errors > 0} />
    </div>
  )
}

function IssueList({ rows }: { rows: CsvImportPreviewRow[] }) {
  const issueRows = rows.filter((row) => row.issues.length > 0).slice(0, 12)

  if (issueRows.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        No blocking issues found. Review the rows before importing.
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {issueRows.map((row) => (
        <div key={row.id} className="rounded-lg border p-3">
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
                {issue.severity === "error" ? "Error" : "Warning"}: {issue.message}
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
    <div className={cn("rounded-lg border p-3", destructive && "border-destructive/30 bg-destructive/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", destructive && "text-destructive")}>{value}</p>
    </div>
  )
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
