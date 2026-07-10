import * as React from "react"

import { requestSpeakerAttribution } from "@/lib/server-functions"
import {
  getAudioPreflightErrorResult,
  isAudibleVoiceLevel,
  measureStreamVoiceLevel,
  runAudioPreflight,
  summarizeAudioSource,
  type AudioSourceKind,
  type AudioPreflightResult,
  type CapturedAudioSource,
} from "@/lib/call-audio-preflight"
import type {
  DeepgramTranscriptionConnection,
  DeepgramTranscriptEvent,
} from "@/lib/deepgram-live-transcription"
import {
  createCallRecordingSignedUrl,
  ensureCallSpeaker,
  insertCallNote,
  insertTranscriptSegment,
  updateCall,
  updateTranscriptSegment,
  uploadCallRecording,
} from "@/lib/supabase/salesframe-data"
import {
  MAX_LIVE_CALL_SECONDS,
  type CallAudioCaptureMode,
  type CallEndedReason,
  type RecordingLifecycleStatus,
  type TranscriptSpeaker,
} from "@/lib/salesframe-core"
import { getUserFacingErrorMessage } from "@/lib/user-facing-errors"
import {
  appendTranscriptDelta,
  canContinueTranscriptTurn,
  isAnswerLikeTranscript,
  isOneChannelAudioSource,
  isQuestionLikeTranscript,
  joinTranscriptText,
  oneChannelQuestionAnswerBoundaryMs,
  rememberFinalTranscriptEvent,
  shouldSuppressFinalTranscript,
  shouldInferOneChannelCustomerTurn,
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
  audioSourceKind?: AudioSourceKind
  clientId?: string
  diarizationSpeaker?: string
  endOfTurnConfidence?: number
  id?: string
  isPartial?: boolean
  languageDetected?: string
  providerEventId?: string
  providerSessionId?: string
  providerTurnIndex?: number
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
  wordConfidence?: number
}

type StartCallCaptureConfig = {
  abortSignal?: AbortSignal
  audioCaptureMode: CallAudioCaptureMode
  audioInputDeviceId?: string
  audioInputDeviceLabel?: string
  audioOutputDeviceId?: string
  audioOutputDeviceLabel?: string
  callId: string
  preparedMeetingAudio?: {
    level?: number
    stream: MediaStream
    surface?: string
  }
  startedAt: string
  workspaceId: string
  onTranscript?: (line: CallCaptureTranscriptLine) => void
  onTranscriptUpdate?: (line: CallCaptureTranscriptLine) => void
}

export type CallCaptureStopResult = {
  callId: string
  durationSeconds: number
  endedReason: CallEndedReason
  endedAt: string
  recordingError: string | null
  recordingMimeType: string | null
  recordingReadyAt: string | null
  recordingSizeBytes: number | null
  recordingStatus: RecordingLifecycleStatus
  recordingStoragePath: string | null
  recordingUrl: string | null
}

type StopCallCaptureOptions = {
  endedReason?: CallEndedReason
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
  diarizationSpeaker?: string
  endMs: number
  endOfTurnConfidence?: number
  languageDetected?: string
  lastActivityMs: number
  openaiItemId?: string
  openaiSegmentId?: string
  providerEventId?: string
  providerSessionId?: string
  providerTurnIndex?: number
  qualityFlags: string[]
  segmentId: string
  sourceKind: AudioSourceKind
  speakerId: string
  startMs: number
  text: string
  transcriptionDelay?: string
  wordConfidence?: number
  turnSequence: number
}

const callStartCancelledMessage = "Call start was cancelled."

type DeepgramLiveTranscriptionModule = typeof import("@/lib/deepgram-live-transcription")

let deepgramLiveTranscriptionModulePromise: Promise<DeepgramLiveTranscriptionModule> | null = null

