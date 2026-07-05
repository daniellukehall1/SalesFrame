import * as React from "react"

import {
  requestCallDiarization,
  requestSpeakerAttribution,
  type CallDiarizationResponse,
} from "@/lib/server-functions"
import {
  runAudioPreflight,
  summarizeAudioSource,
  type AudioSourceKind,
  type AudioPreflightResult,
  type CapturedAudioSource,
} from "@/lib/call-audio-preflight"
import {
  connectRealtimeTranscription,
  flushRealtimeAudioBuffers,
  sourceTranscriptionDelay,
  waitForRealtimeFlush,
  type RealtimeTranscriptEvent,
} from "@/lib/realtime-transcription"
import {
  createCallRecordingSignedUrl,
  ensureCallSpeaker,
  insertCallNote,
  insertTranscriptSegment,
  updateCall,
  updateTranscriptSegment,
  uploadCallRecording,
} from "@/lib/supabase/salesframe-data"
import type { CallAudioCaptureMode, TranscriptSpeaker } from "@/lib/salesframe-core"
import { getUserFacingErrorMessage } from "@/lib/user-facing-errors"
import {
  appendTranscriptDelta,
  canContinueTranscriptTurn,
  joinTranscriptText,
  rememberFinalTranscriptEvent,
  shouldSuppressFinalTranscript,
  type RecentFinalTranscriptEvent,
} from "@/lib/turn-assembler"

export type CallCaptureStatus =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "recording"
  | "paused"
  | "stopping"
  | "stopped"
  | "permission-denied"
  | "upload-failed"
  | "error"

export type CallCapturePermissionState =
  | "unknown"
  | "granted"
  | "denied"
  | "capture-unavailable"

export type CallCaptureTranscriptLine = {
  clientId?: string
  id?: string
  isPartial?: boolean
  speaker: TranscriptSpeaker
  speakerAttributionReason?: string
  speakerConfidence?: number
  speakerDisplayName?: string
  speakerId?: string
  speakerLabel?: TranscriptSpeaker
  speakerNeedsReview?: boolean
  speakerSource?: string
  time: string
  text: string
}

export type CallCaptureDiarizationResult = CallDiarizationResponse

type StartCallCaptureConfig = {
  abortSignal?: AbortSignal
  audioCaptureMode: CallAudioCaptureMode
  callId: string
  onDiarization?: (result: CallCaptureDiarizationResult) => void
  startedAt: string
  workspaceId: string
  onTranscript?: (line: CallCaptureTranscriptLine) => void
  onTranscriptUpdate?: (line: CallCaptureTranscriptLine) => void
}

export type CallCaptureStopResult = {
  callId: string
  durationSeconds: number
  endedAt: string
  recordingStoragePath: string | null
  recordingUrl: string | null
}

type SpeakerAttribution = {
  confidence: number
  needsReview: boolean
  reason: string
  speakerLabel: TranscriptSpeaker
  source: string
}

type TranscriptTurn = {
  attribution: SpeakerAttribution
  clientId: string
  displayName: string
  endMs: number
  lastActivityMs: number
  openaiItemId?: string
  openaiSegmentId?: string
  qualityFlags: string[]
  segmentId: string
  sourceKind: AudioSourceKind
  speakerId: string
  startMs: number
  text: string
  transcriptionDelay: string
  turnSequence: number
}

const rollingDiarizationWindowMs = 30000
const enableRollingDiarization = false
const callStartCancelledMessage = "Call start was cancelled."

function throwIfCallStartCancelled(signal?: AbortSignal) {
  if (!signal?.aborted) return

  throw new Error(callStartCancelledMessage)
}

