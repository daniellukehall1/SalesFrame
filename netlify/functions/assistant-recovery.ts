import type { Config, Context } from "@netlify/functions"

import { isWorkspaceAssistantEnabled } from "./_shared/assistant-core"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { getSupabaseAdmin } from "./_shared/supabase"

type ScheduledPayload = { next_run?: unknown }

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    const payload = await readJson<ScheduledPayload>(request)
    if (typeof payload.next_run !== "string" || Number.isNaN(Date.parse(payload.next_run))) {
      throw badRequest("Scheduled conversation recovery was not recognized.", "assistant_recovery_invalid")
    }
    if (!isWorkspaceAssistantEnabled()) {
      return dataResponse({ disabled: true }, 202)
    }

    const { data, error } = await getSupabaseAdmin().rpc("recover_stale_assistant_state", {
      batch_limit: 100,
    })
    if (error) throw new Error(error.message)
    return dataResponse(data, 202)
  } catch (error) {
    return errorResponse(error, "Conversation recovery needs another moment.", {
      context,
      functionName: "assistant-recovery",
      request,
    })
  }
}

export const config: Config = {
  method: "POST",
  schedule: "*/10 * * * *",
}