function loadDeepgramLiveTranscriptionModule() {
  deepgramLiveTranscriptionModulePromise ??= import("@/lib/deepgram-live-transcription")

  return deepgramLiveTranscriptionModulePromise
}

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
  const recordingStreamCleanupRef = React.useRef<(() => void) | null>(null)
  const partialTranscriptLinesRef = React.useRef<Map<string, CallCaptureTranscriptLine>>(new Map())
  const partialTranscriptTextRef = React.useRef<Map<string, string>>(new Map())
  const deepgramConnectionsRef = React.useRef<DeepgramTranscriptionConnection[]>([])
  const sourceStreamsRef = React.useRef<MediaStream[]>([])
  const audioHealthTimerRef = React.useRef<number | null>(null)
  const persistedTranscriptKeysRef = React.useRef<Set<string>>(new Set())
  const recentFinalTranscriptEventsRef = React.useRef<RecentFinalTranscriptEvent[]>([])
  const recentTranscriptRef = React.useRef<CallCaptureTranscriptLine[]>([])
  const activeTranscriptTurnsRef = React.useRef<Map<AudioSourceKind, TranscriptTurn>>(new Map())
  const deepgramSpeakerLabelsRef = React.useRef<Map<string, TranscriptSpeaker>>(new Map())
  const stopInFlightRef = React.useRef(false)
  const transcriptTurnSequenceRef = React.useRef(0)

  const cleanup = React.useCallback(() => {
    if (audioHealthTimerRef.current !== null) {
      window.clearInterval(audioHealthTimerRef.current)
      audioHealthTimerRef.current = null
    }

    deepgramConnectionsRef.current.forEach((connection) => connection.close())
    deepgramConnectionsRef.current = []

    recordingStreamCleanupRef.current?.()
    recordingStreamCleanupRef.current = null

    sourceStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop())
    })
    sourceStreamsRef.current = []
  }, [])

  React.useEffect(() => cleanup, [cleanup])

  const startLiveAudioHealthMonitoring = React.useCallback(
    (basePreflight: AudioPreflightResult, sources: CapturedAudioSource[]) => {
      if (audioHealthTimerRef.current !== null) {
        window.clearInterval(audioHealthTimerRef.current)
        audioHealthTimerRef.current = null
      }

      let silentBuyerChecks = 0

      const refreshAudioLevels = async () => {
        const measuredSources = await Promise.all(
          sources.map(async (source) => ({
            ...source,
            level: await measureStreamVoiceLevel(source.stream).catch(() => 0),
          }))
        )

        measuredSources.forEach((source, index) => {
          sources[index].level = source.level
        })

        const sellerSources = measuredSources.filter((source) =>
          source.kind === "seller_mic" || source.kind === "mixed_audio" || source.kind === "in_person_microphone"
        )
        const meetingSources = measuredSources.filter((source) => source.kind === "meeting_audio")
        const mixedSources = measuredSources.filter((source) =>
          source.kind === "mixed_audio" || source.kind === "in_person_microphone"
        )
        const sellerMicReady = sellerSources.some((source) => source.stream.getAudioTracks().length > 0)
        const sellerMicHot = sellerSources.some((source) => isAudibleVoiceLevel(source.level))
        const buyerAudioTrackReady = meetingSources.some((source) => source.stream.getAudioTracks().length > 0)
        const buyerAudioReady = meetingSources.some((source) =>
          source.stream.getAudioTracks().length > 0 && isAudibleVoiceLevel(source.level)
        )
        const mixedRoomReady = mixedSources.some((source) => source.stream.getAudioTracks().length > 0)
        const warnings = basePreflight.warnings.filter((warning) => warning !== "Shared audio looks silent. Check the shared audio source.")

        if (basePreflight.requiredCustomerAudio && sellerMicHot && !buyerAudioReady) {
          silentBuyerChecks += 1
        } else {
          silentBuyerChecks = 0
        }

        if (silentBuyerChecks >= 2) {
          warnings.push("Shared audio looks silent. Check the shared audio source.")
        }

        setAudioPreflight((currentPreflight) => {
          const snapshot = currentPreflight ?? basePreflight

          return {
            ...snapshot,
            checkedAt: new Date().toISOString(),
            customerAudioReady: basePreflight.requiredCustomerAudio
              ? buyerAudioTrackReady
              : snapshot.customerAudioReady,
            mixedRoomReady,
            sellerMicReady,
            sources: measuredSources.map(summarizeAudioSource),
            warnings,
          }
        })
      }

      void refreshAudioLevels()
      audioHealthTimerRef.current = window.setInterval(() => {
        void refreshAudioLevels()
      }, 5000)
    },
    []
  )

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
      deepgramSpeakerLabelsRef.current = new Map()
      transcriptTurnSequenceRef.current = 0
      recentTranscriptRef.current = []
      chunksRef.current = []

      try {
        throwIfCallStartCancelled(config.abortSignal)
        const { preflight, sources } = await runAudioPreflight(config.audioCaptureMode, {
          inputDeviceId: config.audioInputDeviceId,
          inputDeviceLabel: config.audioInputDeviceLabel,
          outputDeviceId: config.audioOutputDeviceId,
          outputDeviceLabel: config.audioOutputDeviceLabel,
          preparedMeetingAudio: config.preparedMeetingAudio,
        })
        sourceStreamsRef.current = sources.map((source) => source.stream)
        throwIfCallStartCancelled(config.abortSignal)
        setAudioPreflight(preflight)
        setPermissionState("granted")
        setStatus("connecting")

        await updateCall(config.callId, {
          audio_preflight: preflight,
          audio_source_summary: sources.map(summarizeAudioSource),
          duration_limit_seconds: MAX_LIVE_CALL_SECONDS,
          ended_reason: "seller_stopped",
        })
        throwIfCallStartCancelled(config.abortSignal)

        await updateCall(config.callId, {
          recording_error: null,
          recording_status: "recording",
          duration_limit_seconds: MAX_LIVE_CALL_SECONDS,
          ended_reason: "seller_stopped",
        }).catch(() => undefined)

        const recordingStream = createRecordingStream(sources)
        recordingStreamCleanupRef.current = recordingStream.cleanup
        const recorder = createRecorder(recordingStream.stream, (chunk) => {
          if (chunk.size > 0) chunksRef.current.push(chunk)
        })
        mediaRecorderRef.current = recorder

        const persistTranscriptEvent = async (
          event: DeepgramTranscriptEvent,
          source: CapturedAudioSource
        ) => {
          const elapsedMs = Math.max(
            0,
            Date.now() - new Date(config.startedAt).getTime()
          )
          const itemKey = event.itemId
            ? `${source.kind}-${event.itemId}`
            : `${source.kind}-${Math.round(elapsedMs / 1000)}`
          const transcriptEventKey = event.segmentId ? `${source.kind}-${event.segmentId}` : itemKey

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
              activeTurn && canContinueTurn(activeTurn, initialAttribution, elapsedMs, displayText, source.kind)
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
          const activeTurn = activeTranscriptTurnsRef.current.get(source.kind)
          const segmentAttribution = getDeepgramSegmentAttribution({
            rawSpeaker: event.speaker,
            source,
            speakerLabels: deepgramSpeakerLabelsRef.current,
          })
          const initialAttribution = segmentAttribution ?? getSourceAttribution(source)
          const modelAttribution = segmentAttribution ?? initialAttribution
          const attribution = inferOneChannelTurnAttribution({
            activeTurn,
            attribution: modelAttribution,
            elapsedMs: eventEndMs,
            finalText,
            source,
          })
          const shouldContinueTurn = activeTurn
            ? canContinueTurn(activeTurn, attribution, eventEndMs, finalText, source.kind)
            : false
          const matchingPartialLine =
            partialTranscriptLinesRef.current.get(itemKey) ??
            partialTranscriptLinesRef.current.get(transcriptEventKey)
          const preferredClientId =
            !shouldContinueTurn && activeTurn && matchingPartialLine?.clientId === activeTurn.clientId
              ? itemKey
              : matchingPartialLine?.clientId ?? itemKey
          const finalQualityFlags = [
            ...turnDecision.qualityFlags,
            ...getTurnAssemblyQualityFlags({
              activeTurn,
              attribution,
              finalText,
              shouldContinueTurn,
              source,
            }),
          ]
          const optimisticLine: CallCaptureTranscriptLine = {
            audioSourceKind: source.kind,
            clientId: preferredClientId,
            diarizationSpeaker: event.diarizationSpeaker,
            endOfTurnConfidence: event.endOfTurnConfidence,
            id: shouldContinueTurn && activeTurn ? activeTurn.segmentId : preferredClientId,
            isPartial: false,
            languageDetected: event.languageDetected,
            providerEventId: event.providerEventId,
            providerSessionId: event.providerSessionId,
            providerTurnIndex: event.providerTurnIndex,
            speaker: attribution.speakerLabel,
            speakerAttributionReason: attribution.reason,
            speakerConfidence: attribution.confidence,
            speakerDisplayName: activeTurn?.displayName ?? attribution.speakerLabel,
            speakerId: activeTurn?.speakerId,
            speakerLabel: attribution.speakerLabel,
            speakerNeedsReview: attribution.needsReview,
            speakerSource: attribution.source,
            time: formatElapsedTime(shouldContinueTurn && activeTurn ? activeTurn.startMs : eventStartMs),
            text: shouldContinueTurn && activeTurn ? joinTranscriptText(activeTurn.text, finalText) : finalText,
            wordConfidence: event.wordConfidence,
          }
          upsertRecentTranscriptLine(recentTranscriptRef.current, optimisticLine)
          if (shouldContinueTurn || matchingPartialLine) {
            config.onTranscriptUpdate?.(optimisticLine)
          } else {
            config.onTranscript?.(optimisticLine)
          }

          const turn = shouldContinueTurn && activeTurn
            ? await updateTranscriptTurn({
                attribution,
                config,
                elapsedMs: eventEndMs,
                endOfTurnConfidence: event.endOfTurnConfidence,
                finalText,
                languageDetected: event.languageDetected,
                providerEventId: event.providerEventId,
                providerSessionId: event.providerSessionId,
                providerTurnIndex: event.providerTurnIndex,
                qualityFlags: finalQualityFlags,
                turn: activeTurn,
                wordConfidence: event.wordConfidence,
              })
            : await createTranscriptTurn({
                attribution,
                config,
                diarizationSpeaker: event.diarizationSpeaker,
                elapsedMs: eventEndMs,
                endOfTurnConfidence: event.endOfTurnConfidence,
                finalText,
                languageDetected: event.languageDetected,
                preferredClientId,
                providerEventId: event.providerEventId,
                providerSessionId: event.providerSessionId,
                providerTurnIndex: event.providerTurnIndex,
                qualityFlags: finalQualityFlags,
                source,
                startMs: eventStartMs,
                turnSequenceRef: transcriptTurnSequenceRef,
                wordConfidence: event.wordConfidence,
              })

          activeTranscriptTurnsRef.current.set(source.kind, turn)

          const line = createTranscriptLineFromTurn(turn)
          upsertRecentTranscriptLine(recentTranscriptRef.current, line)
          config.onTranscriptUpdate?.(line)
          partialTranscriptLinesRef.current.delete(itemKey)
          partialTranscriptLinesRef.current.delete(transcriptEventKey)
          partialTranscriptTextRef.current.delete(itemKey)

          if (!shouldContinueTurn) {
            void insertCallNote({
              call_id: config.callId,
              note_type: "evidence",
              text: finalText,
            }).catch(() => undefined)
          }

          if (shouldRefineBeforeTurn(source)) {
            void refineSpeakerAttribution({
              activeTranscriptTurnsRef,
              activeTurn,
              config,
              elapsedMs: eventEndMs,
              eventEndMs,
              eventStartMs,
              line,
              recentTranscript: recentTranscriptRef.current,
              segmentId: turn.segmentId,
              source,
            }).catch(() => undefined)
          }
        }

        const { connectDeepgramLiveTranscription } = await loadDeepgramLiveTranscriptionModule()
        const connections: DeepgramTranscriptionConnection[] = []
        for (const source of sources) {
          throwIfCallStartCancelled(config.abortSignal)
          try {
            const connection = await connectDeepgramLiveTranscription({
              callId: config.callId,
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
            deepgramConnectionsRef.current = connections
            throwIfCallStartCancelled(config.abortSignal)
          } catch (caughtError: unknown) {
            connections.forEach((connection) => connection.close())
            deepgramConnectionsRef.current = []
            throw new Error(
              `${getAudioSourceLabel(source.kind)} transcription needs another connection attempt. ${getUserFacingErrorMessage(
                caughtError,
                "SalesFrame needs live transcription before this call can start."
              )}`
            )
          }
        }

        if (connections.length === 0) {
          throw new Error("SalesFrame needs another transcription connection attempt before it can capture this call.")
        }

        deepgramConnectionsRef.current = connections

        throwIfCallStartCancelled(config.abortSignal)
        startLiveAudioHealthMonitoring(preflight, sources)
        recorder.start(1000)
        setStatus("recording")
      } catch (caughtError: unknown) {
        const failedPreflight = getAudioPreflightErrorResult(caughtError)

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
        setAudioPreflight(failedPreflight)
        await updateCall(config.callId, {
          ...(failedPreflight
            ? {
                audio_preflight: failedPreflight,
                audio_source_summary: failedPreflight.sources,
              }
            : {}),
          ended_reason: config.abortSignal?.aborted ? "start_cancelled" : "start_failed",
          status: "needs_attention",
        }).catch(() => undefined)
        throw caughtError
      }
    },
    [cleanup, startLiveAudioHealthMonitoring]
  )

  const stopCall = React.useCallback(async (options: StopCallCaptureOptions = {}): Promise<CallCaptureStopResult | null> => {
    if (stopInFlightRef.current) return null
    stopInFlightRef.current = true
    const endedReason = options.endedReason ?? "seller_stopped"

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
        const { flushDeepgramAudioBuffers, waitForDeepgramFlush } = await loadDeepgramLiveTranscriptionModule()

        flushDeepgramAudioBuffers(deepgramConnectionsRef.current)
        await waitForDeepgramFlush()
      } catch (caughtError: unknown) {
        setError(getUserFacingErrorMessage(caughtError, "SalesFrame may need a moment to finish the last transcript lines."))
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
        duration_limit_seconds: MAX_LIVE_CALL_SECONDS,
        ended_at: endedAt,
        ended_reason: endedReason,
        status: "processing",
      })
    } catch (caughtError: unknown) {
      setError(getUserFacingErrorMessage(caughtError, "Call stopped. SalesFrame needs another moment to save the final status."))
    }

    let uploadFailed = false
    let recordingStoragePath: string | null = null
    let recordingUrl: string | null = null
    let recordingError: string | null = null
    let recordingMimeType: string | null = null
    let recordingReadyAt: string | null = null
    let recordingSizeBytes: number | null = null
    let recordingStatus: RecordingLifecycleStatus = "none"
    if (blob.size > 0) {
      try {
        recordingStatus = "uploading"
        await updateCall(config.callId, {
          recording_error: null,
          recording_mime_type: getBlobContentType(blob),
          recording_size_bytes: blob.size,
          recording_status: "uploading",
        }).catch(() => undefined)
        const upload = await uploadCallRecording({
          callId: config.callId,
          file: blob,
          workspaceId: config.workspaceId,
        })
        recordingStoragePath = upload.path
        recordingMimeType = upload.contentType
        recordingSizeBytes = upload.sizeBytes
        recordingStatus = "processing"

        try {
          recordingUrl = await createCallRecordingSignedUrl(upload.path)
          recordingReadyAt = new Date().toISOString()
          recordingStatus = "ready"
          await updateCall(config.callId, {
            recording_error: null,
            recording_ready_at: recordingReadyAt,
            recording_status: "ready",
          })
        } catch (caughtError: unknown) {
          recordingError = getUserFacingErrorMessage(caughtError, "Recording was saved, but the replay link needs to be refreshed.")
          await updateCall(config.callId, {
            recording_error: recordingError,
            recording_status: "processing",
          }).catch(() => undefined)
          setError(recordingError)
        }
      } catch (caughtError: unknown) {
        uploadFailed = true
        recordingStatus = "failed"
        recordingError = getUserFacingErrorMessage(caughtError, "Transcript is saved. The audio recording needs another upload attempt.")
        await updateCall(config.callId, {
          recording_error: recordingError,
          recording_status: "failed",
        }).catch(() => undefined)
        setError(recordingError)
      }
    } else {
      recordingStatus = "failed"
      recordingError = "Recording was empty."
      await updateCall(config.callId, {
        recording_error: recordingError,
        recording_mime_type: getBlobContentType(blob),
        recording_size_bytes: 0,
        recording_status: "failed",
      }).catch(() => undefined)
      setError("Transcript is saved. The audio recording was empty.")
    }

    setStatus(uploadFailed ? "upload-failed" : "stopped")
    chunksRef.current = []
    stopInFlightRef.current = false

    return {
      callId: config.callId,
      durationSeconds,
      endedReason,
      endedAt,
      recordingError,
      recordingMimeType,
      recordingReadyAt,
      recordingSizeBytes,
      recordingStatus,
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
        ended_reason: "start_cancelled",
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

type RecordingStreamBundle = {
  cleanup: () => void
  stream: MediaStream
}

type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

function createRecordingStream(sources: CapturedAudioSource[]): RecordingStreamBundle {
  const audioTracks = sources.flatMap((source) => source.stream.getAudioTracks())

  if (audioTracks.length <= 1) {
    return {
      cleanup: () => undefined,
      stream: new MediaStream(audioTracks),
    }
  }

  const AudioContextConstructor =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext

  if (!AudioContextConstructor) {
    return {
      cleanup: () => undefined,
      stream: new MediaStream(audioTracks),
    }
  }

  const audioContext = new AudioContextConstructor()
  const destination = audioContext.createMediaStreamDestination()
  const sourceNodes = sources
    .map((source) => {
      const sourceAudioTracks = source.stream.getAudioTracks()
      if (sourceAudioTracks.length === 0) return null

      const stream = new MediaStream(sourceAudioTracks)
      const sourceNode = audioContext.createMediaStreamSource(stream)
      const gainNode = audioContext.createGain()
      gainNode.gain.value = 1
      sourceNode.connect(gainNode)
      gainNode.connect(destination)

      return { gainNode, sourceNode }
    })
    .filter((node): node is { gainNode: GainNode; sourceNode: MediaStreamAudioSourceNode } => Boolean(node))

  return {
    cleanup: () => {
      sourceNodes.forEach(({ gainNode, sourceNode }) => {
        sourceNode.disconnect()
        gainNode.disconnect()
      })
      destination.stream.getTracks().forEach((track) => track.stop())
      if (audioContext.state !== "closed") {
        void audioContext.close()
      }
    },
    stream: destination.stream,
  }
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
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
  ]
  const mimeType = preferredTypes.find((type) => isRecordableAndPlayableMimeType(type))

  return mimeType ? { mimeType } : undefined
}