export function useCallCapture() {
  const [error, setError] = React.useState<string | null>(null)
  const [permissionState, setPermissionState] =
    React.useState<CallCapturePermissionState>("unknown")
  const [status, setStatus] = React.useState<CallCaptureStatus>("idle")
  const [activeCallId, setActiveCallId] = React.useState("")
  const [audioPreflight, setAudioPreflight] = React.useState<AudioPreflightResult | null>(null)
  const activeConfigRef = React.useRef<StartCallCaptureConfig | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const partialTranscriptLinesRef = React.useRef<Map<string, CallCaptureTranscriptLine>>(new Map())
  const partialTranscriptTextRef = React.useRef<Map<string, string>>(new Map())
  const realtimeDataChannelsRef = React.useRef<RTCDataChannel[]>([])
  const realtimeCommitCleanupsRef = React.useRef<(() => void)[]>([])
  const realtimeCommitTimersRef = React.useRef<number[]>([])
  const rollingDiarizationChunksRef = React.useRef<Blob[]>([])
  const rollingDiarizationInFlightRef = React.useRef(false)
  const rollingDiarizationStartedAtMsRef = React.useRef(0)
  const peerConnectionsRef = React.useRef<RTCPeerConnection[]>([])
  const sourceStreamsRef = React.useRef<MediaStream[]>([])
  const persistedTranscriptKeysRef = React.useRef<Set<string>>(new Set())
  const recentFinalTranscriptEventsRef = React.useRef<RecentFinalTranscriptEvent[]>([])
  const recentTranscriptRef = React.useRef<CallCaptureTranscriptLine[]>([])
  const activeTranscriptTurnsRef = React.useRef<Map<AudioSourceKind, TranscriptTurn>>(new Map())
  const realtimeSegmentedItemsRef = React.useRef<Set<string>>(new Set())
  const realtimeSpeakerLabelsRef = React.useRef<Map<string, TranscriptSpeaker>>(new Map())
  const stopInFlightRef = React.useRef(false)
  const transcriptTurnSequenceRef = React.useRef(0)

  const cleanup = React.useCallback(() => {
    realtimeCommitTimersRef.current.forEach((timer) => window.clearInterval(timer))
    realtimeCommitTimersRef.current = []
    realtimeCommitCleanupsRef.current.forEach((cleanupTurnCommitter) => cleanupTurnCommitter())
    realtimeCommitCleanupsRef.current = []
    realtimeDataChannelsRef.current = []

    peerConnectionsRef.current.forEach((connection) => connection.close())
    peerConnectionsRef.current = []

    sourceStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop())
    })
    sourceStreamsRef.current = []
  }, [])

  React.useEffect(() => cleanup, [cleanup])

  const startCall = React.useCallback(
    async (config: StartCallCaptureConfig) => {
      setError(null)
      setStatus("requesting-permission")
      setActiveCallId(config.callId)
      setAudioPreflight(null)
      activeConfigRef.current = config
      persistedTranscriptKeysRef.current = new Set()
      recentFinalTranscriptEventsRef.current = []
      partialTranscriptLinesRef.current = new Map()
      partialTranscriptTextRef.current = new Map()
      activeTranscriptTurnsRef.current = new Map()
      realtimeSegmentedItemsRef.current = new Set()
      realtimeSpeakerLabelsRef.current = new Map()
      rollingDiarizationChunksRef.current = []
      rollingDiarizationInFlightRef.current = false
      rollingDiarizationStartedAtMsRef.current = 0
      transcriptTurnSequenceRef.current = 0
      recentTranscriptRef.current = []
      chunksRef.current = []

      try {
        throwIfCallStartCancelled(config.abortSignal)
        const { preflight, sources } = await runAudioPreflight(config.audioCaptureMode)
        sourceStreamsRef.current = sources.map((source) => source.stream)
        throwIfCallStartCancelled(config.abortSignal)
        setAudioPreflight(preflight)
        setPermissionState("granted")
        setStatus("connecting")

        await updateCall(config.callId, {
          audio_preflight: preflight,
          audio_source_summary: sources.map(summarizeAudioSource),
        })
        throwIfCallStartCancelled(config.abortSignal)

        const recordingStream = createRecordingStream(sources)
        const diarizationSourceHint = getDiarizationSourceHint(sources, config.audioCaptureMode)
        const recorder = createRecorder(recordingStream, (chunk) => {
          if (chunk.size > 0) chunksRef.current.push(chunk)
          if (enableRollingDiarization && chunk.size > 0) {
            collectRollingDiarizationChunk({
              chunk,
              config,
              sourceHint: diarizationSourceHint,
              startedAtMs: new Date(config.startedAt).getTime(),
              rollingChunksRef: rollingDiarizationChunksRef,
              rollingInFlightRef: rollingDiarizationInFlightRef,
              rollingStartedAtRef: rollingDiarizationStartedAtMsRef,
            })
          }
        })
        mediaRecorderRef.current = recorder

        const persistTranscriptEvent = async (
          event: RealtimeTranscriptEvent,
          source: CapturedAudioSource
        ) => {
          const elapsedMs = Math.max(
            0,
            Date.now() - new Date(config.startedAt).getTime()
          )
          const itemKey = event.itemId
            ? `${source.kind}-${event.itemId}`
            : `${source.kind}-${Math.round(elapsedMs / 1000)}`
          const segmentKey = event.segmentId ? `${source.kind}-${event.segmentId}` : itemKey
          const transcriptEventKey = event.eventKind === "segment" ? segmentKey : itemKey

          if (event.eventKind === "segment") {
            realtimeSegmentedItemsRef.current.add(itemKey)
          } else if (event.eventKind === "completed" && realtimeSegmentedItemsRef.current.has(itemKey)) {
            partialTranscriptLinesRef.current.delete(itemKey)
            partialTranscriptTextRef.current.delete(itemKey)
            return
          }

          if (!event.isFinal) {
            const previousText = partialTranscriptTextRef.current.get(itemKey) ?? ""
            const liveText = event.isDelta ? appendTranscriptDelta(previousText, event.text) : event.text
            const displayText = liveText.trim()
            if (!displayText) return

            partialTranscriptTextRef.current.set(itemKey, liveText)

            const activeTurn = activeTranscriptTurnsRef.current.get(source.kind)
            const existingLine = partialTranscriptLinesRef.current.get(itemKey)
            const initialAttribution = activeTurn?.attribution ?? getSourceAttribution(source)
            const shouldContinuePartialTurn = Boolean(
              activeTurn && canContinueTurn(activeTurn, initialAttribution, elapsedMs, displayText)
            )
            const clientId = existingLine?.clientId ?? (activeTurn && shouldContinuePartialTurn
              ? activeTurn.clientId
              : itemKey)
            const line: CallCaptureTranscriptLine = {
              ...existingLine,
              clientId,
              id: existingLine?.id ?? (activeTurn && shouldContinuePartialTurn ? activeTurn.segmentId : clientId),
              isPartial: true,
              speaker: existingLine?.speaker ?? initialAttribution.speakerLabel,
              speakerAttributionReason:
                existingLine?.speakerAttributionReason ?? initialAttribution.reason,
              speakerConfidence: existingLine?.speakerConfidence ?? initialAttribution.confidence,
              speakerDisplayName:
                existingLine?.speakerDisplayName ?? activeTurn?.displayName ?? initialAttribution.speakerLabel,
              speakerId: existingLine?.speakerId ?? activeTurn?.speakerId,
              speakerLabel: existingLine?.speakerLabel ?? initialAttribution.speakerLabel,
              speakerNeedsReview:
                existingLine?.speakerNeedsReview ?? initialAttribution.needsReview,
              speakerSource: existingLine?.speakerSource ?? source.kind,
              time: existingLine?.time ?? (activeTurn && shouldContinuePartialTurn ? formatElapsedTime(activeTurn.startMs) : formatElapsedTime(elapsedMs)),
              text: activeTurn && shouldContinuePartialTurn
                ? joinTranscriptText(activeTurn.text, displayText)
                : displayText,
            }

            partialTranscriptLinesRef.current.set(itemKey, line)
            if (existingLine || shouldContinuePartialTurn) {
              config.onTranscriptUpdate?.(line)
            } else {
              config.onTranscript?.(line)
            }
            return
          }

          const finalText = event.text.trim() || partialTranscriptTextRef.current.get(itemKey)?.trim() || ""
          if (!finalText) return
          const turnDecision = shouldSuppressFinalTranscript({
            elapsedMs,
            finalText,
            recentEvents: recentFinalTranscriptEventsRef.current,
            sourceKind: source.kind,
          })
          if (turnDecision.lowQuality || turnDecision.duplicate) {
            partialTranscriptLinesRef.current.delete(itemKey)
            partialTranscriptTextRef.current.delete(itemKey)
            return
          }

          const transcriptKey = event.segmentId
            ? `${source.kind}-${event.segmentId}`
            : event.itemId
              ? `${source.kind}-${event.itemId}`
            : `${source.kind}-${finalText}-${Math.round(elapsedMs / 1000)}`
          if (persistedTranscriptKeysRef.current.has(transcriptKey)) return
          persistedTranscriptKeysRef.current.add(transcriptKey)
          rememberFinalTranscriptEvent({
            elapsedMs,
            recentEvents: recentFinalTranscriptEventsRef.current,
            sourceKind: source.kind,
            text: finalText,
          })

          const eventStartMs = event.startMs ?? elapsedMs
          const eventEndMs = event.endMs ?? elapsedMs
          const segmentAttribution = getRealtimeSegmentAttribution({
            rawSpeaker: event.speaker,
            source,
            speakerLabels: realtimeSpeakerLabelsRef.current,
          })
          const initialAttribution = segmentAttribution ?? getSourceAttribution(source)
          const attribution = segmentAttribution ?? await resolveTurnAttribution({
            config,
            elapsedMs,
            initialAttribution,
            recentTranscript: recentTranscriptRef.current,
            segmentText: finalText,
            source,
          })
          const activeTurn = activeTranscriptTurnsRef.current.get(source.kind)
          const shouldContinueTurn = activeTurn
            ? canContinueTurn(activeTurn, attribution, eventEndMs, finalText)
            : false
          const matchingPartialLine =
            partialTranscriptLinesRef.current.get(itemKey) ??
            partialTranscriptLinesRef.current.get(transcriptEventKey)
          const turn = shouldContinueTurn && activeTurn
            ? await updateTranscriptTurn({
                attribution,
                config,
                elapsedMs: eventEndMs,
                finalText,
                openaiItemId: event.itemId,
                openaiSegmentId: event.segmentId,
                qualityFlags: turnDecision.qualityFlags,
                turn: activeTurn,
              })
            : await createTranscriptTurn({
                attribution,
                config,
                elapsedMs: eventEndMs,
                finalText,
                openaiItemId: event.itemId,
                openaiSegmentId: event.segmentId,
                preferredClientId: matchingPartialLine?.clientId ?? itemKey,
                qualityFlags: turnDecision.qualityFlags,
                source,
                startMs: eventStartMs,
                turnSequenceRef: transcriptTurnSequenceRef,
              })

          activeTranscriptTurnsRef.current.set(source.kind, turn)

          const line = createTranscriptLineFromTurn(turn)
          upsertRecentTranscriptLine(recentTranscriptRef.current, line)
          if (shouldContinueTurn || matchingPartialLine) {
            config.onTranscriptUpdate?.(line)
          } else {
            config.onTranscript?.(line)
          }
          partialTranscriptLinesRef.current.delete(itemKey)
          partialTranscriptLinesRef.current.delete(transcriptEventKey)
          partialTranscriptTextRef.current.delete(itemKey)

          if (!shouldContinueTurn) {
            await insertCallNote({
              call_id: config.callId,
              note_type: "evidence",
              text: finalText,
            })
          }

          if (!shouldRefineBeforeTurn(source) || segmentAttribution) {
            void refineSpeakerAttribution({
              config,
              elapsedMs: eventEndMs,
              line,
              recentTranscript: recentTranscriptRef.current,
              segmentId: turn.segmentId,
              source,
            }).catch(() => undefined)
          }
        }

        const connections: RTCPeerConnection[] = []
        for (const source of sources) {
          throwIfCallStartCancelled(config.abortSignal)
          try {
            const connection = await connectRealtimeTranscription({
              callId: config.callId,
              onCommitTimer: (timer) => {
                realtimeCommitTimersRef.current.push(timer)
              },
              onCommitCleanup: (cleanupTurnCommitter) => {
                realtimeCommitCleanupsRef.current.push(cleanupTurnCommitter)
              },
              onDataChannel: (dataChannel) => {
                realtimeDataChannelsRef.current.push(dataChannel)
              },
              onTranscriptError: (caughtError) => {
                if (isRecoverableTranscriptDuplicateError(caughtError)) return

                setStatus("error")
                setError(getUserFacingErrorMessage(caughtError, "That transcript line needs another save attempt. SalesFrame will keep listening."))
              },
              onTranscriptEvent: (event) => persistTranscriptEvent(event, source),
              sourceKind: source.kind,
              stream: source.stream,
            })
            connections.push(connection)
            peerConnectionsRef.current = connections
            throwIfCallStartCancelled(config.abortSignal)
          } catch (caughtError: unknown) {
            if (connections.length === 0 && sources.length === 1) throw caughtError
            setError(
              `${getAudioSourceLabel(source.kind)} transcription needs another connection attempt. ${getUserFacingErrorMessage(
                caughtError,
                "SalesFrame is continuing with the audio it can hear."
              )}`
            )
          }
        }

        if (connections.length === 0) {
          throw new Error("SalesFrame needs another transcription connection attempt before it can capture this call.")
        }

        peerConnectionsRef.current = connections

        throwIfCallStartCancelled(config.abortSignal)
        recorder.start(1000)
        setStatus("recording")
      } catch (caughtError: unknown) {
        cleanup()
        if (config.abortSignal?.aborted) {
          setError(null)
          setPermissionState("unknown")
          setStatus("idle")
          setActiveCallId("")
          setAudioPreflight(null)
          activeConfigRef.current = null
          mediaRecorderRef.current = null
          chunksRef.current = []
          await updateCall(config.callId, { status: "archived" }).catch(() => undefined)
          throw caughtError
        }

        const message = getUserFacingErrorMessage(caughtError, "SalesFrame needs access to the call audio before it can start.")

        if (isCaptureUnavailableError(caughtError)) {
          setPermissionState("capture-unavailable")
        } else if (isPermissionError(caughtError)) {
          setPermissionState("denied")
          setStatus("permission-denied")
        } else {
          setStatus("error")
        }

        setError(message)
        setActiveCallId("")
        setAudioPreflight(null)
        await updateCall(config.callId, { status: "needs_attention" }).catch(() => undefined)
        throw caughtError
      }
    },
    [cleanup]
  )

  const stopCall = React.useCallback(async (): Promise<CallCaptureStopResult | null> => {
    if (stopInFlightRef.current) return null
    stopInFlightRef.current = true

    const config = activeConfigRef.current
    if (!config) {
      cleanup()
      setActiveCallId("")
      setAudioPreflight(null)
      setStatus((currentStatus) => (currentStatus === "idle" ? "idle" : "stopped"))
      stopInFlightRef.current = false
      return null
    }

    setStatus("stopping")
    let blob = createRecordingBlob(chunksRef.current, mediaRecorderRef.current?.mimeType)

    try {
      try {
        flushRealtimeAudioBuffers(realtimeDataChannelsRef.current)
        await waitForRealtimeFlush()
      } catch (caughtError: unknown) {
        setError(getUserFacingErrorMessage(caughtError, "SalesFrame may need a moment to finish the last transcript lines."))
      }

      if (enableRollingDiarization) {
        void sendRollingDiarizationChunk({
          config,
          force: true,
          sourceHint: getDiarizationSourceHintFromMode(config.audioCaptureMode),
          rollingChunksRef: rollingDiarizationChunksRef,
          rollingInFlightRef: rollingDiarizationInFlightRef,
          rollingStartedAtRef: rollingDiarizationStartedAtMsRef,
        })
      }
      blob = await stopRecorder(mediaRecorderRef.current, chunksRef.current)
    } catch (caughtError: unknown) {
      setError(getUserFacingErrorMessage(caughtError, "The call ended, and the audio recording needs another preparation attempt."))
    } finally {
      cleanup()
      activeConfigRef.current = null
      mediaRecorderRef.current = null
      setActiveCallId("")
      setAudioPreflight(null)
    }

    const endedAt = new Date().toISOString()
    const durationSeconds = Math.max(
      0,
      Math.round((new Date(endedAt).getTime() - new Date(config.startedAt).getTime()) / 1000)
    )

    try {
      await updateCall(config.callId, {
        duration_seconds: durationSeconds,
        ended_at: endedAt,
        status: "processing",
      })
    } catch (caughtError: unknown) {
      setError(getUserFacingErrorMessage(caughtError, "Call stopped. SalesFrame needs another moment to save the final status."))
    }

    let uploadFailed = false
    let recordingStoragePath: string | null = null
    let recordingUrl: string | null = null
    if (blob.size > 0) {
      try {
        const upload = await uploadCallRecording({
          callId: config.callId,
          file: blob,
          workspaceId: config.workspaceId,
        })
        recordingStoragePath = upload.path

        try {
          recordingUrl = await createCallRecordingSignedUrl(upload.path)
        } catch (caughtError: unknown) {
          setError(getUserFacingErrorMessage(caughtError, "Recording was saved, but the replay link needs to be refreshed."))
        }
      } catch (caughtError: unknown) {
        uploadFailed = true
        setError(getUserFacingErrorMessage(caughtError, "Transcript is saved. The audio recording needs another upload attempt."))
      }
    }

    setStatus(uploadFailed ? "upload-failed" : "stopped")
    stopInFlightRef.current = false

    return {
      callId: config.callId,
      durationSeconds,
      endedAt,
      recordingStoragePath,
      recordingUrl,
    }
  }, [cleanup])

  const cancelCallStart = React.useCallback(async (callId?: string) => {
    const config = activeConfigRef.current
    const targetCallId = callId || config?.callId || activeCallId

    try {
      await stopRecorder(mediaRecorderRef.current, chunksRef.current)
    } catch {
      // A cancelled start should prioritise releasing capture resources over surfacing cleanup noise.
    } finally {
      cleanup()
      activeConfigRef.current = null
      mediaRecorderRef.current = null
      chunksRef.current = []
      setActiveCallId("")
      setAudioPreflight(null)
      setError(null)
      setPermissionState("unknown")
      setStatus("idle")
    }

    if (targetCallId) {
      await updateCall(targetCallId, {
        ended_at: new Date().toISOString(),
        status: "archived",
      }).catch(() => undefined)
    }
  }, [activeCallId, cleanup])

  const pauseCapture = React.useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder?.state === "recording") {
      recorder.pause()
      sourceStreamsRef.current.forEach((stream) => stream.getAudioTracks().forEach((track) => {
        track.enabled = false
      }))
      setStatus("paused")
    }
  }, [])

  const resumeCapture = React.useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder?.state === "paused") {
      sourceStreamsRef.current.forEach((stream) => stream.getAudioTracks().forEach((track) => {
        track.enabled = true
      }))
      recorder.resume()
      setStatus("recording")
    }
  }, [])

  return {
    activeCallId,
    audioPreflight,
    error,
    pauseCapture,
    permissionState,
    cancelCallStart,
    resumeCapture,
    startCall,
    status,
    stopCall,
  }
}

