import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid } from "./_shared/assistant-core"
import {
  authorizeAssistantThread,
  deleteAssistantThread,
  serializeAssistantThread,
  updateAssistantThread,
} from "./_shared/assistant-store"
import { dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { requireUser } from "./_shared/supabase"

type UpdateThreadPayload = { archived?: unknown; title?: unknown }

export default async (request: Request, context: Context) => {
  try {
    const threadId = assertAssistantUuid(context.params.threadId, "threadId")
    const { supabase, token, user } = await requireUser(request)
    const options = { token, userId: user.id }
    if (request.method === "GET") {
      return dataResponse({ thread: serializeAssistantThread(await authorizeAssistantThread(supabase, threadId, options)) })
    }
    if (request.method === "PATCH") {
      const payload = await readJson<UpdateThreadPayload>(request)
      return dataResponse({ thread: await updateAssistantThread({
        archived: payload.archived,
        options,
        supabase,
        threadId,
        title: payload.title,
      }) })
    }
    if (request.method === "DELETE") {
      await deleteAssistantThread(supabase, threadId, options)
      return new Response(null, { status: 204 })
    }
    throw methodNotAllowed()
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't update that conversation yet.", {
      context,
      functionName: "assistant-thread",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/threads/:threadId",
  method: ["GET", "PATCH", "DELETE"],
}
