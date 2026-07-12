import type { Config, Context } from "@netlify/functions"

import { acceptRecallWebhook } from "./_shared/recall-webhook"

export default async (request: Request, context: Context) => {
  return acceptRecallWebhook({ context, kind: "status", request })
}

export const config: Config = {
  path: "/api/recall/webhooks/status",
  method: "POST",
}
