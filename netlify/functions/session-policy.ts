import type { Config } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"
import {
  getWorkspaceSessionPolicy,
  requireWorkspaceOwner,
  updateWorkspaceSessionPolicy,
} from "./_shared/workspace-session"

type SessionPolicyPayload = {
  idleTimeoutSeconds?: number | null
  workspaceId?: string
}

export default async (request: Request) => {
  try {
    const { supabase, token, user } = await requireUser(request)
    const requestUrl = new URL(request.url)
    const queryWorkspaceId = requestUrl.searchParams.get("workspaceId")?.trim()

    if (request.method === "GET") {
      if (!queryWorkspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")

      await authorizeWorkspace(user.id, queryWorkspaceId, supabase, { token })

      return dataResponse(await getWorkspaceSessionPolicy(supabase, queryWorkspaceId))
    }

    if (request.method === "POST") {
      const payload = await readJson<SessionPolicyPayload>(request)
      const workspaceId = payload.workspaceId?.trim() || queryWorkspaceId

      if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")

      await authorizeWorkspace(user.id, workspaceId, supabase, { token })
      await requireWorkspaceOwner(supabase, user.id, workspaceId)

      return dataResponse(
        await updateWorkspaceSessionPolicy({
          idleTimeoutSeconds: payload.idleTimeoutSeconds ?? null,
          supabase,
          userId: user.id,
          workspaceId,
        })
      )
    }

    throw methodNotAllowed()
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/session/policy",
  method: ["GET", "POST"],
}
