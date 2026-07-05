import type { AudioSourceKind } from "@/lib/call-audio-preflight"
import { createRealtimeTranscriptionSession } from "@/lib/server-functions"

export type RealtimeTranscriptEvent = {
  endMs?: number
  eventKind: "delta" | "completed" | "segment"
  itemId?: string
  segmentId?: string
  isDelta: boolean
  isFinal: boolean
  speaker?: string
  startMs?: number
  text: string
}

export type RealtimeTranscriptionConnectionOptions = {
  callId: string
  onCommitCleanup: (cleanupTurnCommitter: () => void) => void
  onCommitTimer: (timer: number) => void
  onDataChannel: (dataChannel: RTCDataChannel) => void
  onTranscriptError: (error: unknown) => void
  onTranscriptEvent: (event: RealtimeTranscriptEvent) => void | Promise<void>
  sourceKind: AudioSourceKind
  stream: MediaStream
}

const realtimeWebRtcUrl = "https://api.openai.com/v1/realtime/calls"
const realtimeTranscriptActivityPollMs = 120
export const sourceTranscriptionDelay: Record<AudioSourceKind, "high" | "xhigh"> = {
  in_person_microphone: "xhigh",
  meeting_audio: "high",
  mixed_audio: "xhigh",
  seller_mic: "high",
}
const realtimeTranscriptProfiles: Record<
  AudioSourceKind,
  {
    maxTurnMs: number
    minimumActivationMs: number
    minimumSpeechMs: number
    noiseFloorMultiplier: number
    silenceCommitMs: number
    voiceThreshold: number
  }
> = {
  in_person_microphone: {
    maxTurnMs: 32000,
    minimumActivationMs: 280,
    minimumSpeechMs: 900,
    noiseFloorMultiplier: 3.2,
    silenceCommitMs: 2200,
    voiceThreshold: 0.018,
  },
  meeting_audio: {
    maxTurnMs: 24000,
    minimumActivationMs: 240,
    minimumSpeechMs: 800,
    noiseFloorMultiplier: 2.8,
    silenceCommitMs: 1550,
    voiceThreshold: 0.032,
  },
  mixed_audio: {
    maxTurnMs: 32000,
    minimumActivationMs: 280,
    minimumSpeechMs: 900,
    noiseFloorMultiplier: 3.2,
    silenceCommitMs: 2200,
    voiceThreshold: 0.018,
  },
  seller_mic: {
    maxTurnMs: 22000,
    minimumActivationMs: 220,
    minimumSpeechMs: 850,
    noiseFloorMultiplier: 3,
    silenceCommitMs: 1450,
    voiceThreshold: 0.038,
  },
}

export async function connectRealtimeTranscription({
  callId,
  onCommitCleanup,
  onTranscriptError,
  onTranscriptEvent,
  sourceKind,
  onCommitTimer,
  onDataChannel,
  stream,
}: RealtimeTranscriptionConnectionOptions) {
  const session = await createRealtimeTranscriptionSession(callId, {
    sourceKind,
    transcriptionDelay: sourceTranscriptionDelay[sourceKind],
  })
  const ephemeralKey = getRealtimeEphemeralKey(session)
  if (!ephemeralKey) {
    throw new Error("Realtime transcription session did not return a client secret.")
  }

  const peerConnection = new RTCPeerConnection()
  const dataChannel = peerConnection.createDataChannel("oai-events")
  onDataChannel(dataChannel)

  dataChannel.addEventListener("message", (event) => {
    const transcriptEvent = extractRealtimeTranscriptEvent(event.data)
    if (transcriptEvent) {
      void Promise.resolve(onTranscriptEvent(transcriptEvent)).catch(onTranscriptError)
    }
  })

  dataChannel.addEventListener("open", () => {
    startRealtimeSpeechTurnCommitter({
      dataChannel,
      onCommitCleanup,
      onCommitTimer,
      sourceKind,
      stream,
    })
  })

  stream.getAudioTracks().forEach((track) => peerConnection.addTrack(track, stream))

  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  const response = await fetch(realtimeWebRtcUrl, {
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      "Content-Type": "application/sdp",
    },
    method: "POST",
  })

  if (!response.ok) {
    throw new Error("Realtime transcription needs another connection attempt.")
  }

  await peerConnection.setRemoteDescription({
    sdp: await response.text(),
    type: "answer",
  })

  return peerConnection
}

