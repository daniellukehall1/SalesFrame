import type { Config, Context } from "@netlify/functions"

import type { Json, TablesUpdate } from "../../src/lib/supabase/database.types"
import { AppError, badRequest, dataResponse, errorResponse, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { buildAccountLogoMetadata } from "./_shared/account-logo"
import { callOpenAiWebSearchJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeAccount, requireUser } from "./_shared/supabase"

type AccountEnrichmentPayload = {
  accountId?: string
}

type AccountEnrichmentConfidence = "high" | "medium" | "low"

type AccountEnrichmentCoreField = {
  confidence: AccountEnrichmentConfidence
  rationale: string
  sourceLabel: string
  sourceUrl: string
  value: string
}

type AccountEnrichmentResult = {
  coreFields: {
    competitors: AccountEnrichmentCoreField
    currentTools: AccountEnrichmentCoreField
    employeeCount: AccountEnrichmentCoreField
    industry: AccountEnrichmentCoreField
    notes: AccountEnrichmentCoreField
    region: AccountEnrichmentCoreField
    strategicInitiatives: AccountEnrichmentCoreField
  }
  salesSignals: {
    businessSummary: string
    confidence: string
    currentTechStack: string
    discoveryAngles: string
    hiringGrowthSignals: string
    likelyBuyingTriggers: string
    likelyStakeholders: string
    procurementSignals: string
    recentNewsSignals: string
    reviewSentimentSignals: string
    riskFlags: string
    sourceNotes: string
    strategicPriorities: string
  }
  sourceFacts: {
    category: string
    confidence: AccountEnrichmentConfidence
    label: string
    summary: string
    url: string
  }[]
}

const accountEnrichmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["coreFields", "salesSignals", "sourceFacts"],
  properties: {
    coreFields: {
      type: "object",
      additionalProperties: false,
      required: ["industry", "employeeCount", "region", "currentTools", "strategicInitiatives", "competitors", "notes"],
      properties: {
        industry: coreFieldSchema(),
        employeeCount: coreFieldSchema(),
        region: coreFieldSchema(),
        currentTools: coreFieldSchema(),
        strategicInitiatives: coreFieldSchema(),
        competitors: coreFieldSchema(),
        notes: coreFieldSchema(),
      },
    },
    salesSignals: {
      type: "object",
      additionalProperties: false,
      required: [
        "businessSummary",
        "likelyBuyingTriggers",
        "strategicPriorities",
        "currentTechStack",
        "hiringGrowthSignals",
        "recentNewsSignals",
        "procurementSignals",
        "reviewSentimentSignals",
        "likelyStakeholders",
        "discoveryAngles",
        "riskFlags",
        "sourceNotes",
        "confidence",
      ],
      properties: {
        businessSummary: { type: "string" },
        likelyBuyingTriggers: { type: "string" },
        strategicPriorities: { type: "string" },
        currentTechStack: { type: "string" },
        hiringGrowthSignals: { type: "string" },
        recentNewsSignals: { type: "string" },
        procurementSignals: { type: "string" },
        reviewSentimentSignals: { type: "string" },
        likelyStakeholders: { type: "string" },
        discoveryAngles: { type: "string" },
        riskFlags: { type: "string" },
        sourceNotes: { type: "string" },
        confidence: { type: "string" },
      },
    },
    sourceFacts: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "url", "category", "summary", "confidence"],
        properties: {
          label: { type: "string" },
          url: { type: "string" },
          category: { type: "string" },
          summary: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
}

function coreFieldSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "confidence", "sourceLabel", "sourceUrl", "rationale"],
    properties: {
      value: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      sourceLabel: { type: "string" },
      sourceUrl: { type: "string" },
      rationale: { type: "string" },
    },
  }
}

const trustedSourceSet = [
  "Official website",
  "Careers page",
  "Newsroom or blog",
  "Investor pages or filings",
  "Business registry",
  "Google/GDELT-style public news coverage",
  "Jobs and ATS pages",
  "Review sites",
  "Public technographic references",
  "Government procurement portals",
]

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
}

function normalizeConfidence(value: unknown): AccountEnrichmentConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low"
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false

  return error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table|relation .* does not exist|schema cache/i.test(error.message ?? "")
}

function missingEnrichmentStorageError() {
  return new AppError(
    "account_enrichment_storage_missing",
    "Account enrichment is still getting ready for this workspace. Your account is saved, and you can try Enrich account again in a moment.",
    503
  )
}

function assertCoreField(value: unknown, fallback = ""): AccountEnrichmentCoreField {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return {
    confidence: normalizeConfidence(record.confidence),
    rationale: cleanText(record.rationale),
    sourceLabel: cleanText(record.sourceLabel),
    sourceUrl: cleanText(record.sourceUrl),
    value: cleanText(record.value) || fallback,
  }
}

