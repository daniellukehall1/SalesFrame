import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid, requireWorkspaceAssistantEnabled } from "./_shared/assistant-core"
import { getAssistantTaskArtifact } from "./_shared/assistant-store"
import { dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { requireUser } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()
    requireWorkspaceAssistantEnabled()
    const taskId = assertAssistantUuid(context.params.taskId, "taskId")
    const { supabase, token, user } = await requireUser(request)
    assertRateLimit({ key: user.id, limit: 120, name: "conversation task reads", windowMs: 60_000 })
    const artifact = await getAssistantTaskArtifact(supabase, taskId, { token, userId: user.id })
    return dataResponse({ artifact })
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't load that progress update yet.", {
      context,
      functionName: "assistant-task",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/tasks/:taskId",
  method: ["GET"],
}
