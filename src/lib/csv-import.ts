import { parseDateValue } from "./date-utils"
import {
  callPlaybookAliases,
  callPlaybookOptions,
  currencyOptions,
  defaultCallPlaybooks,
  normalizeCurrencyCode,
  type CallPlaybook,
  type CurrencyCode,
} from "./salesframe-core"

export const csvImportLimits = {
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxRows: 5000,
  reviewPageSize: 25,
}

export type CsvImportType = "accounts" | "opportunities"
export type CsvImportAction = "create" | "update" | "skip"
export type CsvImportIssueSeverity = "error" | "warning"
export type CsvImportFilter = "all" | "errors" | "warnings" | "duplicates" | "ready"

export type CsvImportFieldKey =
  | "ignore"
  | "accountName"
  | "accountWebsite"
  | "industry"
  | "employees"
  | "region"
  | "currency"
  | "currentTools"
  | "strategicInitiatives"
  | "competitors"
  | "accountNotes"
  | "opportunityName"
  | "stage"
  | "amount"
  | "closeDate"
  | "source"
  | "pain"
  | "decisionProcess"
  | "nextStep"
  | "manualNotes"
  | "callType"
  | "playbooks"

export type CsvImportField = {
  aliases: string[]
  key: CsvImportFieldKey
  label: string
  required?: boolean
}

export type CsvImportIssue = {
  field?: CsvImportFieldKey
  message: string
  severity: CsvImportIssueSeverity
}

export type CsvImportExistingAccount = {
  currency?: string | null
  id: string
  name: string
  website?: string | null
}

export type CsvImportExistingOpportunity = {
  accountId: string
  id: string
  name: string
}

export type CsvImportRow = Record<string, string>
export type CsvImportColumnMapping = Record<string, CsvImportFieldKey>

export type CsvImportPreviewRow = {
  action: CsvImportAction
  duplicateKind: "none" | "strong" | "medium"
  id: string
  issues: CsvImportIssue[]
  matchedAccountId?: string
  matchedAccountName?: string
  matchedOpportunityId?: string
  matchedOpportunityName?: string
  rowNumber: number
  values: Partial<Record<Exclude<CsvImportFieldKey, "ignore">, string>>
}

export type CsvImportRowDecision = {
  action: CsvImportAction
  rowId: string
}

export type CsvImportSummary = {
  created: number
  failed: number
  failures: {
    message: string
    rowNumber: number
    values: Record<string, string>
  }[]
  skipped: number
  updated: number
}

const commonAccountFields: CsvImportField[] = [
  {
    key: "accountName",
    label: "Account name",
    required: true,
    aliases: ["account", "account name", "company", "company name", "customer", "customer name", "organisation", "organization"],
  },
  {
    key: "accountWebsite",
    label: "Website",
    aliases: [
      "website",
      "domain",
      "company domain",
      "account domain",
      "account website",
      "account website/domain",
      "account website domain",
      "url",
      "web site",
    ],
  },
  {
    key: "industry",
    label: "Industry",
    aliases: ["industry", "sector", "vertical"],
  },
  {
    key: "employees",
    label: "Employees",
    aliases: ["employees", "employee count", "company size", "size", "headcount"],
  },
  {
    key: "region",
    label: "Region",
    aliases: ["region", "country", "territory", "location", "area"],
  },
  {
    key: "currency",
    label: "Currency",
    aliases: ["currency", "currency code", "deal currency", "account currency"],
  },
  {
    key: "currentTools",
    label: "Current tools",
    aliases: ["current tools", "tools", "systems", "current systems", "tech stack", "technology"],
  },
  {
    key: "strategicInitiatives",
    label: "Strategic initiatives",
    aliases: ["strategic initiatives", "initiatives", "priorities", "business priorities", "projects"],
  },
  {
    key: "competitors",
    label: "Competitors",
    aliases: ["competitors", "competition", "incumbent", "current vendor", "vendor"],
  },
  {
    key: "accountNotes",
    label: "Account notes",
    aliases: ["notes", "account notes", "profile notes", "description", "comments"],
  },
]

