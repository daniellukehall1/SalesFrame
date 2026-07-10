import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../../src/lib/supabase/database.types"
import { AppError, forbidden } from "./http"

export const WORKSPACE_SESSION_IDLE_TIMEOUT_OPTIONS = [3600, 14400, 28800, 86400, 604800] as const
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 3600
export const SESSION_WARNING_LEAD_SECONDS = 300
export const ABSOLUTE_TIMEOUT_SECONDS = 86400
export const DEFAULT_WARNING_AFTER_SECONDS = ABSOLUTE_TIMEOUT_SECONDS - SESSION_WARNING_LEAD_SECONDS
const ACTIVITY_WRITE_DEBOUNCE_SECONDS = 45

export type WorkspaceSessionState = "active" | "warning" | "expired"
export type WorkspaceSessionActivityType =
  | "app_load"
  | "workspace_load"
  | "workspace_switch"
  | "route_change"
  | "user_activity"
  | "data_save"
  | "file_upload"
  | "live_call_heartbeat"
  | "start_call_check"
  | "stay_signed_in"

export type WorkspaceSessionStatus = {
  absoluteDeadline: string
  expiresAt: string
  idleDeadline: string | null
  lastActivityAt: string
  now: string
  policy: {
    absoluteTimeoutSeconds: number
    idleTimeoutSeconds: number | null
    warningAfterSeconds: number
  }
  startedAt: string
  state: WorkspaceSessionState
  warningAt: string | null
}

type WorkspaceSessionPolicyRow = Database["public"]["Tables"]["workspace_session_policies"]["Row"]
type WorkspaceSessionActivityRow = Database["public"]["Tables"]["workspace_session_activity"]["Row"]
type WorkspaceSessionActivityInsert = Database["public"]["Tables"]["workspace_session_activity"]["Insert"]

export function normalizeIdleTimeoutSeconds(value: unknown): number | null {
  if (value === null || value === "never") return null
  const numericValue = typeof value === "number" ? value : Number(value)

  return (WORKSPACE_SESSION_IDLE_TIMEOUT_OPTIONS as readonly number[]).includes(numericValue)
    ? numericValue
    : DEFAULT_IDLE_TIMEOUT_SECONDS
}

