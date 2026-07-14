import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid, assertAssistantUuidV4 } from "./_shared/assistant-core"
import {
  createAssistantThread,
  ensureAssistantDefaultThread,
  getAssistantPreference,
  listAssistantThreads,
} from "./_shared/assistant-store"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { requireUser } from "./_shared/supabase"

type CreateThreadPayload = {
  ensureDefault?: unknown
  threadId?: unknown
  title?: unknown
  workspaceId?: unknown
}

export default async (request: Request, context: Context) => {
  try {
    const { supabase, token, user } = await requireUser(request)
    const options = { token, userId: user.id }
    if (request.method === "GET") {
      const url = new URL(request.url)
      const value = url.searchParams.get("workspaceId")
      if (!value) throw badRequest("workspaceId is required.", "workspace_id_required")
      const workspaceId = assertAssistantUuid(value, "workspaceId")
      const includeArchived = url.searchParams.get("includeArchived") === "true"
      const [threads, preference] = await Promise.all([
        listAssistantThreads(supabase, workspaceId, options, includeArchived),
        getAssistantPreference(supabase, workspaceId, options),
      ])
      return dataResponse({ preference, threads })
    }
    if (request.method === "POST") {
      const payload = await readJson<CreateThreadPayload>(request)
      const workspaceId = assertAssistantUuid(payload.workspaceId, "workspaceId")
      if (payload.ensureDefault !== undefined && payload.ensureDefault !== true) {
        throw badRequest("Conversation bootstrap state is invalid.", "assistant_thread_bootstrap_invalid")
      }
      if (payload.ensureDefault === true) {
        if (payload.title !== undefined || payload.threadId !== undefined) {
          throw badRequest("A default conversation cannot include a custom title.", "assistant_thread_bootstrap_invalid")
        }
        return dataResponse({ thread: await ensureAssistantDefaultThread({
          options,
          supabase,
          workspaceId,
        }) })
      }
      return dataResponse({ thread: await createAssistantThread({
        options,
        supabase,
        threadId: payload.threadId === undefined
          ? undefined
          : assertAssistantUuidV4(payload.threadId, "threadId"),
        title: payload.title,
        workspaceId,
      }) }, 201)
    }
    throw methodNotAllowed()
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't open that conversation yet.", {
      context,
      functionName: "assistant-threads",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/threads",
  method: ["GET", "POST"],
}