const opportunityOnlyFields: CsvImportField[] = [
  {
    key: "opportunityName",
    label: "Opportunity name",
    required: true,
    aliases: ["opportunity", "opportunity name", "deal", "deal name", "pipeline name"],
  },
  {
    key: "stage",
    label: "Stage",
    aliases: ["stage", "deal stage", "opportunity stage", "pipeline stage"],
  },
  {
    key: "amount",
    label: "Amount",
    aliases: ["amount", "value", "deal value", "opportunity amount", "arr", "pipeline value"],
  },
  {
    key: "closeDate",
    label: "Close date",
    aliases: ["close date", "close", "expected close", "expected close date", "closing date"],
  },
  {
    key: "source",
    label: "Source",
    aliases: ["source", "lead source", "origin"],
  },
  {
    key: "pain",
    label: "Pain",
    aliases: ["pain", "problem", "need", "business pain", "challenge"],
  },
  {
    key: "decisionProcess",
    label: "Decision process",
    aliases: ["decision process", "process", "buying process", "approval process"],
  },
  {
    key: "nextStep",
    label: "Next step",
    aliases: ["next step", "next steps", "follow up", "action", "action item"],
  },
  {
    key: "manualNotes",
    label: "Manual notes",
    aliases: ["manual notes", "opportunity notes", "deal notes", "notes"],
  },
  {
    key: "callType",
    label: "Call type",
    aliases: ["call type", "meeting type", "conversation type"],
  },
  {
    key: "playbooks",
    label: "Playbooks/frameworks",
    aliases: ["playbooks", "frameworks", "methodology", "methodologies", "sales framework"],
  },
]

const knownStages = new Set([
  "qualification",
  "discovery",
  "validation",
  "demo",
  "business case",
  "proposal",
  "negotiation",
  "closed won",
  "closed lost",
])

export function getCsvImportFields(type: CsvImportType) {
  return type === "accounts"
    ? commonAccountFields
    : [
        opportunityOnlyFields[0],
        commonAccountFields[0],
        commonAccountFields[1],
        ...opportunityOnlyFields.slice(1),
        commonAccountFields[2],
        commonAccountFields[5],
      ]
}

export function getCsvImportFieldLabel(key: CsvImportFieldKey) {
  if (key === "ignore") return "Ignore column"

  return [...commonAccountFields, ...opportunityOnlyFields].find((field) => field.key === key)?.label ?? key
}

export function normalizeCsvHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
}

export function normalizeImportText(value: string | null | undefined) {
  return (value ?? "").trim()
}

export function normalizeImportComparable(value: string | null | undefined) {
  return normalizeImportText(value).toLowerCase().replace(/[^a-z0-9]+/g, "")
}

