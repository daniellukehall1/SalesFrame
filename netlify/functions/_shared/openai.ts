import { getEnv } from "./env"
import { upstreamFailure } from "./http"

export type OpenAiJsonRequest = {
  apiKey: string
  input: string
  model?: string
  schema?: Record<string, unknown>
  schemaName?: string
  strictSchema?: boolean
  system: string
  useWebSearch?: boolean
}

export type OpenAiWebSearchSource = {
  title: string
  url: string
}

export type OpenAiWebSearchJsonResponse<T> = {
  result: T
  sources: OpenAiWebSearchSource[]
}

export async function callOpenAiJson<T>({
  apiKey,
  input,
  model = getEnv("OPENAI_TEXT_MODEL", "gpt-5.4-mini"),
  schema,
  schemaName = "response",
  strictSchema = true,
  system,
  useWebSearch = false,
}: OpenAiJsonRequest): Promise<T> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: system,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input,
            },
          ],
        },
      ],
      text: {
        format: schema
          ? {
              type: "json_schema",
              name: schemaName,
              strict: strictSchema,
              schema,
            }
          : {
              type: "json_object",
            },
      },
      tool_choice: useWebSearch ? "required" : undefined,
      tools: useWebSearch
        ? [
            {
              type: "web_search",
              search_context_size: "medium",
            },
          ]
        : undefined,
    }),
  })

  const data = await readOpenAiPayload(response)

  if (!response.ok) {
    throw upstreamFailure(
      getOpenAiErrorMessage(data, "OpenAI request failed."),
      getOpenAiFailureCode(data, "openai_request_failed")
    )
  }

  const text = extractResponseText(data)
  if (!text) throw upstreamFailure("OpenAI did not return JSON text.", "openai_empty_output")

  try {
    return JSON.parse(text) as T
  } catch {
    throw upstreamFailure("OpenAI returned malformed JSON.", "openai_malformed_json")
  }
}

export async function callOpenAiWebSearchJson<T>({
  apiKey,
  blockedDomains = ["reddit.com", "quora.com", "wikipedia.org"],
  input,
  model = getEnv("OPENAI_ACCOUNT_ENRICHMENT_MODEL", "gpt-5.4-mini"),
  schema,
  schemaName = "response",
  searchContextSize = "medium",
  strictSchema = true,
  system,
}: OpenAiJsonRequest & {
  blockedDomains?: string[]
  searchContextSize?: "low" | "medium" | "high"
}): Promise<OpenAiWebSearchJsonResponse<T>> {
  const webSearchTool: Record<string, unknown> = {
    type: "web_search",
    search_context_size: searchContextSize,
  }

  if (blockedDomains.length > 0) {
    webSearchTool.filters = {
      blocked_domains: blockedDomains,
    }
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      include: ["web_search_call.action.sources"],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: system,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input,
            },
          ],
        },
      ],
      text: {
        format: schema
          ? {
              type: "json_schema",
              name: schemaName,
              strict: strictSchema,
              schema,
            }
          : {
              type: "json_object",
            },
      },
      tool_choice: "required",
      tools: [webSearchTool],
    }),
  })

  const data = await readOpenAiPayload(response)

  if (!response.ok) {
    throw upstreamFailure(
      getOpenAiErrorMessage(data, "OpenAI web research request failed."),
      getOpenAiFailureCode(data, "openai_web_search_failed")
    )
  }

  const text = extractResponseText(data)
  if (!text) throw upstreamFailure("OpenAI did not return JSON text.", "openai_empty_output")

  try {
    return {
      result: JSON.parse(text) as T,
      sources: extractWebSearchSources(data),
    }
  } catch {
    throw upstreamFailure("OpenAI returned malformed JSON.", "openai_malformed_json")
  }
}

async function readOpenAiPayload(response: Response) {
  const text = await response.text()
  if (!text.trim()) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return {
      error: {
        message: text.slice(0, 240),
      },
    }
  }
}

function getOpenAiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback

  const error = (data as Record<string, unknown>).error
  if (!error || typeof error !== "object") return fallback

  const message = (error as Record<string, unknown>).message
  return typeof message === "string" && message.trim() ? message : fallback
}

function getOpenAiFailureCode(data: unknown, fallback: string) {
  const message = getOpenAiErrorMessage(data, "")
  const providerCode = getOpenAiString(
    data && typeof data === "object" && "error" in data && data.error && typeof data.error === "object"
      ? (data.error as Record<string, unknown>).code ?? (data.error as Record<string, unknown>).type
      : ""
  )
  const combined = `${providerCode} ${message}`

  if (/incorrect api key|invalid api key|authentication.*openai|invalid_api_key/i.test(combined)) {
    return "openai_auth_failed"
  }

  if (/insufficient_quota|quota|billing|hard limit|usage limit|credits/i.test(combined)) {
    return "openai_quota_exceeded"
  }

  if (/rate.?limit|too many requests|\b429\b/i.test(combined)) {
    return "openai_rate_limit"
  }

  if (/model_not_found|model .* does not exist|unsupported model|model .* unavailable/i.test(combined)) {
    return "openai_model_error"
  }

  return fallback
}

function getOpenAiString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function extractWebSearchSources(data: unknown): OpenAiWebSearchSource[] {
  if (!data || typeof data !== "object") return []

  const output = "output" in data ? data.output : null
  if (!Array.isArray(output)) return []

  const sourceMap = new Map<string, OpenAiWebSearchSource>()

  for (const item of output) {
    if (!item || typeof item !== "object") continue

    const action = "action" in item ? item.action : null
    if (!action || typeof action !== "object") continue

    const sources = "sources" in action ? action.sources : null
    if (!Array.isArray(sources)) continue

    for (const source of sources) {
      if (!source || typeof source !== "object") continue

      const record = source as Record<string, unknown>
      const url = getOpenAiString(record.url)
      if (!url) continue

      sourceMap.set(url, {
        title: getOpenAiString(record.title) || url,
        url,
      })
    }
  }

  return [...sourceMap.values()].slice(0, 25)
}

function extractResponseText(data: unknown) {
  if (typeof data !== "object" || data === null) return ""
  if ("output_text" in data && typeof data.output_text === "string") return data.output_text

  const output = "output" in data ? data.output : null
  if (!Array.isArray(output)) return ""

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
        return []
      }

      return item.content.flatMap((contentItem: unknown) => {
        if (!contentItem || typeof contentItem !== "object") return []
        if ("text" in contentItem && typeof contentItem.text === "string") return [contentItem.text]
        if ("type" in contentItem && contentItem.type === "output_text" && "text" in contentItem) {
          return typeof contentItem.text === "string" ? [contentItem.text] : []
        }

        return []
      })
    })
    .join("\n")
}