function normalizeEmployeeCountCoreField(field: AccountEnrichmentCoreField): AccountEnrichmentCoreField {
  const valueText = field.value.toLowerCase()
  const contextText = `${field.rationale} ${field.sourceLabel}`.toLowerCase()
  const employeeSignalPattern =
    /\b(employee|employees|headcount|staff|workforce|workers|people employed|team members|company size|organisation size|organization size|fte)\b/
  const nonEmployeeScalePattern =
    /\b(active users?|monthly active users?|users?|customers?|subscribers?|members?|creators?|downloads?|visitors?|accounts?|revenue|valuation|market cap)\b/
  const highScaleNumberPattern = /\b\d+(?:[.,]\d+)?\s*(?:m|mn|million|b|bn|billion)\+?\b/
  const valueHasEmployeeSignal = employeeSignalPattern.test(valueText)
  const contextHasEmployeeSignal = employeeSignalPattern.test(contextText)
  const valueHasNonEmployeeScaleSignal = nonEmployeeScalePattern.test(valueText)
  const contextHasNonEmployeeScaleSignal = nonEmployeeScalePattern.test(contextText)
  const valueLooksLikeAudienceScale =
    highScaleNumberPattern.test(valueText) &&
    !valueHasEmployeeSignal &&
    !contextHasEmployeeSignal

  if (
    field.value &&
    (
      valueHasNonEmployeeScaleSignal ||
      valueLooksLikeAudienceScale ||
      (contextHasNonEmployeeScaleSignal && !contextHasEmployeeSignal)
    )
  ) {
    return {
      ...field,
      confidence: "low",
      rationale: [
        field.rationale,
        "Rejected for employee count because the source describes users, customers, revenue, market scale, or another non-workforce metric rather than headcount.",
      ].filter(Boolean).join(" "),
      value: "",
    }
  }

  return field
}

function assertSalesSignals(value: unknown): AccountEnrichmentResult["salesSignals"] {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

  if (!record) {
    throw upstreamFailure("Account enrichment returned invalid sales signals.", "openai_invalid_account_enrichment_signals")
  }

  return {
    businessSummary: cleanText(record.businessSummary),
    confidence: cleanText(record.confidence) || "Low",
    currentTechStack: cleanText(record.currentTechStack),
    discoveryAngles: cleanText(record.discoveryAngles),
    hiringGrowthSignals: cleanText(record.hiringGrowthSignals),
    likelyBuyingTriggers: cleanText(record.likelyBuyingTriggers),
    likelyStakeholders: cleanText(record.likelyStakeholders),
    procurementSignals: cleanText(record.procurementSignals),
    recentNewsSignals: cleanText(record.recentNewsSignals),
    reviewSentimentSignals: cleanText(record.reviewSentimentSignals),
    riskFlags: cleanText(record.riskFlags),
    sourceNotes: cleanText(record.sourceNotes),
    strategicPriorities: cleanText(record.strategicPriorities),
  }
}

function assertAccountEnrichmentResult(value: unknown): AccountEnrichmentResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

  if (!record || !record.coreFields || !record.salesSignals || !Array.isArray(record.sourceFacts)) {
    throw upstreamFailure("Account enrichment returned an invalid shape.", "openai_invalid_account_enrichment")
  }

  const coreFields = record.coreFields as Record<string, unknown>

  return {
    coreFields: {
      competitors: assertCoreField(coreFields.competitors),
      currentTools: assertCoreField(coreFields.currentTools),
      employeeCount: normalizeEmployeeCountCoreField(assertCoreField(coreFields.employeeCount)),
      industry: assertCoreField(coreFields.industry),
      notes: assertCoreField(coreFields.notes),
      region: assertCoreField(coreFields.region),
      strategicInitiatives: assertCoreField(coreFields.strategicInitiatives),
    },
    salesSignals: assertSalesSignals(record.salesSignals),
    sourceFacts: record.sourceFacts.map((item) => {
      const fact = item && typeof item === "object" && !Array.isArray(item)
        ? item as Record<string, unknown>
        : {}

      return {
        category: cleanText(fact.category),
        confidence: normalizeConfidence(fact.confidence),
        label: cleanText(fact.label),
        summary: cleanText(fact.summary),
        url: cleanText(fact.url),
      }
    }).filter((fact) => fact.label || fact.summary || fact.url),
  }
}

function isBlank(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0 || value.trim() === "Account" || value.trim() === "New account"
}