export async function getWorkspaceSessionPolicy(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<WorkspaceSessionPolicyRow> {
  const { data, error } = await supabase
    .from("workspace_session_policies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data) return data

  const { data: createdPolicy, error: insertError } = await supabase
    .from("workspace_session_policies")
    .upsert({ workspace_id: workspaceId }, { onConflict: "workspace_id" })
    .select("*")
    .single()

  if (insertError) throw new Error(insertError.message)

  return createdPolicy
}

export async function updateWorkspaceSessionPolicy({
  idleTimeoutSeconds,
  supabase,
  userId,
  workspaceId,
}: {
  idleTimeoutSeconds: number | null
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  const normalizedIdleTimeoutSeconds = normalizeIdleTimeoutSeconds(idleTimeoutSeconds)
  const effectiveTimeoutSeconds = Math.min(
    normalizedIdleTimeoutSeconds ?? ABSOLUTE_TIMEOUT_SECONDS,
    ABSOLUTE_TIMEOUT_SECONDS
  )
  const warningAfterSeconds = Math.max(60, effectiveTimeoutSeconds - SESSION_WARNING_LEAD_SECONDS)

  const { data, error } = await supabase
    .from("workspace_session_policies")
    .upsert(
      {
        absolute_timeout_seconds: ABSOLUTE_TIMEOUT_SECONDS,
        idle_timeout_seconds: normalizedIdleTimeoutSeconds,
        updated_by: userId,
        warning_after_seconds: warningAfterSeconds,
        workspace_id: workspaceId,
      },
      { onConflict: "workspace_id" }
    )
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  return data
}

export async function getOrCreateWorkspaceSessionStatus({
  activeCallId,
  activityType = "app_load",
  force = false,
  supabase,
  token,
  userId,
  workspaceId,
}: {
  activeCallId?: string | null
  activityType?: WorkspaceSessionActivityType
  force?: boolean
  supabase: SupabaseClient<Database>
  token?: string
  userId: string
  workspaceId: string
}): Promise<WorkspaceSessionStatus> {
  const policy = await getWorkspaceSessionPolicy(supabase, workspaceId)
  const sessionKey = getSessionKey(userId, token)
  const existingSession = await getWorkspaceSessionActivity({ sessionKey, supabase, userId, workspaceId })
  const now = new Date()

  if (!existingSession) {
    const insertedSession = await createWorkspaceSession({
      activeCallId,
      now,
      policy,
      sessionKey,
      supabase,
      userId,
      workspaceId,
    })

    return buildWorkspaceSessionStatus({ now, policy, session: insertedSession })
  }

  const reconciledSession = await reconcileSessionExpiry({
    policy,
    session: existingSession,
    supabase,
  })
  const evaluatedSession = await expireSessionIfNeeded({
    now,
    policy,
    session: reconciledSession,
    supabase,
  })

  if (evaluatedSession.expired_at) {
    return buildWorkspaceSessionStatus({ now, policy, session: evaluatedSession })
  }

  const shouldSkipWrite =
    !force &&
    !activeCallId &&
    secondsBetween(now, new Date(evaluatedSession.last_heartbeat_at)) < ACTIVITY_WRITE_DEBOUNCE_SECONDS

  if (shouldSkipWrite) {
    return buildWorkspaceSessionStatus({ now, policy, session: evaluatedSession })
  }

  const updatedSession = await updateWorkspaceSessionActivity({
    activeCallId,
    activityType,
    now,
    policy,
    session: evaluatedSession,
    supabase,
  })

  return buildWorkspaceSessionStatus({ now, policy, session: updatedSession })
}

export async function getWorkspaceSessionStatus({
  supabase,
  token,
  userId,
  workspaceId,
}: {
  supabase: SupabaseClient<Database>
  token?: string
  userId: string
  workspaceId: string
}): Promise<WorkspaceSessionStatus> {
  const policy = await getWorkspaceSessionPolicy(supabase, workspaceId)
  const sessionKey = getSessionKey(userId, token)
  const existingSession = await getWorkspaceSessionActivity({ sessionKey, supabase, userId, workspaceId })
  const now = new Date()

  if (!existingSession) {
    const insertedSession = await createWorkspaceSession({
      now,
      policy,
      sessionKey,
      supabase,
      userId,
      workspaceId,
    })

    return buildWorkspaceSessionStatus({ now, policy, session: insertedSession })
  }

  const reconciledSession = await reconcileSessionExpiry({
    policy,
    session: existingSession,
    supabase,
  })
  const evaluatedSession = await expireSessionIfNeeded({
    now,
    policy,
    session: reconciledSession,
    supabase,
  })

  return buildWorkspaceSessionStatus({ now, policy, session: evaluatedSession })
}

export async function requireActiveWorkspaceSession({
  activeCallId,
  activityType = "workspace_load",
  supabase,
  token,
  userId,
  workspaceId,
}: {
  activeCallId?: string | null
  activityType?: WorkspaceSessionActivityType
  supabase: SupabaseClient<Database>
  token?: string
  userId: string
  workspaceId: string
}) {
  const status = await getOrCreateWorkspaceSessionStatus({
    activeCallId,
    activityType,
    supabase,
    token,
    userId,
    workspaceId,
  })

  if (status.state === "expired") {
    throw new AppError(
      "workspace_session_expired",
      "We signed you out to keep your workspace safe.",
      401
    )
  }

  return status
}

export async function requireWorkspaceOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string
) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw forbidden("Workspace owners can change this setting.")
}

function getSessionKey(userId: string, token?: string) {
  const tokenSessionId = getJwtSessionId(token)

  return tokenSessionId || userId
}

function getJwtSessionId(token?: string) {
  if (!token) return ""
  const [, payload] = token.split(".")
  if (!payload) return ""

  try {
    const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { session_id?: unknown }

    return typeof decodedPayload.session_id === "string" && decodedPayload.session_id.trim()
      ? decodedPayload.session_id.trim()
      : ""
  } catch {
    return ""
  }
}

async function getWorkspaceSessionActivity({
  sessionKey,
  supabase,
  userId,
  workspaceId,
}: {
  sessionKey: string
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  const { data, error } = await supabase
    .from("workspace_session_activity")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("session_key", sessionKey)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return data
}

async function createWorkspaceSession({
  activeCallId,
  now,
  policy,
  sessionKey,
  supabase,
  userId,
  workspaceId,
}: {
  activeCallId?: string | null
  now: Date
  policy: WorkspaceSessionPolicyRow
  sessionKey: string
  supabase: SupabaseClient<Database>
  userId: string
  workspaceId: string
}) {
  const startedAt = now.toISOString()
  const row: WorkspaceSessionActivityInsert = {
    active_call_id: activeCallId ?? null,
    active_call_started_at: activeCallId ? startedAt : null,
    expires_at: calculateExpiresAt({ activeCallId, now, policy, startedAt: now }).toISOString(),
    last_activity_at: startedAt,
    last_heartbeat_at: startedAt,
    session_key: sessionKey,
    started_at: startedAt,
    user_id: userId,
    workspace_id: workspaceId,
  }
  const { data, error } = await supabase
    .from("workspace_session_activity")
    .upsert(row, { onConflict: "workspace_id,user_id,session_key" })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  return data
}

async function expireSessionIfNeeded({
  now,
  policy,
  session,
  supabase,
}: {
  now: Date
  policy: WorkspaceSessionPolicyRow
  session: WorkspaceSessionActivityRow
  supabase: SupabaseClient<Database>
}) {
  if (session.expired_at) return session

  const absoluteDeadline = addSeconds(new Date(session.started_at), policy.absolute_timeout_seconds)
  const expiresAt = new Date(session.expires_at)
  const reason = now >= absoluteDeadline
    ? "absolute_timeout"
    : now >= expiresAt
      ? "idle_timeout"
      : null

  if (!reason) return session

  const { data, error } = await supabase
    .from("workspace_session_activity")
    .update({
      expired_at: now.toISOString(),
      expired_reason: reason,
    })
    .eq("id", session.id)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  return data
}

async function reconcileSessionExpiry({
  policy,
  session,
  supabase,
}: {
  policy: WorkspaceSessionPolicyRow
  session: WorkspaceSessionActivityRow
  supabase: SupabaseClient<Database>
}) {
  if (session.expired_at) return session

  const expectedExpiresAt = calculateExpiresAt({
    activeCallId: session.active_call_id,
    now: new Date(session.last_activity_at),
    policy,
    startedAt: new Date(session.started_at),
  })

  if (new Date(session.expires_at).getTime() === expectedExpiresAt.getTime()) return session

  const { data, error } = await supabase
    .from("workspace_session_activity")
    .update({ expires_at: expectedExpiresAt.toISOString() })
    .eq("id", session.id)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  return data
}

async function updateWorkspaceSessionActivity({
  activeCallId,
  now,
  policy,
  session,
  supabase,
}: {
  activeCallId?: string | null
  activityType: WorkspaceSessionActivityType
  now: Date
  policy: WorkspaceSessionPolicyRow
  session: WorkspaceSessionActivityRow
  supabase: SupabaseClient<Database>
}) {
  const activeCallStartedAt =
    activeCallId && !session.active_call_started_at
      ? now.toISOString()
      : session.active_call_started_at

  const { data, error } = await supabase
    .from("workspace_session_activity")
    .update({
      active_call_id: activeCallId ?? null,
      active_call_started_at: activeCallId ? activeCallStartedAt : null,
      expires_at: calculateExpiresAt({
        activeCallId,
        now,
        policy,
        startedAt: new Date(session.started_at),
      }).toISOString(),
      last_activity_at: now.toISOString(),
      last_heartbeat_at: now.toISOString(),
    })
    .eq("id", session.id)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  return data
}

function buildWorkspaceSessionStatus({
  now,
  policy,
  session,
}: {
  now: Date
  policy: WorkspaceSessionPolicyRow
  session: WorkspaceSessionActivityRow
}): WorkspaceSessionStatus {
  const startedAt = new Date(session.started_at)
  const absoluteDeadline = addSeconds(startedAt, policy.absolute_timeout_seconds)
  const idleDeadline = policy.idle_timeout_seconds === null
    ? null
    : addSeconds(new Date(session.last_activity_at), policy.idle_timeout_seconds)
  const expiresAt = new Date(session.expires_at)
  const warningAt = addSeconds(expiresAt, -SESSION_WARNING_LEAD_SECONDS)
  const state: WorkspaceSessionState = session.expired_at || now >= expiresAt || now >= absoluteDeadline
    ? "expired"
    : now >= warningAt
      ? "warning"
      : "active"

  return {
    absoluteDeadline: absoluteDeadline.toISOString(),
    expiresAt: expiresAt.toISOString(),
    idleDeadline: idleDeadline ? idleDeadline.toISOString() : null,
    lastActivityAt: session.last_activity_at,
    now: now.toISOString(),
    policy: {
      absoluteTimeoutSeconds: policy.absolute_timeout_seconds,
      idleTimeoutSeconds: policy.idle_timeout_seconds,
      warningAfterSeconds: policy.warning_after_seconds,
    },
    startedAt: session.started_at,
    state,
    warningAt: warningAt.toISOString(),
  }
}

function calculateExpiresAt({
  activeCallId,
  now,
  policy,
  startedAt,
}: {
  activeCallId?: string | null
  now: Date
  policy: WorkspaceSessionPolicyRow
  startedAt: Date
}) {
  const absoluteDeadline = addSeconds(startedAt, policy.absolute_timeout_seconds)
  const idleDeadline = policy.idle_timeout_seconds === null || activeCallId
    ? absoluteDeadline
    : addSeconds(now, policy.idle_timeout_seconds)

  return idleDeadline < absoluteDeadline ? idleDeadline : absoluteDeadline
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}

function secondsBetween(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 1000
}
