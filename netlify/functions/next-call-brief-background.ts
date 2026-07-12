import { randomUUID } from "node:crypto"

import type { Config, Context } from "@netlify/functions"

import {
  verifyNextCallBriefWorkDispatch,
  type NextCallBriefWorkDispatch,
} from "./_shared/next-call-brief-dispatch"
import { AppError, errorResponse, methodNotAllowed } from "./_shared/http"
import { generateNextCallBrief } from "./_shared/next-call-brief"
import { getSupabaseAdmin } from "./_shared/supabase"

const maximumDispatchBytes = 1_024

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    const contentLength = Number(request.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > maximumDispatchBytes) {
      throw new AppError("next_call_work_too_large", "Next call work was not recognized.", 413)
    }
    const rawBody = await request.text()
    if (Buffer.byteLength(rawBody) > maximumDispatchBytes) {
      throw new AppError("next_call_work_too_large", "Next call work was not recognized.", 413)
    }

    let payload: NextCallBriefWorkDispatch
    try {
      payload = JSON.parse(rawBody) as NextCallBriefWorkDispatch
    } catch {
      throw new AppError("next_call_work_invalid", "Next call work was not recognized.", 400)
    }
    verifyNextCallBriefWorkDispatch({
      payload,
      signature: request.headers.get("x-salesframe-next-call-work-signature"),
    })

    await generateNextCallBrief({
      attemptId: payload.attemptId,
      supabase: getSupabaseAdmin(),
      workerId: `next-call-background:${context.requestId || randomUUID()}`,
    })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error, "Next call work needs another moment.", {
      context,
      functionName: "next-call-brief-background",
      request,
    })
  }
}

export const config: Config = {
  background: true,
  path: "/api/internal/next-call-brief-work",
  method: "POST",
}
