import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"

import type { Database } from "../../../src/lib/supabase/database.types"
import { getEnv, requireEnv } from "./env"
import { AppError, forbidden, notFound, unauthorized } from "./http"
import { requireActiveWorkspaceSession } from "./workspace-session"

let adminClient: SupabaseClient<Database> | null = null

export type AuthedRequestContext = {
  supabase: SupabaseClient<Database>
  token: string
  user: User
}

type LiveCallLike = Pick<Database["public"]["Tables"]["calls"]["Row"], "ended_at" | "started_at" | "status">

export function assertCallIsLive(
  call: LiveCallLike,
  options: {
    code?: string
    message?: string
  } = {}
) {
  if (call.status === "active" && call.started_at && !call.ended_at) return

  throw new AppError(
    options.code ?? "live_call_not_active",
    options.message ?? "This call is no longer live. Start a new call before using live coaching.",
    409
  )
}

export function getSupabaseAdmin() {
  if (adminClient) return adminClient

  adminClient = createClient<Database>(
    requireEnv("VITE_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return adminClient
}

function getSupabaseForUser(token: string) {
  return createClient<Database>(
    requireEnv("VITE_SUPABASE_URL"),
    requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  )
}

export async function requireUser(request: Request): Promise<AuthedRequestContext> {
  const authHeader = request.headers.get("Authorization")
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!token) {
    throw unauthorized("Missing bearer token.")
  }

  const supabase = getEnv("SUPABASE_SERVICE_ROLE_KEY")
    ? getSupabaseAdmin()
    : getSupabaseForUser(token)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error) throw unauthorized(error.message)
  if (!user) throw unauthorized("User is not signed in.")

  return {
    supabase,
    token,
    user,
  }
}

export async function authorizeWorkspace(
  userId: string,
  workspaceId: string,
  supabase: SupabaseClient<Database> = getSupabaseAdmin(),
  options: { activeCallId?: string | null; requireActiveSession?: boolean; token?: string } = {}
) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw forbidden()

  if (options.requireActiveSession === false) return

  await requireActiveWorkspaceSession({
    activeCallId: options.activeCallId ?? null,
    supabase,
    token: options.token,
    userId,
    workspaceId,
  })
}

export async function authorizeAccount(
  userId: string,
  accountId: string,
  supabase: SupabaseClient<Database> = getSupabaseAdmin(),
  options: { activeCallId?: string | null; requireActiveSession?: boolean; token?: string } = {}
) {
  const { data: account, error } = await supabase
    .from("accounts")
    .select("id,workspace_id")
    .eq("id", accountId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!account) throw notFound("Account was not found.")

  await authorizeWorkspace(userId, account.workspace_id, supabase, options)

  return account
}

export async function authorizeContact(
  userId: string,
  contactId: string,
  supabase: SupabaseClient<Database> = getSupabaseAdmin(),
  options: { activeCallId?: string | null; requireActiveSession?: boolean; token?: string } = {}
) {
  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id,workspace_id,account_id,archived_at")
    .eq("id", contactId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!contact) throw notFound("Contact was not found.")

  const account = await authorizeAccount(userId, contact.account_id, supabase, options)
  if (account.workspace_id !== contact.workspace_id) {
    throw forbidden("Contact does not belong to this account workspace.")
  }

  return contact
}

export async function authorizeOpportunity(
  userId: string,
  opportunityId: string,
  supabase: SupabaseClient<Database> = getSupabaseAdmin(),
  options: { activeCallId?: string | null; requireActiveSession?: boolean; token?: string } = {}
) {
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .select("id,workspace_id,account_id")
    .eq("id", opportunityId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!opportunity) throw notFound("Opportunity was not found.")

  await authorizeWorkspace(userId, opportunity.workspace_id, supabase, options)

  return opportunity
}

export async function authorizeCall(
  userId: string,
  callId: string,
  supabase: SupabaseClient<Database> = getSupabaseAdmin(),
  options: { activeCallId?: string | null; requireActiveSession?: boolean; token?: string } = {}
) {
  const { data: call, error } = await supabase
    .from("calls")
    .select("id,workspace_id,account_id,opportunity_id,status,started_at,ended_at")
    .eq("id", callId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!call) throw notFound("Call was not found.")

  await authorizeWorkspace(userId, call.workspace_id, supabase, {
    ...options,
    activeCallId: options.activeCallId ?? call.id,
  })

  return call
}
