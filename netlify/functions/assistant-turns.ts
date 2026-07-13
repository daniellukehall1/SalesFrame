import type { Config, Context } from "@netlify/functions"

import {
  ASSISTANT_MESSAGE_LIMIT,
  ASSISTANT_MODEL,
  assertAssistantOptionalUuid,
  assertAssistantSafePath,
  assertAssistantText,
  assertAssistantUuid,
  getAssistantSafeErrorCode,
  requireWorkspaceAssistantEnabled,
  type AssistantRouteContext,
} from "./_shared/assistant-core"
import { isAssistantArtifactsEnabled } from "./_shared/assistant-artifacts"
import { runWorkspaceAssistant } from "./_shared/assistant-openai"
import {
  authorizeAssistantThread,
  beginAssistantRun,
  completeAssistantRun,
  failAssistantRun,
  getAssistantHistory,
  getAssistantRunReplay,
  getAssistantThreadContext,
  tryAssistantDeterministicRead,
} from "./_shared/assistant-store"
import { AppError, forbidden, getPublicErrorMessageForError, errorResponse, methodNotAllowed, readJson } from "./_shared/http"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import {
  authorizeAccount,
  authorizeCall,
  authorizeContact,
  authorizeOpportunity,
  requireUser,
} from "./_shared/supabase"