function buildCoreUpdatePlan(
  account: Record<string, unknown>,
  coreFields: AccountEnrichmentResult["coreFields"]
) {
  const fieldMap = [
    ["industry", "industry", coreFields.industry],
    ["employee_count", "employeeCount", coreFields.employeeCount],
    ["region", "region", coreFields.region],
    ["current_tools", "currentTools", coreFields.currentTools],
    ["strategic_initiatives", "strategicInitiatives", coreFields.strategicInitiatives],
    ["competitors", "competitors", coreFields.competitors],
    ["notes", "notes", coreFields.notes],
  ] as const

  const applied: Record<string, string> = {}
  const suggested: Record<string, AccountEnrichmentCoreField> = {}
  const proposed: Record<string, AccountEnrichmentCoreField> = {}
  const updatePayload: TablesUpdate<"accounts"> = {}

  for (const [dbField, resultField, result] of fieldMap) {
    if (!result.value) continue

    proposed[resultField] = result

    if (isBlank(account[dbField]) && result.confidence === "high") {
      applied[resultField] = result.value
      ;(updatePayload as Record<string, string>)[dbField] = result.value
    } else {
      suggested[resultField] = result
    }
  }

  return {
    applied,
    proposed,
    suggested,
    updatePayload,
  }
}

function mapSignalsToProfile({
  accountId,
  result,
  userId,
  workspaceId,
}: {
  accountId: string
  result: AccountEnrichmentResult
  userId: string
  workspaceId: string
}) {
  const signals = result.salesSignals

  return {
    account_id: accountId,
    business_summary: signals.businessSummary,
    confidence: signals.confidence,
    created_by_user_id: userId,
    current_tech_stack: signals.currentTechStack,
    discovery_angles: signals.discoveryAngles,
    hiring_growth_signals: signals.hiringGrowthSignals,
    last_enriched_at: new Date().toISOString(),
    likely_buying_triggers: signals.likelyBuyingTriggers,
    likely_stakeholders: signals.likelyStakeholders,
    procurement_signals: signals.procurementSignals,
    recent_news_signals: signals.recentNewsSignals,
    review_sentiment_signals: signals.reviewSentimentSignals,
    risk_flags: signals.riskFlags,
    source_notes: signals.sourceNotes,
    strategic_priorities: signals.strategicPriorities,
    updated_by_user_id: userId,
    workspace_id: workspaceId,
  }
}

