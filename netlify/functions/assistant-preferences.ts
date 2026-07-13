import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid } from "./_shared/assistant-core"
import { getAssistantPreference, updateAssistantPreference } from "./_shared/assistant-store"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { requireUser } from "./_shared/supabase"

type PreferencePayload = {
  activeThreadId?: string | null
  interfaceMode?: unknown
  lastStandardPath?: unknown
  workspaceId?: unknown
}

export default async (request: Request, context: Context) => {
  try {
    const { supabase, token, user } = await requireUser(request)
    if (request.method === "GET") {
      const value = new URL(request.url).searchParams.get("workspaceId")
      if (!value) throw badRequest("workspaceId is required.", "workspace_id_required")
      const workspaceId = assertAssistantUuid(value, "workspaceId")
      return dataResponse(await getAssistantPreference(supabase, workspaceId, { token, userId: user.id }))
    }
    if (request.method === "POST") {
      const payload = await readJson<PreferencePayload>(request)
      const workspaceId = assertAssistantUuid(payload.workspaceId, "workspaceId")
      return dataResponse(await updateAssistantPreference({
        activeThreadId: payload.activeThreadId,
        interfaceMode: payload.interfaceMode,
        lastStandardPath: payload.lastStandardPath,
        options: { token, userId: user.id },
        supabase,
        workspaceId,
      }))
    }
    throw methodNotAllowed()
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't save that workspace preference yet.", {
      context,
      functionName: "assistant-preferences",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/preferences",
  method: ["GET", "POST"],
}
