import type { Config, Context } from "@netlify/functions"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "../../src/lib/supabase/database.types"
import { getEnv } from "./_shared/env"
import {
  AppError,
  badRequest,
  dataResponse,
  errorResponse,
  getPublicErrorMessageForError,
  logSafeEvent,
  methodNotAllowed,
  readJson,
  upstreamFailure,
} from "./_shared/http"
import { callOpenAiWebSearchJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeContact, requireUser } from "./_shared/supabase"

type ContactEnrichmentPayload = {
  contactId?: string
}

type EnrichmentConfidence = "high" | "medium" | "low"

type EnrichedCoreField = {
  confidence: EnrichmentConfidence
  rationale: string
  value: string
}

type ContactEnrichmentResult = {
  caveats: string
  confidence: number
  coreFields: {
    department: EnrichedCoreField
    jobTitle: EnrichedCoreField
    location: EnrichedCoreField
    seniority: EnrichedCoreField
  }
  discoveryAngles: string
  identityStatus: "matched" | "ambiguous" | "not_found"
  likelyKpis: string
  likelyPriorities: string
  professionalSummary: string
  recentProfessionalSignals: string
  relevantExperience: string
  roleScope: string
  sourceFacts: {
    category: string
    confidence: EnrichmentConfidence
    label: string
    summary: string
  }[]
}

type QueuedContact = {
  account_id: string
  archived_at: string | null
  department: string | null
  full_name: string
  job_title: string | null
  linkedin_url: string | null
  location: string | null
  preferred_name: string | null
  seniority: string | null
  workspace_id: string
}

type ActiveContactEnrichmentRun = {
  created_at: string
  id: string
  started_at: string | null
  status: "queued" | "running"
}

const CONTACT_ENRICHMENT_LEASE_MS = 10 * 60 * 1000

const coreFieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "confidence", "rationale"],
  properties: {
    value: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    rationale: { type: "string" },
  },
}

const contactEnrichmentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "identityStatus",
    "coreFields",
    "professionalSummary",
    "roleScope",
    "likelyPriorities",
    "likelyKpis",
    "relevantExperience",
    "recentProfessionalSignals",
    "discoveryAngles",
    "confidence",
    "caveats",
    "sourceFacts",
  ],
  properties: {
    identityStatus: { type: "string", enum: ["matched", "ambiguous", "not_found"] },
    coreFields: {
      type: "object",
      additionalProperties: false,
      required: ["jobTitle", "department", "seniority", "location"],
      properties: {
        jobTitle: coreFieldSchema,
        department: coreFieldSchema,
        seniority: coreFieldSchema,
        location: coreFieldSchema,
      },
    },
    professionalSummary: { type: "string" },
    roleScope: { type: "string" },
    likelyPriorities: { type: "string" },
    likelyKpis: { type: "string" },
    relevantExperience: { type: "string" },
    recentProfessionalSignals: { type: "string" },
    discoveryAngles: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    caveats: { type: "string" },
    sourceFacts: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "category", "summary", "confidence"],
        properties: {
          label: { type: "string" },
          category: { type: "string" },
          summary: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
}

function cleanText(value: unknown, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function normalizeDomain(value: unknown) {
  return cleanText(value, 500)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
}

function normalizeConfidence(value: unknown): EnrichmentConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low"
}

function normalizeCoreField(value: unknown): EnrichedCoreField {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return {
    confidence: normalizeConfidence(record.confidence),
    rationale: cleanText(record.rationale, 500),
    value: cleanText(record.value, 240),
  }
}

function assertContactEnrichmentResult(value: unknown): ContactEnrichmentResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  const coreFields = record?.coreFields && typeof record.coreFields === "object" && !Array.isArray(record.coreFields)
    ? record.coreFields as Record<string, unknown>
    : null
  const identityStatus = record?.identityStatus

  if (
    !record ||
    !coreFields ||
    (identityStatus !== "matched" && identityStatus !== "ambiguous" && identityStatus !== "not_found") ||
    !Array.isArray(record.sourceFacts)
  ) {
    throw upstreamFailure("Contact enrichment returned an invalid shape.", "openai_invalid_contact_enrichment")
  }

  return {
    caveats: cleanText(record.caveats),
    confidence: typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? Math.max(0, Math.min(1, record.confidence))
      : 0,
    coreFields: {
      department: normalizeCoreField(coreFields.department),
      jobTitle: normalizeCoreField(coreFields.jobTitle),
      location: normalizeCoreField(coreFields.location),
      seniority: normalizeCoreField(coreFields.seniority),
    },
    discoveryAngles: cleanText(record.discoveryAngles),
    identityStatus,
    likelyKpis: cleanText(record.likelyKpis),
    likelyPriorities: cleanText(record.likelyPriorities),
    professionalSummary: cleanText(record.professionalSummary),
    recentProfessionalSignals: cleanText(record.recentProfessionalSignals),
    relevantExperience: cleanText(record.relevantExperience),
    roleScope: cleanText(record.roleScope),
    sourceFacts: record.sourceFacts.slice(0, 12).flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return []
      const source = item as Record<string, unknown>
      const label = cleanText(source.label, 200)
      const summary = cleanText(source.summary, 600)
      if (!label && !summary) return []

      return [{
        category: cleanText(source.category, 100),
        confidence: normalizeConfidence(source.confidence),
        label,
        summary,
      }]
    }),
  }
}

function isMissingContactSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false

  return error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    /Could not find the table|Could not find .* column|relation .* does not exist|column .* does not exist|schema cache/i.test(error.message ?? "")
}

function missingContactEnrichmentStorageError() {
  return new AppError(
    "contact_enrichment_storage_missing",
    "Contact enrichment is still getting ready. Your contact is saved, and you can try again in a moment.",
    503
  )
}

function contactEnrichmentInProgressError() {
  return new AppError(
    "contact_enrichment_in_progress",
    "SalesFrame is already enriching this contact.",
    409
  )
}

function isStaleContactEnrichmentRun(run: ActiveContactEnrichmentRun, now = Date.now()) {
  const leaseStartedAt = Date.parse(run.started_at ?? run.created_at)
  return !Number.isFinite(leaseStartedAt) || leaseStartedAt <= now - CONTACT_ENRICHMENT_LEASE_MS
}

export function buildSafeContactEnrichmentInput({
  accountDomain,
  accountName,
  contact,
  hasSellerSuppliedProfile,
}: {
  accountDomain: string
  accountName: string
  contact: QueuedContact
  hasSellerSuppliedProfile: boolean
}) {
  return {
    account: {
      domain: accountDomain,
      name: accountName,
    },
    contact: {
      department: cleanText(contact.department, 120),
      fullName: cleanText(contact.full_name, 180),
      jobTitle: cleanText(contact.job_title, 180),
      location: cleanText(contact.location, 140),
      preferredName: cleanText(contact.preferred_name, 100),
      seniority: cleanText(contact.seniority, 100),
    },
    identityHints: {
      sellerSuppliedPublicProfileAvailable: hasSellerSuppliedProfile,
    },
    requiredBehavior: [
      "Use public professional sources only.",
      "Match this exact person and employer before returning matched.",
      "Return ambiguous when multiple people plausibly match, evidence conflicts, or identity cannot be established.",
      "Leave unsupported fields blank and use low confidence.",
      "Do not infer protected traits, personality, private facts, or sensitive characteristics.",
      "Focus on role scope, professional priorities, useful KPIs, relevant experience, recent professional signals, and safe B2B discovery angles.",
    ],
  }
}