function isRecordableAndPlayableMimeType(mimeType: string) {
  if (!MediaRecorder.isTypeSupported(mimeType)) return false
  if (typeof document === "undefined") return true

  const audio = document.createElement("audio")
  const baseType = mimeType.split(";")[0]?.trim() ?? mimeType
  return Boolean(audio.canPlayType(mimeType) || audio.canPlayType(baseType))
}

function getBlobContentType(blob: Blob) {
  return blob.type.split(";")[0]?.trim().toLowerCase() || "audio/webm"
}

function shouldRefineBeforeTurn(source: CapturedAudioSource) {
  return source.kind === "mixed_audio" || source.kind === "in_person_microphone"
}

async function createTranscriptTurn({
  attribution,
  config,
  diarizationSpeaker,
  elapsedMs,
  endOfTurnConfidence,
  finalText,
  languageDetected,
  preferredClientId,
  providerEventId,
  providerSessionId,
  providerTurnIndex,
  qualityFlags,
  source,
  startMs,
  turnSequenceRef,
  wordConfidence,
}: {
  attribution: SpeakerAttribution
  config: StartCallCaptureConfig
  diarizationSpeaker?: string
  elapsedMs: number
  endOfTurnConfidence?: number
  finalText: string
  languageDetected?: string
  preferredClientId?: string
  providerEventId?: string
  providerSessionId?: string
  providerTurnIndex?: number
  qualityFlags: string[]
  source: CapturedAudioSource
  startMs?: number
  turnSequenceRef: React.MutableRefObject<number>
  wordConfidence?: number
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
    audio_source_kind: source.kind,
    client_turn_id: clientTurnId,
    diarization_speaker: diarizationSpeaker ?? null,
    end_of_turn_confidence: endOfTurnConfidence ?? null,
    language_detected: languageDetected ?? null,
    provider_event_id: providerEventId ?? null,
    provider_session_id: providerSessionId ?? null,
    provider_turn_index: providerTurnIndex ?? null,
    transcription_provider: "deepgram_flux",
    turn_sequence: turnSequence,
    word_confidence: wordConfidence ?? null,
    quality_flags: qualityFlags,
  })
  const resolvedClientTurnId = segment.client_turn_id ?? clientTurnId
  const resolvedTurnSequence = segment.turn_sequence ?? turnSequence

  return {
    attribution,
    clientId: resolvedClientTurnId,
    diarizationSpeaker: segment.diarization_speaker ?? diarizationSpeaker,
    displayName: speaker.display_name || speaker.label,
    endMs: segment.end_ms ?? elapsedMs,
    endOfTurnConfidence: segment.end_of_turn_confidence ?? endOfTurnConfidence,
    languageDetected: segment.language_detected ?? languageDetected,
    lastActivityMs: segment.end_ms ?? elapsedMs,
    providerEventId: segment.provider_event_id ?? providerEventId,
    providerSessionId: segment.provider_session_id ?? providerSessionId,
    providerTurnIndex: segment.provider_turn_index ?? providerTurnIndex,
    qualityFlags,
    segmentId: segment.id,
    sourceKind: (segment.audio_source_kind as AudioSourceKind | null) ?? source.kind,
    speakerId: segment.speaker_id ?? speaker.id,
    startMs: segment.start_ms ?? resolvedStartMs,
    text: segment.text || finalText,
    transcriptionDelay: segment.transcription_delay ?? undefined,
    wordConfidence: segment.word_confidence ?? wordConfidence,
    turnSequence: resolvedTurnSequence,
  }
}

