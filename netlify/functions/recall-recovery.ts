import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { dispatchRecallWork } from "./_shared/recall-work-dispatch"

type ScheduledPayload = { next_run?: unknown }

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    const payload = await readJson<ScheduledPayload>(request)
    if (typeof payload.next_run !== "string" || Number.isNaN(Date.parse(payload.next_run))) {
      throw badRequest("Scheduled recovery request was not recognized.", "meeting_bot_recovery_invalid")
    }

    await dispatchRecallWork({ kind: "scheduled_sweep" })

    return dataResponse({ dispatched: true }, 202)
  } catch (error) {
    return errorResponse(error, undefined, {
      context,
      functionName: "recall-recovery",
      request,
    })
  }
}

export const config: Config = {
  method: "POST",
  schedule: "* * * * *",
}
