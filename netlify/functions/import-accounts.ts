import type { Config, Context } from "@netlify/functions"

import type { TablesInsert, TablesUpdate } from "../../src/lib/supabase/database.types"
import {
  applyCsvRowDecisions,
  buildCsvImportPreview,
  resolveImportCurrency,
  type CsvImportColumnMapping,
  type CsvImportRow,
  type CsvImportRowDecision,
  type CsvImportSummary,
} from "../../src/lib/csv-import"
import { defaultCurrencyCode, normalizeCurrencyCode, type CurrencyCode } from "../../src/lib/salesframe-core"
import { buildAccountLogoMetadata } from "./_shared/account-logo"
import { badRequest, dataResponse, errorResponse, getPublicErrorMessageForError, methodNotAllowed, readJson } from "./_shared/http"
import {
  createCsvImportRun,
  createImportEnrichmentSummary,
  finalizeCsvImportRun,
  processQueuedEnrichmentJobs,
  queueAccountEnrichmentJobs,
  type AccountEnrichmentQueueTarget,
} from "./_shared/import-enrichment"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"

type ImportAccountsPayload = {
  decisions?: CsvImportRowDecision[]
  defaultCurrency?: string
  enrichmentEnabled?: boolean
  fileName?: string
  mapping?: CsvImportColumnMapping
  rows?: CsvImportRow[]
  workspaceId?: string
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const { supabase, user } = await requireUser(request)
    const payload = await readJson<ImportAccountsPayload>(request)
    const workspaceId = payload.workspaceId?.trim()
    if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")

    await authorizeWorkspace(user.id, workspaceId, supabase)
    assertRateLimit({
      key: `${user.id}:${workspaceId}`,
      limit: 12,
      name: "CSV import",
      windowMs: 10 * 60 * 1000,
    })

    const rows = validateRows(payload.rows)
    const mapping = validateMapping(payload.mapping)
    const defaultCurrency = normalizeCurrencyCode(payload.defaultCurrency)
    const enrichmentEnabled = payload.enrichmentEnabled !== false
    const importRunId = await createCsvImportRun({
      enrichmentEnabled,
      fileName: payload.fileName,
      importType: "accounts",
      rowCount: rows.length,
      supabase,
      userId: user.id,
      workspaceId,
    })

    const { data: accountRows, error: accountError } = await supabase
      .from("accounts")
      .select("id,name,website,currency")
      .eq("workspace_id", workspaceId)

    if (accountError) throw new Error(accountError.message)

    const previewRows = applyCsvRowDecisions(
      buildCsvImportPreview({
        defaultCurrency,
        existingAccounts: accountRows ?? [],
        existingOpportunities: [],
        mapping,
        rows,
        type: "accounts",
      }),
      payload.decisions ?? []
    )
    const summary: CsvImportSummary = {
      created: 0,
      enrichment: createImportEnrichmentSummary(enrichmentEnabled),
      failed: 0,
      failures: [],
      skipped: 0,
      updated: 0,
    }
    const accountsToEnrich: AccountEnrichmentQueueTarget[] = []

    for (const row of previewRows) {
      const originalRow = rows[row.rowNumber - 2] ?? {}
      const errorIssue = row.issues.find((issue) => issue.severity === "error")

      if (errorIssue || row.action === "skip") {
        summary.skipped += 1
        if (errorIssue) {
          summary.failed += 1
          summary.failures.push({
            message: errorIssue.message,
            rowNumber: row.rowNumber,
            values: originalRow,
          })
        }
        continue
      }

      try {
        if (row.action === "update") {
          if (!row.matchedAccountId) {
            throw new Error("Choose a duplicate account before updating this row.")
          }

          await assertAccountInWorkspace(row.matchedAccountId, workspaceId)
          const updatePayload = buildAccountUpdatePayload(row.values, defaultCurrency)
          const response = await supabase
            .from("accounts")
            .update(updatePayload)
            .eq("id", row.matchedAccountId)
            .eq("workspace_id", workspaceId)
            .select("id,name,website")
            .single()

          if (response.error) throw new Error(response.error.message)
          accountsToEnrich.push({
            accountId: response.data.id,
            name: response.data.name,
            website: response.data.website,
          })
          summary.updated += 1
        } else {
          const insertPayload: TablesInsert<"accounts"> = {
            currency: resolveImportCurrency(row.values.currency, defaultCurrency),
            current_tools: row.values.currentTools ?? null,
            employee_count: row.values.employees ?? null,
            industry: row.values.industry ?? null,
            name: row.values.accountName ?? "Untitled account",
            notes: row.values.accountNotes ?? null,
            owner_user_id: user.id,
            region: row.values.region || "Australia",
            strategic_initiatives: row.values.strategicInitiatives ?? null,
            competitors: row.values.competitors ?? null,
            website: row.values.accountWebsite ?? null,
            workspace_id: workspaceId,
            ...buildAccountLogoMetadata(row.values.accountWebsite ?? null),
          }
          const response = await supabase.from("accounts").insert(insertPayload).select("id,name,website").single()

          if (response.error) throw new Error(response.error.message)
          accountsToEnrich.push({
            accountId: response.data.id,
            name: response.data.name,
            website: response.data.website,
          })
          summary.created += 1
        }
      } catch (error) {
        summary.failed += 1
        summary.failures.push({
          message: getPublicErrorMessageForError(error, "Row needs review before it can be imported."),
          rowNumber: row.rowNumber,
          values: originalRow,
        })
      }
    }

    try {
      summary.enrichment = await queueAccountEnrichmentJobs({
        enabled: enrichmentEnabled,
        importRunId,
        supabase,
        targets: accountsToEnrich,
        userId: user.id,
        workspaceId,
      })
      await finalizeCsvImportRun({ importRunId, summary, supabase })
      if (summary.enrichment.status === "queued") {
        context.waitUntil(
          processQueuedEnrichmentJobs({ limit: 3, supabase, userId: user.id, workspaceId }).catch(() => undefined)
        )
      }
    } catch {
      summary.enrichment = {
        ...createImportEnrichmentSummary(enrichmentEnabled),
        skipped: accountsToEnrich.length,
        status: enrichmentEnabled ? "unavailable" : "off",
      }
    }

    return dataResponse(summary)

    async function assertAccountInWorkspace(accountId: string, currentWorkspaceId: string) {
      const response = await supabase
        .from("accounts")
        .select("id")
        .eq("id", accountId)
        .eq("workspace_id", currentWorkspaceId)
        .maybeSingle()

      if (response.error) throw new Error(response.error.message)
      if (!response.data) {
        throw badRequest("Account update target does not belong to the selected workspace.", "cross_workspace_account_rejected")
      }
    }
  } catch (error) {
    return errorResponse(error)
  }
}

