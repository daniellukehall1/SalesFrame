import type { Config, Context } from "@netlify/functions"

import { applyNextCallBriefStep, getBriefScope } from "./_shared/next-call-brief"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, notFound, readJson } from "./_shared/http"
import { authorizeOpportunity, requireUser } from "./_shared/supabase"

type ApplyPayload = {
  expectedOpportunityUpdatedAt?: unknown
  nextStep?: unknown
}

function assertUuid(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw badRequest(`${field} is invalid.`, `next_call_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_invalid`)
  }
  return value.toLowerCase()
}

function assertTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw badRequest(
      "Review the current opportunity before updating its next step.",
      "next_call_expected_opportunity_update_invalid"
    )
  }
  // Preserve the database revision exactly. Re-serializing through Date would
  // truncate PostgreSQL microseconds and turn an unchanged row into a false 409.
  return value.trim()
}

function assertNextStep(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 2000) {
    throw badRequest("Enter a next step before saving.", "next_call_next_step_invalid")
  }
  return value.trim()
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    const briefId = assertUuid(context.params.briefId, "briefId")
    const payload = await readJson<ApplyPayload>(request)
    const { supabase, token, user } = await requireUser(request)
    const scope = await getBriefScope(supabase, briefId)
    const opportunity = await authorizeOpportunity(user.id, scope.opportunity_id, supabase, { token })
    if (opportunity.workspace_id !== scope.workspace_id || opportunity.account_id !== scope.account_id) {
      throw notFound("Next call brief was not found.")
    }

    return dataResponse(
      await applyNextCallBriefStep({
        briefId,
        expectedOpportunityUpdatedAt: assertTimestamp(payload.expectedOpportunityUpdatedAt),
        nextStep: assertNextStep(payload.nextStep),
        supabase,
        userId: user.id,
      })
    )
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't update the opportunity next step yet.", {
      context,
      functionName: "next-call-brief-apply",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/next-call-briefs/:briefId/apply-next-step",
  method: ["POST"],
}
