import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid } from "./_shared/assistant-core"
import { buildAssistantBriefing } from "./_shared/assistant-store"
import { badRequest, dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { requireUser } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()
    const value = new URL(request.url).searchParams.get("workspaceId")
    if (!value) throw badRequest("workspaceId is required.", "workspace_id_required")
    const workspaceId = assertAssistantUuid(value, "workspaceId")
    const { supabase, token, user } = await requireUser(request)
    return dataResponse(await buildAssistantBriefing(supabase, workspaceId, { token, userId: user.id }))
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't prepare that workspace briefing yet.", {
      context,
      functionName: "assistant-briefing",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/briefing",
  method: ["GET"],
}