export default async function handler(request: Request, _context: Context) {
  if (request.method !== "POST") return errorResponse(methodNotAllowed())

  let accountForFailedRun: { id: string; workspace_id: string; name?: string | null; website?: string | null } | null = null
  let userIdForFailedRun: string | null = null

  try {
    const payload = await readJson<AccountEnrichmentPayload>(request)
    if (!payload.accountId) throw badRequest("accountId is required.", "account_id_required")

    const { supabase, user } = await requireUser(request)
    userIdForFailedRun = user.id
    const authorizedAccount = await authorizeAccount(user.id, payload.accountId, supabase)
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", authorizedAccount.id)
      .single()

    if (accountError) throw new Error(accountError.message)
    accountForFailedRun = account

    const accountName = cleanText(account.name)
    const accountDomain = normalizeDomain(cleanText(account.website))

    if (!accountName) throw badRequest("Account name is required before enrichment.", "account_name_required")
    if (!accountDomain) throw badRequest("Website or domain is required before enrichment.", "account_domain_required")

    assertRateLimit({
      key: `${user.id}:${authorizedAccount.workspace_id}`,
      limit: 12,
      name: "account enrichment",
      windowMs: 10 * 60 * 1000,
    })

    const [profileStorageCheck, runStorageCheck] = await Promise.all([
      supabase.from("account_enrichment_profiles").select("id").limit(1),
      supabase.from("account_enrichment_runs").select("id").limit(1),
    ])
    const storageError = profileStorageCheck.error ?? runStorageCheck.error
    if (isMissingRelationError(storageError)) throw missingEnrichmentStorageError()
    if (storageError) throw new Error(storageError.message)

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, authorizedAccount.workspace_id)
    const openAiResponse = await callOpenAiWebSearchJson<AccountEnrichmentResult>({
      apiKey,
      schema: accountEnrichmentSchema,
      schemaName: "salesframe_account_enrichment",
      system:
        "You are SalesFrame's account enrichment analyst. Return only schema-valid JSON. Use public web research and trusted sources only. Prioritize the official website, careers page, newsroom, investor or filings pages, business registry, public news including Google or GDELT-style coverage, jobs or ATS pages, review sites, public technographic references, and government procurement portals. Do not invent facts. Leave fields blank when evidence is weak. Make sales signals useful for live B2B discovery questions. For employeeCount, return only workforce headcount or employee range. Never put users, active users, customers, subscribers, creators, members, downloads, revenue, valuation, or market scale into employeeCount; put those facts in sales signals or notes instead.",
      input: JSON.stringify({
        account: {
          name: accountName,
          website: accountDomain,
          existingFields: {
            competitors: account.competitors,
            currentTools: account.current_tools,
            employeeCount: account.employee_count,
            industry: account.industry,
            notes: account.notes,
            region: account.region,
            strategicInitiatives: account.strategic_initiatives,
          },
        },
        trustedSourceSet,
        requiredBehavior: [
          "Find source-backed account facts that can improve sales discovery.",
          "Prefer concise, practical B2B sales language.",
          "Return high confidence only when a source directly supports the field.",
          "employeeCount must be employee/headcount/workforce only; if exact employee evidence is unavailable, return an empty value with low confidence.",
          "Return low confidence for inferred or conflicting facts.",
          "Do not use private, scraped, or paywalled-only facts.",
        ],
      }),
    })
    const result = assertAccountEnrichmentResult(openAiResponse.result)
    const updatePlan = buildCoreUpdatePlan(account, result.coreFields)

    let updatedAccount = account
    if (Object.keys(updatePlan.updatePayload).length > 0) {
      const { data, error } = await supabase
        .from("accounts")
        .update(updatePlan.updatePayload)
        .eq("id", account.id)
        .select("*")
        .single()

      if (error) throw new Error(error.message)
      updatedAccount = data
    }

    const logoMetadata = buildAccountLogoMetadata(updatedAccount.website || accountDomain)
    const logoUrlCanBePreserved =
      logoMetadata.logo_domain &&
      logoMetadata.logo_domain === updatedAccount.logo_domain &&
      updatedAccount.logo_url
    const nextLogoMetadata = {
      ...logoMetadata,
      logo_status: logoMetadata.logo_url || logoUrlCanBePreserved ? "resolved" : logoMetadata.logo_status,
      logo_url: logoMetadata.logo_url || logoUrlCanBePreserved || null,
    }
    const { data: accountWithLogo, error: logoError } = await supabase
      .from("accounts")
      .update(nextLogoMetadata)
      .eq("id", account.id)
      .select("*")
      .single()

    if (logoError) throw new Error(logoError.message)
    updatedAccount = accountWithLogo

    const sourceFacts = [
      ...result.sourceFacts.map((fact) => ({
        ...fact,
        action: fact.confidence === "high" ? "suggested" : "ignored",
      })),
      ...openAiResponse.sources.map((source) => ({
        action: "consulted",
        category: "OpenAI web_search source",
        confidence: "medium",
        label: source.title,
        summary: source.title,
        url: source.url,
      })),
    ]

    const { data: profile, error: profileError } = await supabase
      .from("account_enrichment_profiles")
      .upsert(mapSignalsToProfile({
        accountId: account.id,
        result,
        userId: user.id,
        workspaceId: authorizedAccount.workspace_id,
      }), { onConflict: "workspace_id,account_id" })
      .select("*")
      .single()

    if (profileError) throw new Error(profileError.message)

    const { data: run, error: runError } = await supabase
      .from("account_enrichment_runs")
      .insert({
        account_id: account.id,
        applied_core_updates: updatePlan.applied as Json,
        created_by_user_id: user.id,
        proposed_core_updates: updatePlan.proposed as Json,
        requested_account_name: accountName,
        requested_domain: accountDomain,
        sales_signals: result.salesSignals as unknown as Json,
        sources: sourceFacts as unknown as Json,
        status: "completed",
        suggested_core_updates: updatePlan.suggested as unknown as Json,
        workspace_id: authorizedAccount.workspace_id,
      })
      .select("*")
      .single()

    if (runError) throw new Error(runError.message)

    return dataResponse({
      account: updatedAccount,
      appliedCoreUpdates: updatePlan.applied,
      profile,
      run,
      suggestedCoreUpdates: updatePlan.suggested,
    })
  } catch (error) {
    if (accountForFailedRun && userIdForFailedRun) {
      try {
        const { supabase } = await requireUser(request)
        await supabase.from("account_enrichment_runs").insert({
          account_id: accountForFailedRun.id,
          created_by_user_id: userIdForFailedRun,
          error_message: error instanceof Error ? error.message : "Account enrichment failed.",
          requested_account_name: accountForFailedRun.name ?? null,
          requested_domain: accountForFailedRun.website ?? null,
          status: "failed",
          workspace_id: accountForFailedRun.workspace_id,
        })
      } catch {
        // Preserve the original enrichment error.
      }
    }

    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/account-enrichment",
}
