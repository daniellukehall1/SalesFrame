import * as React from "react"

import {
  MEETING_BOT_HEARTBEAT_INTERVAL_MS,
  MEETING_BOT_POLL_INTERVAL_MS,
  createMeetingBotClientInstanceId,
  createMeetingBotClientRequestId,
  createMeetingBotPresenceController,
  getBrowserMeetingBotPresenceEnvironment,
  getMeetingBotErrorPresentation,
  getMeetingBotStatusPresentation,
  isMeetingBotSessionPending,
  shouldAcceptMeetingBotSnapshot,
  validateMeetingBotUrl,
  type MeetingBotCaptureStatus,
  type MeetingBotBrowserFallbackCaptureMethod,
  type MeetingBotBrowserFallbackResponse,
  type MeetingBotClientApi,
  type MeetingBotErrorPresentation,
  type MeetingBotEndedReason,
  type MeetingBotSessionSnapshot,
  type MeetingBotStatusSubscriber,
} from "@/lib/meeting-bot"

type UseMeetingBotCaptureOptions = {
  api: MeetingBotClientApi
  heartbeatIntervalMs?: number
  initialSession?: MeetingBotSessionSnapshot | null
  onRecoverableError?: (error: unknown) => void
  onSessionChange?: (session: MeetingBotSessionSnapshot) => void
  pollIntervalMs?: number
  restoreSessionId?: string | null
  subscribe?: MeetingBotStatusSubscriber
}

type StartMeetingBotOptions = {
  callId: string
  clientRequestId?: string
  meetingUrl: string
  signal?: AbortSignal
}

type StopMeetingBotOptions = {
  endedReason?: MeetingBotEndedReason
  signal?: AbortSignal
}

export type UseMeetingBotCaptureResult = {
  activeSessionId: string | null
  clear: () => void
  error: MeetingBotErrorPresentation | null
  isActive: boolean
  isPending: boolean
  refresh: (signal?: AbortSignal) => Promise<MeetingBotSessionSnapshot | null>
  restore: (sessionId: string, signal?: AbortSignal) => Promise<MeetingBotSessionSnapshot>
  session: MeetingBotSessionSnapshot | null
  start: (options: StartMeetingBotOptions) => Promise<MeetingBotSessionSnapshot>
  status: MeetingBotCaptureStatus
  statusPresentation: ReturnType<typeof getMeetingBotStatusPresentation>
  stop: (options?: StopMeetingBotOptions) => Promise<MeetingBotSessionSnapshot | null>
  switchToBrowserCapture: (
    captureMethod: MeetingBotBrowserFallbackCaptureMethod,
    signal?: AbortSignal
  ) => Promise<MeetingBotBrowserFallbackResponse>
}

