import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, logSafeEvent, methodNotAllowed, readJson } from "./_shared/http"
import { getSupabaseAdmin } from "./_shared/supabase"

type ScheduledCleanupPayload = {
  next_run?: unknown
}

type ExpiredCallRecording = {
  id: string
  recording_storage_path: string | null
  workspace_id: string
}

type ExpiredRecordingUploadReconciliation = {
  cleanup_started_at: string
  call_id: string
  id: string
  storage_path: string
  workspace_id: string
}

const deepgramGrantRetentionMs = 24 * 60 * 60 * 1000
const recordingReconciliationBatchLimit = 50
const recordingReconciliationMaxBatches = 4
const recordingReconciliationStaleClaimSeconds = 15 * 60

export function isScopedRecordingPath(call: ExpiredCallRecording) {
  const pathParts = call.recording_storage_path?.split("/") ?? []
  const [workspaceId, callId, ...fileNameParts] = pathParts

  return (
    workspaceId === call.workspace_id &&
    callId === call.id &&
    Boolean(fileNameParts.join("/"))
  )
}

export function isScopedReconciliationPath(
  registration: ExpiredRecordingUploadReconciliation
) {
  const pathParts = registration.storage_path.split("/")

  return (
    pathParts.length === 3 &&
    pathParts[0] === registration.workspace_id &&
    pathParts[1] === registration.call_id &&
    Boolean(pathParts[2])
  )
}

function assertScheduledPayload(payload: ScheduledCleanupPayload) {
  if (typeof payload.next_run !== "string" || Number.isNaN(Date.parse(payload.next_run))) {
    throw badRequest("Scheduled cleanup request was not recognized.", "invalid_scheduled_cleanup_request")
  }
}

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    assertScheduledPayload(await readJson<ScheduledCleanupPayload>(request))

    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()
    const expiredGrantCutoff = new Date(Date.now() - deepgramGrantRetentionMs).toISOString()
    const { count: removedDeepgramTokenGrantCount, error: grantCleanupError } = await supabase
      .from("deepgram_token_grants")
      .delete({ count: "exact" })
      .lt("issued_at", expiredGrantCutoff)

    if (grantCleanupError) throw new Error(grantCleanupError.message)

    let claimedRecordingRegistrations = 0
    let clearedReferencedRecordingRegistrations = 0
    let removedOrphanedRecordingUploads = 0
    let skippedInvalidRecordingRegistrations = 0

    // Drain a bounded number of pages so a steady orphan backlog cannot remain
    // permanently capped at one page per run. Four hourly batches provide up
    // to 4,800 claims/day while bounding each scheduled invocation.
    for (let batch = 0; batch < recordingReconciliationMaxBatches; batch += 1) {
      const { data: expiredReconciliations, error: reconciliationReadError } = await supabase
        .rpc("claim_expired_recording_upload_reconciliations", {
          batch_limit: recordingReconciliationBatchLimit,
          stale_claim_seconds: recordingReconciliationStaleClaimSeconds,
        })

      if (reconciliationReadError) throw new Error(reconciliationReadError.message)

      const claimedBatch = expiredReconciliations ?? []
      claimedRecordingRegistrations += claimedBatch.length

      if (claimedBatch.length === 0) break

      const scopedReconciliations = claimedBatch.filter(isScopedReconciliationPath)
      const skippedInvalidReconciliations = claimedBatch.length - scopedReconciliations.length
      skippedInvalidRecordingRegistrations += skippedInvalidReconciliations

      if (skippedInvalidReconciliations > 0) {
        logSafeEvent("error", "recording_reconciliation_path_mismatch", {
          skippedRegistrations: skippedInvalidReconciliations,
        })
      }

      const reconciliationPaths = scopedReconciliations.map(
        (registration) => registration.storage_path
      )
      const referencedRecordingPaths = new Set<string>()

      if (reconciliationPaths.length > 0) {
        const { data: referencedCalls, error: referencedCallReadError } = await supabase
          .from("calls")
          .select("recording_storage_path")
          .in("recording_storage_path", reconciliationPaths)

        if (referencedCallReadError) throw new Error(referencedCallReadError.message)

        for (const call of referencedCalls ?? []) {
          if (call.recording_storage_path) referencedRecordingPaths.add(call.recording_storage_path)
        }
      }

      const referencedReconciliationIds: string[] = []
      const unreferencedReconciliationIds: string[] = []
      const unreferencedRecordingPaths: string[] = []

      for (const registration of scopedReconciliations) {
        if (referencedRecordingPaths.has(registration.storage_path)) {
          referencedReconciliationIds.push(registration.id)
        } else {
          unreferencedReconciliationIds.push(registration.id)
          unreferencedRecordingPaths.push(registration.storage_path)
        }
      }

      if (referencedReconciliationIds.length > 0) {
        const { error: referencedLedgerDeleteError } = await supabase
          .from("recording_upload_reconciliations")
          .delete()
          .in("id", referencedReconciliationIds)

        if (referencedLedgerDeleteError) throw new Error(referencedLedgerDeleteError.message)

        clearedReferencedRecordingRegistrations += referencedReconciliationIds.length
      }

      if (unreferencedRecordingPaths.length > 0) {
        const { error: orphanRemoveError } = await supabase.storage
          .from("call-recordings")
          .remove(unreferencedRecordingPaths)

        if (orphanRemoveError) throw new Error(orphanRemoveError.message)

        const { error: orphanLedgerDeleteError } = await supabase
          .from("recording_upload_reconciliations")
          .delete()
          .in("id", unreferencedReconciliationIds)

        if (orphanLedgerDeleteError) throw new Error(orphanLedgerDeleteError.message)

        removedOrphanedRecordingUploads += unreferencedRecordingPaths.length
      }

      if (claimedBatch.length < recordingReconciliationBatchLimit) break
    }

    const { data: expiredCalls, error } = await supabase
      .from("calls")
      .select("id,workspace_id,recording_storage_path")
      .lte("retention_expires_at", now)
      .not("recording_storage_path", "is", null)
      .limit(100)

    if (error) throw new Error(error.message)

    const canonicalCalls = (expiredCalls ?? []).filter(isScopedRecordingPath)
    const skippedMismatchedCalls = (expiredCalls?.length ?? 0) - canonicalCalls.length

    if (skippedMismatchedCalls > 0) {
      logSafeEvent("error", "retention_cleanup_path_mismatch", {
        skippedCalls: skippedMismatchedCalls,
      })
    }

    const recordingPaths =
      canonicalCalls
        ?.map((call) => call.recording_storage_path)
        .filter((path): path is string => Boolean(path)) ?? []

    if (recordingPaths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from("call-recordings")
        .remove(recordingPaths)

      if (removeError) throw new Error(removeError.message)
    }

    const expiredCallIds = canonicalCalls.map((call) => call.id)

    if (expiredCallIds.length > 0) {
      const { error: updateError } = await supabase
        .from("calls")
        .update({
          recording_storage_path: null,
          recording_url: null,
          status: "archived",
        })
        .in("id", expiredCallIds)

      if (updateError) throw new Error(updateError.message)
    }

    return dataResponse({
      archivedCalls: expiredCallIds.length,
      claimedRecordingRegistrations,
      clearedReferencedRecordingRegistrations,
      removedDeepgramTokenGrants: removedDeepgramTokenGrantCount ?? 0,
      removedOrphanedRecordingUploads,
      removedRecordings: recordingPaths.length,
      skippedInvalidRecordingRegistrations,
      skippedMismatchedCalls,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  method: ["POST"],
  schedule: "@hourly",
}
