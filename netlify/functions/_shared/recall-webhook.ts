import type { Context } from "@netlify/functions"

import { getEnv, requireEnv } from "./env"
import { AppError, errorResponse, logSafeEvent, methodNotAllowed } from "./http"
import {
  encryptMeetingBotValue,
  hashWebhookPayload,
  verifyRecallWebhook,
} from "./meeting-bot-crypto"
import {
  assertRecallWebhookBodySize,
  getRecallBotId,
} from "./meeting-bot-processing"
import {
  getMeetingBotSessionByRecallBotId,
  insertMeetingBotWebhookEvent,
  recoverMeetingBotSessionMapping,
} from "./meeting-bot-store"
import type { RecallRealtimePayload, RecallStatusPayload } from "./meeting-bot-types"
import { dispatchRecallWork } from "./recall-work-dispatch"
import { getRecallRegion } from "./recall-client"
import { getSupabaseAdmin } from "./supabase"

function parseVerifiedPayload(rawBody: string) {
  let payload: RecallRealtimePayload | RecallStatusPayload
  try {
    payload = JSON.parse(rawBody) as RecallRealtimePayload | RecallStatusPayload
  } catch {
    throw new AppError("recall_webhook_payload_invalid", "Webhook payload was not recognized.", 400)
  }
  const event = typeof payload.event === "string" ? payload.event.trim().toLowerCase() : ""
  if (!/^[a-z0-9_.-]{1,120}$/.test(event)) {
    throw new AppError("recall_webhook_payload_invalid", "Webhook payload was not recognized.", 400)
  }

  return { event, payload }
}

export async function acceptRecallWebhook({
  context,
  kind,
  request,
}: {
  context: Context
  kind: "realtime" | "status"
  request: Request
}) {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    assertRecallWebhookBodySize(request)
    const rawBody = await request.text()
    assertRecallWebhookBodySize(request, rawBody)
    const secret = kind === "status"
      ? getEnv("RECALL_SVIX_WEBHOOK_SECRET") || requireEnv("RECALL_WORKSPACE_VERIFICATION_SECRET")
      : requireEnv("RECALL_WORKSPACE_VERIFICATION_SECRET")
    const verification = verifyRecallWebhook({ rawBody, request, secret })
    const { event, payload } = parseVerifiedPayload(rawBody)
    const botId = getRecallBotId(payload)
    if (!botId) throw new AppError("recall_webhook_payload_invalid", "Webhook payload was not recognized.", 400)
    const supabase = getSupabaseAdmin()
    let session = await getMeetingBotSessionByRecallBotId(supabase, botId)
    if (!session) {
      const correlationToken = payload.data?.bot?.metadata?.salesframe_session
      if (
        typeof correlationToken === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationToken)
      ) {
        session = await recoverMeetingBotSessionMapping({
          correlationToken,
          recallBotId: botId,
          supabase,
        })
      }
    }
    if (!session) {
      logSafeEvent("warn", "recall_webhook_unmapped_bot", { eventType: event })
      return new Response(null, { status: 204 })
    }

    const encryptedPayload = encryptMeetingBotValue(rawBody)
    const region = getRecallRegion()
    const inserted = await insertMeetingBotWebhookEvent({
      eventTimestamp: new Date(verification.timestamp * 1000).toISOString(),
      eventType: event,
      payload: encryptedPayload,
      payloadHash: hashWebhookPayload(rawBody),
      recallBotId: botId,
      region,
      sessionId: session.id,
      supabase,
      webhookId: verification.webhookId,
    })
    if (inserted) {
      context.waitUntil(
        dispatchRecallWork({
          kind: "webhook_event",
          region,
          webhookId: verification.webhookId,
        }).catch(() => undefined)
      )
    }

    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    return errorResponse(error, "Webhook could not be accepted.", {
      context,
      functionName: `recall-${kind}-webhook`,
      request,
    })
  }
}
