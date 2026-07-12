import type { Config, Context } from "@netlify/functions"

import { getBriefScope, readNextCallBriefEvidence } from "./_shared/next-call-brief"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, notFound } from "./_shared/http"
import { authorizeOpportunity, requireUser } from "./_shared/supabase"

function assertUuid(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw badRequest(`${field} is invalid.`, `next_call_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_invalid`)
  }
  return value.toLowerCase()
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "GET") throw methodNotAllowed()
    const briefId = assertUuid(context.params.briefId, "briefId")
    const itemId = assertUuid(context.params.itemId, "itemId")
    const { supabase, token, user } = await requireUser(request)
    const scope = await getBriefScope(supabase, briefId)
    const opportunity = await authorizeOpportunity(user.id, scope.opportunity_id, supabase, { token })
    if (opportunity.workspace_id !== scope.workspace_id || opportunity.account_id !== scope.account_id) {
      throw notFound("Next call brief was not found.")
    }

    return dataResponse(await readNextCallBriefEvidence({ briefId, itemId, supabase }))
  } catch (error) {
    return errorResponse(error, "This evidence is no longer available.", {
      context,
      functionName: "next-call-brief-evidence",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/next-call-briefs/:briefId/items/:itemId/evidence",
  method: ["GET"],
}
