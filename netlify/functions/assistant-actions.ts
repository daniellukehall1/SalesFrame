import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid } from "./_shared/assistant-core"
import { cancelAssistantProposal } from "./_shared/assistant-store"
import { errorResponse, methodNotAllowed } from "./_shared/http"
import { requireUser } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "DELETE") throw methodNotAllowed()
    const proposalId = assertAssistantUuid(context.params.proposalId, "proposalId")
    const { supabase, token, user } = await requireUser(request)
    await cancelAssistantProposal(supabase, proposalId, { token, userId: user.id })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't cancel that action yet.", {
      context,
      functionName: "assistant-actions",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/actions/:proposalId",
  method: ["DELETE"],
}