export function flushRealtimeAudioBuffers(dataChannels: RTCDataChannel[]) {
  dataChannels.forEach((dataChannel) => {
    try {
      commitRealtimeAudioBuffer(dataChannel)
    } catch {
      // The connection may already be closed while the seller is stopping the call.
    }
  })
}

export function waitForRealtimeFlush() {
  return new Promise((resolve) => window.setTimeout(resolve, 350))
}

function startRealtimeSpeechTurnCommitter({
  dataChannel,
  onCommitCleanup,
  onCommitTimer,
  sourceKind,
  stream,
}: {
  dataChannel: RTCDataChannel
  onCommitCleanup: (cleanupTurnCommitter: () => void) => void
  onCommitTimer: (timer: number) => void
  sourceKind: AudioSourceKind
  stream: MediaStream
}) {
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextCtor) {
    return
  }

  const audioContext = new AudioContextCtor()
  if (audioContext.state === "suspended") {
    void audioContext.resume()
  }
  const sourceNode = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 1024
  sourceNode.connect(analyser)

  const samples = new Uint8Array(analyser.fftSize)
  const profile = realtimeTranscriptProfiles[sourceKind]
  let isSpeaking = false
  let noiseFloor = profile.voiceThreshold / 3
  let voiceCandidateStartedAt = 0
  let speechStartedAt = 0
  let lastVoiceAt = 0

  const timer = window.setInterval(() => {
    analyser.getByteTimeDomainData(samples)
    const now = Date.now()
    const voiceLevel = calculateAudioRms(samples)
    const activationThreshold = Math.max(
      profile.voiceThreshold,
      noiseFloor * profile.noiseFloorMultiplier
    )
    const hasVoice = voiceLevel >= activationThreshold

    if (!isSpeaking && !hasVoice) {
      noiseFloor = noiseFloor * 0.92 + voiceLevel * 0.08
      voiceCandidateStartedAt = 0

      return
    }

    if (!isSpeaking) {
      if (!voiceCandidateStartedAt) voiceCandidateStartedAt = now
      if (now - voiceCandidateStartedAt < profile.minimumActivationMs) return

      isSpeaking = true
      speechStartedAt = voiceCandidateStartedAt
      lastVoiceAt = now
    } else if (hasVoice) {
      lastVoiceAt = now
    }

    if (!isSpeaking) return

    const speechDuration = now - speechStartedAt
    const silenceDuration = now - lastVoiceAt
    const hasEnoughSpeech = speechDuration >= profile.minimumSpeechMs
    const reachedNaturalBoundary =
      hasEnoughSpeech && silenceDuration >= profile.silenceCommitMs
    const reachedMaxTurn = speechDuration >= profile.maxTurnMs

    if (!reachedNaturalBoundary && !reachedMaxTurn) return

    commitRealtimeAudioBuffer(dataChannel)
    isSpeaking = false
    voiceCandidateStartedAt = 0
    speechStartedAt = 0
    lastVoiceAt = 0
  }, realtimeTranscriptActivityPollMs)

  onCommitTimer(timer)
  onCommitCleanup(() => {
    try {
      sourceNode.disconnect()
      analyser.disconnect()
      void audioContext.close()
    } catch {
      // Audio graph may already be closed when the call stops.
    }
  })
}

