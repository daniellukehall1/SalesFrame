import type { Config, Context } from "@netlify/functions"

import {
  generateNextCallBrief,
  queueNextCallBriefGeneration,
  readNextCallBrief,
} from "./_shared/next-call-brief"
import {
  AppError,
  badRequest,
  dataResponse,
  errorResponse,
  methodNotAllowed,
  readJson,
} from "./_shared/http"
import { authorizeOpportunity, requireUser } from "./_shared/supabase"

type RefreshPayload = {
  clientRequestId?: unknown
}

function assertUuid(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw badRequest(`${field} is invalid.`, `next_call_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_invalid`)
  }
  return value.toLowerCase()
}

export default async (request: Request, context: Context) => {
  try {
    const opportunityId = assertUuid(context.params.opportunityId, "opportunityId")
    const { supabase, token, user } = await requireUser(request)
    const opportunity = await authorizeOpportunity(user.id, opportunityId, supabase, { token })

    if (request.method === "GET") {
      return dataResponse(await readNextCallBrief(supabase, opportunity.id))
    }

    if (request.method === "POST") {
      const payload = await readJson<RefreshPayload>(request)
      const clientRequestId = assertUuid(payload.clientRequestId, "clientRequestId")
      const queued = await queueNextCallBriefGeneration({
        clientRequestId,
        opportunityId: opportunity.id,
        supabase,
        userId: user.id,
      })

      if (queued.attemptId && (queued.status === "queued" || queued.status === "processing")) {
        context.waitUntil(
          generateNextCallBrief({
            attemptId: queued.attemptId,
            supabase,
            workerId: `next-call:${context.requestId || clientRequestId}`,
          }).catch(() => undefined)
        )
      }

      return dataResponse(
        {
          briefId: queued.briefId,
          status: queued.status,
        },
        202
      )
    }

    throw methodNotAllowed()
  } catch (error) {
    return errorResponse(
      error instanceof AppError ? error : error,
      "SalesFrame couldn't update this brief yet. Your previous guidance is still available.",
      { context, functionName: "next-call-brief", request }
    )
  }
}

export const config: Config = {
  path: "/api/opportunities/:opportunityId/next-call-brief",
  method: ["GET", "POST"],
}