function createRecordingStream(sources: CapturedAudioSource[]) {
  return new MediaStream(
    sources.flatMap((source) => source.stream.getAudioTracks())
  )
}

function createRecorder(stream: MediaStream, onData: (chunk: Blob) => void) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Recording is not available in this browser.")
  }

  const recorder = new MediaRecorder(stream, getRecorderOptions())

  recorder.addEventListener("dataavailable", (event) => {
    onData(event.data)
  })

  return recorder
}

function getRecorderOptions() {
  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ]
  const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))

  return mimeType ? { mimeType } : undefined
}

function collectRollingDiarizationChunk({
  chunk,
  config,
  rollingChunksRef,
  rollingInFlightRef,
  rollingStartedAtRef,
  sourceHint,
  startedAtMs,
}: {
  chunk: Blob
  config: StartCallCaptureConfig
  rollingChunksRef: React.MutableRefObject<Blob[]>
  rollingInFlightRef: React.MutableRefObject<boolean>
  rollingStartedAtRef: React.MutableRefObject<number>
  sourceHint: string
  startedAtMs: number
}) {
  const elapsedMs = Math.max(0, Date.now() - startedAtMs)
  if (rollingChunksRef.current.length === 0) {
    rollingStartedAtRef.current = elapsedMs
  }

  rollingChunksRef.current.push(chunk)

  if (elapsedMs - rollingStartedAtRef.current < rollingDiarizationWindowMs) return

  void sendRollingDiarizationChunk({
    config,
    force: false,
    rollingChunksRef,
    rollingInFlightRef,
    rollingStartedAtRef,
    sourceHint,
  })
}