function commitRealtimeAudioBuffer(dataChannel: RTCDataChannel) {
  if (dataChannel.readyState !== "open") return

  try {
    dataChannel.send(JSON.stringify({ type: "input_audio_buffer.commit" }))
  } catch {
    // The realtime channel can close between the ready-state check and send while a call is stopping.
  }
}

function calculateAudioRms(samples: Uint8Array) {
  const sumSquares = samples.reduce((sum, sample) => {
    const centeredSample = (sample - 128) / 128

    return sum + centeredSample * centeredSample
  }, 0)

  return Math.sqrt(sumSquares / samples.length)
}

function getRealtimeEphemeralKey(value: unknown) {
  if (!value || typeof value !== "object") return ""

  if ("client_secret" in value) {
    const clientSecret = value.client_secret

    if (typeof clientSecret === "string") return clientSecret
    if (
      clientSecret &&
      typeof clientSecret === "object" &&
      "value" in clientSecret &&
      typeof clientSecret.value === "string"
    ) {
      return clientSecret.value
    }
  }

  if ("value" in value && typeof value.value === "string") {
    return value.value
  }

  if ("ephemeral_key" in value && typeof value.ephemeral_key === "string") {
    return value.ephemeral_key
  }

  return ""
}

function extractRealtimeTranscriptEvent(value: unknown): RealtimeTranscriptEvent | null {
  if (typeof value !== "string") return null

  try {
    const event = JSON.parse(value) as Record<string, unknown>
    const type = typeof event.type === "string" ? event.type : ""
    const isDelta = type === "conversation.item.input_audio_transcription.delta"
    const isCompleted = type === "conversation.item.input_audio_transcription.completed"
    const isSegment = type === "conversation.item.input_audio_transcription.segment"
    if (!isDelta && !isCompleted && !isSegment) return null

    const itemId =
      getString(event.item_id) ||
      getString(event.itemId) ||
      getNestedString(event, ["item", "id"])
    const segmentId =
      getString(event.id) ||
      getString(event.segment_id) ||
      getNestedString(event, ["segment", "id"])
    const text =
      getString(event.transcript) ||
      getString(event.text) ||
      getRealtimeDeltaString(event.delta) ||
      getNestedString(event, ["segment", "text"]) ||
      getNestedString(event, ["segment", "transcript"]) ||
      getNestedString(event, ["response", "text"]) ||
      getNestedString(event, ["response", "transcript"]) ||
      getNestedString(event, ["item", "content", 0, "transcript"]) ||
      getNestedString(event, ["item", "content", 0, "text"])

    if (!text) return null

    return {
      endMs: getRealtimeEventMilliseconds(event, "end"),
      eventKind: isSegment ? "segment" : isDelta ? "delta" : "completed",
      itemId,
      segmentId,
      isDelta,
      isFinal: isCompleted || isSegment,
      speaker:
        getString(event.speaker) ||
        getNestedString(event, ["segment", "speaker"]),
      startMs: getRealtimeEventMilliseconds(event, "start"),
      text,
    }
  } catch {
    return null
  }
}

function getRealtimeEventMilliseconds(event: Record<string, unknown>, key: "start" | "end") {
  const value =
    event[`${key}_ms`] ??
    event[`${key}Ms`] ??
    event[key] ??
    getNestedValue(event, ["segment", key]) ??
    getNestedValue(event, ["segment", `${key}_ms`])

  if (typeof value !== "number" || !Number.isFinite(value)) return undefined

  return value > 10000 ? Math.round(value) : Math.round(value * 1000)
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function getRealtimeDeltaString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : ""
}

function getNestedString(record: Record<string, unknown>, path: Array<string | number>) {
  const value = getNestedValue(record, path)

  return getString(value)
}

function getNestedValue(record: Record<string, unknown>, path: Array<string | number>) {
  return path.reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined
    if (typeof key === "number") {
      return Array.isArray(value) ? value[key] : undefined
    }

    return (value as Record<string, unknown>)[key]
  }, record)
}
