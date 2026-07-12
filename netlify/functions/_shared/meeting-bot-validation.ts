import { createHash, timingSafeEqual } from "node:crypto"

import type { MeetingPlatform } from "./meeting-bot-types"

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const googleMeetCodePattern = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i
const teamsPathPattern = /^\/(?:l\/meetup-join|meet)\//i
const preferredNameGroups = [
  ["alex", "alexander", "alexandra"],
  ["ben", "benjamin"],
  ["beth", "elizabeth", "liz"],
  ["bill", "will", "william"],
  ["bob", "rob", "robert"],
  ["becca", "rebecca"],
  ["charles", "charlie"],
  ["chris", "christopher"],
  ["dan", "daniel", "danny"],
  ["dave", "david"],
  ["ed", "edward"],
  ["jen", "jennifer"],
  ["jim", "james"],
  ["joe", "joseph"],
  ["jon", "jonathan"],
  ["kate", "katie", "katherine", "catherine"],
  ["maggie", "margaret"],
  ["matt", "matthew"],
  ["mike", "michael"],
  ["nick", "nicholas"],
  ["pat", "patricia", "patrick"],
  ["rick", "richard"],
  ["sam", "samantha", "samuel"],
  ["steve", "steven", "stephen"],
  ["tom", "thomas"],
  ["tony", "anthony"],
] as const
const preferredNameVariants = new Map<string, ReadonlySet<string>>()
for (const group of preferredNameGroups) {
  const variants = new Set<string>(group)
  for (const name of group) preferredNameVariants.set(name, variants)
}

function isHost(host: string, root: string) {
  return host === root || host.endsWith(`.${root}`)
}

function isDirectZoomPath(path: string) {
  return /^\/(?:j|s|w)\/\d{6,}(?:\/|$)/i.test(path) || /^\/wc\/\d{6,}\/join(?:\/|$)/i.test(path)
}

function isDirectWebexUrl(url: URL, path: string) {
  const normalizedPath = path.toLowerCase()

  return (
    normalizedPath.includes("/meet/") ||
    normalizedPath.includes("/join/") ||
    (normalizedPath.endsWith("/j.php") && url.searchParams.has("MTID")) ||
    (normalizedPath.includes("/webappng/sites/") && normalizedPath.includes("/meeting/"))
  )
}

export class MeetingUrlValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "MeetingUrlValidationError"
    this.code = code
  }
}

export function assertUuid(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    throw new MeetingUrlValidationError(
      `${fieldName.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_invalid`,
      `${fieldName} must be a valid identifier.`
    )
  }

  return value.trim()
}

export function parseMeetingUrl(value: unknown): { platform: MeetingPlatform; url: string } {
  if (typeof value !== "string" || !value.trim()) {
    throw new MeetingUrlValidationError("meeting_url_required", "Paste a meeting URL to continue.")
  }

  if (value.length > 4096) {
    throw new MeetingUrlValidationError("meeting_url_too_long", "That meeting URL is too long.")
  }

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new MeetingUrlValidationError("meeting_url_invalid", "Enter a valid meeting URL.")
  }

  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new MeetingUrlValidationError(
      "meeting_url_invalid",
      "Use the direct HTTPS link from Zoom, Google Meet, Microsoft Teams, or Webex."
    )
  }

  url.hash = ""
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  const path = url.pathname.replace(/\/{2,}/g, "/")

  if (host === "meet.google.com" && googleMeetCodePattern.test(path.split("/").filter(Boolean)[0] ?? "")) {
    return { platform: "google_meet", url: url.toString() }
  }

  if (
    (isHost(host, "zoom.us") || isHost(host, "zoom.com") || isHost(host, "zoomgov.com")) &&
    isDirectZoomPath(path)
  ) {
    return { platform: "zoom", url: url.toString() }
  }

  if (
    (
      host === "teams.microsoft.com" ||
      host === "teams.live.com" ||
      host === "teams.microsoft.us" ||
      host === "teams.cloud.microsoft"
    ) &&
    teamsPathPattern.test(path)
  ) {
    return { platform: "microsoft_teams", url: url.toString() }
  }

  if ((isHost(host, "webex.com") || isHost(host, "webexgov.us")) && isDirectWebexUrl(url, path)) {
    return { platform: "webex", url: url.toString() }
  }

  throw new MeetingUrlValidationError(
    "meeting_url_unsupported",
    "Use a direct Zoom, Google Meet, Microsoft Teams, or Webex meeting link."
  )
}

