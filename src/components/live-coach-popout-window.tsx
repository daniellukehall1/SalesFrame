import * as React from "react"
import {
  ArrowRightIcon,
  AudioLinesIcon,
  CheckCircle2Icon,
  SquareIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  createDisconnectedLiveCoachPopoutSnapshot,
  createLiveCoachPopoutSourceId,
  getLiveCoachPopoutCommandKey,
  isFreshLiveCoachPopoutAcknowledgement,
  isFreshLiveCoachPopoutSnapshot,
  isLiveCoachPopoutCommandAcknowledgement,
  isLiveCoachPopoutSnapshot,
  liveCoachPopoutChannelName,
  liveCoachPopoutCommandAckStorageKey,
  liveCoachPopoutSnapshotStorageKey,
  liveCoachPopoutVersion,
  readStoredLiveCoachPopoutSnapshot,
  writeStoredLiveCoachPopoutCommand,
  type LiveCoachPopoutCommandAcknowledgement,
  type LiveCoachPopoutCallStatus,
  type LiveCoachPopoutCommand,
  type LiveCoachPopoutSnapshot,
} from "@/lib/live-coach-popout"

type PendingCoachCommand = {
  command: LiveCoachPopoutCommand["command"]
  commandKey: string
  questionId?: string
}

export function LiveCoachPopoutWindow({ darkMode }: { darkMode: boolean }) {
  const sourceIdRef = React.useRef(createLiveCoachPopoutSourceId("popout"))
  const channelRef = React.useRef<BroadcastChannel | null>(null)
  const pendingCommandRef = React.useRef<PendingCoachCommand | null>(null)
  const [snapshot, setSnapshot] = React.useState<LiveCoachPopoutSnapshot>(() =>
    readStoredLiveCoachPopoutSnapshot() ?? createDisconnectedLiveCoachPopoutSnapshot(sourceIdRef.current)
  )
  const [pendingCommand, setPendingCommand] = React.useState<PendingCoachCommand | null>(null)
  const [actionMessage, setActionMessage] = React.useState("")
  const question = snapshot.question
  const statusLabel = getCoachPopoutStatusLabel(snapshot.callStatus)
  const canCloseWindow = snapshot.callStatus === "ended" || snapshot.callStatus === "disconnected"
  const hasPendingQuestionCommand = pendingCommand?.command === "asked" || pendingCommand?.command === "skip"
  const shouldShowCallContext = snapshot.callStatus !== "disconnected" || Boolean(snapshot.activeCallId)

  const handleCloseWindow = React.useCallback(() => {
    window.close()
    window.setTimeout(() => {
      if (!window.closed) window.location.assign("/")
    }, 80)
  }, [])

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)
  }, [darkMode])

  React.useEffect(() => {
    document.title = "Live Coach - SalesFrame"
  }, [])

  React.useEffect(() => {
    pendingCommandRef.current = pendingCommand
  }, [pendingCommand])

  React.useEffect(() => {
    if (snapshot.callStatus === "disconnected" || snapshot.callStatus === "ended") return

    const staleSnapshotTimeoutId = window.setInterval(() => {
      setSnapshot((currentSnapshot) => {
        if (currentSnapshot.callStatus === "disconnected" || currentSnapshot.callStatus === "ended") {
          return currentSnapshot
        }
        if (isFreshLiveCoachPopoutSnapshot(currentSnapshot)) return currentSnapshot

        setPendingCommand(null)
        setActionMessage("Open the main SalesFrame tab to reconnect the live coach.")
        return createDisconnectedLiveCoachPopoutSnapshot(sourceIdRef.current)
      })
    }, 5_000)

    return () => window.clearInterval(staleSnapshotTimeoutId)
  }, [snapshot.callStatus])

  React.useEffect(() => {
    const handleSnapshot = (nextSnapshot: LiveCoachPopoutSnapshot) => {
      if (nextSnapshot.sourceId === sourceIdRef.current) return
      if (!isFreshLiveCoachPopoutSnapshot(nextSnapshot)) return
      setSnapshot(nextSnapshot)
    }

    const handleAcknowledgement = (acknowledgement: LiveCoachPopoutCommandAcknowledgement) => {
      if (acknowledgement.sourceId === sourceIdRef.current) return
      if (!isFreshLiveCoachPopoutAcknowledgement(acknowledgement)) return
      const pending = pendingCommandRef.current
      if (!pending || acknowledgement.commandKey !== pending.commandKey) return

      setActionMessage(acknowledgement.message)
      if (acknowledgement.status === "ignored") setPendingCommand(null)
    }

    const handleBroadcastMessage = (event: MessageEvent) => {
      if (isLiveCoachPopoutSnapshot(event.data)) handleSnapshot(event.data)
      if (isLiveCoachPopoutCommandAcknowledgement(event.data)) handleAcknowledgement(event.data)
    }

    const handleStorageMessage = (event: StorageEvent) => {
      if (!event.newValue) return

      try {
        const parsedValue: unknown = JSON.parse(event.newValue)
        if (event.key === liveCoachPopoutSnapshotStorageKey && isLiveCoachPopoutSnapshot(parsedValue)) {
          handleSnapshot(parsedValue)
        }
        if (
          event.key === liveCoachPopoutCommandAckStorageKey &&
          isLiveCoachPopoutCommandAcknowledgement(parsedValue)
        ) {
          handleAcknowledgement(parsedValue)
        }
      } catch {
        // Ignore malformed storage events from older tabs.
      }
    }

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(liveCoachPopoutChannelName)
      channelRef.current = channel
      channel.addEventListener("message", handleBroadcastMessage)
    }

    window.addEventListener("storage", handleStorageMessage)

    const readyCommand: LiveCoachPopoutCommand = {
      type: "command",
      version: liveCoachPopoutVersion,
      sentAt: new Date().toISOString(),
      sourceId: sourceIdRef.current,
      command: "ready",
    }
    channelRef.current?.postMessage(readyCommand)
    writeStoredLiveCoachPopoutCommand(readyCommand)

    return () => {
      window.removeEventListener("storage", handleStorageMessage)
      channelRef.current?.removeEventListener("message", handleBroadcastMessage)
      channelRef.current?.close()
      channelRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!pendingCommand) return

    const commandSettled =
      pendingCommand.command === "end_call"
        ? ["stopping", "ended", "disconnected"].includes(snapshot.callStatus)
        : pendingCommand.questionId
          ? snapshot.question?.id !== pendingCommand.questionId || snapshot.question?.isAsked === true
          : false

    if (commandSettled) {
      setActionMessage(
        pendingCommand.command === "end_call"
          ? "Ending the call in SalesFrame."
          : "Question updated in SalesFrame."
      )
      setPendingCommand(null)
      return
    }

    const waitingTimeoutId = window.setTimeout(() => {
      setActionMessage("Still waiting for the main SalesFrame tab.")
    }, 2_000)
    const staleTimeoutId = window.setTimeout(() => {
      setPendingCommand(null)
      setActionMessage("Open the main SalesFrame tab if this does not update.")
    }, 6_000)

    return () => {
      window.clearTimeout(waitingTimeoutId)
      window.clearTimeout(staleTimeoutId)
    }
  }, [pendingCommand, snapshot.callStatus, snapshot.question?.id, snapshot.question?.isAsked])

  const sendCommand = React.useCallback((
    command: LiveCoachPopoutCommand["command"],
    questionId?: string
  ) => {
    const nextCommand: LiveCoachPopoutCommand = {
      type: "command",
      version: liveCoachPopoutVersion,
      sentAt: new Date().toISOString(),
      sourceId: sourceIdRef.current,
      command,
      activeCallId: snapshot.activeCallId,
      questionId,
    }
    const commandKey = getLiveCoachPopoutCommandKey(nextCommand)

    setPendingCommand({ command, commandKey, questionId })
    setActionMessage(
      command === "end_call"
        ? "Ending call from the main SalesFrame tab."
        : "Sending that to SalesFrame."
    )
    channelRef.current?.postMessage(nextCommand)
    writeStoredLiveCoachPopoutCommand(nextCommand)
  }, [snapshot.activeCallId])

  return (
    <div className="h-svh overflow-hidden bg-muted/30 p-2 text-foreground sm:p-3">
      <div className="mx-auto flex h-[calc(100svh-1rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border sm:h-[calc(100svh-1.5rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0f0f10] text-white">
              <AudioLinesIcon aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">SalesFrame</p>
              <p className="truncate text-xs text-muted-foreground">{statusLabel}</p>
            </div>
          </div>
          <div className="grid justify-items-end gap-0.5">
            <div className="rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
              {formatPopoutTime(snapshot.elapsedSeconds)}
            </div>
            {snapshot.limitNotice ? (
              <p className="text-[0.7rem] font-medium text-amber-700 dark:text-amber-300" role="status" aria-live="polite">
                {snapshot.limitNotice}
              </p>
            ) : null}
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          {shouldShowCallContext ? (
            <div className="rounded-lg bg-muted/30 px-3 py-2">
              <p className="truncate text-sm font-medium">{snapshot.accountName}</p>
              <p className="truncate text-xs text-muted-foreground">{snapshot.opportunityName}</p>
            </div>
          ) : null}

          <section
            className="flex min-h-[220px] flex-1 flex-col justify-center gap-3 rounded-xl bg-muted/20 p-4"
            aria-label="Live coach recommendation"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="grid gap-1">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Ask this next
              </p>
              {question?.confidence !== null && question?.confidence !== undefined ? (
                <p className="text-xs text-muted-foreground">
                  {Math.round(question.confidence * 100)}% confidence
                </p>
              ) : null}
            </div>

            {question ? (
              <div className="grid gap-3">
                <p className="text-[1.65rem] font-semibold leading-tight tracking-normal">
                  "{question.question}"
                </p>
                {question.reason ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{question.reason}</p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3">
                <p className="text-[1.65rem] font-semibold leading-tight tracking-normal">Stay with the conversation.</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{snapshot.message}</p>
              </div>
            )}
          </section>
        </main>

        <footer className="grid shrink-0 gap-2 border-t bg-card p-3">
          {actionMessage ? (
            <p className="text-center text-xs text-muted-foreground" role="status" aria-live="polite">
              {actionMessage}
            </p>
          ) : null}

          {question && snapshot.canActOnQuestion ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="gap-2"
                disabled={hasPendingQuestionCommand}
                onClick={() => sendCommand("asked", question.id)}
              >
                <CheckCircle2Icon />
                Asked
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={hasPendingQuestionCommand}
                onClick={() => sendCommand("skip", question.id)}
              >
                <ArrowRightIcon />
                Skip
              </Button>
            </div>
          ) : null}

          {snapshot.canEndCall ? (
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={pendingCommand?.command === "end_call"}
              onClick={() => sendCommand("end_call")}
            >
              <SquareIcon />
              {pendingCommand?.command === "end_call" ? "Ending call" : "End call"}
            </Button>
          ) : canCloseWindow ? (
            <Button type="button" variant="outline" onClick={handleCloseWindow}>
              Close window
            </Button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}

function getCoachPopoutStatusLabel(status: LiveCoachPopoutCallStatus) {
  if (status === "starting") return "Getting ready"
  if (status === "live") return "Live coach"
  if (status === "paused") return "Paused"
  if (status === "stopping") return "Saving call"
  if (status === "ended") return "Call ended"
  if (status === "error") return "Needs attention"
  if (status === "disconnected") return "Waiting for main tab"

  return "Ready"
}

function formatPopoutTime(value: number) {
  const hours = Math.floor(value / 3600)
  const minutes = String(Math.floor((value % 3600) / 60)).padStart(2, "0")
  const seconds = String(value % 60).padStart(2, "0")
  if (hours > 0) return `${hours}:${minutes}:${seconds}`

  return `${minutes}:${seconds}`
}

export default LiveCoachPopoutWindow
