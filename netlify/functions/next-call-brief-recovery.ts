import type { Config, Context } from "@netlify/functions"

import { dispatchNextCallBriefWork } from "./_shared/next-call-brief-dispatch"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { getSupabaseAdmin } from "./_shared/supabase"

type ScheduledPayload = { next_run?: unknown }

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    const payload = await readJson<ScheduledPayload>(request)
    if (typeof payload.next_run !== "string" || Number.isNaN(Date.parse(payload.next_run))) {
      throw badRequest("Scheduled Next call recovery was not recognized.", "next_call_recovery_invalid")
    }

    const supabase = getSupabaseAdmin()
    const { data: attempts, error } = await supabase.rpc("claim_due_next_call_brief_dispatches", {
      worker_id: `next-call-recovery:${context.requestId || "scheduled"}`,
      batch_limit: 10,
      lease_seconds: 120,
    })
    if (error) throw new Error(error.message)

    const results = await Promise.allSettled(
      (attempts ?? []).map((attempt) => dispatchNextCallBriefWork(attempt.id))
    )
    return dataResponse({
      claimed: attempts?.length ?? 0,
      dispatched: results.filter((result) => result.status === "fulfilled").length,
    }, 202)
  } catch (error) {
    return errorResponse(error, "Next call recovery needs another moment.", {
      context,
      functionName: "next-call-brief-recovery",
      request,
    })
  }
}

export const config: Config = {
  method: "POST",
  schedule: "*/2 * * * *",
}
