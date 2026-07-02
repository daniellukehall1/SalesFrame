import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { getSupabaseAdmin } from "./_shared/supabase"

type ScheduledCleanupPayload = {
  next_run?: unknown
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
    const { data: expiredCalls, error } = await supabase
      .from("calls")
      .select("id,recording_storage_path")
      .lte("retention_expires_at", now)
      .not("recording_storage_path", "is", null)
      .limit(100)

    if (error) throw new Error(error.message)

    const recordingPaths =
      expiredCalls
        ?.map((call) => call.recording_storage_path)
        .filter((path): path is string => Boolean(path)) ?? []

    if (recordingPaths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from("call-recordings")
        .remove(recordingPaths)

      if (removeError) throw new Error(removeError.message)
    }

    const expiredCallIds = expiredCalls?.map((call) => call.id) ?? []

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
      removedRecordings: recordingPaths.length,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  method: ["POST"],
  schedule: "@daily",
}
