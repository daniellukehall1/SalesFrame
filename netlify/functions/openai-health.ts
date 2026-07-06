import type { Config, Context } from "@netlify/functions"

import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, logSafeEvent, methodNotAllowed } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"

const openAiHealthSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ready: {
      type: "boolean",
    },
  },
  required: ["ready"],
}

type OpenAiHealthProbe = {
  ready: boolean
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()

    const { supabase, user } = await requireUser(request)
    const requestUrl = new URL(request.url)
    const workspaceId = requestUrl.searchParams.get("workspaceId") ?? ""
    if (!workspaceId) {
      throw badRequest("workspaceId is required.", "workspace_id_required")
    }

    await authorizeWorkspace(user.id, workspaceId, supabase)
    assertRateLimit({
      key: `${user.id}:${workspaceId}`,
      limit: 30,
      name: "OpenAI health",
      windowMs: 60 * 1000,
    })

    const model = getEnv("OPENAI_LIVE_QUESTION_MODEL", "gpt-5.4-mini")
    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, workspaceId)

    await callOpenAiJson<OpenAiHealthProbe>({
      apiKey,
      input: "Return {\"ready\": true}.",
      model,
      schema: openAiHealthSchema,
      schemaName: "salesframe_openai_health",
      system:
        "You are checking whether SalesFrame can use this OpenAI key for a low-latency structured live coaching request. Return only schema-valid JSON.",
    })

    logSafeEvent("info", "openai_health_ready", {
      model,
      userId: user.id,
      workspaceId,
    })

    return dataResponse({
      model,
      provider: "openai",
      ready: true,
    })
  } catch (error) {
    return errorResponse(error, undefined, {
      context,
      functionName: "openai-health",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/openai/health",
  method: ["GET"],
}