async function processContactEnrichmentRun({
  accountId,
  contactId,
  runId,
  supabase,
  userId,
  workspaceId,
}: {
  accountId: string
  contactId: string
  runId: string
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  try {
    const { data: runningRun, error: runningError } = await supabase
      .from("contact_enrichment_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .eq("account_id", accountId)
      .eq("contact_id", contactId)
      .eq("status", "queued")
      .select("id")
      .maybeSingle()

    if (runningError) throw new Error(runningError.message)
    if (!runningRun) return

    const [contactResponse, accountResponse] = await Promise.all([
      supabase
        .from("contacts")
        .select("id,workspace_id,account_id,full_name,preferred_name,job_title,department,seniority,location,linkedin_url,archived_at")
        .eq("id", contactId)
        .eq("workspace_id", workspaceId)
        .eq("account_id", accountId)
        .single(),
      supabase
        .from("accounts")
        .select("id,name,website")
        .eq("id", accountId)
        .eq("workspace_id", workspaceId)
        .single(),
    ])

    if (contactResponse.error) throw new Error(contactResponse.error.message)
    if (accountResponse.error) throw new Error(accountResponse.error.message)
    const contact = contactResponse.data
    const account = accountResponse.data
    const accountDomain = normalizeDomain(account.website)
    const hasSellerSuppliedProfile = Boolean(cleanText(contact.linkedin_url))

    if (contact.archived_at) {
      throw new AppError("contact_archived", "This contact was archived before enrichment started.", 409)
    }
    if (!cleanText(contact.full_name)) throw badRequest("Contact name is required before enrichment.", "contact_name_required")
    if (!accountDomain && !hasSellerSuppliedProfile) {
      throw badRequest(
        "Add an account domain or public professional profile before enrichment.",
        "contact_enrichment_identity_required"
      )
    }

    const apiKey = await getDecryptedOpenAiKey(supabase, userId, workspaceId)
    const model = getEnv(
      "OPENAI_CONTACT_ENRICHMENT_MODEL",
      getEnv("OPENAI_ACCOUNT_ENRICHMENT_MODEL", "gpt-5.4-mini")
    )
    const openAiResponse = await callOpenAiWebSearchJson<ContactEnrichmentResult>({
      apiKey,
      blockedDomains: ["quora.com", "wikipedia.org"],
      input: JSON.stringify(buildSafeContactEnrichmentInput({
        accountDomain,
        accountName: cleanText(account.name, 240),
        contact,
        hasSellerSuppliedProfile,
      })),
      model,
      schema: contactEnrichmentSchema,
      schemaName: "salesframe_contact_enrichment",
      searchContextSize: "medium",
      system:
        "You are SalesFrame's contact enrichment analyst. Return only schema-valid JSON based on public professional evidence. Establish that the person matches the supplied name and employer before returning matched. Abstain with ambiguous or not_found when identity is uncertain. Never infer protected traits, personality, private facts, personal life, or sensitive characteristics. Never generate contact details or profile identifiers. Use concise B2B sales language. Research can shape discovery wording but is not proof of opportunity methodology fields.",
    })
    const result = assertContactEnrichmentResult(openAiResponse.result)
    const sources = {
      facts: result.sourceFacts,
      consulted: openAiResponse.sources,
    }

    if (result.identityStatus !== "matched") {
      const { error } = await supabase
        .from("contact_enrichment_runs")
        .update({
          completed_at: new Date().toISOString(),
          enrichment_payload: result as unknown as Json,
          error_message: result.caveats || "SalesFrame could not establish a unique public professional match.",
          model,
          sources: sources as unknown as Json,
          status: "ambiguous",
        })
        .eq("id", runId)
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .eq("status", "running")

      if (error) throw new Error(error.message)
      return
    }

    const { data: finalized, error: finalizeError } = await supabase.rpc("finalize_contact_enrichment_run", {
      core_fields: result.coreFields as unknown as Json,
      model_name: model,
      profile_payload: {
        caveats: result.caveats,
        confidence: result.confidence,
        discoveryAngles: result.discoveryAngles,
        likelyKpis: result.likelyKpis,
        likelyPriorities: result.likelyPriorities,
        professionalSummary: result.professionalSummary,
        recentProfessionalSignals: result.recentProfessionalSignals,
        relevantExperience: result.relevantExperience,
        roleScope: result.roleScope,
      },
      result_payload: result as unknown as Json,
      source_payload: sources as unknown as Json,
      target_account_id: accountId,
      target_contact_id: contactId,
      target_run_id: runId,
      target_user_id: userId,
      target_workspace_id: workspaceId,
    })

    if (finalizeError) throw new Error(finalizeError.message)
    if (!finalized) return
  } catch (error) {
    try {
      const { error: failureStatusError } = await supabase
        .from("contact_enrichment_runs")
        .update({
          completed_at: new Date().toISOString(),
          error_message: getPublicErrorMessageForError(error, "Contact enrichment failed. Try again."),
          status: "failed",
        })
        .eq("id", runId)
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .eq("status", "running")

      if (failureStatusError) {
        logSafeEvent("error", "contact_enrichment_failure_status_persist_failed", {
          diagnostic: failureStatusError.code || "database_error",
          functionName: "contact-enrichment",
        })
      }
    } catch (persistenceError) {
      logSafeEvent("error", "contact_enrichment_failure_status_persist_failed", {
        diagnostic: persistenceError instanceof Error ? persistenceError.name : "unknown_error",
        functionName: "contact-enrichment",
      })
    }

    logSafeEvent("warn", "contact_enrichment_background_failed", {
      diagnostic: error instanceof AppError ? error.code : error instanceof Error ? error.name : "unknown_error",
      functionName: "contact-enrichment",
    })
  }
}

export default async (request: Request, context: Context) => {
  try {
    if (request.method !== "POST") throw methodNotAllowed()

    const payload = await readJson<ContactEnrichmentPayload>(request)
    if (!payload.contactId) throw badRequest("contactId is required.", "contact_id_required")

    const { supabase, token, user } = await requireUser(request)
    const authorizedContact = await authorizeContact(user.id, payload.contactId, supabase, { token })
    if (authorizedContact.archived_at) {
      throw new AppError("contact_archived", "Restore this contact before enriching it.", 409)
    }

    assertRateLimit({
      key: `${user.id}:${authorizedContact.workspace_id}`,
      limit: 12,
      name: "contact enrichment",
      windowMs: 10 * 60 * 1000,
    })

    const [contactResponse, accountResponse, activeRunResponse] = await Promise.all([
      supabase
        .from("contacts")
        .select("id,workspace_id,account_id,full_name,preferred_name,job_title,department,seniority,location,linkedin_url,archived_at")
        .eq("id", authorizedContact.id)
        .eq("workspace_id", authorizedContact.workspace_id)
        .eq("account_id", authorizedContact.account_id)
        .single(),
      supabase
        .from("accounts")
        .select("id,name,website")
        .eq("id", authorizedContact.account_id)
        .eq("workspace_id", authorizedContact.workspace_id)
        .single(),
      supabase
        .from("contact_enrichment_runs")
        .select("id,status,created_at,started_at")
        .eq("workspace_id", authorizedContact.workspace_id)
        .eq("contact_id", authorizedContact.id)
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const storageError = activeRunResponse.error
    if (isMissingContactSchemaError(storageError)) throw missingContactEnrichmentStorageError()
    if (contactResponse.error) throw new Error(contactResponse.error.message)
    if (accountResponse.error) throw new Error(accountResponse.error.message)
    if (storageError) throw new Error(storageError.message)
    if (activeRunResponse.data) {
      const activeRun = activeRunResponse.data as ActiveContactEnrichmentRun
      if (!isStaleContactEnrichmentRun(activeRun)) throw contactEnrichmentInProgressError()

      const { data: staleLeaseTakenOver, error: staleLeaseError } = await supabase
        .from("contact_enrichment_runs")
        .update({
          completed_at: new Date().toISOString(),
          error_message: "The previous enrichment attempt did not finish. Retry started a new attempt.",
          status: "failed",
        })
        .eq("id", activeRun.id)
        .eq("workspace_id", authorizedContact.workspace_id)
        .eq("contact_id", authorizedContact.id)
        .eq("created_at", activeRun.created_at)
        .eq("status", activeRun.status)
        .select("id")
        .maybeSingle()

      if (staleLeaseError) throw new Error(staleLeaseError.message)
      if (!staleLeaseTakenOver) {
        const { data: latestRun, error: latestRunError } = await supabase
          .from("contact_enrichment_runs")
          .select("id,status")
          .eq("workspace_id", authorizedContact.workspace_id)
          .eq("contact_id", authorizedContact.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestRunError) throw new Error(latestRunError.message)
        if (latestRun?.status === "queued" || latestRun?.status === "running") {
          throw contactEnrichmentInProgressError()
        }
        if (latestRun?.status === "completed" || latestRun?.status === "ambiguous") {
          return dataResponse({
            contactId: authorizedContact.id,
            runId: latestRun.id,
            status: latestRun.status,
          })
        }
      }
    }

    const contact = contactResponse.data
    const account = accountResponse.data
    const accountDomain = normalizeDomain(account.website)
    if (!cleanText(contact.full_name)) throw badRequest("Contact name is required before enrichment.", "contact_name_required")
    if (!accountDomain && !cleanText(contact.linkedin_url)) {
      throw badRequest(
        "Add an account domain or public professional profile before enrichment.",
        "contact_enrichment_identity_required"
      )
    }

    const model = getEnv(
      "OPENAI_CONTACT_ENRICHMENT_MODEL",
      getEnv("OPENAI_ACCOUNT_ENRICHMENT_MODEL", "gpt-5.4-mini")
    )
    const { data: run, error: runError } = await supabase
      .from("contact_enrichment_runs")
      .insert({
        account_id: authorizedContact.account_id,
        contact_id: authorizedContact.id,
        created_by_user_id: user.id,
        model,
        requested_account_name: cleanText(account.name, 240),
        requested_full_name: cleanText(contact.full_name, 180),
        status: "queued",
        workspace_id: authorizedContact.workspace_id,
      })
      .select("id,status")
      .single()

    if (runError?.code === "23505") throw contactEnrichmentInProgressError()
    if (isMissingContactSchemaError(runError)) throw missingContactEnrichmentStorageError()
    if (runError) throw new Error(runError.message)

    context.waitUntil(processContactEnrichmentRun({
      accountId: authorizedContact.account_id,
      contactId: authorizedContact.id,
      runId: run.id,
      supabase,
      userId: user.id,
      workspaceId: authorizedContact.workspace_id,
    }))

    return dataResponse({
      contactId: authorizedContact.id,
      runId: run.id,
      status: "queued" as const,
    }, 202)
  } catch (error) {
    return errorResponse(error, undefined, {
      context,
      functionName: "contact-enrichment",
      request,
    })
  }
}

export const config: Config = {
  path: "/api/openai/contact-enrichment",
  method: ["POST"],
}
