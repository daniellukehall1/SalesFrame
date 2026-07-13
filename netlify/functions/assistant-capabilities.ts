import type { Config, Context } from "@netlify/functions"

import { getAssistantCapabilityClientCatalog } from "../../src/lib/assistant-capability-registry"
import { assertAssistantUuid } from "./_shared/assistant-core"
import { badRequest, dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()
    const url = new URL(request.url)
    const rawWorkspaceId = url.searchParams.get("workspaceId")
    if (!rawWorkspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")
    const workspaceId = assertAssistantUuid(rawWorkspaceId, "workspaceId")
    const { supabase, token, user } = await requireUser(request)
    assertRateLimit({ key: `${workspaceId}:${user.id}`, limit: 60, name: "conversation capability reads", windowMs: 60_000 })
    await authorizeWorkspace(user.id, workspaceId, supabase, { token })

    return dataResponse({ capabilities: getAssistantCapabilityClientCatalog() })
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't load conversation actions yet.", {
      context,
      functionName: "assistant-capabilities",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/capabilities",
  method: ["GET"],
}
