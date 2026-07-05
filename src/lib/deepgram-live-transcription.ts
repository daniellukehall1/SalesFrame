import type { AudioSourceKind } from "@/lib/call-audio-preflight"
import { createDeepgramTranscriptionToken } from "@/lib/server-functions"

export type DeepgramTranscriptEvent = {
  diarizationSpeaker?: string
  endMs?: number
  endOfTurnConfidence?: number
  eventKind: "update" | "start_of_turn" | "eager_end_of_turn" | "turn_resumed" | "end_of_turn"
  isDelta: boolean
  isFinal: boolean
  itemId?: string
  languageDetected?: string
  provider: "deepgram_flux"
  providerEventId?: string
  providerSessionId: string
  providerTurnIndex?: number
  segmentId?: string
  speaker?: string
  startMs?: number
  text: string
  wordConfidence?: number
}

export type DeepgramTranscriptionConnection = {
  close: () => void
  flush: () => void
}

export type DeepgramTranscriptionConnectionOptions = {
  callId: string
  onTranscriptError: (error: unknown) => void
  onTranscriptEvent: (event: DeepgramTranscriptEvent) => void | Promise<void>
  sourceKind: AudioSourceKind
  stream: MediaStream
}

type DeepgramTokenResponse = {
  accessToken: string
  config: {
    diarizeModel: string
    eagerEotThreshold: number
    encoding: string
    eotThreshold: number
    eotTimeoutMs: number
    model: string
    sampleRate: number
  }
  expiresIn: number
  websocketUrl: string
}

type DeepgramTurnMessage = {
  audio_window_end?: number
  audio_window_start?: number
  channel?: {
    alternatives?: DeepgramAlternative[]
  }
  end_of_turn_confidence?: number
  event?: string
  from_finalize?: boolean
  is_final?: boolean
  languages?: string[]
  metadata?: {
    request_id?: string
  }
  request_id?: string
  speech_final?: boolean
  transcript?: string
  turn_index?: number
  type?: string
  words?: DeepgramWord[]
}

type DeepgramAlternative = {
  confidence?: number
  transcript?: string
  words?: DeepgramWord[]
}

type DeepgramWord = {
  confidence?: number
  end?: number
  punctuated_word?: string
  speaker?: number
  start?: number
  word?: string
}

const deepgramChunkMs = 80
const pcmWorkletName = "salesframe-pcm-capture"
const providerName = "deepgram_flux" as const

export async function connectDeepgramLiveTranscription({
  callId,
  onTranscriptError,
  onTranscriptEvent,
  sourceKind,
  stream,
}: DeepgramTranscriptionConnectionOptions): Promise<DeepgramTranscriptionConnection> {
  const session = await createDeepgramTranscriptionToken(callId, { sourceKind })
  const tokenResponse = normalizeDeepgramTokenResponse(session)
  const providerSessionId = createProviderSessionId(sourceKind)
  const websocketUrl = getDeepgramWebsocketUrl(tokenResponse.websocketUrl)
  const socket = new WebSocket(websocketUrl, ["token", tokenResponse.accessToken])
  const audioPipeline = await createPcmAudioPipeline({
    onAudioChunk: (chunk) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(chunk)
    },
    onError: onTranscriptError,
    sampleRate: tokenResponse.config.sampleRate,
    stream,
  })

  socket.binaryType = "arraybuffer"
  socket.addEventListener("open", () => {
    audioPipeline.start()
  })
  socket.addEventListener("message", (event) => {
    const transcriptEvent = extractDeepgramTranscriptEvent({
      message: event.data,
      providerSessionId,
      sourceKind,
    })
    if (transcriptEvent) {
      void Promise.resolve(onTranscriptEvent(transcriptEvent)).catch(onTranscriptError)
    }
  })
  socket.addEventListener("error", () => {
    onTranscriptError(new Error("Deepgram live transcription needs another connection attempt."))
  })
  socket.addEventListener("close", (event) => {
    audioPipeline.stop()
    if (event.wasClean || event.code === 1000) return
    onTranscriptError(new Error("Deepgram live transcription connection closed early."))
  })

  return {
    close: () => {
      audioPipeline.stop()
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        try {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "CloseStream" }))
        } catch {
          // The socket may already be closing when a seller stops the call.
        }
        socket.close(1000, "call_stopped")
      }
    },
    flush: () => {
      try {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "Finalize" }))
      } catch {
        // Finalize is best-effort during stop.
      }
    },
  }
}

export function flushDeepgramAudioBuffers(connections: DeepgramTranscriptionConnection[]) {
  connections.forEach((connection) => connection.flush())
}

export function waitForDeepgramFlush() {
  return new Promise((resolve) => window.setTimeout(resolve, 450))
}

