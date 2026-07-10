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
    diarizeModel?: string
    eagerEotThreshold: number
    encoding: string
    eotThreshold: number
    eotTimeoutMs: number
    model: string
    sampleRate: number
  }
  expiresIn: number
  websocketUrl: string
  websocketUrls?: string[]
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
const deepgramKeepAliveMs = 5000
const deepgramSocketOpenTimeoutMs = 15000
const audioWorkletSetupTimeoutMs = 2500
const deepgramStartupAttempts = 3
const deepgramReconnectAttempts = 2
const maxBufferedAudioChunks = Math.ceil(4000 / deepgramChunkMs)
const pcmWorkletName = "salesframe-pcm-capture"
const providerName = "deepgram_flux" as const

export async function connectDeepgramLiveTranscription({
  callId,
  onTranscriptError,
  onTranscriptEvent,
  sourceKind,
  stream,
}: DeepgramTranscriptionConnectionOptions): Promise<DeepgramTranscriptionConnection> {
  let activeSocket: WebSocket | null = null
  let audioBacklog: ArrayBuffer[] = []
  let bufferDrainTimer: number | undefined
  let keepAliveTimer: number | undefined
  let lastAudioSentAt = 0
  let closedByClient = false
  let reconnecting = false

  const audioPipeline = await createPcmAudioPipeline({
    onAudioChunk: (chunk) => {
      if (chunk.byteLength === 0) return

      if (activeSocket?.readyState === WebSocket.OPEN) {
        activeSocket.send(chunk)
        lastAudioSentAt = Date.now()
        return
      }

      audioBacklog.push(chunk)
      if (audioBacklog.length > maxBufferedAudioChunks) {
        audioBacklog = audioBacklog.slice(-maxBufferedAudioChunks)
      }
    },
    onError: onTranscriptError,
    sampleRate: 16000,
    stream,
  })

  const connectSocket = async (attempts: number) => {
    let lastError: unknown

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const connection = await openDeepgramSocket({
          callId,
          onTranscriptError,
          onTranscriptEvent,
          onUnexpectedClose: () => {
            if (closedByClient || reconnecting) return

            reconnecting = true
            activeSocket = null
            void connectSocket(deepgramReconnectAttempts)
              .then((socket) => {
                reconnecting = false
                if (closedByClient) {
                  audioBacklog = []
                  socket.close(1000, "call_stopped")
                  return
                }
                activeSocket = socket
                drainBufferedAudio()
              })
              .catch((error) => {
                reconnecting = false
                if (!closedByClient) onTranscriptError(error)
              })
          },
          sourceKind,
        })

        return connection
      } catch (error) {
        lastError = error
        if (!shouldRetryDeepgramStartup(error) || attempt === attempts) break
        await waitForDeepgramRetry(attempt)
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Deepgram needs another moment. Try again shortly.")
  }

  const drainBufferedAudio = () => {
    if (bufferDrainTimer || !activeSocket || activeSocket.readyState !== WebSocket.OPEN) return

    const drainNextChunk = () => {
      bufferDrainTimer = undefined
      if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return

      const chunk = audioBacklog.shift()
      if (chunk && chunk.byteLength > 0) {
        activeSocket.send(chunk)
        lastAudioSentAt = Date.now()
      }

      if (audioBacklog.length > 0) {
        bufferDrainTimer = window.setTimeout(drainNextChunk, Math.round(deepgramChunkMs * 0.8))
      }
    }

    drainNextChunk()
  }

  const startKeepAlive = () => {
    keepAliveTimer = window.setInterval(() => {
      if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return
      if (Date.now() - lastAudioSentAt < deepgramKeepAliveMs) return

      try {
        activeSocket.send(JSON.stringify({ type: "KeepAlive" }))
      } catch (error) {
        onTranscriptError(error)
      }
    }, deepgramKeepAliveMs)
  }

  try {
    audioPipeline.start()
    activeSocket = await connectSocket(deepgramStartupAttempts)
    drainBufferedAudio()
    startKeepAlive()
  } catch (error) {
    audioPipeline.stop()
    throw error
  }

  return {
    close: () => {
      closedByClient = true
      audioBacklog = []
      if (bufferDrainTimer) window.clearTimeout(bufferDrainTimer)
      if (keepAliveTimer) window.clearInterval(keepAliveTimer)
      audioPipeline.stop()
      const socket = activeSocket
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        try {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "CloseStream" }))
        } catch {
          // The socket may already be closing when a seller stops the call.
        }
        socket.close(1000, "call_stopped")
      }
      activeSocket = null
    },
    flush: () => {
      try {
        if (activeSocket?.readyState === WebSocket.OPEN) activeSocket.send(JSON.stringify({ type: "Finalize" }))
      } catch {
        // Finalize is best-effort during stop.
      }
    },
  }
}