async function updateTranscriptTurn({
  attribution,
  config,
  elapsedMs,
  endOfTurnConfidence,
  finalText,
  languageDetected,
  providerEventId,
  providerSessionId,
  providerTurnIndex,
  qualityFlags,
  turn,
  wordConfidence,
}: {
  attribution: SpeakerAttribution
  config: StartCallCaptureConfig
  elapsedMs: number
  endOfTurnConfidence?: number
  finalText: string
  languageDetected?: string
  providerEventId?: string
  providerSessionId?: string
  providerTurnIndex?: number
  qualityFlags: string[]
  turn: TranscriptTurn
  wordConfidence?: number
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
    audio_source_kind: turn.sourceKind,
    client_turn_id: turn.clientId,
    end_of_turn_confidence: endOfTurnConfidence ?? turn.endOfTurnConfidence ?? null,
    language_detected: languageDetected ?? turn.languageDetected ?? null,
    provider_event_id: providerEventId ?? turn.providerEventId ?? null,
    provider_session_id: providerSessionId ?? turn.providerSessionId ?? null,
    provider_turn_index: providerTurnIndex ?? turn.providerTurnIndex ?? null,
    transcription_provider: "deepgram_flux",
    turn_sequence: turn.turnSequence,
    transcription_delay: turn.transcriptionDelay,
    word_confidence: wordConfidence ?? turn.wordConfidence ?? null,
    quality_flags: [...new Set([...turn.qualityFlags, ...qualityFlags])],
  })

  return {
    ...turn,
    attribution,
    displayName: speaker?.display_name || speaker?.label || turn.displayName,
    endMs: elapsedMs,
    endOfTurnConfidence: endOfTurnConfidence ?? turn.endOfTurnConfidence,
    diarizationSpeaker: turn.diarizationSpeaker,
    languageDetected: languageDetected ?? turn.languageDetected,
    lastActivityMs: elapsedMs,
    providerEventId: providerEventId ?? turn.providerEventId,
    providerSessionId: providerSessionId ?? turn.providerSessionId,
    providerTurnIndex: providerTurnIndex ?? turn.providerTurnIndex,
    qualityFlags: [...new Set([...turn.qualityFlags, ...qualityFlags])],
    speakerId: nextSpeakerId,
    text: nextText,
    wordConfidence: wordConfidence ?? turn.wordConfidence,
  }
}

