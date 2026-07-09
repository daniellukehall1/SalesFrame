import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { processQueuedEnrichmentJobs, resumePausedEnrichmentJobs } from "./_shared/import-enrichment"
import { getOpenAiKeyStatus, removeOpenAiKey, saveOpenAiKey } from "./_shared/openai-key"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"

type SaveKeyPayload = {
  apiKey?: string
  workspaceId?: string
}

export default async (request: Request, context: Context) => {
  try {
    const { supabase, token, user } = await requireUser(request)
    const requestUrl = new URL(request.url)
    const queryWorkspaceId = requestUrl.searchParams.get("workspaceId") ?? undefined

    if (request.method === "GET") {
      const workspaceId = queryWorkspaceId
      if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")
      await authorizeWorkspace(user.id, workspaceId, supabase, { token })

      return dataResponse(await getOpenAiKeyStatus(supabase, user.id, workspaceId))
    }

    if (request.method === "POST") {
      const payload = await readJson<SaveKeyPayload>(request)
      const workspaceId = payload.workspaceId ?? queryWorkspaceId
      if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")
      await authorizeWorkspace(user.id, workspaceId, supabase, { token })

      const status = await saveOpenAiKey({
        apiKey: payload.apiKey ?? "",
        supabase,
        userId: user.id,
        workspaceId,
      })
      await resumePausedEnrichmentJobs({ supabase, userId: user.id, workspaceId })
      context.waitUntil(
        processQueuedEnrichmentJobs({ limit: 3, supabase, userId: user.id, workspaceId }).catch(() => undefined)
      )

      return dataResponse(
        status
      )
    }

    if (request.method === "DELETE") {
      const workspaceId = queryWorkspaceId
      if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")
      await authorizeWorkspace(user.id, workspaceId, supabase, { token })
      await removeOpenAiKey(supabase, user.id, workspaceId)

      return dataResponse({ connected: false })
    }

    throw methodNotAllowed()
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/key",
  method: ["GET", "POST", "DELETE"],
}