function normalizeDeepgramTokenResponse(value: unknown): DeepgramTokenResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Deepgram live transcription did not return session details.")
  }

  const record = value as Record<string, unknown>
  const accessToken = getString(record.accessToken)
  const websocketUrl = getString(record.websocketUrl)
  const config = record.config && typeof record.config === "object"
    ? record.config as Record<string, unknown>
    : {}

  if (!accessToken || !websocketUrl) {
    throw new Error("Deepgram live transcription did not return a temporary token.")
  }

  return {
    accessToken,
    config: {
      diarizeModel: getString(config.diarizeModel) || "latest",
      eagerEotThreshold: getNumber(config.eagerEotThreshold, 0.4),
      encoding: getString(config.encoding) || "linear16",
      eotThreshold: getNumber(config.eotThreshold, 0.75),
      eotTimeoutMs: getNumber(config.eotTimeoutMs, 5000),
      model: getString(config.model) || "flux-general-en",
      sampleRate: getNumber(config.sampleRate, 16000),
    },
    expiresIn: getNumber(record.expiresIn, 30),
    websocketUrl,
  }
}

function getDeepgramWebsocketUrl(websocketUrl: string) {
  const url = new URL(websocketUrl)
  url.searchParams.set("encoding", "linear16")
  url.searchParams.set("sample_rate", "16000")

  return url.toString()
}

async function createPcmAudioPipeline({
  onAudioChunk,
  onError,
  sampleRate,
  stream,
}: {
  onAudioChunk: (chunk: ArrayBuffer) => void
  onError: (error: unknown) => void
  sampleRate: number
  stream: MediaStream
}) {
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextCtor) {
    throw new Error("This browser cannot prepare live transcription audio.")
  }

  const audioContext = new AudioContextCtor()
  const sourceNode = audioContext.createMediaStreamSource(stream)
  const chunker = createPcmChunker({
    inputSampleRate: audioContext.sampleRate,
    onAudioChunk,
    outputSampleRate: sampleRate,
  })
  let cleanup = () => undefined

  if (audioContext.audioWorklet) {
    const workletUrl = createPcmWorkletUrl()
    await audioContext.audioWorklet.addModule(workletUrl)
    URL.revokeObjectURL(workletUrl)
    const workletNode = new AudioWorkletNode(audioContext, pcmWorkletName)
    const silentSink = audioContext.createGain()
    silentSink.gain.value = 0
    workletNode.port.onmessage = (event) => {
      const samples = event.data instanceof Float32Array
        ? event.data
        : new Float32Array(event.data as ArrayBuffer)
      chunker.push(samples)
    }
    sourceNode.connect(workletNode)
    workletNode.connect(silentSink)
    silentSink.connect(audioContext.destination)
    cleanup = () => {
      workletNode.port.onmessage = null
      sourceNode.disconnect()
      workletNode.disconnect()
      silentSink.disconnect()
    }
  } else {
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    const silentSink = audioContext.createGain()
    silentSink.gain.value = 0
    processor.onaudioprocess = (event) => {
      chunker.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    }
    sourceNode.connect(processor)
    processor.connect(silentSink)
    silentSink.connect(audioContext.destination)
    cleanup = () => {
      processor.onaudioprocess = null
      sourceNode.disconnect()
      processor.disconnect()
      silentSink.disconnect()
    }
  }

  return {
    start: () => {
      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(onError)
      }
    },
    stop: () => {
      try {
        chunker.flush()
        cleanup()
        void audioContext.close()
      } catch {
        // The audio graph may already be closed during call cleanup.
      }
    },
  }
}

function createPcmChunker({
  inputSampleRate,
  onAudioChunk,
  outputSampleRate,
}: {
  inputSampleRate: number
  onAudioChunk: (chunk: ArrayBuffer) => void
  outputSampleRate: number
}) {
  const samplesPerChunk = Math.max(1, Math.round(outputSampleRate * deepgramChunkMs / 1000))
  let pending: number[] = []
  let carry = 0

  return {
    flush: () => {
      if (pending.length > 0) {
        onAudioChunk(floatSamplesToLinear16(pending))
        pending = []
      }
    },
    push: (samples: Float32Array) => {
      const ratio = inputSampleRate / outputSampleRate
      for (let outputIndex = 0; ; outputIndex += 1) {
        const inputIndex = Math.floor(carry + outputIndex * ratio)
        if (inputIndex >= samples.length) {
          carry = Math.max(0, carry + outputIndex * ratio - samples.length)
          break
        }
        pending.push(samples[inputIndex])
        if (pending.length >= samplesPerChunk) {
          onAudioChunk(floatSamplesToLinear16(pending))
          pending = []
        }
      }
    },
  }
}

function floatSamplesToLinear16(samples: number[]) {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  })

  return buffer
}

