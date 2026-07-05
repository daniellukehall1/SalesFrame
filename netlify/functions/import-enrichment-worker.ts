import type { Config, Context } from "@netlify/functions"

import { dataResponse, errorResponse, methodNotAllowed } from "./_shared/http"
import { processQueuedEnrichmentJobs } from "./_shared/import-enrichment"
import { getSupabaseAdmin } from "./_shared/supabase"

export default async (request: Request, context: Context) => {
  if (request.method !== "POST") return errorResponse(methodNotAllowed())

  try {
    const result = await processQueuedEnrichmentJobs({
      limit: 8,
      supabase: getSupabaseAdmin(),
      workerId: `scheduled-import-enrichment-${context.requestId ?? Date.now()}`,
    })

    return dataResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  schedule: "@hourly",
}