async function openDeepgramSocket({
  callId,
  onTranscriptError,
  onTranscriptEvent,
  onUnexpectedClose,
  sourceKind,
}: {
  callId: string
  onTranscriptError: (error: unknown) => void
  onTranscriptEvent: (event: DeepgramTranscriptEvent) => void | Promise<void>
  onUnexpectedClose: () => void
  sourceKind: AudioSourceKind
}) {
  const session = await createDeepgramTranscriptionToken(callId, { sourceKind })
  const tokenResponse = normalizeDeepgramTokenResponse(session)
  const providerSessionId = createProviderSessionId(sourceKind)
  const websocketUrls = getDeepgramWebsocketUrls(tokenResponse)
  const socket = await createOpenedDeepgramSocket(websocketUrls, tokenResponse.accessToken)
  let transcriptEventQueue = Promise.resolve()

  socket.addEventListener("message", (event) => {
    const transcriptEvent = extractDeepgramTranscriptEvent({
      message: event.data,
      providerSessionId,
      sourceKind,
    })
    if (transcriptEvent) {
      if (!transcriptEvent.isFinal) {
        void Promise.resolve(onTranscriptEvent(transcriptEvent)).catch(onTranscriptError)
        return
      }

      transcriptEventQueue = transcriptEventQueue
        .then(() => onTranscriptEvent(transcriptEvent))
        .catch((error) => {
          onTranscriptError(error)
        })
    }
  })
  socket.addEventListener("close", (event) => {
    if (event.wasClean || event.code === 1000) return
    onUnexpectedClose()
  })
  socket.addEventListener("error", onUnexpectedClose)

  return socket
}

async function createOpenedDeepgramSocket(websocketUrls: string[], accessToken: string) {
  let lastError: unknown
  const failures: string[] = []

  for (const websocketUrl of websocketUrls) {
    for (const protocols of getDeepgramAuthProtocolAttempts(accessToken)) {
      let socket: WebSocket | null = null

      try {
        socket = new WebSocket(websocketUrl, protocols)
        socket.binaryType = "arraybuffer"
        await waitForDeepgramSocketOpen(socket)
        return socket
      } catch (error) {
        lastError = error
        failures.push(`${getDeepgramSocketHost(websocketUrl)} ${protocols[0]}: ${getDeepgramErrorMessage(error)}`)
        try {
          socket?.close()
        } catch {
          // The socket may already be closed after a failed handshake.
        }
      }
    }
  }

  const failureSummary = failures.length > 0 ? ` Attempts: ${failures.join(" | ")}` : ""
  const message = getDeepgramErrorMessage(lastError)
  throw new Error(`${message || "This browser or network blocked the live transcript connection."}${failureSummary}`)
}

function getDeepgramAuthProtocolAttempts(accessToken: string) {
  // Browser WebSockets cannot set an Authorization header. Deepgram's browser
  // reference supports Bearer temporary tokens; in the browser this is sent as
  // Sec-WebSocket-Protocol: bearer, <temporary credential>.
  return [["bearer", accessToken]]
}

