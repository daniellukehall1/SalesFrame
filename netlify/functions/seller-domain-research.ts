import type { Config, Context } from "@netlify/functions"

import { getEnv } from "./_shared/env"
import { badRequest, dataResponse, errorResponse, methodNotAllowed, readJson, upstreamFailure } from "./_shared/http"
import { callOpenAiJson } from "./_shared/openai"
import { getDecryptedOpenAiKey } from "./_shared/openai-key"
import { authorizeWorkspace, requireUser } from "./_shared/supabase"

type SellerDomainResearchPayload = {
  apiKey?: string
  domain?: string
  workspaceId?: string
}

type SellerDomainResearchResult = {
  productContext: string
  sellerCompany: string
  sellerDomain: string
  sources: string[]
}

const domainPattern = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
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

function assertSellerDomainResearchResult(value: unknown): SellerDomainResearchResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

  if (
    !record ||
    typeof record.sellerCompany !== "string" ||
    typeof record.sellerDomain !== "string" ||
    typeof record.productContext !== "string" ||
    !Array.isArray(record.sources)
  ) {
    throw upstreamFailure("Seller domain research returned an invalid shape.", "openai_invalid_seller_domain_research")
  }

  const sellerDomain = normalizeDomain(record.sellerDomain)
  if (!domainPattern.test(sellerDomain)) {
    throw upstreamFailure("Seller domain research returned an invalid company domain.", "openai_invalid_seller_domain")
  }

  return {
    productContext: requiredText(record.productContext, "Seller domain research did not return product context.", "openai_empty_product_context"),
    sellerCompany: requiredText(record.sellerCompany, "Seller domain research did not return a company name.", "openai_empty_seller_company"),
    sellerDomain,
    sources: requiredStringList(record.sources, "Seller domain research did not return sources.", "openai_empty_seller_domain_sources"),
  }
}

async function getApiKey({
  apiKey,
  supabase,
  userId,
  workspaceId,
}: {
  apiKey?: string
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]
  userId: string
  workspaceId?: string
}) {
  const requestApiKey = apiKey?.trim()
  if (requestApiKey) return requestApiKey

  if (!workspaceId) {
    throw badRequest("workspaceId is required when using a saved OpenAI key.", "workspace_id_required")
  }

  await authorizeWorkspace(userId, workspaceId)

  try {
    return await getDecryptedOpenAiKey(supabase, userId, workspaceId)
  } catch (error) {
    if (error instanceof Error && error.message.includes("Save an OpenAI API key")) {
      throw badRequest("Enter or save an OpenAI API key before running seller domain research.", "openai_key_required")
    }

    throw error
  }
}

export default async (request: Request, _context: Context) => {
  try {
    if (request.method !== "POST") {
      throw methodNotAllowed()
    }

    const payload = await readJson<SellerDomainResearchPayload>(request)
    const domain = normalizeDomain(payload.domain ?? "")
    if (!domain || !domainPattern.test(domain)) {
      throw badRequest("Enter a valid company domain.", "seller_domain_required")
    }

    const { supabase, user } = await requireUser(request)
    const apiKey = await getApiKey({
      apiKey: payload.apiKey,
      supabase,
      userId: user.id,
      workspaceId: payload.workspaceId,
    })

    const result = assertSellerDomainResearchResult(
      await callOpenAiJson<SellerDomainResearchResult>({
        apiKey,
        useWebSearch: getEnv("OPENAI_RESEARCH_WEB_SEARCH", "true") !== "false",
        schemaName: "seller_domain_research",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["sellerCompany", "sellerDomain", "productContext", "sources"],
          properties: {
            sellerCompany: {
              type: "string",
              description: "The company name represented by the supplied domain.",
            },
            sellerDomain: {
              type: "string",
              description: "The canonical company domain that was researched.",
            },
            productContext: {
              type: "string",
              description:
                "One clear paragraph describing what the company sells, who buys it, and the main business outcomes customers buy it for.",
            },
            sources: {
              type: "array",
              minItems: 1,
              items: { type: "string" },
              description: "Trusted source labels or URLs used to infer the product context.",
            },
          },
        },
        system:
          "You are SalesFrame's seller-company research analyst. Return only schema-valid JSON. Use web research. Start with the official company website for the supplied domain, then use trusted public sources if needed. Identify what the company sells in practical B2B sales language. Do not invent facts. Keep productContext concise, specific, and useful for shaping customer research and live sales questions.",
        input: JSON.stringify({
          domain,
          task:
            "Research this seller company domain and produce the product context that should fill a 'What you sell' field in a sales call setup modal.",
          requiredTone:
            "Specific, commercial, plain English. Mention products/services, likely buyers or use cases, and why customers buy.",
        }),
      })
    )

    return dataResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/openai/seller-domain-research",
  method: ["POST"],
}
