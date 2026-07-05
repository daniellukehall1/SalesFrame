import type { SupabaseClient } from "@supabase/supabase-js"

import {
  normalizeImportDomain,
  type CsvImportSummary,
  type CsvImportType,
} from "../../../src/lib/csv-import"
import type { Database, Json, Tables, TablesInsert } from "../../../src/lib/supabase/database.types"
import { runAccountEnrichmentForAccount } from "../account-enrichment"
import { getPublicErrorMessageForError, logSafeEvent } from "./http"

export type AccountEnrichmentQueueTarget = {
  accountId: string
  name?: string | null
  opportunityId?: string | null
  website?: string | null
}

type ImportSummaryCounts = Pick<CsvImportSummary, "created" | "failed" | "failures" | "skipped" | "updated">

export type BulkImportRunStatus = {
  createdAt: string
  failureRows: CsvImportSummary["failures"]
  fileName: string | null
  id: string
  importType: string
  lastUpdatedAt: string
  progress: number
  rowCount: number
  rows: {
    created: number
    failed: number
    skipped: number
    updated: number
  }
  enrichment: {
    alreadyTracked: number
    completed: number
    failed: number
    paused: number
    queued: number
    retrying: number
    running: number
    skipped: number
    total: number
  }
}

const activeJobStatuses = new Set(["queued", "running", "retrying", "succeeded", "paused_missing_key"])
const staleRunningWindowMs = 10 * 60 * 1000

export function createImportEnrichmentSummary(enabled = true): CsvImportSummary["enrichment"] {
  return {
    alreadyTracked: 0,
    enabled,
    paused: 0,
    queued: 0,
    skipped: 0,
    status: enabled ? "none" : "off",
  }
}

