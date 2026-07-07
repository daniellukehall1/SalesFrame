import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { processQueuedEnrichmentJobs } from "./_shared/import-enrichment"
import { getSupabaseAdmin } from "./_shared/supabase"

type ScheduledImportEnrichmentPayload = {
  next_run?: unknown
}

function assertScheduledPayload(payload: ScheduledImportEnrichmentPayload) {
  if (typeof payload.next_run !== "string" || Number.isNaN(Date.parse(payload.next_run))) {
    throw badRequest("Scheduled import enrichment request was not recognized.", "invalid_scheduled_import_enrichment_request")
  }
}

export default async (request: Request, context: Context) => {
  if (request.method !== "POST") return errorResponse(methodNotAllowed())

  try {
    assertScheduledPayload(await readJson<ScheduledImportEnrichmentPayload>(request))

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