function getDeepgramSocketHost(websocketUrl: string) {
  try {
    return new URL(websocketUrl).host
  } catch {
    return "deepgram"
  }
}

function waitForDeepgramSocketOpen(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      try {
        socket.close()
      } catch {
        // The browser may already be closing the socket.
      }
      reject(new Error("This browser or network blocked the live transcript connection."))
    }, deepgramSocketOpenTimeoutMs)

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      socket.removeEventListener("open", handleOpen)
      socket.removeEventListener("error", handleError)
      socket.removeEventListener("close", handleClose)
    }
    const handleOpen = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error("This browser or network blocked the live transcript connection."))
    }
    const handleClose = (event: CloseEvent) => {
      cleanup()
      reject(createDeepgramSocketCloseError(event))
    }

    socket.addEventListener("open", handleOpen)
    socket.addEventListener("error", handleError)
    socket.addEventListener("close", handleClose)
  })
}

function createDeepgramSocketCloseError(event: CloseEvent) {
  const closeDetail = [event.code, event.reason].filter(Boolean).join(" ")
  if (event.code === 1008) {
    return new Error(
      closeDetail
        ? `Deepgram rejected the live transcript connection (${closeDetail}).`
        : "Deepgram rejected the live transcript connection."
    )
  }

  if (event.code === 1006) {
    return new Error("This browser or network blocked the live transcript connection.")
  }

  return new Error(
    closeDetail
      ? `Deepgram needs another moment. Try again shortly. (${closeDetail})`
      : "Deepgram needs another moment. Try again shortly."
  )
}

function getDeepgramErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error.trim()) return error

  return "This browser or network blocked the live transcript connection."
}

function shouldRetryDeepgramStartup(error: unknown) {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined
  if (code === "deepgram_key_missing" || code === "deepgram_auth_failed") return false

  return true
}

function waitForDeepgramRetry(attempt: number) {
  return new Promise((resolve) => window.setTimeout(resolve, 250 * attempt))
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
      diarizeModel: getString(config.diarizeModel) || undefined,
      eagerEotThreshold: getNumber(config.eagerEotThreshold, 0.4),
      encoding: getString(config.encoding) || "linear16",
      eotThreshold: getNumber(config.eotThreshold, 0.75),
      eotTimeoutMs: getNumber(config.eotTimeoutMs, 5000),
      model: getString(config.model) || "flux-general-en",
      sampleRate: getNumber(config.sampleRate, 16000),
    },
    expiresIn: getNumber(record.expiresIn, 30),
    websocketUrl,
    websocketUrls: Array.isArray(record.websocketUrls)
      ? record.websocketUrls.filter((url): url is string => typeof url === "string" && Boolean(url.trim()))
      : undefined,
  }
}

function getDeepgramWebsocketUrls(tokenResponse: DeepgramTokenResponse) {
  const urls = tokenResponse.websocketUrls?.length
    ? tokenResponse.websocketUrls
    : [tokenResponse.websocketUrl]

  return Array.from(new Set(urls.map((websocketUrl) => {
    const url = new URL(websocketUrl)
    url.searchParams.set("encoding", "linear16")
    url.searchParams.set("sample_rate", "16000")

    return url.toString()
  })))
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
  let pipelineReady = false

  if (audioContext.audioWorklet) {
    let workletUrl = ""
    try {
      workletUrl = createPcmWorkletUrl()
      await waitForAudioWorkletSetup(audioContext.audioWorklet.addModule(workletUrl))
      URL.revokeObjectURL(workletUrl)
      workletUrl = ""

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
      pipelineReady = true
    } catch {
      if (workletUrl) URL.revokeObjectURL(workletUrl)
      cleanup = () => undefined
    }
  }

  if (!pipelineReady) {
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

function waitForAudioWorkletSetup<T>(setupPromise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Audio worklet setup timed out."))
    }, audioWorkletSetupTimeoutMs)

    setupPromise.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
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