export function normalizeImportDomain(value: string | null | undefined) {
  return normalizeImportText(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
}

export function buildCsvColumnAutoMapping(headers: string[], type: CsvImportType): CsvImportColumnMapping {
  const fields = getCsvImportFields(type)
  const aliasToKey = new Map<string, CsvImportFieldKey>()

  fields.forEach((field) => {
    aliasToKey.set(normalizeImportComparable(field.label), field.key)
    field.aliases.forEach((alias) => aliasToKey.set(normalizeImportComparable(alias), field.key))
  })

  return Object.fromEntries(
    headers.map((header) => [
      header,
      aliasToKey.get(normalizeImportComparable(header)) ?? "ignore",
    ])
  )
}

export function getMappedCsvValue(
  row: CsvImportRow,
  mapping: CsvImportColumnMapping,
  key: Exclude<CsvImportFieldKey, "ignore">
) {
  const mappedHeader = Object.entries(mapping).find(([, fieldKey]) => fieldKey === key)?.[0]
  if (!mappedHeader) return ""

  return normalizeImportText(row[mappedHeader])
}

export function getMappedCsvValues(row: CsvImportRow, mapping: CsvImportColumnMapping) {
  const values: Partial<Record<Exclude<CsvImportFieldKey, "ignore">, string>> = {}

  Object.entries(mapping).forEach(([header, key]) => {
    if (key === "ignore") return

    const value = normalizeImportText(row[header])
    if (value) {
      values[key] = value
    }
  })

  return values
}

export function normalizeCsvImportPlaybooks(value: string | null | undefined): CallPlaybook[] {
  const raw = normalizeImportText(value)
  if (!raw) return [...defaultCallPlaybooks]

  const tokens = raw
    .split(/[,;|·]/)
    .map((token) => token.trim())
    .filter(Boolean)

  const selected: CallPlaybook[] = []
  tokens.forEach((token) => {
    const normalizedToken = token.toLowerCase()
    const matched =
      callPlaybookOptions.find((playbook) => playbook.toLowerCase() === normalizedToken) ??
      callPlaybookAliases[normalizedToken]

    if (matched && !selected.includes(matched)) {
      selected.push(matched)
    }
  })

  return selected.length ? selected : [...defaultCallPlaybooks]
}

export function resolveImportCurrency(value: string | null | undefined, fallback: CurrencyCode) {
  const raw = normalizeImportText(value)
  if (!raw) return fallback

  const normalized = normalizeCurrencyCode(raw)
  return currencyOptions.includes(raw.toUpperCase() as CurrencyCode) ? normalized : fallback
}

export function buildCsvImportPreview({
  defaultCurrency,
  existingAccounts,
  existingOpportunities,
  mapping,
  rows,
  type,
}: {
  defaultCurrency: CurrencyCode
  existingAccounts: CsvImportExistingAccount[]
  existingOpportunities: CsvImportExistingOpportunity[]
  mapping: CsvImportColumnMapping
  rows: CsvImportRow[]
  type: CsvImportType
}): CsvImportPreviewRow[] {
  return rows.map((row, index) => {
    const values = getMappedCsvValues(row, mapping)
    const issues: CsvImportIssue[] = []
    const rowNumber = index + 2
    let duplicateKind: CsvImportPreviewRow["duplicateKind"] = "none"
    let matchedAccount: CsvImportExistingAccount | undefined
    let matchedOpportunity: CsvImportExistingOpportunity | undefined

    if (type === "accounts") {
      const accountName = values.accountName ?? ""
      if (!accountName) {
        issues.push({
          field: "accountName",
          message: "Account name is required.",
          severity: "error",
        })
      }

      const match = findAccountMatch(existingAccounts, accountName, values.accountWebsite)
      matchedAccount = match.account
      duplicateKind = match.kind

      if (matchedAccount) {
        issues.push({
          field: duplicateKind === "strong" ? "accountName" : undefined,
          message:
            duplicateKind === "strong"
              ? `Looks like an existing account: ${matchedAccount.name}.`
              : `Possible account match: ${matchedAccount.name}. Review before importing.`,
          severity: "warning",
        })
      }
    } else {
      const opportunityName = values.opportunityName ?? ""
      const accountName = values.accountName ?? ""
      if (!opportunityName) {
        issues.push({
          field: "opportunityName",
          message: "Opportunity name is required.",
          severity: "error",
        })
      }
      if (!accountName) {
        issues.push({
          field: "accountName",
          message: "Account name is required to import opportunities.",
          severity: "error",
        })
      }

      const accountMatch = findAccountMatch(existingAccounts, accountName, values.accountWebsite)
      matchedAccount = accountMatch.account

      if (accountName && !matchedAccount) {
        issues.push({
          field: "accountName",
          message: `Account "${accountName}" will be created in this workspace.`,
          severity: "warning",
        })
      } else if (matchedAccount && accountMatch.kind === "medium") {
        issues.push({
          field: "accountName",
          message: `Possible account match: ${matchedAccount.name}. Review before importing.`,
          severity: "warning",
        })
      }

      matchedOpportunity = matchedAccount
        ? findOpportunityMatch(existingOpportunities, opportunityName, matchedAccount.id)
        : undefined

      if (matchedOpportunity) {
        duplicateKind = "strong"
        issues.push({
          field: "opportunityName",
          message: `Looks like an existing opportunity: ${matchedOpportunity.name}.`,
          severity: "warning",
        })
      }

      if (values.closeDate && !parseDateValue(values.closeDate)) {
        issues.push({
          field: "closeDate",
          message: "Close date could not be parsed; it will be saved as a note.",
          severity: "warning",
        })
      }

      if (values.stage && !knownStages.has(values.stage.trim().toLowerCase())) {
        issues.push({
          field: "stage",
          message: "Stage is not one of the standard SalesFrame stages; it will be imported as typed.",
          severity: "warning",
        })
      }
    }

    if (values.currency) {
      const normalizedCurrency = normalizeCurrencyCode(values.currency)
      if (normalizedCurrency !== values.currency.toUpperCase()) {
        issues.push({
          field: "currency",
          message: `Currency "${values.currency}" is not supported; ${defaultCurrency} will be used.`,
          severity: "warning",
        })
      }
    }

    const hasErrors = issues.some((issue) => issue.severity === "error")
    const action: CsvImportAction = hasErrors || duplicateKind !== "none" ? "skip" : "create"

    return {
      action,
      duplicateKind,
      id: `row-${index + 1}`,
      issues,
      matchedAccountId: matchedAccount?.id,
      matchedAccountName: matchedAccount?.name,
      matchedOpportunityId: matchedOpportunity?.id,
      matchedOpportunityName: matchedOpportunity?.name,
      rowNumber,
      values,
    }
  })
}

export function getCsvImportCounts(rows: CsvImportPreviewRow[]) {
  return {
    duplicates: rows.filter((row) => row.duplicateKind !== "none").length,
    errors: rows.filter((row) => row.issues.some((issue) => issue.severity === "error")).length,
    ready: rows.filter((row) => !row.issues.some((issue) => issue.severity === "error") && row.action !== "skip").length,
    warnings: rows.filter((row) => row.issues.some((issue) => issue.severity === "warning")).length,
  }
}

export function filterCsvImportRows(rows: CsvImportPreviewRow[], filter: CsvImportFilter) {
  if (filter === "errors") return rows.filter((row) => row.issues.some((issue) => issue.severity === "error"))
  if (filter === "warnings") return rows.filter((row) => row.issues.some((issue) => issue.severity === "warning"))
  if (filter === "duplicates") return rows.filter((row) => row.duplicateKind !== "none")
  if (filter === "ready") return rows.filter((row) => !row.issues.some((issue) => issue.severity === "error") && row.action !== "skip")

  return rows
}

export function applyCsvRowDecisions(
  previewRows: CsvImportPreviewRow[],
  decisions: CsvImportRowDecision[]
) {
  const decisionByRowId = new Map(decisions.map((decision) => [decision.rowId, decision.action]))

  return previewRows.map((row) => ({
    ...row,
    action: row.issues.some((issue) => issue.severity === "error")
      ? "skip"
      : decisionByRowId.get(row.id) ?? row.action,
  }))
}

export function makeFailedRowsCsv(summary: CsvImportSummary) {
  const headers = ["Row", "Error", "Values"]
  const lines = [
    headers,
    ...summary.failures.map((failure) => [
      String(failure.rowNumber),
      failure.message,
      JSON.stringify(failure.values),
    ]),
  ]

  return lines.map((line) => line.map(escapeCsvCell).join(",")).join("\n")
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function findAccountMatch(
  accounts: CsvImportExistingAccount[],
  accountName: string | undefined,
  accountWebsite: string | undefined
) {
  const comparableName = normalizeImportComparable(accountName)
  const domain = normalizeImportDomain(accountWebsite)

  const strong = accounts.find((account) => {
    const accountComparableName = normalizeImportComparable(account.name)
    const accountDomain = normalizeImportDomain(account.website)

    return Boolean(comparableName && domain && accountComparableName === comparableName && accountDomain === domain)
  })

  if (strong) return { account: strong, kind: "strong" as const }

  const medium = accounts.find((account) => {
    const accountComparableName = normalizeImportComparable(account.name)
    const accountDomain = normalizeImportDomain(account.website)

    return Boolean(
      (comparableName && accountComparableName === comparableName) ||
      (domain && accountDomain === domain)
    )
  })

  if (medium) return { account: medium, kind: "medium" as const }

  return { account: undefined, kind: "none" as const }
}

function findOpportunityMatch(
  opportunities: CsvImportExistingOpportunity[],
  opportunityName: string | undefined,
  accountId: string
) {
  const comparableName = normalizeImportComparable(opportunityName)
  if (!comparableName) return undefined

  return opportunities.find(
    (opportunity) =>
      opportunity.accountId === accountId &&
      normalizeImportComparable(opportunity.name) === comparableName
  )
}
