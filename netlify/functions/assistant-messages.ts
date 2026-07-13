import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid } from "./_shared/assistant-core"
import { listAssistantMessages } from "./_shared/assistant-store"
import { dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { requireUser } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()
    const threadId = assertAssistantUuid(context.params.threadId, "threadId")
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50)
    const { supabase, token, user } = await requireUser(request)
    return dataResponse(await listAssistantMessages(
      supabase,
      threadId,
      { token, userId: user.id },
      Number.isFinite(limit) ? limit : 50
    ))
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't load that conversation yet.", {
      context,
      functionName: "assistant-messages",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/threads/:threadId/messages",
  method: ["GET"],
}
