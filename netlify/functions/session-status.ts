import type { Config } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"
import { getOrCreateWorkspaceSessionStatus } from "./_shared/workspace-session"

export default async (request: Request) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()

    const { supabase, token, user } = await requireUser(request)
    const requestUrl = new URL(request.url)
    const workspaceId = requestUrl.searchParams.get("workspaceId")?.trim()

    if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")

    await authorizeWorkspace(user.id, workspaceId, supabase, { requireActiveSession: false })

    const status = await getOrCreateWorkspaceSessionStatus({
      activityType: "app_load",
      supabase,
      token,
      userId: user.id,
      workspaceId,
    })

    return dataResponse(status)
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/session/status",
  method: "GET",
}
