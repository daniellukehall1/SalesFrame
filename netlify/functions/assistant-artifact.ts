import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid, requireWorkspaceAssistantEnabled } from "./_shared/assistant-core"
import { getAssistantArtifactById } from "./_shared/assistant-store"
import { dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { requireUser } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()
    requireWorkspaceAssistantEnabled()
    const artifactId = assertAssistantUuid(context.params.artifactId, "artifactId")
    const { supabase, token, user } = await requireUser(request)
    assertRateLimit({ key: user.id, limit: 120, name: "conversation artifact reads", windowMs: 60_000 })
    const artifact = await getAssistantArtifactById(supabase, artifactId, { token, userId: user.id })
    return dataResponse({ artifact })
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't open that result yet.", {
      context,
      functionName: "assistant-artifact",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/artifacts/:artifactId",
  method: ["GET"],
}
