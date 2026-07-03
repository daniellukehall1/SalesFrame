import type { Config, Context } from "@netlify/functions"

import { dataResponse, errorResponse, logSafeEvent, methodNotAllowed, readJson } from "./_shared/http"
import { assertRateLimit } from "./_shared/rate-limit"

type ClientErrorPayload = {
  eventName?: string
  message?: string
  metadata?: Record<string, unknown>
  route?: string
  stack?: string
}

export default async function handler(request: Request, context: Context) {
  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const payload = await readJson<ClientErrorPayload>(request)
    const rateLimitKey =
      request.headers.get("x-nf-client-connection-ip") ||
      request.headers.get("x-forwarded-for")?.split(",").at(0) ||
      request.headers.get("user-agent") ||
      "unknown"

    assertRateLimit({
      key: rateLimitKey,
      limit: 60,
      name: "client error logging",
      windowMs: 60 * 1000,
    })

    logSafeEvent("error", "salesframe_client_error", {
      eventName: payload.eventName || "client_error",
      functionName: "client-error",
      hasAuthorization: Boolean(request.headers.get("Authorization")),
      message: payload.message || "Client error",
      metadata: payload.metadata ?? {},
      requestId: context.requestId,
      route: payload.route || "",
      stack: payload.stack || "",
    })

    return dataResponse({ ok: true })
  } catch (error) {
    return errorResponse(error, undefined, {
      context,
      functionName: "client-error",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/client-error",
  method: ["POST"],
}
