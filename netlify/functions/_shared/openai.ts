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

export type OpenAiDiarizedSegment = {
  endMs: number
  speaker: string
  startMs: number
  text: string
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
    throw upstreamFailure(getOpenAiErrorMessage(data, "OpenAI request failed."), "openai_request_failed")
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
    throw upstreamFailure(getOpenAiErrorMessage(data, "OpenAI web research request failed."), "openai_web_search_failed")
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

const supportedRealtimeTranscriptionDelays = new Set(["minimal", "low", "medium", "high", "xhigh"])
const supportedRealtimeTranscriptionModels = new Set(["gpt-realtime-whisper"])

function getRealtimeTranscriptionModel() {
  const explicitRealtimeModel = getEnv("OPENAI_REALTIME_TRANSCRIPTION_MODEL")
  if (supportedRealtimeTranscriptionModels.has(explicitRealtimeModel)) return explicitRealtimeModel

  const legacyTranscriptionModel = getEnv("OPENAI_TRANSCRIPTION_MODEL")
  if (supportedRealtimeTranscriptionModels.has(legacyTranscriptionModel)) return legacyTranscriptionModel

  return "gpt-realtime-whisper"
}

export async function createRealtimeTranscriptionSession(
  apiKey: string,
  options: { sourceKind?: string; transcriptionDelay?: string } = {}
) {
  const transcriptionModel = getRealtimeTranscriptionModel()
  const isRealtimeWhisper = transcriptionModel === "gpt-realtime-whisper"
  const defaultDelay =
    options.sourceKind === "mixed_audio" || options.sourceKind === "in_person_microphone"
      ? getEnv("OPENAI_TRANSCRIPTION_MIXED_DELAY", "xhigh")
      : getEnv("OPENAI_TRANSCRIPTION_DELAY", "high")
  const requestedDelay = options.transcriptionDelay || defaultDelay
  const transcriptionConfig: Record<string, unknown> = {
    model: transcriptionModel,
    language: getEnv("OPENAI_TRANSCRIPTION_LANGUAGE", "en"),
  }
  if (isRealtimeWhisper) {
    transcriptionConfig.delay = supportedRealtimeTranscriptionDelays.has(requestedDelay)
      ? requestedDelay
      : defaultDelay
  }

  const inputConfig: Record<string, unknown> = {
    transcription: transcriptionConfig,
  }

  if (isRealtimeWhisper) {
    inputConfig.turn_detection = null
  } else {
    inputConfig.noise_reduction = {
      type: getEnv("OPENAI_TRANSCRIPTION_NOISE_REDUCTION", "far_field"),
    }
    inputConfig.turn_detection = {
      type: "server_vad",
      threshold: Number(getEnv("OPENAI_TRANSCRIPTION_VAD_THRESHOLD", "0.58")),
      prefix_padding_ms: Number(getEnv("OPENAI_TRANSCRIPTION_PREFIX_PADDING_MS", "300")),
      silence_duration_ms: Number(getEnv("OPENAI_TRANSCRIPTION_SILENCE_MS", "900")),
    }
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "transcription",
        audio: {
          input: inputConfig,
        },
      },
    }),
  })

  const data = await readOpenAiPayload(response)

  if (!response.ok) {
    throw upstreamFailure(
      getOpenAiErrorMessage(data, "Realtime transcription session could not be created."),
      "openai_realtime_session_failed"
    )
  }

  return data
}

export async function transcribeDiarizedAudio({
  apiKey,
  audio,
  filename,
  mimeType,
}: {
  apiKey: string
  audio: Blob
  filename: string
  mimeType: string
}) {
  const formData = new FormData()
  formData.set("model", getEnv("OPENAI_DIARIZATION_MODEL", "gpt-4o-transcribe-diarize"))
  formData.set("response_format", "diarized_json")
  formData.set("chunking_strategy", getEnv("OPENAI_DIARIZATION_CHUNKING_STRATEGY", "auto"))
  formData.set("language", getEnv("OPENAI_TRANSCRIPTION_LANGUAGE", "en"))
  formData.set("file", audio, filename || `salesframe-call-chunk.${getAudioExtension(mimeType)}`)

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  const data = await readOpenAiPayload(response)

  if (!response.ok) {
    throw upstreamFailure(getOpenAiErrorMessage(data, "OpenAI diarized transcription failed."), "openai_diarization_failed")
  }

  return {
    raw: data,
    segments: normalizeDiarizedSegments(data),
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

function normalizeDiarizedSegments(data: unknown): OpenAiDiarizedSegment[] {
  if (!data || typeof data !== "object") return []

  const record = data as Record<string, unknown>
  const segments =
    Array.isArray(record.segments)
      ? record.segments
      : Array.isArray(record.diarization)
        ? record.diarization
        : Array.isArray(record.words)
          ? record.words
          : []

  return segments
    .map((segment) => {
      if (!segment || typeof segment !== "object") return null

      const item = segment as Record<string, unknown>
      const text = getOpenAiString(item.text) || getOpenAiString(item.transcript) || getOpenAiString(item.word)
      const speaker =
        getOpenAiString(item.speaker) ||
        getOpenAiString(item.speaker_label) ||
        getOpenAiString(item.speakerLabel) ||
        getOpenAiString(item.label)

      if (!text || !speaker) return null

      return {
        endMs: normalizeTimestampMs(item.end ?? item.end_ms ?? item.endMs),
        speaker,
        startMs: normalizeTimestampMs(item.start ?? item.start_ms ?? item.startMs),
        text,
      }
    })
    .filter((segment): segment is OpenAiDiarizedSegment => Boolean(segment))
}

function normalizeTimestampMs(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0

  return value > 10000 ? Math.round(value) : Math.round(value * 1000)
}

function getOpenAiString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a"
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3"
  if (mimeType.includes("wav")) return "wav"

  return "webm"
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
