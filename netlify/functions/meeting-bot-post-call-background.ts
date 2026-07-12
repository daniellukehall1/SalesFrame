import { randomUUID } from "node:crypto"

import type { Config, Context } from "@netlify/functions"

import { AppError, errorResponse, methodNotAllowed } from "./_shared/http"
import {
  runMeetingBotPostCallGeneration,
  verifyMeetingBotPostCallDispatch,
  type MeetingBotPostCallDispatch,
} from "./_shared/meeting-bot-post-call"
import { getSupabaseAdmin } from "./_shared/supabase"
import { generatePostCallOutputs } from "./post-call-outputs"

const maximumDispatchBytes = 1_024

async function readDispatch(request: Request) {
  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumDispatchBytes) {
    throw new AppError("meeting_bot_post_call_invalid", "Post-call request was not recognized.", 413)
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody) > maximumDispatchBytes) {
    throw new AppError("meeting_bot_post_call_invalid", "Post-call request was not recognized.", 413)
  }

  try {
    return JSON.parse(rawBody) as MeetingBotPostCallDispatch
  } catch {
    throw new AppError("meeting_bot_post_call_invalid", "Post-call request was not recognized.", 400)
  }
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    const payload = await readDispatch(request)
    verifyMeetingBotPostCallDispatch({
      payload,
      signature: request.headers.get("x-salesframe-post-call-signature"),
    })

    await runMeetingBotPostCallGeneration({
      generateOutputs: generatePostCallOutputs,
      sessionId: payload.sessionId,
      supabase: getSupabaseAdmin(),
      workerId: `background:${context.requestId || randomUUID()}`,
    })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error, "Post-call processing needs another moment.", {
      context,
      functionName: "meeting-bot-post-call-background",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/internal/meeting-bot-post-call",
  method: "POST",
}
