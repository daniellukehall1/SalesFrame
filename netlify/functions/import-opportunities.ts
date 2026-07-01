import type { Config, Context } from "@netlify/functions"

import {
  applyCsvRowDecisions,
  buildCsvImportPreview,
  normalizeCsvImportPlaybooks,
  normalizeImportComparable,
  normalizeImportDomain,
  resolveImportCurrency,
  type CsvImportColumnMapping,
  type CsvImportRow,
  type CsvImportRowDecision,
  type CsvImportSummary,
} from "../../src/lib/csv-import"
import { formatCurrencyAmount } from "../../src/lib/currency-utils"
import { normalizeCloseDateForPersistence } from "../../src/lib/date-utils"
import type { Tables, TablesInsert, TablesUpdate } from "../../src/lib/supabase/database.types"
import {
  callPlaybookAliases,
  callPlaybookOptions,
  defaultCurrencyCode,
  normalizeCurrencyCode,
  type CallPlaybook,
  type CurrencyCode,
} from "../../src/lib/salesframe-core"
import { buildAccountLogoMetadata } from "./_shared/account-logo"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"

type ImportOpportunitiesPayload = {
  decisions?: CsvImportRowDecision[]
  defaultCurrency?: string
  mapping?: CsvImportColumnMapping
  rows?: CsvImportRow[]
  workspaceId?: string
}