async function sendRollingDiarizationChunk({
  config,
  force,
  rollingChunksRef,
  rollingInFlightRef,
  rollingStartedAtRef,
  sourceHint,
}: {
  config: StartCallCaptureConfig
  force: boolean
  rollingChunksRef: React.MutableRefObject<Blob[]>
  rollingInFlightRef: React.MutableRefObject<boolean>
  rollingStartedAtRef: React.MutableRefObject<number>
  sourceHint: string
}) {
  if (rollingInFlightRef.current) return
  if (rollingChunksRef.current.length === 0) return
  if (!force && rollingChunksRef.current.length < 8) return

  const chunks = rollingChunksRef.current
  const chunkStartedAtMs = rollingStartedAtRef.current
  const type = chunks.find((chunk) => chunk.type)?.type || "audio/webm"

  rollingChunksRef.current = []
  rollingStartedAtRef.current = 0
  rollingInFlightRef.current = true

  try {
    const result = await requestCallDiarization({
      audio: new Blob(chunks, { type }),
      callId: config.callId,
      chunkStartedAtMs,
      sourceHint,
    })

    config.onDiarization?.(result)
  } catch {
    if (force) {
      // Live notes should stay focused on the conversation; post-call cleanup can retry without adding system text.
    }
  } finally {
    rollingInFlightRef.current = false
  }
}

