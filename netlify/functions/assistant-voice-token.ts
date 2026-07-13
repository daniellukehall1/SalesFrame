import type { Config, Context } from "@netlify/functions"

import { assertAssistantUuid, requireWorkspaceAssistantEnabled } from "./_shared/assistant-core"
import { createDeepgramListenUrls, createDeepgramTemporaryToken, getDeepgramFluxConfig } from "./_shared/deepgram"
import { AppError, dataResponse, errorResponse, methodNotAllowed, readJson, tooManyRequests } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"

type VoiceTokenPayload = { workspaceId?: unknown }

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    requireWorkspaceAssistantEnabled()
    const payload = await readJson<VoiceTokenPayload>(request)
    const workspaceId = assertAssistantUuid(payload.workspaceId, "workspaceId")
    const { supabase, token, user } = await requireUser(request)
    await authorizeWorkspace(user.id, workspaceId, supabase, { token })
    assertRateLimit({
      key: `${workspaceId}:${user.id}`,
      limit: 12,
      name: "conversation voice setup",
      windowMs: 10 * 60 * 1000,
    })
    const quota = await supabase.rpc("claim_assistant_voice_token_grant", {
      grant_limit: 12,
      target_user_id: user.id,
      target_workspace_id: workspaceId,
      window_seconds: 10 * 60,
    })
    if (quota.error) throw new Error(quota.error.message)
    if (!quota.data) throw tooManyRequests("That is a lot of voice activity at once. Wait a moment, then try again.")

    const config = getDeepgramFluxConfig()
    const grant = await createDeepgramTemporaryToken({ sourceKind: "assistant_command" })
    if (!Number.isFinite(grant.expiresIn) || grant.expiresIn < 1 || grant.expiresIn > 60) {
      throw new AppError(
        "assistant_voice_token_duration_invalid",
        "SalesFrame voice input needs another setup check.",
        503
      )
    }
    const websocketUrls = createDeepgramListenUrls(config)
    return dataResponse({
      accessToken: grant.accessToken,
      config,
      expiresIn: grant.expiresIn,
      sourceKind: "assistant_command",
      websocketUrl: websocketUrls[0],
      websocketUrls,
    })
  } catch (error) {
    return errorResponse(error, "Voice input needs another moment. Try again shortly.", {
      context,
      functionName: "assistant-voice-token",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/voice-token",
  method: ["POST"],
}