function canContinueTurn(
  turn: TranscriptTurn,
  attribution: SpeakerAttribution,
  elapsedMs: number,
  nextText: string,
  sourceKind: AudioSourceKind
) {
  return canContinueTranscriptTurn({
    attributionSpeaker: attribution.speakerLabel,
    elapsedMs,
    nextText,
    sourceKind,
    turn,
  })
}

function inferOneChannelTurnAttribution({
  activeTurn,
  attribution,
  elapsedMs,
  finalText,
  source,
}: {
  activeTurn?: TranscriptTurn
  attribution: SpeakerAttribution
  elapsedMs: number
  finalText: string
  source: CapturedAudioSource
}): SpeakerAttribution {
  if (!activeTurn || !isOneChannelAudioSource(source.kind)) return attribution

  const pauseMs = Math.max(0, elapsedMs - activeTurn.lastActivityMs)
  const shouldInferCustomer = shouldInferOneChannelCustomerTurn({
    nextText: finalText,
    pauseMs,
    sourceKind: source.kind,
    turn: activeTurn,
  })

  if (!shouldInferCustomer) return attribution

  return {
    ...attribution,
    confidence: Math.max(attribution.confidence, 0.74),
    needsReview: true,
    reason:
      `One-channel speaker split inferred from a seller question followed by an answer after ${Math.round(pauseMs)}ms of pause. Review if the room audio was ambiguous.`,
    speakerLabel: "Customer",
    source: "one_channel_turn_context",
  }
}

