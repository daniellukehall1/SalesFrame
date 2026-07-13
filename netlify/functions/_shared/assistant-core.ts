import { getEnv } from "./env"
import { AppError, badRequest } from "./http"

export const ASSISTANT_MODEL = () =>
  getEnv("OPENAI_WORKSPACE_ASSISTANT_MODEL", "gpt-5.6-terra").trim() || "gpt-5.6-terra"
export const ASSISTANT_MAX_TOOL_ROUNDS = 4
export const ASSISTANT_MAX_READ_OPERATIONS = 8
export const ASSISTANT_MAX_TOOL_OUTPUT_BYTES = 48_000
export const ASSISTANT_MESSAGE_LIMIT = 12
export const ASSISTANT_PROPOSAL_TTL_MS = 10 * 60 * 1000

export function isWorkspaceAssistantEnabled() {
  return getEnv("WORKSPACE_ASSISTANT_ENABLED", "false").trim().toLowerCase() === "true"
}

export function requireWorkspaceAssistantEnabled() {
  if (isWorkspaceAssistantEnabled()) return
  throw new AppError(
    "workspace_assistant_unavailable",
    "Conversation AI is temporarily unavailable. Your workspace actions are still available.",
    503
  )
}

export const assistantCapabilityIds = [
  "create_account",
  "update_account",
  "archive_account",
  "create_opportunity",
  "update_opportunity",
  "archive_opportunity",
  "create_contact",
  "update_contact",
  "archive_contact",
] as const

export type AssistantCapabilityId = (typeof assistantCapabilityIds)[number]
export type AssistantRisk = "standard" | "costed" | "destructive"
export type AssistantResourceType = "account" | "opportunity" | "contact"

export type AssistantRouteContext = {
  path: string
  workspaceId?: string
  accountId?: string
  opportunityId?: string
  callId?: string
}

export type AssistantActionPreview = {
  title: string
  fields: Array<{ label: string; value: string }>
}

export type AssistantProposalRequest = {
  accountId: string | null
  capabilityId: AssistantCapabilityId
  fields: Record<string, unknown>
  recordId: string | null
}

export function assertAssistantUuid(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw badRequest(`${field} is invalid.`, `assistant_${toSnakeCase(field)}_invalid`)
  }

  return value.toLowerCase()
}

export function assertAssistantOptionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined
  return assertAssistantUuid(value, field)
}

export function assertAssistantText(
  value: unknown,
  field: string,
  options: { max: number; min?: number } = { max: 8000 }
) {
  const min = options.min ?? 1
  if (typeof value !== "string") {
    throw badRequest(`${field} is invalid.`, `assistant_${toSnakeCase(field)}_invalid`)
  }

  const text = value.trim()
  if (text.length < min || text.length > options.max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    throw badRequest(`${field} is invalid.`, `assistant_${toSnakeCase(field)}_invalid`)
  }

  return text
}

export function assertAssistantSafePath(value: unknown, field = "path") {
  const path = assertAssistantText(value, field, { max: 2048 })
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(path)
  ) {
    throw badRequest(`${field} is invalid.`, `assistant_${toSnakeCase(field)}_invalid`)
  }

  return path
}

export function assertAssistantCapabilityId(value: unknown): AssistantCapabilityId {
  if (typeof value !== "string" || !assistantCapabilityIds.includes(value as AssistantCapabilityId)) {
    throw badRequest("That action is not supported.", "assistant_capability_invalid")
  }
  return value as AssistantCapabilityId
}

export function getAssistantSafeErrorCode(error: unknown) {
  if (error instanceof AppError) return normalizeSafeCode(error.code)
  return "assistant_run_failed"
}

export function normalizeSafeCode(value: string) {
  const safe = value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 120)
  return safe || "assistant_error"
}

export function toAssistantTitle(value: string) {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= 60) return compact
  return `${compact.slice(0, 57).trimEnd()}…`
}

export function toNullableString(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string") throw badRequest("Review the proposed fields.", "assistant_action_fields_invalid")
  const text = value.trim()
  if (text.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    throw badRequest("Review the proposed fields.", "assistant_action_fields_invalid")
  }
  return text || null
}

export function toRequiredString(value: unknown, max: number) {
  const text = toNullableString(value, max)
  if (!text) throw badRequest("Review the proposed fields.", "assistant_action_fields_invalid")
  return text
}

export function toOptionalDate(value: unknown) {
  const text = toNullableString(value, 10)
  if (!text) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) {
    throw badRequest("Review the proposed date.", "assistant_action_date_invalid")
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw badRequest("Review the proposed date.", "assistant_action_date_invalid")
  }
  return text
}

function toSnakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase()
}