function getDiarizationSourceHint(sources: CapturedAudioSource[], mode: CallAudioCaptureMode) {
  if (mode === "in_person_microphone") return "in_person_microphone"
  if (sources.length > 1) return "separate_seller_and_meeting_audio"
  if (sources.some((source) => source.kind === "meeting_audio")) return "meeting_audio"

  return getDiarizationSourceHintFromMode(mode)
}

function getDiarizationSourceHintFromMode(mode: CallAudioCaptureMode) {
  if (mode === "meeting_audio") return "meeting_audio"
  if (mode === "in_person_microphone") return "in_person_microphone"

  return "mixed_audio"
}

async function resolveTurnAttribution({
  config,
  elapsedMs,
  initialAttribution,
  recentTranscript,
  segmentText,
  source,
}: {
  config: StartCallCaptureConfig
  elapsedMs: number
  initialAttribution: SpeakerAttribution
  recentTranscript: CallCaptureTranscriptLine[]
  segmentText: string
  source: CapturedAudioSource
}) {
  if (!shouldRefineBeforeTurn(source)) return initialAttribution

  try {
    const response = await requestSpeakerAttribution({
      callId: config.callId,
      elapsedMs,
      recentTranscript,
      segmentText,
      sourceHint: source.kind,
    })

    return normalizeAttribution(response.attribution, source)
  } catch {
    return {
      ...initialAttribution,
      needsReview: true,
      reason: `${initialAttribution.reason} Speaker label still needs review.`,
    }
  }
}

function shouldRefineBeforeTurn(source: CapturedAudioSource) {
  return source.kind === "meeting_audio" || source.kind === "mixed_audio" || source.kind === "in_person_microphone"
}