export function useMeetingBotCapture({
  api,
  heartbeatIntervalMs = MEETING_BOT_HEARTBEAT_INTERVAL_MS,
  initialSession = null,
  onRecoverableError,
  onSessionChange,
  pollIntervalMs = MEETING_BOT_POLL_INTERVAL_MS,
  restoreSessionId,
  subscribe,
}: UseMeetingBotCaptureOptions): UseMeetingBotCaptureResult {
  const [actionStatus, setActionStatus] = React.useState<MeetingBotCaptureStatus | null>(null)
  const [error, setError] = React.useState<MeetingBotErrorPresentation | null>(null)
  const [session, setSession] = React.useState<MeetingBotSessionSnapshot | null>(initialSession)
  const apiRef = React.useRef(api)
  const clientInstanceIdRef = React.useRef(createMeetingBotClientInstanceId())
  const mountedRef = React.useRef(false)
  const onRecoverableErrorRef = React.useRef(onRecoverableError)
  const onSessionChangeRef = React.useRef(onSessionChange)
  const sessionRef = React.useRef<MeetingBotSessionSnapshot | null>(initialSession)
  const startInFlightRef = React.useRef<Promise<MeetingBotSessionSnapshot> | null>(null)

  apiRef.current = api
  onRecoverableErrorRef.current = onRecoverableError
  onSessionChangeRef.current = onSessionChange

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const applySnapshot = React.useCallback((nextSession: MeetingBotSessionSnapshot) => {
    const currentSession = sessionRef.current
    if (!shouldAcceptMeetingBotSnapshot(currentSession, nextSession)) return currentSession ?? nextSession

    sessionRef.current = nextSession
    if (mountedRef.current) {
      setSession(nextSession)
      setActionStatus(null)
      setError(nextSession.status === "failed" ? getMeetingBotErrorPresentation(nextSession.errorCode ?? nextSession.providerSubcode) : null)
    }
    if (mountedRef.current) onSessionChangeRef.current?.(nextSession)
    return nextSession
  }, [])

  React.useEffect(() => {
    if (initialSession) applySnapshot(initialSession)
  }, [applySnapshot, initialSession])

  const restore = React.useCallback(
    async (sessionId: string, signal?: AbortSignal) => {
      const nextSession = await apiRef.current.get(sessionId, { signal })
      return applySnapshot(nextSession)
    },
    [applySnapshot]
  )

  const restoredSessionIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!restoreSessionId || restoredSessionIdRef.current === restoreSessionId) return
    if (sessionRef.current?.sessionId === restoreSessionId) {
      restoredSessionIdRef.current = restoreSessionId
      return
    }

    restoredSessionIdRef.current = restoreSessionId
    const controller = new AbortController()
    void restore(restoreSessionId, controller.signal).catch((caughtError) => {
      if (controller.signal.aborted) return
      if (mountedRef.current) setError(getMeetingBotErrorPresentation(caughtError))
    })

    return () => controller.abort()
  }, [restore, restoreSessionId])

  const start = React.useCallback(
    (options: StartMeetingBotOptions) => {
      if (startInFlightRef.current) return startInFlightRef.current

      if (sessionRef.current && isMeetingBotSessionPending(sessionRef.current.status)) {
        const activeSessionError = Object.assign(new Error("Meeting bot is already active."), {
          code: "meeting_bot_already_active",
        })
        if (mountedRef.current) setError(getMeetingBotErrorPresentation(activeSessionError))
        return Promise.reject(activeSessionError)
      }

      const validatedUrl = validateMeetingBotUrl(options.meetingUrl)
      if (!validatedUrl.valid) {
        const validationError = Object.assign(new Error(validatedUrl.message), {
          code: "invalid_meeting_url",
          validationCode: validatedUrl.code,
        })
        if (mountedRef.current) setError(getMeetingBotErrorPresentation(validationError))
        return Promise.reject(validationError)
      }

      if (mountedRef.current) {
        setActionStatus("provisioning")
        setError(null)
      }

      const startPromise = apiRef.current
        .create(
          {
            callId: options.callId,
            clientInstanceId: clientInstanceIdRef.current,
            clientRequestId: options.clientRequestId ?? createMeetingBotClientRequestId(),
            meetingUrl: validatedUrl.normalizedUrl,
          },
          { signal: options.signal }
        )
        .then(applySnapshot)
        .catch((caughtError) => {
          if (mountedRef.current && !options.signal?.aborted) {
            setActionStatus("failed")
            setError(getMeetingBotErrorPresentation(caughtError))
          }
          throw caughtError
        })
        .finally(() => {
          startInFlightRef.current = null
        })

      startInFlightRef.current = startPromise
      return startPromise
    },
    [applySnapshot]
  )

  const refresh = React.useCallback(
    async (signal?: AbortSignal) => {
      const activeSession = sessionRef.current
      if (!activeSession) return null
      const nextSession = await apiRef.current.get(activeSession.sessionId, { signal })
      return applySnapshot(nextSession)
    },
    [applySnapshot]
  )

  const stop = React.useCallback(
    async (options: StopMeetingBotOptions = {}) => {
      const activeSession = sessionRef.current
      if (!activeSession) return null

      if (mountedRef.current) {
        setActionStatus("leaving")
        setError(null)
      }

      try {
        const nextSession = await apiRef.current.leave(
          activeSession.sessionId,
          {
            clientInstanceId: clientInstanceIdRef.current,
            endedReason: options.endedReason ?? "seller_stopped",
          },
          { signal: options.signal }
        )
        return applySnapshot(nextSession)
      } catch (caughtError) {
        if (mountedRef.current && !options.signal?.aborted) {
          setActionStatus(null)
          setError(getMeetingBotErrorPresentation(caughtError))
        }
        throw caughtError
      }
    },
    [applySnapshot]
  )

  const switchToBrowserCapture = React.useCallback(
    async (captureMethod: MeetingBotBrowserFallbackCaptureMethod, signal?: AbortSignal) => {
      const activeSession = sessionRef.current
      if (!activeSession) throw new Error("Meeting bot session is not available for fallback.")
      return apiRef.current.fallback(
        activeSession.sessionId,
        {
          captureMethod,
          clientInstanceId: clientInstanceIdRef.current,
        },
        { signal }
      )
    },
    []
  )

  React.useEffect(() => {
    const environment = getBrowserMeetingBotPresenceEnvironment()
    if (!environment) return

    return createMeetingBotPresenceController({
      disconnect: (activeSession) =>
        apiRef.current.disconnect(activeSession.sessionId, {
          clientInstanceId: clientInstanceIdRef.current,
          keepalive: true,
          reason: "page_exit",
        }),
      environment,
      getSession: () => sessionRef.current,
      heartbeat: async (activeSession, visibilityState) => {
        try {
          const nextSession = await apiRef.current.heartbeat(
            activeSession.sessionId,
            {
              clientInstanceId: clientInstanceIdRef.current,
              visibilityState,
            }
          )
          if (nextSession) applySnapshot(nextSession)
        } catch (caughtError) {
          onRecoverableErrorRef.current?.(caughtError)
        }
      },
      heartbeatIntervalMs,
    })
  }, [applySnapshot, heartbeatIntervalMs, session?.sessionId])

  const watchedSessionId = session?.sessionId ?? null
  const shouldWatchSession = Boolean(
    session &&
      (
        isMeetingBotSessionPending(session.status) ||
        session.postCallStatus === "pending" ||
        session.postCallStatus === "running"
      )
  )

  React.useEffect(() => {
    if (!watchedSessionId || !shouldWatchSession) return

    if (subscribe) {
      return subscribe(watchedSessionId, {
        onError: (caughtError) => onRecoverableErrorRef.current?.(caughtError),
        onSnapshot: applySnapshot,
      })
    }

    const controller = new AbortController()
    const intervalId = window.setInterval(() => {
      void apiRef.current
        .get(watchedSessionId, { signal: controller.signal })
        .then(applySnapshot)
        .catch((caughtError) => {
          if (!controller.signal.aborted) onRecoverableErrorRef.current?.(caughtError)
        })
    }, pollIntervalMs)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [applySnapshot, pollIntervalMs, shouldWatchSession, subscribe, watchedSessionId])

  const clear = React.useCallback(() => {
    const activeSession = sessionRef.current
    if (activeSession && isMeetingBotSessionPending(activeSession.status)) return

    sessionRef.current = null
    if (mountedRef.current) {
      setActionStatus(null)
      setError(null)
      setSession(null)
    }
  }, [])

  const status = actionStatus ?? session?.status ?? "idle"

  return {
    activeSessionId: session?.sessionId ?? null,
    clear,
    error,
    isActive: status === "recording",
    isPending: isMeetingBotSessionPending(status),
    refresh,
    restore,
    session,
    start,
    status,
    statusPresentation: getMeetingBotStatusPresentation(session && status === session.status ? session : status),
    stop,
    switchToBrowserCapture,
  }
}
