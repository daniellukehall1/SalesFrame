import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid, requireWorkspaceAssistantEnabled } from "./_shared/assistant-core"
import { prepareAssistantArtifactAction } from "./_shared/assistant-store"
import { dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { requireUser } from "./_shared/supabase"

type PreparePayload = { actionId?: unknown; artifactId?: unknown }

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    requireWorkspaceAssistantEnabled()
    const payload = await readJson<PreparePayload>(request)
    const artifactId = assertAssistantUuid(payload.artifactId, "artifactId")
    const actionId = assertAssistantUuid(payload.actionId, "actionId")
    const { supabase, token, user } = await requireUser(request)
    assertRateLimit({ key: user.id, limit: 30, name: "conversation action preparation", windowMs: 60_000 })
    return dataResponse(await prepareAssistantArtifactAction({
      actionId,
      artifactId,
      options: { token, userId: user.id },
      supabase,
    }))
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't prepare that action yet. Nothing was changed.", {
      context,
      functionName: "assistant-action-prepare",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/actions/prepare",
  method: ["POST"],
}
