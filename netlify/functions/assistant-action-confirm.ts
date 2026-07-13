import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid, requireWorkspaceAssistantEnabled } from "./_shared/assistant-core"
import { confirmAssistantProposal } from "./_shared/assistant-store"
import { dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { requireUser } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    requireWorkspaceAssistantEnabled()
    const proposalId = assertAssistantUuid(context.params.proposalId, "proposalId")
    const { supabase, token, user } = await requireUser(request)
    return dataResponse(await confirmAssistantProposal(supabase, proposalId, { token, userId: user.id }))
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't complete that action yet.", {
      context,
      functionName: "assistant-action-confirm",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/actions/:proposalId/confirm",
  method: ["POST"],
}
