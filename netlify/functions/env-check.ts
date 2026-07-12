import type { Config, Context } from "@netlify/functions"

import {
  getEnv,
  meetingBotServerEnvNames,
  optionalEnvNames,
  optionalFrontendEnvNames,
  optionalServerEnvNames,
  requiredEnvNames,
  requiredFrontendEnvNames,
  requiredServerEnvNames,
} from "./_shared/env"
import { badRequest, dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"
import { requireWorkspaceOwner } from "./_shared/workspace-session"

function getEnvStatus(name: string) {
  return {
    name,
    configured: Boolean(getEnv(name)),
  }
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()

    const { supabase, token, user } = await requireUser(request)
    const requestUrl = new URL(request.url)
    const workspaceId = requestUrl.searchParams.get("workspaceId")?.trim()

    if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")

    await authorizeWorkspace(user.id, workspaceId, supabase, { token })
    await requireWorkspaceOwner(supabase, user.id, workspaceId)
    assertRateLimit({
      key: `${user.id}:${workspaceId}`,
      limit: 20,
      name: "environment readiness",
      windowMs: 60 * 1000,
    })

    const required = requiredEnvNames.map(getEnvStatus)
    const optional = optionalEnvNames.map(getEnvStatus)
    const missing = required
      .filter((item) => !item.configured)
      .map((item) => item.name)
    const meetingBotEnabled = /^(?:1|true|yes|on)$/i.test(getEnv("RECALL_MEETING_BOT_ENABLED"))
    const meetingBotMissing = meetingBotServerEnvNames.filter((name) => {
      const value = getEnv(name)
      if (!value) return true
      if (name === "MEETING_BOT_CRYPTO_SECRET") return value.length < 32
      if (name === "RECALL_WORKSPACE_VERIFICATION_SECRET") {
        const secrets = value.split(/[\s,]+/).filter(Boolean)
        return secrets.length === 0 || secrets.some((secret) => !secret.startsWith("whsec_"))
      }
      return false
    })

    return dataResponse({
      ready: missing.length === 0,
      missing,
      required,
      optional,
      groups: {
        frontend: requiredFrontendEnvNames,
        optionalFrontend: optionalFrontendEnvNames,
        server: requiredServerEnvNames,
      },
      features: {
        meetingBot: {
          enabled: meetingBotEnabled,
          ready: !meetingBotEnabled || meetingBotMissing.length === 0,
          missing: meetingBotEnabled ? meetingBotMissing : [],
        },
      },
    })
  } catch (error) {
    return errorResponse(error, undefined, {
      context,
      functionName: "env-check",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/system/env",
  method: ["GET"],
}
