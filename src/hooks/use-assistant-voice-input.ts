import * as React from "react"

import type { AssistantVoiceInput, AssistantVoiceState } from "@/lib/assistant-types"
import {
  connectDeepgramLiveTranscription,
  type DeepgramTranscriptionConnection,
} from "@/lib/deepgram-live-transcription"
import { createAssistantVoiceToken } from "@/lib/server-functions"

const maximumVoiceCommandMs = 30_000
const finalTranscriptGraceMs = 850

type UseAssistantVoiceInputOptions = {
  workspaceId: string
}

export function useAssistantVoiceInput({ workspaceId }: UseAssistantVoiceInputOptions): AssistantVoiceInput {
  const [state, setState] = React.useState<AssistantVoiceState>("idle")
  const [transcript, setTranscript] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const connectionRef = React.useRef<DeepgramTranscriptionConnection | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const stopTimerRef = React.useRef<number | null>(null)
  const operationIdRef = React.useRef(0)
  const captureActiveRef = React.useRef(false)
  const committedTextRef = React.useRef("")
  const currentTurnTextRef = React.useRef("")

  const clearTimers = React.useCallback(() => {
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current)
    stopTimerRef.current = null
  }, [])

  const releaseCapture = React.useCallback(() => {
    clearTimers()
    connectionRef.current?.close()
    connectionRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    captureActiveRef.current = false
  }, [clearTimers])

  const finish = React.useCallback(async () => {
    if (!captureActiveRef.current) return

    const operationId = operationIdRef.current
    setState("transcribing")
    clearTimers()
    connectionRef.current?.flush()

    await new Promise<void>((resolve) => window.setTimeout(resolve, finalTranscriptGraceMs))
    if (operationIdRef.current !== operationId) return

    releaseCapture()
    setState("idle")
  }, [clearTimers, releaseCapture])

  const start = React.useCallback(async () => {
    if (!workspaceId || captureActiveRef.current || state === "transcribing") return

    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    releaseCapture()
    committedTextRef.current = ""
    currentTurnTextRef.current = ""
    setTranscript("")
    setErrorMessage("")
    setState("requesting")

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      })

      if (operationIdRef.current !== operationId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      captureActiveRef.current = true
      connectionRef.current = await connectDeepgramLiveTranscription({
        callId: workspaceId,
        sourceKind: "in_person_microphone",
        stream,
        tokenProvider: () => createAssistantVoiceToken(workspaceId),
        onTranscriptError: () => {
          if (operationIdRef.current !== operationId) return
          operationIdRef.current += 1
          releaseCapture()
          setErrorMessage("SalesFrame couldn't hear that clearly. You can type instead or try again.")
          setState("error")
        },
        onTranscriptEvent: (event) => {
          if (operationIdRef.current !== operationId || !event.text.trim()) return

          if (event.isFinal) {
            const nextTurn = event.text.trim()
            const committedTurns = committedTextRef.current
              ? `${committedTextRef.current} ${nextTurn}`
              : nextTurn
            committedTextRef.current = committedTurns
            currentTurnTextRef.current = ""
            setTranscript(committedTurns)
            return
          }

          currentTurnTextRef.current = event.text.trim()
          setTranscript(
            [committedTextRef.current, currentTurnTextRef.current]
              .filter(Boolean)
              .join(" ")
          )
        },
      })

      if (operationIdRef.current !== operationId) {
        releaseCapture()
        return
      }

      setState("listening")
      stopTimerRef.current = window.setTimeout(() => {
        void finish()
      }, maximumVoiceCommandMs)
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      releaseCapture()
      const permissionDenied =
        error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")
      setErrorMessage(
        permissionDenied
          ? "Microphone access is off. Allow it in your browser, or type your request."
          : "SalesFrame couldn't start voice input. You can type instead or try again."
      )
      setState("error")
    }
  }, [finish, releaseCapture, state, workspaceId])

  const discard = React.useCallback(() => {
    operationIdRef.current += 1
    releaseCapture()
    committedTextRef.current = ""
    currentTurnTextRef.current = ""
    setTranscript("")
    setErrorMessage("")
    setState("idle")
  }, [releaseCapture])

  React.useEffect(() => {
    operationIdRef.current += 1
    releaseCapture()
    committedTextRef.current = ""
    currentTurnTextRef.current = ""
    setTranscript("")
    setErrorMessage("")
    setState("idle")

    return () => {
      operationIdRef.current += 1
      releaseCapture()
    }
  }, [releaseCapture, workspaceId])

  return {
    state,
    transcript,
    statusText:
      state === "requesting"
        ? "Turning on the microphone"
        : state === "listening"
          ? "Listening — select stop when you're done"
          : state === "transcribing"
            ? "Finishing your request"
            : undefined,
    errorMessage: errorMessage || undefined,
    onStart: start,
    onStop: finish,
    onDiscard: discard,
  }
}
