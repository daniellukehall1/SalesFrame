import type { Config, Context } from "@netlify/functions"

import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, forbidden, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { assertRateLimit } from "./_shared/rate-limit"
import { authorizeAccount, authorizeCall, authorizeOpportunity, requireUser } from "./_shared/supabase"

type CustomerResearchPayload = {
  accountId?: string
  callId?: string | null
  customerContact?: string
  customerRole?: string
  opportunityId?: string | null
  productContext?: string
  sellerCompany?: string
  sellerDomain?: string
}

type CustomerResearchResult = {
  researchSummary: string
  questionAngle: string
  insights: {
    headline: string
    summary: string
    questionAngle: string
    sources: string[]
  }[]
  trustedSourcesUsed: string[]
}

const trustedSources = [
  "LinkedIn company and profile pages",
  "Company website and newsroom",
  "Annual reports or investor pages",
  "Trusted business press",
]

const customerResearchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["researchSummary", "questionAngle", "insights", "trustedSourcesUsed"],
  properties: {
    researchSummary: { type: "string" },
    questionAngle: { type: "string" },
    insights: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "summary", "questionAngle", "sources"],
        properties: {
          headline: { type: "string" },
          summary: { type: "string" },
          questionAngle: { type: "string" },
          sources: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
        },
      },
    },
    trustedSourcesUsed: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
    },
  },
}

function requiredText(value: unknown, message: string, code: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw upstreamFailure(message, code)
  }

  return value.trim()
}

function requiredStringList(value: unknown, message: string, code: string) {
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : []

  if (items.length === 0) {
    throw upstreamFailure(message, code)
  }

  return items
}

function assertCustomerResearchResult(value: unknown): CustomerResearchResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

  if (
    !record ||
    typeof record.researchSummary !== "string" ||
    typeof record.questionAngle !== "string" ||
    !Array.isArray(record.insights) ||
    !Array.isArray(record.trustedSourcesUsed)
  ) {
    throw upstreamFailure("Customer research returned an invalid shape.", "openai_invalid_customer_research")
  }

  const insights = record.insights.map((item, index) => {
    const insight = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : null

    if (!insight) {
      throw upstreamFailure("Customer research returned an invalid insight.", "openai_invalid_customer_research_insight")
    }

    return {
      headline: requiredText(insight.headline, `Customer research insight ${index + 1} did not include a headline.`, "openai_empty_customer_research_headline"),
      summary: requiredText(insight.summary, `Customer research insight ${index + 1} did not include a summary.`, "openai_empty_customer_research_summary"),
      questionAngle: requiredText(insight.questionAngle, `Customer research insight ${index + 1} did not include a question angle.`, "openai_empty_customer_research_question_angle"),
      sources: requiredStringList(insight.sources, `Customer research insight ${index + 1} did not include sources.`, "openai_empty_customer_research_sources"),
    }
  })

  if (insights.length === 0) {
    throw upstreamFailure("Customer research did not return any source-backed insights.", "openai_empty_customer_research_insights")
  }

  return {
    researchSummary: requiredText(record.researchSummary, "Customer research did not return a summary.", "openai_empty_customer_research_summary"),
    questionAngle: requiredText(record.questionAngle, "Customer research did not return a question angle.", "openai_empty_customer_research_question_angle"),
    insights,
    trustedSourcesUsed: requiredStringList(record.trustedSourcesUsed, "Customer research did not return trusted sources.", "openai_empty_customer_research_trusted_sources"),
  }
}

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const payload = await readJson<CustomerResearchPayload>(request)
    if (!payload.accountId) throw badRequest("accountId is required.", "account_id_required")

    const { supabase, token, user } = await requireUser(request)
    const authorizedAccount = await authorizeAccount(user.id, payload.accountId, supabase, { token })
    const authorizedOpportunity = payload.opportunityId
      ? await authorizeOpportunity(user.id, payload.opportunityId, supabase, { token })
      : null
    const authorizedCall = payload.callId ? await authorizeCall(user.id, payload.callId, supabase, { token }) : null

    if (authorizedOpportunity && authorizedOpportunity.account_id !== payload.accountId) {
      throw forbidden("Opportunity does not belong to this account.")
    }
    if (authorizedCall && authorizedCall.account_id !== payload.accountId) {
      throw forbidden("Call does not belong to this account.")
    }
    if (authorizedCall && payload.opportunityId && authorizedCall.opportunity_id !== payload.opportunityId) {
      throw forbidden("Call does not belong to this opportunity.")
    }

    assertRateLimit({
      key: `${user.id}:${authorizedAccount.workspace_id}`,
      limit: 12,
      name: "customer research",
      windowMs: 10 * 60 * 1000,
    })

    const apiKey = await getDecryptedOpenAiKey(supabase, user.id, authorizedAccount.workspace_id)
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", payload.accountId)
      .single()

    if (accountError) throw new Error(accountError.message)

    const { data: opportunity, error: opportunityError } = payload.opportunityId
      ? await supabase
          .from("opportunities")
          .select("*")
          .eq("id", payload.opportunityId)
          .maybeSingle()
      : { data: null, error: null }

    if (opportunityError) throw new Error(opportunityError.message)

    const result = assertCustomerResearchResult(
      await callOpenAiJson<CustomerResearchResult>({
        apiKey,
        useWebSearch: getEnv("OPENAI_RESEARCH_WEB_SEARCH", "true") !== "false",
        schema: customerResearchSchema,
        schemaName: "salesframe_customer_research",
        system:
          "You are a sales research analyst. Return only valid JSON. Use trusted public sources only, prioritising LinkedIn, the company website/newsroom, investor pages, and reputable business press. Do not invent facts. If source-backed evidence is weak, say so.",
        input: JSON.stringify({
          account,
          opportunity,
          seller: {
            company: payload.sellerCompany,
            domain: payload.sellerDomain,
            productContext: payload.productContext,
          },
          customerContact: payload.customerContact,
          customerRole: payload.customerRole,
          requiredJsonShape: {
            researchSummary: "One concise paragraph.",
            questionAngle: "How this should change live call questioning.",
            insights: [
              {
                headline: "Short insight",
                summary: "Source-grounded summary",
                questionAngle: "Question this should influence",
                sources: ["source label or URL"],
              },
            ],
            trustedSourcesUsed: trustedSources,
          },
        }),
      })
    )

    const { data: researchRun, error: insertError } = await supabase
      .from("customer_research_runs")
      .insert({
        call_id: authorizedCall?.id ?? null,
        account_id: authorizedAccount.id,
        opportunity_id: payload.opportunityId ?? null,
        enabled: true,
        customer_contact: payload.customerContact ?? null,
        customer_role: payload.customerRole ?? null,
        seller_company: payload.sellerCompany ?? null,
	        seller_domain: payload.sellerDomain ?? null,
	        product_context: payload.productContext ?? null,
	        trusted_sources: result.trustedSourcesUsed,
        research_summary: result.researchSummary,
        question_angle: result.questionAngle,
        created_by_user_id: user.id,
      })
      .select("*")
      .single()

    if (insertError) throw new Error(insertError.message)

    return dataResponse({
      researchRun,
      result,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/customer-research",
  method: ["POST"],
}