function validateRows(rows: unknown) {
  if (!Array.isArray(rows)) throw badRequest("rows must be an array.", "invalid_import_rows")
  if (rows.length === 0) throw badRequest("CSV file did not include any rows.", "empty_import")
  if (rows.length > 5000) throw badRequest("CSV imports are limited to 5,000 rows.", "import_row_limit")

  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw badRequest("Every row must be an object.", "invalid_import_row")
    }

    return Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([key, value]) => [
        key,
        value == null ? "" : String(value),
      ])
    )
  })
}

function validateMapping(mapping: unknown) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw badRequest("column mapping is required.", "invalid_column_mapping")
  }

  return mapping as CsvImportColumnMapping
}

function buildAccountUpdatePayload(
  values: Partial<Record<string, string>>,
  defaultCurrency: CurrencyCode = defaultCurrencyCode
) {
  const updatePayload: TablesUpdate<"accounts"> = {}

  assignIfPresent(updatePayload, "name", values.accountName)
  assignIfPresent(updatePayload, "website", values.accountWebsite)
  assignIfPresent(updatePayload, "industry", values.industry)
  assignIfPresent(updatePayload, "employee_count", values.employees)
  assignIfPresent(updatePayload, "region", values.region)
  assignIfPresent(updatePayload, "current_tools", values.currentTools)
  assignIfPresent(updatePayload, "strategic_initiatives", values.strategicInitiatives)
  assignIfPresent(updatePayload, "competitors", values.competitors)
  assignIfPresent(updatePayload, "notes", values.accountNotes)

  if (values.accountWebsite?.trim()) {
    Object.assign(updatePayload, buildAccountLogoMetadata(values.accountWebsite))
  }

  if (values.currency?.trim()) {
    updatePayload.currency = resolveImportCurrency(values.currency, defaultCurrency)
  }

  return updatePayload
}

function assignIfPresent<T extends Record<string, unknown>>(target: T, key: string, value: unknown) {
  if (typeof value === "string" && value.trim()) {
    target[key as keyof T] = value.trim() as T[keyof T]
  }
}

export const config: Config = {
  path: "/api/import/accounts",
  method: ["POST"],
}
