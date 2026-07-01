import type { Config, Context } from "@netlify/functions"

import { dataResponse, errorResponse } from "./_shared/http"
import { getSupabaseAdmin } from "./_shared/supabase"

export default async (_request: Request, _context: Context) => {
  try {
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
  schedule: "@daily",
}
