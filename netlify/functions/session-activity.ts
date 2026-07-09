import type { Config } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"
import {
  getOrCreateWorkspaceSessionStatus,
  type WorkspaceSessionActivityType,
} from "./_shared/workspace-session"

type SessionActivityPayload = {
  activeCallId?: string | null
  activityType?: WorkspaceSessionActivityType
  workspaceId?: string
}

export default async (request: Request) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const { supabase, token, user } = await requireUser(request)
    const payload = await readJson<SessionActivityPayload>(request)
    const workspaceId = payload.workspaceId?.trim()

    if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")

    await authorizeWorkspace(user.id, workspaceId, supabase, { requireActiveSession: false })

    const status = await getOrCreateWorkspaceSessionStatus({
      activeCallId: payload.activeCallId ?? null,
      activityType: payload.activityType ?? "user_activity",
      force: true,
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
  path: "/api/session/activity",
  method: "POST",
}