function getTurnAssemblyQualityFlags({
  activeTurn,
  attribution,
  finalText,
  shouldContinueTurn,
  source,
}: {
  activeTurn?: TranscriptTurn
  attribution: SpeakerAttribution
  finalText: string
  shouldContinueTurn: boolean
  source: CapturedAudioSource
}) {
  const flags: string[] = []
  if (!isOneChannelAudioSource(source.kind)) return flags

  flags.push("one_channel_mixed_audio")
  if (source.level > 0 && source.level < 0.018) flags.push("one_channel_low_preflight_level")
  if (attribution.source === "one_channel_turn_context") flags.push("one_channel_contextual_speaker_split")
  if (activeTurn && !shouldContinueTurn) flags.push("one_channel_new_turn_boundary")
  if (activeTurn && shouldContinueTurn) flags.push("one_channel_merged_same_speaker")
  if (activeTurn && isQuestionLikeTranscript(activeTurn.text) && isAnswerLikeTranscript(finalText)) {
    flags.push("one_channel_question_answer_pattern")
  }

  return flags
}

function createTranscriptLineFromTurn(turn: TranscriptTurn): CallCaptureTranscriptLine {
  return {
    audioSourceKind: turn.sourceKind,
    clientId: turn.clientId,
    diarizationSpeaker: turn.diarizationSpeaker,
    endOfTurnConfidence: turn.endOfTurnConfidence,
    id: turn.segmentId,
    isPartial: false,
    languageDetected: turn.languageDetected,
    providerEventId: turn.providerEventId,
    providerSessionId: turn.providerSessionId,
    providerTurnIndex: turn.providerTurnIndex,
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
    wordConfidence: turn.wordConfidence,
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
  activeTranscriptTurnsRef,
  activeTurn,
  config,
  elapsedMs,
  eventEndMs,
  eventStartMs,
  line,
  recentTranscript,
  segmentId,
  source,
}: {
  activeTranscriptTurnsRef: React.MutableRefObject<Map<AudioSourceKind, TranscriptTurn>>
  activeTurn?: TranscriptTurn
  config: StartCallCaptureConfig
  elapsedMs: number
  eventEndMs: number
  eventStartMs: number
  line: CallCaptureTranscriptLine
  recentTranscript: CallCaptureTranscriptLine[]
  segmentId: string
  source: CapturedAudioSource
}) {
  try {
    const response = await requestSpeakerAttribution({
      callId: config.callId,
      elapsedMs,
      priorTurn: activeTurn
        ? {
            endMs: activeTurn.endMs,
            sourceKind: activeTurn.sourceKind,
            speaker: activeTurn.attribution.speakerLabel,
            startMs: activeTurn.startMs,
            text: activeTurn.text,
          }
        : null,
      recentTranscript,
      segmentText: line.text,
      segmentSignals: {
        answerLike: isAnswerLikeTranscript(line.text),
        followsQuestion: Boolean(activeTurn && isQuestionLikeTranscript(activeTurn.text)),
        oneChannel: isOneChannelAudioSource(source.kind),
        questionLike: isQuestionLikeTranscript(line.text),
        sourceKind: source.kind,
      },
      silenceGapMs: activeTurn
        ? Math.max(0, eventStartMs - activeTurn.lastActivityMs, eventEndMs - activeTurn.lastActivityMs)
        : null,
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
    const liveTurn = activeTranscriptTurnsRef.current.get(source.kind)
    if (liveTurn?.segmentId === segmentId) {
      activeTranscriptTurnsRef.current.set(source.kind, {
        ...liveTurn,
        attribution,
        displayName: speaker.display_name || speaker.label,
        speakerId: speaker.id,
      })
    }
    config.onTranscriptUpdate?.(updatedLine)
  } catch {
    const reviewableLine = {
      ...line,
      speakerAttributionReason: `${line.speakerAttributionReason ?? "Initial speaker label used."} Speaker label still needs review.`,
      speakerNeedsReview: true,
    }
    recentTranscriptRefUpdate(recentTranscript, reviewableLine)
    const liveTurn = activeTranscriptTurnsRef.current.get(source.kind)
    if (liveTurn?.segmentId === segmentId) {
      activeTranscriptTurnsRef.current.set(source.kind, {
        ...liveTurn,
        attribution: {
          ...liveTurn.attribution,
          needsReview: true,
          reason: reviewableLine.speakerAttributionReason ?? liveTurn.attribution.reason,
        },
      })
    }
    config.onTranscriptUpdate?.(reviewableLine)
  }
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

function getDeepgramSegmentAttribution({
  rawSpeaker,
  source,
  speakerLabels,
}: {
  rawSpeaker?: string
  source: CapturedAudioSource
  speakerLabels: Map<string, TranscriptSpeaker>
}): SpeakerAttribution | null {
  if (!rawSpeaker?.trim()) return null

  const speakerLabel = getDeepgramSegmentSpeakerLabel({
    rawSpeaker,
    source,
    speakerLabels,
  })

  return {
    confidence: source.kind === "seller_mic" ? 0.96 : source.kind === "meeting_audio" ? 0.86 : 0.76,
    needsReview: source.kind === "mixed_audio" || source.kind === "in_person_microphone",
    reason:
      source.kind === "seller_mic"
        ? "Deepgram speaker metadata matched the dedicated seller microphone stream."
        : source.kind === "meeting_audio"
          ? "Deepgram speaker metadata labelled this customer-side speaker from meeting audio."
          : "Deepgram speaker metadata labelled this speaker from mixed room audio; review if needed.",
    speakerLabel,
    source: "deepgram_flux_diarization",
  }
}

function getDeepgramSegmentSpeakerLabel({
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
    source: typeof record.source === "string" && record.source.trim() ? record.source.trim() : "model_live_role",
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
  if (kind === "meeting_audio") return "Shared audio"
  if (kind === "in_person_microphone") return "Room/call audio"

  return "Room/call audio"
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
    try {
      recorder.requestData()
    } catch {
      // Some browsers throw if no data is pending. Stopping still flushes what is available.
    }
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
    (
      error.message.includes("transcript_segments_call_source_openai_segment_unique_idx") ||
      error.message.includes("transcript_segments_call_provider_turn_unique_idx") ||
      error.message.includes("transcript_segments_call_provider_event_unique_idx")
    )
  )
}

function formatElapsedTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