type TurnPayload = {
  clientRequestId?: unknown
  routeContext?: unknown
  text?: unknown
  threadId?: unknown
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()
    requireWorkspaceAssistantEnabled()
    const payload = await readJson<TurnPayload>(request)
    const threadId = assertAssistantUuid(payload.threadId, "threadId")
    const clientRequestId = assertAssistantUuid(payload.clientRequestId, "clientRequestId")
    const text = assertAssistantText(payload.text, "text", { max: 8000 })
    const { supabase, token, user } = await requireUser(request)
    const options = { token, userId: user.id }
    const thread = await authorizeAssistantThread(supabase, threadId, options)
    const persistedContext = await getAssistantThreadContext(supabase, thread.id, options)
    const mergedRouteContext = mergeAssistantRouteContext(payload.routeContext, persistedContext)
    let routeContext: AssistantRouteContext
    try {
      routeContext = await authorizeRouteContext(
        mergedRouteContext,
        thread.workspace_id,
        supabase,
        options
      )
    } catch (error) {
      if (!persistedContext || hasExplicitResourceContext(payload.routeContext)) throw error
      // A deleted or archived historical selection must not strand the thread.
      // Retry from the current route only; every ID is reauthorized below.
      routeContext = await authorizeRouteContext(
        payload.routeContext,
        thread.workspace_id,
        supabase,
        options
      )
    }
    assertRateLimit({
      key: `${thread.workspace_id}:${user.id}`,
      limit: 12,
      name: "conversation turns",
      windowMs: 60 * 1000,
    })

    const started = await beginAssistantRun({
      clientRequestId,
      model: ASSISTANT_MODEL(),
      options,
      supabase,
      text,
      thread,
    })

    if (started.existing) {
      const replay = await getAssistantRunReplay(supabase, started.run, user.id)
      return assistantEventStream(async (send) => {
        send({ type: "text_delta", text: replay.message.content })
        for (const reference of replay.references) sendReference(send, reference)
        for (const artifact of replay.artifacts) sendArtifact(send, artifact)
        for (const proposal of replay.proposals) sendProposal(send, proposal)
        send({ type: "complete", messageId: replay.message.id })
      })
    }

    return assistantEventStream(async (send) => {
      let toolRounds = 0
      let readOperations = 0
      try {
        send({ type: "status", text: "Looking at your workspace" })
        const deterministic = await tryAssistantDeterministicRead({
          options,
          routeContext,
          supabase,
          text,
          workspaceId: thread.workspace_id,
        })
        if (deterministic) {
          const artifactsEnabled = isAssistantArtifactsEnabled()
          readOperations = deterministic.readOperations
          const message = await completeAssistantRun({
            artifacts: artifactsEnabled ? deterministic.artifacts : [],
            content: deterministic.text,
            inputTokens: 0,
            outputTokens: 0,
            readOperations,
            references: deterministic.references,
            resolvedContext: artifactsEnabled ? deterministic.resolvedContext : undefined,
            run: started.run,
            supabase,
            toolRounds: 0,
          })
          send({ type: "text_delta", text: deterministic.text })
          for (const reference of deterministic.references) sendReference(send, reference)
          if (artifactsEnabled) {
            for (const artifact of deterministic.artifacts) sendArtifact(send, artifact)
          }
          send({ type: "complete", messageId: message.id })
          return
        }
        const [apiKey, history] = await Promise.all([
          getDecryptedOpenAiKey(supabase, user.id, thread.workspace_id),
          getAssistantHistory(supabase, thread.id, user.id, ASSISTANT_MESSAGE_LIMIT),
        ])
        const result = await runWorkspaceAssistant({
          apiKey,
          history,
          model: started.run.model,
          options,
          routeContext,
          run: started.run,
          supabase,
        })
        toolRounds = result.toolRounds
        readOperations = result.readOperations
        const artifactsEnabled = isAssistantArtifactsEnabled()
        const message = await completeAssistantRun({
          artifacts: artifactsEnabled ? result.artifacts : [],
          content: result.text,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          readOperations,
          references: result.references,
          resolvedContext: artifactsEnabled && result.artifacts[0]
            ? {
                ...(Object.values(result.artifactContext).some(Boolean)
                  ? result.artifactContext
                  : {
                      accountId: routeContext.accountId,
                      callId: routeContext.callId,
                      contactId: routeContext.contactId,
                      opportunityId: routeContext.opportunityId,
                    }),
                artifactId: result.artifacts[0].id,
                source: Object.values(result.artifactContext).some(Boolean) ? "explicit" : "route",
              }
            : undefined,
          run: started.run,
          supabase,
          toolRounds,
        })
        send({ type: "text_delta", text: result.text })
        for (const reference of result.references) {
          sendReference(send, reference)
        }
        if (artifactsEnabled) {
          for (const artifact of result.artifacts) sendArtifact(send, artifact)
        }
        for (const proposal of result.proposals) sendProposal(send, proposal)
        send({ type: "complete", messageId: message.id })
      } catch (error) {
        const code = getAssistantSafeErrorCode(error)
        await failAssistantRun(
          supabase,
          started.run.id,
          user.id,
          code,
          toolRounds,
          readOperations
        ).catch(() => undefined)
        send({
          code,
          message: getPublicErrorMessageForError(error, "SalesFrame couldn't complete that message. Try again."),
          type: "error",
        })
      }
    })
  } catch (error) {
    return errorResponse(error, "SalesFrame couldn't start that conversation yet.", {
      context,
      functionName: "assistant-turns",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/assistant/turns",
  method: ["POST"],
}

async function authorizeRouteContext(
  value: unknown,
  workspaceId: string,
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  options: { token: string; userId: string }
): Promise<AssistantRouteContext> {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const contextWorkspaceId = assertAssistantOptionalUuid(raw.workspaceId, "routeWorkspaceId")
  if (contextWorkspaceId && contextWorkspaceId !== workspaceId) {
    throw forbidden()
  }
  const route: AssistantRouteContext = {
    path: assertAssistantSafePath(raw.path ?? "/", "routePath"),
    workspaceId,
  }
  route.accountId = assertAssistantOptionalUuid(raw.accountId, "routeAccountId")
  route.opportunityId = assertAssistantOptionalUuid(raw.opportunityId, "routeOpportunityId")
  route.contactId = assertAssistantOptionalUuid(raw.contactId, "routeContactId")
  route.callId = assertAssistantOptionalUuid(raw.callId, "routeCallId")
  let contactAccountId: string | null = null

  if (route.accountId) {
    const account = await authorizeAccount(options.userId, route.accountId, supabase, { token: options.token })
    if (account.workspace_id !== workspaceId) throw forbidden()
    const { data, error } = await supabase
      .from("accounts")
      .select("archived_at")
      .eq("id", account.id)
      .single()
    if (error) throw new Error(error.message)
    if (data.archived_at) throw inactiveRouteContext("account")
  }
  if (route.opportunityId) {
    const opportunity = await authorizeOpportunity(options.userId, route.opportunityId, supabase, { token: options.token })
    if (opportunity.workspace_id !== workspaceId || (route.accountId && opportunity.account_id !== route.accountId)) {
      throw forbidden()
    }
    const { data, error } = await supabase
      .from("opportunities")
      .select("archived_at")
      .eq("id", opportunity.id)
      .single()
    if (error) throw new Error(error.message)
    if (data.archived_at) throw inactiveRouteContext("opportunity")
  }
  if (route.contactId) {
    const contact = await authorizeContact(options.userId, route.contactId, supabase, { token: options.token })
    if (contact.workspace_id !== workspaceId || (route.accountId && contact.account_id !== route.accountId)) {
      throw forbidden()
    }
    if (contact.archived_at) throw inactiveRouteContext("contact")
    contactAccountId = contact.account_id
    if (route.opportunityId) {
      const opportunity = await authorizeOpportunity(options.userId, route.opportunityId, supabase, { token: options.token })
      if (opportunity.account_id !== contact.account_id) throw forbidden()
    }
  }
  if (route.callId) {
    const call = await authorizeCall(options.userId, route.callId, supabase, { token: options.token })
    if (
      call.workspace_id !== workspaceId ||
      (route.accountId && call.account_id !== route.accountId) ||
      (route.opportunityId && call.opportunity_id !== route.opportunityId) ||
      (contactAccountId && call.account_id !== contactAccountId)
    ) {
      throw forbidden()
    }
  }
  return route
}

function sendArtifact(
  send: (event: Record<string, unknown>) => void,
  artifact: unknown
) {
  send({ artifact, type: "artifact" })
}

function assistantEventStream(
  produce: (send: (event: Record<string, unknown>) => void) => Promise<void>
) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      try {
        await produce(send)
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "Content-Type": "text/event-stream; charset=utf-8",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  })
}