async function createTranscriptTurn({
  attribution,
  config,
  elapsedMs,
  finalText,
  openaiItemId,
  openaiSegmentId,
  preferredClientId,
  qualityFlags,
  source,
  startMs,
  turnSequenceRef,
}: {
  attribution: SpeakerAttribution
  config: StartCallCaptureConfig
  elapsedMs: number
  finalText: string
  openaiItemId?: string
  openaiSegmentId?: string
  preferredClientId?: string
  qualityFlags: string[]
  source: CapturedAudioSource
  startMs?: number
  turnSequenceRef: React.MutableRefObject<number>
}): Promise<TranscriptTurn> {
  const resolvedStartMs = startMs ?? elapsedMs
  turnSequenceRef.current += 1
  const turnSequence = turnSequenceRef.current
  const clientTurnId = preferredClientId || `${source.kind}-turn-${turnSequence}`
  const speaker = await ensureCallSpeaker({
    call_id: config.callId,
    label: attribution.speakerLabel,
    display_name: attribution.speakerLabel,
    role: getSpeakerRole(attribution.speakerLabel),
  })

  const segment = await insertTranscriptSegment({
    call_id: config.callId,
    speaker_id: speaker.id,
    start_ms: resolvedStartMs,
    end_ms: elapsedMs,
    text: finalText,
    is_final: true,
    speaker_attribution: attribution.source,
    speaker_attribution_reason: attribution.reason,
    speaker_confidence: attribution.confidence,
    speaker_needs_review: attribution.needsReview,
    speaker_source: source.kind,
    openai_item_id: openaiItemId ?? null,
    openai_segment_id: openaiSegmentId ?? null,
    audio_source_kind: source.kind,
    client_turn_id: clientTurnId,
    turn_sequence: turnSequence,
    transcription_delay: sourceTranscriptionDelay[source.kind],
    quality_flags: qualityFlags,
  })
  const resolvedClientTurnId = segment.client_turn_id ?? clientTurnId
  const resolvedTurnSequence = segment.turn_sequence ?? turnSequence

  return {
    attribution,
    clientId: resolvedClientTurnId,
    displayName: speaker.display_name || speaker.label,
    endMs: segment.end_ms ?? elapsedMs,
    lastActivityMs: segment.end_ms ?? elapsedMs,
    openaiItemId: segment.openai_item_id ?? openaiItemId,
    openaiSegmentId: segment.openai_segment_id ?? openaiSegmentId,
    qualityFlags,
    segmentId: segment.id,
    sourceKind: (segment.audio_source_kind as AudioSourceKind | null) ?? source.kind,
    speakerId: segment.speaker_id ?? speaker.id,
    startMs: segment.start_ms ?? resolvedStartMs,
    text: segment.text || finalText,
    transcriptionDelay: segment.transcription_delay ?? sourceTranscriptionDelay[source.kind],
    turnSequence: resolvedTurnSequence,
  }
}

async function updateTranscriptTurn({
  attribution,
  config,
  elapsedMs,
  finalText,
  openaiItemId,
  openaiSegmentId,
  qualityFlags,
  turn,
}: {
  attribution: SpeakerAttribution
  config: StartCallCaptureConfig
  elapsedMs: number
  finalText: string
  openaiItemId?: string
  openaiSegmentId?: string
  qualityFlags: string[]
  turn: TranscriptTurn
}): Promise<TranscriptTurn> {
  const nextText = joinTranscriptText(turn.text, finalText)
  const shouldUpdateSpeaker = attribution.speakerLabel !== turn.attribution.speakerLabel
  const speaker = shouldUpdateSpeaker
    ? await ensureCallSpeaker({
        call_id: config.callId,
        label: attribution.speakerLabel,
        display_name: attribution.speakerLabel,
        role: getSpeakerRole(attribution.speakerLabel),
      })
    : null
  const nextSpeakerId = speaker?.id ?? turn.speakerId

  await updateTranscriptSegment(turn.segmentId, {
    end_ms: elapsedMs,
    speaker_id: nextSpeakerId,
    text: nextText,
    speaker_attribution: attribution.source,
    speaker_attribution_reason: attribution.reason,
    speaker_confidence: attribution.confidence,
    speaker_needs_review: attribution.needsReview,
    speaker_source: turn.sourceKind,
    openai_item_id: openaiItemId ?? turn.openaiItemId ?? null,
    openai_segment_id: openaiSegmentId ?? turn.openaiSegmentId ?? null,
    audio_source_kind: turn.sourceKind,
    client_turn_id: turn.clientId,
    turn_sequence: turn.turnSequence,
    transcription_delay: turn.transcriptionDelay,
    quality_flags: [...new Set([...turn.qualityFlags, ...qualityFlags])],
  })

  return {
    ...turn,
    attribution,
    displayName: speaker?.display_name || speaker?.label || turn.displayName,
    endMs: elapsedMs,
    lastActivityMs: elapsedMs,
    openaiItemId: openaiItemId ?? turn.openaiItemId,
    openaiSegmentId: openaiSegmentId ?? turn.openaiSegmentId,
    qualityFlags: [...new Set([...turn.qualityFlags, ...qualityFlags])],
    speakerId: nextSpeakerId,
    text: nextText,
  }
}

function canContinueTurn(
  turn: TranscriptTurn,
  attribution: SpeakerAttribution,
  elapsedMs: number,
  nextText: string
) {
  return canContinueTranscriptTurn({
    attributionSpeaker: attribution.speakerLabel,
    elapsedMs,
    nextText,
    turn,
  })
}

