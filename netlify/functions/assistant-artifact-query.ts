import type { Config, Context } from "@netlify/functions"

import { assertAssistantText, assertAssistantUuid, requireWorkspaceAssistantEnabled } from "./_shared/assistant-core"
import { queryAssistantArtifactById } from "./_shared/assistant-store"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { requireUser } from "./_shared/supabase"

type QueryPayload = {
  cursor?: unknown
  filters?: unknown
  search?: unknown
  sort?: unknown
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    requireWorkspaceAssistantEnabled()
    const artifactId = assertAssistantUuid(context.params.artifactId, "artifactId")
    const payload = await readJson<QueryPayload>(request)
    if (payload.cursor !== undefined && payload.cursor !== null && payload.cursor !== "") {
      assertAssistantText(payload.cursor, "cursor", { max: 500 })
      throw badRequest("This result has no additional page.", "assistant_artifact_cursor_invalid")
    }
    const filters = payload.filters === undefined
      ? undefined
      : payload.filters && typeof payload.filters === "object" && !Array.isArray(payload.filters)
        ? payload.filters as Record<string, unknown>
        : (() => { throw badRequest("That result filter is not supported.", "assistant_artifact_filter_invalid") })()
    const { supabase, token, user } = await requireUser(request)
    assertRateLimit({ key: user.id, limit: 60, name: "conversation artifact queries", windowMs: 60_000 })
    const artifact = await queryAssistantArtifactById({
      artifactId,
      filters,
      options: { token, userId: user.id },
      search: payload.search,
      sort: payload.sort,
      supabase,
    })
    return dataResponse({ artifact })
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't update that result yet.", {
      context,
      functionName: "assistant-artifact-query",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/artifacts/:artifactId/query",
  method: ["POST"],
}
