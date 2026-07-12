import { randomUUID } from "node:crypto"

import type { Config, Context } from "@netlify/functions"

import { AppError, errorResponse, methodNotAllowed } from "./_shared/http"
import {
  processDueMeetingBotProvisioning,
  processMeetingBotWebhookEvent,
  recoverMeetingBotSessions,
  runMeetingBotProvisioningWindow,
} from "./_shared/meeting-bot-processing"
import {
  expireMeetingBotPrivatePayloads,
  listDueMeetingBotWebhookIds,
} from "./_shared/meeting-bot-store"
import {
  dispatchRecallWork,
  verifyRecallWorkDispatch,
  type RecallWorkDispatch,
} from "./_shared/recall-work-dispatch"
import { getSupabaseAdmin } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    const contentLength = Number(request.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > 1_024) {
      throw new AppError("recall_work_too_large", "Recall work request was not recognized.", 413)
    }
    const rawBody = await request.text()
    if (Buffer.byteLength(rawBody) > 1_024) {
      throw new AppError("recall_work_too_large", "Recall work request was not recognized.", 413)
    }
    let payload: RecallWorkDispatch
    try {
      payload = JSON.parse(rawBody) as RecallWorkDispatch
    } catch {
      throw new AppError("recall_work_invalid", "Recall work request was not recognized.", 400)
    }
    verifyRecallWorkDispatch({
      payload,
      signature: request.headers.get("x-salesframe-recall-work-signature"),
    })
    const supabase = getSupabaseAdmin()
    const workerId = `recall-background:${context.requestId || randomUUID()}`

    if (payload.kind === "provision_session") {
      await runMeetingBotProvisioningWindow({ sessionId: payload.sessionId, supabase })
    } else if (payload.kind === "webhook_event") {
      await processMeetingBotWebhookEvent({
        region: payload.region,
        supabase,
        webhookId: payload.webhookId,
        workerId,
      })
    } else {
      await expireMeetingBotPrivatePayloads(supabase)
      await processDueMeetingBotProvisioning({ limit: 25, supabase, workerId: `${workerId}:provision` })
      const dueEvents = await listDueMeetingBotWebhookIds(supabase, 25)
      await Promise.allSettled(
        dueEvents.map((event) =>
          dispatchRecallWork({
            kind: "webhook_event",
            region: event.region,
            webhookId: event.webhook_id,
          })
        )
      )
      await recoverMeetingBotSessions({ limit: 25, supabase, workerId: `${workerId}:recover` })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error, "Recall work needs another moment.", {
      context,
      functionName: "recall-work-background",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/internal/recall-work",
  method: "POST",
}