function createTranscriptLineFromTurn(turn: TranscriptTurn): CallCaptureTranscriptLine {
  return {
    clientId: turn.clientId,
    id: turn.segmentId,
    isPartial: false,
    speaker: turn.attribution.speakerLabel,
    speakerAttributionReason: turn.attribution.reason,
    speakerConfidence: turn.attribution.confidence,
    speakerDisplayName: turn.displayName,
    speakerId: turn.speakerId,
    speakerLabel: turn.attribution.speakerLabel,
    speakerNeedsReview: turn.attribution.needsReview,
    speakerSource: turn.attribution.source,
    time: formatElapsedTime(turn.startMs),
    text: turn.text,
  }
}

function upsertRecentTranscriptLine(
  recentTranscript: CallCaptureTranscriptLine[],
  line: CallCaptureTranscriptLine
) {
  const index = recentTranscript.findIndex(
    (item) => item.id === line.id || (item.clientId && item.clientId === line.clientId)
  )

  if (index >= 0) {
    recentTranscript[index] = line
    return
  }

  recentTranscript.push(line)
  if (recentTranscript.length > 12) recentTranscript.splice(0, recentTranscript.length - 12)
}

async function refineSpeakerAttribution({
  config,
  elapsedMs,
  line,
  recentTranscript,
  segmentId,
  source,
}: {
  config: StartCallCaptureConfig
  elapsedMs: number
  line: CallCaptureTranscriptLine
  recentTranscript: CallCaptureTranscriptLine[]
  segmentId: string
  source: CapturedAudioSource
}) {
  const response = await requestSpeakerAttribution({
    callId: config.callId,
    elapsedMs,
    recentTranscript,
    segmentText: line.text,
    sourceHint: source.kind,
  })
  const attribution = normalizeAttribution(response.attribution, source)

  const speaker = await ensureCallSpeaker({
    call_id: config.callId,
    label: attribution.speakerLabel,
    display_name: attribution.speakerLabel,
    role: getSpeakerRole(attribution.speakerLabel),
  })

  await updateTranscriptSegment(segmentId, {
    speaker_id: speaker.id,
    speaker_attribution: attribution.source,
    speaker_attribution_reason: attribution.reason,
    speaker_confidence: attribution.confidence,
    speaker_needs_review: attribution.needsReview,
    speaker_source: source.kind,
  })

  const updatedLine: CallCaptureTranscriptLine = {
    ...line,
    speaker: attribution.speakerLabel,
    speakerAttributionReason: attribution.reason,
    speakerConfidence: attribution.confidence,
    speakerDisplayName: speaker.display_name || speaker.label,
    speakerId: speaker.id,
    speakerLabel: attribution.speakerLabel,
    speakerNeedsReview: attribution.needsReview,
    speakerSource: attribution.source,
  }

  recentTranscriptRefUpdate(recentTranscript, updatedLine)
  config.onTranscriptUpdate?.(updatedLine)
}

function recentTranscriptRefUpdate(
  recentTranscript: CallCaptureTranscriptLine[],
  updatedLine: CallCaptureTranscriptLine
) {
  const index = recentTranscript.findIndex((line) => line.id === updatedLine.id)
  if (index >= 0) recentTranscript[index] = updatedLine
}

function getSourceAttribution(source: CapturedAudioSource): SpeakerAttribution {
  return {
    confidence: source.confidence,
    needsReview:
      source.confidence < 0.72 ||
      source.kind === "mixed_audio" ||
      source.kind === "in_person_microphone",
    reason:
      source.kind === "seller_mic"
        ? "Initial label from the dedicated seller microphone stream."
        : source.kind === "meeting_audio"
          ? "Initial label from the meeting or tab audio stream."
          : source.kind === "in_person_microphone"
            ? "Initial label from one-channel room audio. AI refinement and manual review may be needed."
            : "Initial label from mixed microphone audio. Model refinement and manual review may be needed.",
    speakerLabel: source.speakerHint,
    source: "source_stream",
  }
}

function getRealtimeSegmentAttribution({
  rawSpeaker,
  source,
  speakerLabels,
}: {
  rawSpeaker?: string
  source: CapturedAudioSource
  speakerLabels: Map<string, TranscriptSpeaker>
}): SpeakerAttribution | null {
  if (!rawSpeaker?.trim()) return null

  const speakerLabel = getRealtimeSegmentSpeakerLabel({
    rawSpeaker,
    source,
    speakerLabels,
  })

  return {
    confidence: source.kind === "seller_mic" ? 0.96 : source.kind === "meeting_audio" ? 0.86 : 0.76,
    needsReview: source.kind === "mixed_audio" || source.kind === "in_person_microphone",
    reason:
      source.kind === "seller_mic"
        ? "OpenAI realtime segment matched the dedicated seller microphone stream."
        : source.kind === "meeting_audio"
          ? "OpenAI realtime segment labelled this customer-side speaker from meeting audio."
          : "OpenAI realtime segment labelled this speaker from mixed room audio; review if needed.",
    speakerLabel,
    source: "openai_realtime_segment",
  }
}

function getRealtimeSegmentSpeakerLabel({
  rawSpeaker,
  source,
  speakerLabels,
}: {
  rawSpeaker: string
  source: CapturedAudioSource
  speakerLabels: Map<string, TranscriptSpeaker>
}): TranscriptSpeaker {
  if (source.kind === "seller_mic") return "Seller"

  const normalized = rawSpeaker.trim().toLowerCase()
  if (normalized.includes("seller")) return "Seller"

  const speakerKey = `${source.kind}:${normalized}`
  const existingLabel = speakerLabels.get(speakerKey)
  if (existingLabel) return existingLabel

  const sourceSpeakerCount = [...speakerLabels.keys()].filter((key) => key.startsWith(`${source.kind}:`)).length
  const customerLabels: TranscriptSpeaker[] = ["Customer", "Customer 2", "Customer 3"]
  const roomLabels: TranscriptSpeaker[] = ["Seller", "Customer", "Customer 2"]
  const labelPool = source.kind === "meeting_audio" ? customerLabels : roomLabels
  const nextLabel = labelPool[Math.min(sourceSpeakerCount, labelPool.length - 1)]

  speakerLabels.set(speakerKey, nextLabel)

  return nextLabel
}