function sendProposal(send: (event: Record<string, unknown>) => void, proposal: Record<string, unknown>) {
  const preview = proposal.preview && typeof proposal.preview === "object" && !Array.isArray(proposal.preview)
    ? proposal.preview as Record<string, unknown>
    : {}
  const fields = Array.isArray(preview.fields)
    ? preview.fields.filter((field) => field && typeof field === "object")
    : []
  send({
    proposal: {
      capabilityId: proposal.capabilityId,
      expiresAt: proposal.expiresAt,
      fields,
      id: proposal.id,
      risk: proposal.risk,
      summary: typeof preview.title === "string" ? preview.title : "Review this change",
    },
    type: "proposal",
  })
}

function sendReference(
  send: (event: Record<string, unknown>) => void,
  reference: { id: string; label: string; route: string; type: string }
) {
  send({
    reference: {
      id: reference.id,
      kind: toClientReferenceKind(reference.type),
      label: reference.label,
      route: reference.route,
    },
    type: "reference",
  })
}

function toClientReferenceKind(value: string) {
  if (value === "transcript_segment") return "transcript"
  if (value === "methodology_evidence") return "methodology"
  if (value === "next_call_brief") return "brief"
  return value
}

function mergeAssistantRouteContext(
  routeValue: unknown,
  persisted: {
    account_id: string | null
    opportunity_id: string | null
    contact_id: string | null
    call_id: string | null
  } | null
) {
  const route = routeValue && typeof routeValue === "object" && !Array.isArray(routeValue)
    ? routeValue as Record<string, unknown>
    : {}
  if (!persisted || hasExplicitResourceContext(route)) return route
  return {
    ...route,
    accountId: persisted.account_id ?? undefined,
    callId: persisted.call_id ?? undefined,
    contactId: persisted.contact_id ?? undefined,
    opportunityId: persisted.opportunity_id ?? undefined,
  }
}

function hasExplicitResourceContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const route = value as Record<string, unknown>
  return ["accountId", "opportunityId", "contactId", "callId"].some((key) =>
    typeof route[key] === "string" && String(route[key]).trim().length > 0
  )
}

function inactiveRouteContext(resource: "account" | "opportunity" | "contact") {
  return new AppError(
    "assistant_context_unavailable",
    `That ${resource} is no longer active. Choose another ${resource} and try again.`,
    409
  )
}
