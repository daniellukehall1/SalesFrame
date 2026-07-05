import type { ManualQuestion } from "@/lib/salesframe-core"

export const liveCoachPopoutRoute = "/coach-popout"
export const liveCoachPopoutChannelName = "salesframe-live-coach-popout"
export const liveCoachPopoutSnapshotStorageKey = "salesframe.live-coach-popout.snapshot"
export const liveCoachPopoutCommandStorageKey = "salesframe.live-coach-popout.command"
export const liveCoachPopoutCommandAckStorageKey = "salesframe.live-coach-popout.command-ack"
export const liveCoachPopoutVersion = 1
export const liveCoachPopoutSnapshotMaxAgeMs = 45_000
export const liveCoachPopoutCommandMaxAgeMs = 15_000
export const liveCoachPopoutAcknowledgementMaxAgeMs = 15_000

export type LiveCoachPopoutCallStatus =
  | "idle"
  | "starting"
  | "live"
  | "paused"
  | "stopping"
  | "ended"
  | "error"
  | "disconnected"

const liveCoachPopoutCallStatuses: readonly LiveCoachPopoutCallStatus[] = [
  "idle",
  "starting",
  "live",
  "paused",
  "stopping",
  "ended",
  "error",
  "disconnected",
]

export type LiveCoachPopoutQuestion = Pick<
  ManualQuestion,
  "id" | "question" | "reason" | "target" | "framework" | "source"
> & {
  confidence: number | null
  isAsked: boolean
}

export type LiveCoachPopoutSnapshot = {
  type: "snapshot"
  version: typeof liveCoachPopoutVersion
  sentAt: string
  sourceId: string
  activeCallId: string
  accountName: string
  opportunityName: string
  callStatus: LiveCoachPopoutCallStatus
  coachStatus: string
  elapsedSeconds: number
  question: LiveCoachPopoutQuestion | null
  canActOnQuestion: boolean
  canEndCall: boolean
  message: string
}

export type LiveCoachPopoutCommandName = "asked" | "skip" | "end_call" | "ready"

export type LiveCoachPopoutCommand = {
  type: "command"
  version: typeof liveCoachPopoutVersion
  sentAt: string
  sourceId: string
  command: LiveCoachPopoutCommandName
  activeCallId?: string
  questionId?: string
}

export type LiveCoachPopoutCommandAcknowledgement = {
  type: "command_ack"
  version: typeof liveCoachPopoutVersion
  sentAt: string
  sourceId: string
  commandKey: string
  status: "accepted" | "ignored"
  message: string
}