function normalizeAttribution(value: unknown, source: CapturedAudioSource): SpeakerAttribution {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const confidence =
    typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? Math.max(0, Math.min(1, record.confidence))
      : source.confidence
  const speakerLabel = normalizeSpeakerLabelForSource(record.speakerLabel, source)

  return {
    confidence,
    needsReview: record.needsReview === true || confidence < 0.72,
    reason:
      typeof record.reason === "string" && record.reason.trim()
        ? record.reason.trim()
        : "Speaker refined from source stream and recent conversation context.",
    speakerLabel,
    source: typeof record.source === "string" && record.source.trim() ? record.source.trim() : "model_realtime",
  }
}

function normalizeSpeakerLabelForSource(value: unknown, source: CapturedAudioSource): TranscriptSpeaker {
  if (source.kind === "seller_mic") return "Seller"

  if (source.kind === "meeting_audio") {
    const normalized = typeof value === "string" ? value.toLowerCase() : ""
    if (normalized.includes("customer 3") || normalized.includes("customer three")) return "Customer 3"
    if (normalized.includes("customer 2") || normalized.includes("customer two")) return "Customer 2"
    if (normalized.includes("participant 3") || normalized.includes("participant three")) return "Customer 2"
    if (normalized.includes("participant 2") || normalized.includes("participant two")) return "Customer"
    if (normalized.includes("buyer") || normalized.includes("prospect") || normalized.includes("client")) return "Customer"
    if (normalized.includes("speaker_3") || normalized.includes("speaker-3")) return "Customer 2"
    if (normalized.includes("speaker 3") || normalized.includes("speaker three")) return "Customer 2"

    return "Customer"
  }

  return normalizeSpeakerLabel(value, source.speakerHint)
}

function normalizeSpeakerLabel(value: unknown, defaultLabel: TranscriptSpeaker): TranscriptSpeaker {
  if (typeof value !== "string") return defaultLabel

  const normalized = value.toLowerCase()
  if (normalized.includes("seller")) return "Seller"
  if (
    normalized.includes("buyer") ||
    normalized.includes("prospect") ||
    normalized.includes("client") ||
    normalized.includes("participant 2") ||
    normalized.includes("participant two")
  ) return "Customer"
  if (normalized.includes("unknown") || normalized.includes("uncertain")) return "Unknown"
  if (normalized.includes("customer 3") || normalized.includes("customer three")) return "Customer 3"
  if (normalized.includes("customer 2") || normalized.includes("customer two")) return "Customer 2"
  if (normalized.includes("customer")) return "Customer"
  if (normalized.includes("speaker_3") || normalized.includes("speaker-3")) return "Customer 2"
  if (normalized.includes("speaker_2") || normalized.includes("speaker-2")) return "Customer"
  if (normalized.includes("speaker_1") || normalized.includes("speaker-1")) return "Seller"
  if (normalized.includes("speaker 3") || normalized.includes("speaker three")) return "Customer 2"
  if (normalized.includes("speaker 2") || normalized.includes("speaker two")) return "Customer"
  if (normalized.includes("speaker 1") || normalized.includes("speaker one")) return "Seller"
  if (normalized.includes("3") || normalized.includes("three")) return "Customer 2"
  if (normalized.includes("2") || normalized.includes("two")) return "Customer"

  return defaultLabel
}

function getSpeakerRole(speaker: TranscriptSpeaker) {
  if (speaker === "Seller") return "seller"
  if (speaker === "Customer 2") return "customer_2"
  if (speaker === "Customer 3") return "customer_3"
  if (speaker === "Unknown" || speaker.startsWith("Speaker ")) return "unknown"

  return "customer"
}

function getAudioSourceLabel(kind: AudioSourceKind) {
  if (kind === "seller_mic") return "Seller microphone"
  if (kind === "meeting_audio") return "Meeting app/tab audio"
  if (kind === "in_person_microphone") return "In-person microphone"

  return "Mixed audio"
}

function stopRecorder(recorder: MediaRecorder | null, chunks: Blob[]) {
  return new Promise<Blob>((resolve) => {
    if (!recorder || recorder.state === "inactive") {
      resolve(createRecordingBlob(chunks, recorder?.mimeType))
      return
    }

    recorder.addEventListener(
      "stop",
      () => {
        resolve(createRecordingBlob(chunks, recorder.mimeType))
      },
      { once: true }
    )
    recorder.stop()
  })
}

function createRecordingBlob(chunks: Blob[], mimeType?: string) {
  return new Blob(chunks, mimeType ? { type: mimeType } : undefined)
}

function isPermissionError(error: unknown) {
  return (
    error instanceof DOMException &&
    ["AbortError", "NotAllowedError", "PermissionDeniedError"].includes(error.name)
  )
}

function isCaptureUnavailableError(error: unknown) {
  return (
    error instanceof Error &&
    /audio capture is not available|microphone capture is not available|recording is not available/i.test(error.message)
  )
}

function isRecoverableTranscriptDuplicateError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("duplicate key value violates unique constraint") &&
    error.message.includes("transcript_segments_call_source_openai_segment_unique_idx")
  )
}

function formatElapsedTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