function createPcmWorkletUrl() {
  const code = `
    class SalesFramePcmCapture extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0] && inputs[0][0];
        if (input && input.length) {
          const copy = new Float32Array(input);
          this.port.postMessage(copy, [copy.buffer]);
        }
        return true;
      }
    }
    registerProcessor("${pcmWorkletName}", SalesFramePcmCapture);
  `

  return URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
}

function extractDeepgramTranscriptEvent({
  message,
  providerSessionId,
  sourceKind,
}: {
  message: unknown
  providerSessionId: string
  sourceKind: AudioSourceKind
}): DeepgramTranscriptEvent | null {
  const payload = parseDeepgramMessage(message)
  if (!payload) return null

  const eventName = getString(payload.event || payload.type)
  const normalizedKind = normalizeDeepgramEventKind(eventName, payload)
  if (!normalizedKind) return null

  const alternative = payload.channel?.alternatives?.[0]
  const words = payload.words ?? alternative?.words ?? []
  const transcript = getString(payload.transcript) || getString(alternative?.transcript)
  if (!transcript && normalizedKind !== "turn_resumed") return null

  const turnIndex = typeof payload.turn_index === "number" ? payload.turn_index : undefined
  const providerEventId = [
    providerSessionId,
    sourceKind,
    turnIndex ?? "unknown",
    normalizedKind,
    Math.round(getSeconds(payload.audio_window_end) * 1000),
  ].join(":")
  const wordConfidence = getMeanWordConfidence(words, alternative?.confidence)
  const diarizationSpeaker = getDominantDiarizationSpeaker(words)

  return {
    diarizationSpeaker,
    endMs: toMilliseconds(payload.audio_window_end),
    endOfTurnConfidence: getFiniteNumber(payload.end_of_turn_confidence),
    eventKind: normalizedKind,
    isDelta: false,
    isFinal: normalizedKind === "end_of_turn",
    itemId: typeof turnIndex === "number" ? `${providerSessionId}:${sourceKind}:${turnIndex}` : providerEventId,
    languageDetected: getLanguageDetected(payload.languages),
    provider: providerName,
    providerEventId,
    providerSessionId,
    providerTurnIndex: turnIndex,
    segmentId: typeof turnIndex === "number" ? `${providerSessionId}:${sourceKind}:turn:${turnIndex}` : providerEventId,
    speaker: diarizationSpeaker,
    startMs: toMilliseconds(payload.audio_window_start),
    text: transcript,
    wordConfidence,
  }
}

function parseDeepgramMessage(message: unknown): DeepgramTurnMessage | null {
  if (typeof message !== "string") return null

  try {
    const parsed = JSON.parse(message) as DeepgramTurnMessage
    if (!parsed || typeof parsed !== "object") return null

    return parsed
  } catch {
    return null
  }
}

function normalizeDeepgramEventKind(
  eventName: string,
  payload: DeepgramTurnMessage
): DeepgramTranscriptEvent["eventKind"] | null {
  if (eventName === "Update") return "update"
  if (eventName === "StartOfTurn") return "start_of_turn"
  if (eventName === "EagerEndOfTurn") return "eager_end_of_turn"
  if (eventName === "TurnResumed") return "turn_resumed"
  if (eventName === "EndOfTurn") return "end_of_turn"
  if (payload.speech_final || payload.is_final || payload.from_finalize) return "end_of_turn"
  if (payload.channel?.alternatives?.[0]?.transcript || payload.transcript) return "update"

  return null
}

function getDominantDiarizationSpeaker(words: DeepgramWord[]) {
  const counts = new Map<number, number>()
  words.forEach((word) => {
    if (typeof word.speaker !== "number" || !Number.isFinite(word.speaker)) return
    counts.set(word.speaker, (counts.get(word.speaker) ?? 0) + 1)
  })

  let dominantSpeaker: number | null = null
  let dominantCount = 0
  counts.forEach((count, speaker) => {
    if (count > dominantCount) {
      dominantSpeaker = speaker
      dominantCount = count
    }
  })

  return dominantSpeaker === null ? undefined : `speaker_${dominantSpeaker}`
}

function getMeanWordConfidence(words: DeepgramWord[], fallback?: number) {
  const confidences = words
    .map((word) => word.confidence)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))

  if (confidences.length === 0) return getFiniteNumber(fallback)

  return roundConfidence(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
}

function getLanguageDetected(languages: unknown) {
  if (!Array.isArray(languages)) return undefined
  const firstLanguage = languages.find((language) => typeof language === "string" && language.trim())

  return typeof firstLanguage === "string" ? firstLanguage : undefined
}

function createProviderSessionId(sourceKind: AudioSourceKind) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12)

  return `dg_${sourceKind}_${Date.now().toString(36)}_${randomPart}`
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function getNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? roundConfidence(value) : undefined
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000))
}

function getSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function toMilliseconds(value: unknown) {
  const seconds = getSeconds(value)

  return seconds ? Math.max(0, Math.round(seconds * 1000)) : undefined
}
