import type { Config } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, forbidden, methodNotAllowed, readJson } from "./_shared/http"
import { assertCallIsLive, authorizeCall, authorizeWorkspace, requireUser } from "./_shared/supabase"
import {
  getOrCreateWorkspaceSessionStatus,
  type WorkspaceSessionActivityType,
} from "./_shared/workspace-session"

type SessionActivityPayload = {
  activeCallId?: string | null
  activityType?: WorkspaceSessionActivityType
  workspaceId?: string
}

const workspaceSessionActivityTypes = new Set<WorkspaceSessionActivityType>([
  "app_load",
  "workspace_load",
  "workspace_switch",
  "route_change",
  "user_activity",
  "data_save",
  "file_upload",
  "live_call_heartbeat",
  "start_call_check",
  "stay_signed_in",
])

export default async (request: Request) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const { supabase, token, user } = await requireUser(request)
    const payload = await readJson<SessionActivityPayload>(request)
    const workspaceId = payload.workspaceId?.trim()
    const activityType = payload.activityType ?? "user_activity"

    if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")
    if (!workspaceSessionActivityTypes.has(activityType)) {
      throw badRequest("activityType is not recognized.", "session_activity_type_invalid")
    }

    let activeCallId: string | null = null
    if (payload.activeCallId) {
      const activeCall = await authorizeCall(user.id, payload.activeCallId, supabase, {
        requireActiveSession: false,
        token,
      })
      if (activeCall.workspace_id !== workspaceId) {
        throw forbidden("The active call does not belong to this workspace.")
      }
      assertCallIsLive(activeCall, {
        code: "session_call_not_active",
        message: "This call is no longer live and cannot extend the workspace session.",
      })
      activeCallId = activeCall.id
    } else {
      await authorizeWorkspace(user.id, workspaceId, supabase, { requireActiveSession: false })
    }

    const status = await getOrCreateWorkspaceSessionStatus({
      activeCallId,
      activityType,
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