export function createLiveCoachPopoutSourceId(prefix = "salesframe") {
  const randomValue =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${randomValue}`
}

export function isLiveCoachPopoutRoute(pathname = getCurrentPathname()) {
  return pathname === liveCoachPopoutRoute
}

export function readStoredLiveCoachPopoutSnapshot(): LiveCoachPopoutSnapshot | null {
  const snapshot = readStoredLiveCoachPopoutValue<LiveCoachPopoutSnapshot>(
    liveCoachPopoutSnapshotStorageKey,
    isLiveCoachPopoutSnapshot
  )

  return snapshot && isFreshLiveCoachPopoutSnapshot(snapshot) ? snapshot : null
}

export function writeStoredLiveCoachPopoutSnapshot(snapshot: LiveCoachPopoutSnapshot) {
  writeStoredLiveCoachPopoutValue(liveCoachPopoutSnapshotStorageKey, snapshot)
}

export function writeStoredLiveCoachPopoutCommand(command: LiveCoachPopoutCommand) {
  writeStoredLiveCoachPopoutValue(liveCoachPopoutCommandStorageKey, command)
}

export function writeStoredLiveCoachPopoutAcknowledgement(
  acknowledgement: LiveCoachPopoutCommandAcknowledgement
) {
  writeStoredLiveCoachPopoutValue(liveCoachPopoutCommandAckStorageKey, acknowledgement)
}

export function getLiveCoachPopoutCommandKey(command: LiveCoachPopoutCommand) {
  return [
    command.version,
    command.sourceId,
    command.sentAt,
    command.command,
    command.activeCallId ?? "",
    command.questionId ?? "",
  ].join(":")
}

export function createDisconnectedLiveCoachPopoutSnapshot(
  sourceId = createLiveCoachPopoutSourceId("popout")
): LiveCoachPopoutSnapshot {
  return {
    type: "snapshot",
    version: liveCoachPopoutVersion,
    sentAt: new Date().toISOString(),
    sourceId,
    activeCallId: "",
    accountName: "SalesFrame",
    opportunityName: "Live coach",
    callStatus: "disconnected",
    coachStatus: "idle",
    elapsedSeconds: 0,
    question: null,
    canActOnQuestion: false,
    canEndCall: false,
    message: "Open a live call in SalesFrame, then pop this coach out again.",
  }
}

export function isLiveCoachPopoutSnapshot(value: unknown): value is LiveCoachPopoutSnapshot {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<LiveCoachPopoutSnapshot>

  return (
    candidate.type === "snapshot" &&
    candidate.version === liveCoachPopoutVersion &&
    typeof candidate.sentAt === "string" &&
    typeof candidate.sourceId === "string" &&
    typeof candidate.activeCallId === "string" &&
    typeof candidate.accountName === "string" &&
    typeof candidate.opportunityName === "string" &&
    isLiveCoachPopoutCallStatus(candidate.callStatus) &&
    typeof candidate.coachStatus === "string" &&
    typeof candidate.elapsedSeconds === "number" &&
    Number.isFinite(candidate.elapsedSeconds) &&
    candidate.elapsedSeconds >= 0 &&
    typeof candidate.canActOnQuestion === "boolean" &&
    typeof candidate.canEndCall === "boolean" &&
    typeof candidate.message === "string" &&
    (candidate.question === null || isLiveCoachPopoutQuestion(candidate.question))
  )
}

export function isFreshLiveCoachPopoutSnapshot(
  snapshot: LiveCoachPopoutSnapshot,
  maxAgeMs = liveCoachPopoutSnapshotMaxAgeMs
) {
  const sentAtTime = Date.parse(snapshot.sentAt)
  if (!Number.isFinite(sentAtTime)) return false

  const ageMs = Date.now() - sentAtTime
  return ageMs >= 0 && ageMs <= maxAgeMs
}

export function isFreshLiveCoachPopoutCommand(
  command: LiveCoachPopoutCommand,
  maxAgeMs = liveCoachPopoutCommandMaxAgeMs
) {
  const sentAtTime = Date.parse(command.sentAt)
  if (!Number.isFinite(sentAtTime)) return false

  const ageMs = Date.now() - sentAtTime
  return ageMs >= 0 && ageMs <= maxAgeMs
}

export function isFreshLiveCoachPopoutAcknowledgement(
  acknowledgement: LiveCoachPopoutCommandAcknowledgement,
  maxAgeMs = liveCoachPopoutAcknowledgementMaxAgeMs
) {
  const sentAtTime = Date.parse(acknowledgement.sentAt)
  if (!Number.isFinite(sentAtTime)) return false

  const ageMs = Date.now() - sentAtTime
  return ageMs >= 0 && ageMs <= maxAgeMs
}

export function isLiveCoachPopoutCommand(value: unknown): value is LiveCoachPopoutCommand {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<LiveCoachPopoutCommand>

  return (
    candidate.type === "command" &&
    candidate.version === liveCoachPopoutVersion &&
    typeof candidate.sentAt === "string" &&
    typeof candidate.sourceId === "string" &&
    (candidate.activeCallId === undefined || typeof candidate.activeCallId === "string") &&
    (candidate.questionId === undefined || typeof candidate.questionId === "string") &&
    ["asked", "skip", "end_call", "ready"].includes(candidate.command ?? "")
  )
}

export function isLiveCoachPopoutCommandAcknowledgement(
  value: unknown
): value is LiveCoachPopoutCommandAcknowledgement {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<LiveCoachPopoutCommandAcknowledgement>

  return (
    candidate.type === "command_ack" &&
    candidate.version === liveCoachPopoutVersion &&
    typeof candidate.sentAt === "string" &&
    typeof candidate.sourceId === "string" &&
    typeof candidate.commandKey === "string" &&
    (candidate.status === "accepted" || candidate.status === "ignored") &&
    typeof candidate.message === "string"
  )
}

function isLiveCoachPopoutQuestion(value: unknown): value is LiveCoachPopoutQuestion {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<LiveCoachPopoutQuestion>

  return (
    typeof candidate.id === "string" &&
    typeof candidate.question === "string" &&
    typeof candidate.reason === "string" &&
    typeof candidate.target === "string" &&
    typeof candidate.framework === "string" &&
    typeof candidate.source === "string" &&
    (candidate.confidence === null ||
      (typeof candidate.confidence === "number" &&
        Number.isFinite(candidate.confidence) &&
        candidate.confidence >= 0 &&
        candidate.confidence <= 1)) &&
    typeof candidate.isAsked === "boolean"
  )
}

function isLiveCoachPopoutCallStatus(value: unknown): value is LiveCoachPopoutCallStatus {
  return (
    typeof value === "string" &&
    liveCoachPopoutCallStatuses.includes(value as LiveCoachPopoutCallStatus)
  )
}

function readStoredLiveCoachPopoutValue<T>(
  key: string,
  validate: (value: unknown) => value is T
): T | null {
  if (typeof window === "undefined") return null

  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) return null
    const parsedValue: unknown = JSON.parse(rawValue)

    return validate(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

function writeStoredLiveCoachPopoutValue(key: string, value: unknown) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // BroadcastChannel is the primary path. Storage can be unavailable in private browser modes.
  }
}

function getCurrentPathname() {
  return typeof window === "undefined" ? "" : window.location.pathname
}
