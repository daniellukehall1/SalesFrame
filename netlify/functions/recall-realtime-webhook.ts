import type { Config, Context } from "@netlify/functions"

import { acceptRecallWebhook } from "./_shared/recall-webhook"

export default async (request: Request, context: Context) => {
  return acceptRecallWebhook({ context, kind: "realtime", request })
}

export const config: Config = {
  path: "/api/recall/webhooks/realtime",
  method: "POST",
}
