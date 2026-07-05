import type { Config, Context } from "@netlify/functions"

import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import {
  listBulkImportStatus,
  processQueuedEnrichmentJobs,
  retryFailedEnrichmentJobs,
} from "./_shared/import-enrichment"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"

type StatusPayload = {
  action?: "retry_failed" | "refresh"
  workspaceId?: string
}

export default async (request: Request, context: Context) => {
  try {
    const { supabase, user } = await requireUser(request)
    const requestUrl = new URL(request.url)
    const queryWorkspaceId = requestUrl.searchParams.get("workspaceId") ?? undefined

    if (request.method === "GET") {
      const workspaceId = queryWorkspaceId
      if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")
      await authorizeWorkspace(user.id, workspaceId, supabase)

      return dataResponse(await listBulkImportStatus({ supabase, workspaceId }))
    }

    if (request.method === "POST") {
      const payload = await readJson<StatusPayload>(request)
      const workspaceId = payload.workspaceId ?? queryWorkspaceId
      if (!workspaceId) throw badRequest("workspaceId is required.", "workspace_id_required")
      await authorizeWorkspace(user.id, workspaceId, supabase)

      if (payload.action === "retry_failed") {
        await retryFailedEnrichmentJobs({ supabase, userId: user.id, workspaceId })
      }
      if (payload.action === "retry_failed" || payload.action === "refresh") {
        context.waitUntil(
          processQueuedEnrichmentJobs({ limit: 3, supabase, userId: user.id, workspaceId }).catch(() => undefined)
        )
      }

      return dataResponse(await listBulkImportStatus({ supabase, workspaceId }))
    }

    throw methodNotAllowed()
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/import/enrichment-status",
  method: ["GET", "POST"],
}