export async function createCsvImportRun({
  enrichmentEnabled,
  fileName,
  importType,
  rowCount,
  supabase,
  userId,
  workspaceId,
}: {
  enrichmentEnabled: boolean
  fileName?: string
  importType: CsvImportType
  rowCount: number
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  const response = await supabase
    .from("csv_import_runs")
    .insert({
      created_by_user_id: userId,
      enrichment_enabled: enrichmentEnabled,
      file_name: fileName?.trim() || null,
      import_type: importType,
      row_count: rowCount,
      workspace_id: workspaceId,
    })
    .select("id")
    .single()

  if (isMissingRelationError(response.error)) return null
  if (response.error) throw new Error(response.error.message)

  return response.data.id
}

export async function finalizeCsvImportRun({
  importRunId,
  summary,
  supabase,
}: {
  importRunId: string | null
  summary: ImportSummaryCounts & { enrichment: CsvImportSummary["enrichment"] }
  supabase: SupabaseClient<Database>
}) {
  if (!importRunId) return

  const response = await supabase
    .from("csv_import_runs")
    .update({
      created_count: summary.created,
      enrichment_already_tracked_count: summary.enrichment.alreadyTracked,
      enrichment_paused_count: summary.enrichment.paused,
      enrichment_queued_count: summary.enrichment.queued,
      enrichment_skipped_count: summary.enrichment.skipped,
      failed_count: summary.failed,
      failure_rows: summary.failures as unknown as Json,
      skipped_count: summary.skipped,
      updated_count: summary.updated,
    })
    .eq("id", importRunId)

  if (response.error && !isMissingRelationError(response.error)) throw new Error(response.error.message)
}

export async function queueAccountEnrichmentJobs({
  enabled,
  importRunId,
  supabase,
  targets,
  userId,
  workspaceId,
}: {
  enabled: boolean
  importRunId: string | null
  supabase: SupabaseClient<Database>
  targets: AccountEnrichmentQueueTarget[]
  userId: string
  workspaceId: string
}) {
  const enrichment = createImportEnrichmentSummary(enabled)
  if (!enabled) return enrichment

  const uniqueTargets = dedupeTargets(targets)
  const validTargets = uniqueTargets.filter((target) => normalizeImportDomain(target.website))
  enrichment.skipped += uniqueTargets.length - validTargets.length

  if (validTargets.length === 0) {
    enrichment.status = "none"
    return enrichment
  }

  const hasOpenAiKey = await workspaceHasOpenAiKey({ supabase, userId, workspaceId })
  const status = hasOpenAiKey ? "queued" : "paused_missing_key"
  const idempotencyKeys = validTargets.map((target) =>
    buildAccountEnrichmentIdempotencyKey(workspaceId, target.accountId, target.website)
  )
  const existingResponse = await supabase
    .from("ai_enrichment_jobs")
    .select("idempotency_key,status")
    .eq("workspace_id", workspaceId)
    .in("idempotency_key", idempotencyKeys)

  if (isMissingRelationError(existingResponse.error)) {
    enrichment.status = "unavailable"
    enrichment.skipped += validTargets.length
    return enrichment
  }
  if (existingResponse.error) throw new Error(existingResponse.error.message)

  const existingJobs = new Map((existingResponse.data ?? []).map((job) => [job.idempotency_key, job.status]))
  const jobsToInsert: TablesInsert<"ai_enrichment_jobs">[] = []

  for (const target of validTargets) {
    const idempotencyKey = buildAccountEnrichmentIdempotencyKey(workspaceId, target.accountId, target.website)
    const existingStatus = existingJobs.get(idempotencyKey)

    if (existingStatus && activeJobStatuses.has(existingStatus)) {
      enrichment.alreadyTracked += 1
      continue
    }

    jobsToInsert.push({
      account_id: target.accountId,
      created_by_user_id: userId,
      idempotency_key: idempotencyKey,
      import_run_id: importRunId,
      job_type: "account_enrichment",
      opportunity_id: target.opportunityId ?? null,
      requested_account_name: target.name ?? null,
      requested_domain: normalizeImportDomain(target.website),
      status,
      workspace_id: workspaceId,
    })
  }

  if (jobsToInsert.length > 0) {
    const insertResponse = await supabase
      .from("ai_enrichment_jobs")
      .upsert(jobsToInsert, { onConflict: "workspace_id,idempotency_key" })

    if (insertResponse.error) throw new Error(insertResponse.error.message)
  }

  if (status === "queued") {
    enrichment.queued = jobsToInsert.length
    enrichment.status = jobsToInsert.length > 0 ? "queued" : "none"
  } else {
    enrichment.paused = jobsToInsert.length
    enrichment.status = jobsToInsert.length > 0 ? "paused_missing_key" : "none"
  }

  return enrichment
}

export async function listBulkImportStatus({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient<Database>
  workspaceId: string
}) {
  const runsResponse = await supabase
    .from("csv_import_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(8)

  if (isMissingRelationError(runsResponse.error)) return { runs: [], pausedMissingKeyCount: 0 }
  if (runsResponse.error) throw new Error(runsResponse.error.message)

  const runs = runsResponse.data ?? []
  const runIds = runs.map((run) => run.id)
  const jobsResponse = runIds.length
    ? await supabase
        .from("ai_enrichment_jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("import_run_id", runIds)
    : { data: [], error: null }

  if (isMissingRelationError(jobsResponse.error)) return { runs: [], pausedMissingKeyCount: 0 }
  if (jobsResponse.error) throw new Error(jobsResponse.error.message)

  const pausedResponse = await supabase
    .from("ai_enrichment_jobs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "paused_missing_key")

  if (pausedResponse.error && !isMissingRelationError(pausedResponse.error)) {
    throw new Error(pausedResponse.error.message)
  }

  const jobsByRun = groupJobsByRun(jobsResponse.data ?? [])

  return {
    pausedMissingKeyCount: pausedResponse.count ?? 0,
    runs: runs.map((run) => mapImportRunStatus(run, jobsByRun.get(run.id) ?? [])),
  }
}

export async function processQueuedEnrichmentJobs({
  limit = 3,
  supabase,
  userId,
  workerId = `salesframe-import-enrichment-${Date.now()}`,
  workspaceId,
}: {
  limit?: number
  supabase: SupabaseClient<Database>
  userId?: string
  workerId?: string
  workspaceId?: string
}) {
  const now = new Date().toISOString()
  const safeLimit = Math.max(1, Math.min(10, limit))

  await releaseStaleRunningJobs({ supabase, userId, workspaceId })

  let query = supabase
    .from("ai_enrichment_jobs")
    .select("*")
    .in("status", ["queued", "retrying"])
    .lte("run_after", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(safeLimit)

  if (workspaceId) query = query.eq("workspace_id", workspaceId)
  if (userId) query = query.eq("created_by_user_id", userId)

  const jobsResponse = await query

  if (isMissingRelationError(jobsResponse.error)) return { failed: 0, paused: 0, processed: 0, retried: 0, skipped: 0, succeeded: 0 }
  if (jobsResponse.error) throw new Error(jobsResponse.error.message)

  const counts = { failed: 0, paused: 0, processed: 0, retried: 0, skipped: 0, succeeded: 0 }

  for (const job of jobsResponse.data ?? []) {
    const attemptNumber = job.attempts + 1
    const lockResponse = await supabase
      .from("ai_enrichment_jobs")
      .update({
        attempts: attemptNumber,
        last_error: null,
        locked_at: new Date().toISOString(),
        locked_by: workerId,
        status: "running",
      })
      .eq("id", job.id)
      .in("status", ["queued", "retrying"])
      .select("*")
      .maybeSingle()

    if (lockResponse.error) {
      logSafeEvent("warn", "bulk_import_enrichment_lock_failed", {
        jobId: job.id,
        message: lockResponse.error.message,
        workspaceId: job.workspace_id,
      })
      continue
    }
    if (!lockResponse.data) continue

    const lockedJob = lockResponse.data
    counts.processed += 1

    try {
      const accountResponse = await supabase
        .from("accounts")
        .select("id")
        .eq("workspace_id", lockedJob.workspace_id)
        .eq("id", lockedJob.account_id)
        .maybeSingle()

      if (accountResponse.error) throw new Error(accountResponse.error.message)
      if (!accountResponse.data) {
        await markJobTerminal({
          lastError: "Account no longer exists.",
          status: "skipped",
          supabase,
          job: lockedJob,
        })
        counts.skipped += 1
        continue
      }

      if (!lockedJob.created_by_user_id) {
        throw new Error("The enrichment job does not have an owner to authorize.")
      }

      await runAccountEnrichmentForAccount({
        accountId: lockedJob.account_id,
        rateLimit: false,
        supabase,
        userId: lockedJob.created_by_user_id,
      })

      await markJobTerminal({
        lastError: null,
        status: "succeeded",
        supabase,
        job: lockedJob,
      })
      counts.succeeded += 1
    } catch (error) {
      const publicMessage = getPublicErrorMessageForError(error, "SalesFrame could not enrich this account yet.")

      if (isOpenAiKeyMissingError(error)) {
        await markJobTerminal({
          lastError: publicMessage,
          status: "paused_missing_key",
          supabase,
          job: lockedJob,
        })
        counts.paused += 1
        continue
      }

      if (isAccountMissingError(error)) {
        await markJobTerminal({
          lastError: publicMessage,
          status: "skipped",
          supabase,
          job: lockedJob,
        })
        counts.skipped += 1
        continue
      }

      const shouldRetry = attemptNumber < lockedJob.max_attempts
      const updateResponse = await supabase
        .from("ai_enrichment_jobs")
        .update({
          last_error: publicMessage,
          locked_at: null,
          locked_by: null,
          run_after: shouldRetry ? getRetryRunAfter(attemptNumber) : new Date().toISOString(),
          status: shouldRetry ? "retrying" : "failed",
        })
        .eq("id", lockedJob.id)

      if (updateResponse.error) throw new Error(updateResponse.error.message)
      if (shouldRetry) counts.retried += 1
      else counts.failed += 1
    }
  }

  return counts
}

export async function retryFailedEnrichmentJobs({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  const hasOpenAiKey = await workspaceHasOpenAiKey({ supabase, userId, workspaceId })
  const nextStatus = hasOpenAiKey ? "queued" : "paused_missing_key"
  const response = await supabase
    .from("ai_enrichment_jobs")
    .update({
      last_error: null,
      locked_at: null,
      locked_by: null,
      run_after: new Date().toISOString(),
      status: nextStatus,
    })
    .eq("workspace_id", workspaceId)
    .eq("created_by_user_id", userId)
    .eq("status", "failed")

  if (response.error) throw new Error(response.error.message)

  return nextStatus
}

export async function resumePausedEnrichmentJobs({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  const response = await supabase
    .from("ai_enrichment_jobs")
    .update({
      last_error: null,
      run_after: new Date().toISOString(),
      status: "queued",
    })
    .eq("workspace_id", workspaceId)
    .eq("created_by_user_id", userId)
    .eq("status", "paused_missing_key")

  if (response.error && !isMissingRelationError(response.error)) throw new Error(response.error.message)
}

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false

  return error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table|relation .* does not exist|schema cache/i.test(error.message ?? "")
}

async function workspaceHasOpenAiKey({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  const response = await supabase
    .from("user_ai_settings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "openai")
    .not("openai_api_key_encrypted", "is", null)
    .maybeSingle()

  if (response.error) throw new Error(response.error.message)

  return Boolean(response.data)
}

function dedupeTargets(targets: AccountEnrichmentQueueTarget[]) {
  const byKey = new Map<string, AccountEnrichmentQueueTarget>()

  for (const target of targets) {
    if (!target.accountId) continue

    const domain = normalizeImportDomain(target.website)
    const key = `${target.accountId}:${domain || "no-domain"}`
    if (!byKey.has(key)) byKey.set(key, target)
  }

  return [...byKey.values()]
}

function buildAccountEnrichmentIdempotencyKey(workspaceId: string, accountId: string, website?: string | null) {
  return `account_enrichment:${workspaceId}:${accountId}:${normalizeImportDomain(website)}`
}

function groupJobsByRun(jobs: Tables<"ai_enrichment_jobs">[]) {
  const map = new Map<string, Tables<"ai_enrichment_jobs">[]>()

  for (const job of jobs) {
    if (!job.import_run_id) continue
    const items = map.get(job.import_run_id) ?? []
    items.push(job)
    map.set(job.import_run_id, items)
  }

  return map
}

function mapImportRunStatus(run: Tables<"csv_import_runs">, jobs: Tables<"ai_enrichment_jobs">[]): BulkImportRunStatus {
  const enrichment = {
    alreadyTracked: run.enrichment_already_tracked_count,
    completed: countJobs(jobs, "succeeded"),
    failed: countJobs(jobs, "failed"),
    paused: countJobs(jobs, "paused_missing_key"),
    queued: countJobs(jobs, "queued"),
    retrying: countJobs(jobs, "retrying"),
    running: countJobs(jobs, "running"),
    skipped: countJobs(jobs, "skipped"),
    total: jobs.length,
  }
  const settled = enrichment.completed + enrichment.failed + enrichment.skipped
  const progress = enrichment.total === 0 ? 100 : Math.round((settled / enrichment.total) * 100)

  return {
    createdAt: run.created_at,
    enrichment,
    failureRows: Array.isArray(run.failure_rows) ? run.failure_rows as CsvImportSummary["failures"] : [],
    fileName: run.file_name,
    id: run.id,
    importType: run.import_type,
    lastUpdatedAt: getLatestUpdatedAt(run.updated_at, jobs),
    progress,
    rowCount: run.row_count,
    rows: {
      created: run.created_count,
      failed: run.failed_count,
      skipped: run.skipped_count,
      updated: run.updated_count,
    },
  }
}

function countJobs(jobs: Tables<"ai_enrichment_jobs">[], status: string) {
  return jobs.filter((job) => job.status === status).length
}

async function releaseStaleRunningJobs({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient<Database>
  userId?: string
  workspaceId?: string
}) {
  const staleBefore = new Date(Date.now() - staleRunningWindowMs).toISOString()
  let query = supabase
    .from("ai_enrichment_jobs")
    .update({
      last_error: "Worker timed out before the enrichment finished. SalesFrame will retry it.",
      locked_at: null,
      locked_by: null,
      run_after: new Date().toISOString(),
      status: "retrying",
    })
    .eq("status", "running")
    .lt("locked_at", staleBefore)

  if (workspaceId) query = query.eq("workspace_id", workspaceId)
  if (userId) query = query.eq("created_by_user_id", userId)

  const response = await query
  if (response.error && !isMissingRelationError(response.error)) throw new Error(response.error.message)
}

async function markJobTerminal({
  job,
  lastError,
  status,
  supabase,
}: {
  job: Tables<"ai_enrichment_jobs">
  lastError: string | null
  status: "failed" | "paused_missing_key" | "skipped" | "succeeded"
  supabase: SupabaseClient<Database>
}) {
  const response = await supabase
    .from("ai_enrichment_jobs")
    .update({
      last_error: lastError,
      locked_at: null,
      locked_by: null,
      status,
    })
    .eq("id", job.id)

  if (response.error) throw new Error(response.error.message)
}

function getRetryRunAfter(attemptNumber: number) {
  const retryDelaySeconds = Math.min(60 * 60, 30 * Math.pow(2, Math.max(0, attemptNumber - 1)))
  const jitterSeconds = Math.floor(Math.random() * 20)

  return new Date(Date.now() + (retryDelaySeconds + jitterSeconds) * 1000).toISOString()
}

function isOpenAiKeyMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "")

  return /openai api key|openai key|save .*key|key .*settings/i.test(message)
}

function isAccountMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "")

  return /account was not found|record was not found|not found/i.test(message)
}

function getLatestUpdatedAt(runUpdatedAt: string, jobs: Tables<"ai_enrichment_jobs">[]) {
  return jobs.reduce((latest, job) => {
    return new Date(job.updated_at).getTime() > new Date(latest).getTime() ? job.updated_at : latest
  }, runUpdatedAt)
}