export function normalizePersonName(value: unknown) {
  if (typeof value !== "string") return ""

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^(?:dr|mr|mrs|ms|miss|prof)\.?\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return ""
  const normalized = value.trim().toLowerCase()

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : ""
}

export function arePersonNamesEquivalent(leftValue: unknown, rightValue: unknown) {
  const left = normalizePersonName(leftValue)
  const right = normalizePersonName(rightValue)
  if (!left || !right) return false
  if (left === right) return true

  const leftParts = left.split(" ")
  const rightParts = right.split(" ")
  if (leftParts.length !== rightParts.length || leftParts.length < 2) return false
  if (leftParts.slice(1).join(" ") !== rightParts.slice(1).join(" ")) return false

  return preferredNameVariants.get(leftParts[0])?.has(rightParts[0]) ?? false
}

export function arePreferredNamesEquivalent(leftValue: unknown, rightValue: unknown) {
  const left = normalizePersonName(leftValue).split(" ")[0] ?? ""
  const right = normalizePersonName(rightValue).split(" ")[0] ?? ""
  if (!left || !right) return false
  return left === right || (preferredNameVariants.get(left)?.has(right) ?? false)
}

export function nameSimilarity(leftValue: unknown, rightValue: unknown) {
  const left = normalizePersonName(leftValue)
  const right = normalizePersonName(rightValue)
  if (!left || !right) return 0
  if (left === right) return 1

  return jaroWinkler(left, right)
}

export type MeetingBotBufferedUtterance = {
  endMs: number | null
  eventId: string
  startMs: number | null
  text: string
}

export function orderMeetingBotUtterances(utterances: MeetingBotBufferedUtterance[]) {
  return [...utterances].sort((left, right) => {
    const leftStart = Number.isFinite(left.startMs) ? Number(left.startMs) : Number.MAX_SAFE_INTEGER
    const rightStart = Number.isFinite(right.startMs) ? Number(right.startMs) : Number.MAX_SAFE_INTEGER
    if (leftStart !== rightStart) return leftStart - rightStart
    const leftEnd = Number.isFinite(left.endMs) ? Number(left.endMs) : Number.MAX_SAFE_INTEGER
    const rightEnd = Number.isFinite(right.endMs) ? Number(right.endMs) : Number.MAX_SAFE_INTEGER
    if (leftEnd !== rightEnd) return leftEnd - rightEnd
    return left.eventId.localeCompare(right.eventId)
  })
}

export function getMeetingBotTurnCommitAt(
  speechEndedAt: string | null | undefined,
  nowMs = Date.now()
) {
  const endedAtMs = Date.parse(speechEndedAt ?? "")
  return Number.isFinite(endedAtMs)
    ? Math.max(nowMs, endedAtMs + 600)
    : nowMs + 3_000
}

function jaroWinkler(left: string, right: string) {
  if (left === right) return 1

  const matchDistance = Math.max(0, Math.floor(Math.max(left.length, right.length) / 2) - 1)
  const leftMatches = new Array<boolean>(left.length).fill(false)
  const rightMatches = new Array<boolean>(right.length).fill(false)
  let matches = 0

  for (let index = 0; index < left.length; index += 1) {
    const start = Math.max(0, index - matchDistance)
    const end = Math.min(index + matchDistance + 1, right.length)

    for (let candidateIndex = start; candidateIndex < end; candidateIndex += 1) {
      if (rightMatches[candidateIndex] || left[index] !== right[candidateIndex]) continue
      leftMatches[index] = true
      rightMatches[candidateIndex] = true
      matches += 1
      break
    }
  }

  if (matches === 0) return 0

  let transpositions = 0
  let rightIndex = 0
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    if (!leftMatches[leftIndex]) continue
    while (!rightMatches[rightIndex]) rightIndex += 1
    if (left[leftIndex] !== right[rightIndex]) transpositions += 1
    rightIndex += 1
  }

  const jaro = (
    matches / left.length +
    matches / right.length +
    (matches - transpositions / 2) / matches
  ) / 3
  let prefixLength = 0
  while (
    prefixLength < Math.min(4, left.length, right.length) &&
    left[prefixLength] === right[prefixLength]
  ) {
    prefixLength += 1
  }

  return jaro + prefixLength * 0.1 * (1 - jaro)
}

export function constantTimeTextEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest()
  const rightHash = createHash("sha256").update(right).digest()

  return timingSafeEqual(leftHash, rightHash)
}