type AccountLookup = Pick<Tables<"accounts">, "currency" | "id" | "name" | "website">
type OpportunityLookup = Pick<Tables<"opportunities">, "account_id" | "id" | "name">
type PlaybookLookup = Pick<Tables<"playbooks">, "id" | "is_system" | "name" | "slug" | "workspace_id">

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const { supabase, user } = await requireUser(request)
    const payload = await readJson<ImportOpportunitiesPayload>(request)
    const workspaceId = payload.workspaceId?.trim()
    if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")

    await authorizeWorkspace(user.id, workspaceId, supabase)

    const rows = validateRows(payload.rows)
    const mapping = validateMapping(payload.mapping)
    const defaultCurrency = normalizeCurrencyCode(payload.defaultCurrency)

    const [accountResponse, opportunityResponse, playbookResponse] = await Promise.all([
      supabase.from("accounts").select("id,name,website,currency").eq("workspace_id", workspaceId),
      supabase.from("opportunities").select("id,name,account_id").eq("workspace_id", workspaceId),
      supabase
        .from("playbooks")
        .select("id,name,slug,is_system,workspace_id")
        .or(`is_system.eq.true,workspace_id.eq.${workspaceId}`),
    ])

    if (accountResponse.error) throw new Error(accountResponse.error.message)
    if (opportunityResponse.error) throw new Error(opportunityResponse.error.message)
    if (playbookResponse.error) throw new Error(playbookResponse.error.message)

    const workspaceAccounts = [...(accountResponse.data ?? [])]
    const workspaceOpportunities = opportunityResponse.data ?? []
    const playbooks = playbookResponse.data ?? []
    const previewRows = applyCsvRowDecisions(
      buildCsvImportPreview({
        defaultCurrency,
        existingAccounts: workspaceAccounts.map((account) => ({
          currency: account.currency,
          id: account.id,
          name: account.name,
          website: account.website,
        })),
        existingOpportunities: workspaceOpportunities.map((opportunity) => ({
          accountId: opportunity.account_id,
          id: opportunity.id,
          name: opportunity.name,
        })),
        mapping,
        rows,
        type: "opportunities",
      }),
      payload.decisions ?? []
    )
    const createdAccountByKey = new Map<string, AccountLookup>()
    const summary: CsvImportSummary = {
      created: 0,
      failed: 0,
      failures: [],
      skipped: 0,
      updated: 0,
    }

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
        const account = await resolveAccountForRow({
          accounts: workspaceAccounts,
          createdAccountByKey,
          defaultCurrency,
          rowValues: row.values,
          userId: user.id,
          workspaceId,
        })

        if (row.action === "update") {
          if (!row.matchedOpportunityId) {
            throw new Error("Choose a duplicate opportunity before updating this row.")
          }

          await assertOpportunityInWorkspace(row.matchedOpportunityId, workspaceId)
          const updatePayload = buildOpportunityUpdatePayload(row.values, account, defaultCurrency)
          if (account.id) updatePayload.account_id = account.id

          const response = await supabase
            .from("opportunities")
            .update(updatePayload)
            .eq("id", row.matchedOpportunityId)
            .eq("workspace_id", workspaceId)
            .select("id")
            .single()

          if (response.error) throw new Error(response.error.message)

          if (row.values.playbooks?.trim()) {
            await replaceOpportunityPlaybooks(row.matchedOpportunityId, getPlaybookIds(playbooks, row.values.playbooks))
          }

          summary.updated += 1
        } else {
          const closeDate = normalizeCloseDateForPersistence(row.values.closeDate ?? "")
          const accountCurrency = normalizeCurrencyCode(account.currency)
          const response = await supabase
            .from("opportunities")
            .insert({
              account_id: account.id,
              amount: formatCurrencyAmount(row.values.amount || "Unqualified", accountCurrency),
              call_type: row.values.callType || "Discovery",
              close_date: closeDate.date,
              close_date_note: closeDate.note,
              decision_process: row.values.decisionProcess || null,
              manual_notes: row.values.manualNotes || null,
              name: row.values.opportunityName ?? "Untitled opportunity",
              next_step: row.values.nextStep || null,
              owner_user_id: user.id,
              pain: row.values.pain || null,
              source: row.values.source || "CSV import",
              stage: row.values.stage || "Qualification",
              workspace_id: workspaceId,
            } satisfies TablesInsert<"opportunities">)
            .select("id")
            .single()

          if (response.error) throw new Error(response.error.message)

          await replaceOpportunityPlaybooks(response.data.id, getPlaybookIds(playbooks, row.values.playbooks))
          summary.created += 1
        }
      } catch (error) {
        summary.failed += 1
        summary.failures.push({
          message: error instanceof Error ? error.message : "Row could not be imported.",
          rowNumber: row.rowNumber,
          values: originalRow,
        })
      }
    }

    return dataResponse(summary)

    async function resolveAccountForRow({
      accounts,
      createdAccountByKey,
      defaultCurrency,
      rowValues,
      userId,
      workspaceId,
    }: {
      accounts: AccountLookup[]
      createdAccountByKey: Map<string, AccountLookup>
      defaultCurrency: CurrencyCode
      rowValues: Partial<Record<string, string>>
      userId: string
      workspaceId: string
    }) {
      const accountName = rowValues.accountName?.trim()
      if (!accountName) throw new Error("Account name is required.")

      const matchedAccount = accounts.find((account) => {
        const sameName = normalizeImportComparable(account.name) === normalizeImportComparable(accountName)
        const sameDomain =
          normalizeImportDomain(rowValues.accountWebsite) &&
          normalizeImportDomain(account.website) === normalizeImportDomain(rowValues.accountWebsite)

        return sameName || sameDomain
      })

      if (matchedAccount) return matchedAccount

      const createdKey = `${normalizeImportComparable(accountName)}:${normalizeImportDomain(rowValues.accountWebsite)}`
      const createdAccount = createdAccountByKey.get(createdKey)
      if (createdAccount) return createdAccount

      const accountPayload: TablesInsert<"accounts"> = {
        currency: resolveImportCurrency(rowValues.currency, defaultCurrency),
        industry: rowValues.industry || null,
        name: accountName,
        owner_user_id: userId,
        region: "Australia",
        website: rowValues.accountWebsite || null,
        workspace_id: workspaceId,
        ...buildAccountLogoMetadata(rowValues.accountWebsite || null),
      }
      const response = await supabase.from("accounts").insert(accountPayload).select("id,name,website,currency").single()

      if (response.error) throw new Error(response.error.message)

      accounts.push(response.data)
      createdAccountByKey.set(createdKey, response.data)
      return response.data
    }

    async function assertOpportunityInWorkspace(opportunityId: string, currentWorkspaceId: string) {
      const response = await supabase
        .from("opportunities")
        .select("id")
        .eq("id", opportunityId)
        .eq("workspace_id", currentWorkspaceId)
        .maybeSingle()

      if (response.error) throw new Error(response.error.message)
      if (!response.data) {
        throw badRequest("Opportunity update target does not belong to the selected workspace.", "cross_workspace_opportunity_rejected")
      }
    }

    async function replaceOpportunityPlaybooks(opportunityId: string, playbookIds: string[]) {
      const deleteResponse = await supabase
        .from("opportunity_playbooks")
        .delete()
        .eq("opportunity_id", opportunityId)

      if (deleteResponse.error) throw new Error(deleteResponse.error.message)
      if (playbookIds.length === 0) return

      const insertResponse = await supabase
        .from("opportunity_playbooks")
        .insert(playbookIds.map((playbookId) => ({ opportunity_id: opportunityId, playbook_id: playbookId })))

      if (insertResponse.error) throw new Error(insertResponse.error.message)
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

function buildOpportunityUpdatePayload(
  values: Partial<Record<string, string>>,
  account: AccountLookup,
  defaultCurrency: CurrencyCode = defaultCurrencyCode
) {
  const updatePayload: TablesUpdate<"opportunities"> = {}

  assignIfPresent(updatePayload, "name", values.opportunityName)
  assignIfPresent(updatePayload, "stage", values.stage)
  assignIfPresent(updatePayload, "source", values.source)
  assignIfPresent(updatePayload, "pain", values.pain)
  assignIfPresent(updatePayload, "decision_process", values.decisionProcess)
  assignIfPresent(updatePayload, "next_step", values.nextStep)
  assignIfPresent(updatePayload, "manual_notes", values.manualNotes)
  assignIfPresent(updatePayload, "call_type", values.callType)

  if (values.amount?.trim()) {
    updatePayload.amount = formatCurrencyAmount(values.amount, account.currency ?? defaultCurrency)
  }

  if (values.closeDate?.trim()) {
    const closeDate = normalizeCloseDateForPersistence(values.closeDate)
    updatePayload.close_date = closeDate.date
    updatePayload.close_date_note = closeDate.note
  }

  return updatePayload
}

function assignIfPresent<T extends Record<string, unknown>>(target: T, key: string, value: unknown) {
  if (typeof value === "string" && value.trim()) {
    target[key as keyof T] = value.trim() as T[keyof T]
  }
}

function getPlaybookIds(playbooks: PlaybookLookup[], value: string | null | undefined) {
  const selected = new Set(normalizeCsvImportPlaybooks(value))
  const workspaceCustomPlaybook = playbooks.find((playbook) => playbook.slug === "custom" && !playbook.is_system)

  return playbooks
    .filter((playbook) => {
      if (playbook.slug === "custom") {
        return selected.has("Custom framework") && playbook.id === (workspaceCustomPlaybook?.id ?? playbook.id)
      }

      const normalizedName = playbook.name.toLowerCase()
      const canonicalPlaybook =
        callPlaybookOptions.find((option) => option.toLowerCase() === normalizedName) ??
        callPlaybookAliases[normalizedName]

      return canonicalPlaybook ? selected.has(canonicalPlaybook) : selected.has(playbook.name as CallPlaybook)
    })
    .map((playbook) => playbook.id)
}

export const config: Config = {
  path: "/api/import/opportunities",
  method: ["POST"],
}
