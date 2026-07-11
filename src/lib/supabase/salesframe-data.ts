import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"
import type { Database, Json, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import { buildAccountLogoMetadata } from "@/lib/account-logo"
import {
  getRecordingUploadRecoveryAction,
  type RecordingPointerSnapshot,
} from "@/lib/supabase/recording-upload-integrity"

export type SalesFrameClient = SupabaseClient<Database>

export type WorkspaceRow = Tables<"workspaces">
export type AccountRow = Tables<"accounts">
export type ContactRow = Tables<"contacts">
export type OpportunityRow = Tables<"opportunities">
export type OpportunityContactRow = Tables<"opportunity_contacts">
export type PlaybookRow = Tables<"playbooks">
export type PlaybookFieldRow = Tables<"playbook_fields">
export type OpportunityPlaybookRow = Tables<"opportunity_playbooks">
export type CallPlaybookRow = Tables<"call_playbooks">
export type CallRow = Tables<"calls">
export type CallContactRow = Tables<"call_contacts">
export type CallSpeakerRow = Tables<"call_speakers">
export type TranscriptSegmentRow = Tables<"transcript_segments">
export type CallNoteRow = Tables<"call_notes">
export type CallIntentLedgerRow = Tables<"call_intent_ledger">
export type OpportunityFieldEvidenceRow = Tables<"opportunity_field_evidence">
export type OpportunityStakeholderRow = Tables<"opportunity_stakeholders">
export type LiveGuidanceFeedbackRow = Tables<"live_guidance_feedback">
export type SellerResearchProfileRow = Tables<"seller_research_profiles">
export type CustomerResearchRunRow = Tables<"customer_research_runs">
export type AccountEnrichmentProfileRow = Tables<"account_enrichment_profiles">
export type AccountEnrichmentRunRow = Tables<"account_enrichment_runs">
export type ContactEnrichmentProfileRow = Tables<"contact_enrichment_profiles">
export type ContactEnrichmentRunRow = Tables<"contact_enrichment_runs">
export type PostCallOutputRow = Tables<"post_call_outputs">
export type NextCallBriefRow = Tables<"next_call_briefs">

export type OpportunityContactAssignment = Pick<
  TablesInsert<"opportunity_contacts">,
  "contact_id" | "buying_roles" | "influence" | "relationship_strength" | "stance" | "is_primary" | "notes"
>

export type CallContactAssignment = Pick<
  TablesInsert<"call_contacts">,
  "contact_id" | "attendance_status" | "is_primary"
>

const transcriptDuplicateRecoveryDelaysMs = [0, 50, 150, 300]

type SupabaseResponse<T> = {
  data: T | null
  error: { code?: string; message: string } | null
}

function getSupabase(client?: SalesFrameClient) {
  return client ?? createClient()
}

function requireData<T>({ data, error }: SupabaseResponse<T>, missingMessage: string): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error(missingMessage)

  return data
}

function applyAccountLogoMetadata<T extends TablesInsert<"accounts"> | TablesUpdate<"accounts">>(values: T): T {
  if (!("website" in values)) return values

  const logoMetadata = buildAccountLogoMetadata(values.website)

  return {
    ...values,
    logo_checked_at: values.logo_checked_at ?? logoMetadata.logo_checked_at,
    logo_domain: values.logo_domain ?? logoMetadata.logo_domain,
    logo_source: values.logo_source ?? logoMetadata.logo_source,
    logo_status: values.logo_status ?? logoMetadata.logo_status,
    logo_url: values.logo_url ?? logoMetadata.logo_url,
  }
}

function isMissingRelationError(error: SupabaseResponse<unknown>["error"]) {
  if (!error) return false

  return error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table|relation .* does not exist|schema cache/i.test(error.message)
}

function missingAccountEnrichmentStorageMessage() {
  return "Account enrichment is still getting ready for this workspace. Your account is saved, and you can try Enrich account again in a moment."
}

async function getCurrentUserId(client?: SalesFrameClient) {
  const supabase = getSupabase(client)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw new Error(userError.message)
  if (!user) throw new Error("Sign in before changing this workspace.")

  return user.id
}

export async function getCurrentUserProfile(client?: SalesFrameClient) {
  const supabase = getSupabase(client)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw new Error(userError.message)
  if (!user) return null

  const response = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (response.error) throw new Error(response.error.message)

  return response.data
}

export async function updateCurrentUserProfile(
  values: Pick<
    TablesUpdate<"user_profiles">,
    "avatar_url" | "company_name" | "email" | "full_name" | "role_title" | "timezone"
  >,
  client?: SalesFrameClient
) {
  const supabase = getSupabase(client)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw new Error(userError.message)
  if (!user) throw new Error("Sign in before updating your profile.")

  const response = await supabase
    .from("user_profiles")
    .update(values)
    .eq("id", user.id)
    .select("*")
    .single()

  return requireData(response, "Profile was not updated.")
}

export async function listWorkspaces(client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true })

  return requireData(response, "No workspaces returned.")
}

export async function resolveRecordWorkspaceId(
  resource: { id: string; type: "account" | "opportunity" | "call" },
  client?: SalesFrameClient
) {
  const table = resource.type === "account" ? "accounts" : resource.type === "opportunity" ? "opportunities" : "calls"
  const response = await getSupabase(client)
    .from(table)
    .select("workspace_id")
    .eq("id", resource.id)
    .maybeSingle()

  if (response.error) throw new Error(response.error.message)

  return response.data?.workspace_id ?? null
}

export async function createWorkspace(
  values: Pick<TablesInsert<"workspaces">, "name"> &
    Partial<Pick<TablesInsert<"workspaces">, "description" | "default_currency" | "workspace_icon">>,
  client?: SalesFrameClient
) {
  const supabase = getSupabase(client)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw new Error(userError.message)
  if (!user) throw new Error("Sign in before creating a workspace.")

  const response = await supabase
    .from("workspaces")
    .insert({
      default_currency: values.default_currency ?? "AUD",
      description: values.description ?? "Seller workspace",
      name: values.name,
      owner_user_id: user.id,
      workspace_icon: values.workspace_icon ?? "building-2",
    })
    .select("*")
    .single()

  return requireData(response, "Workspace was not created.")
}

export async function updateWorkspace(
  workspaceId: string,
  values: Pick<TablesUpdate<"workspaces">, "name" | "description" | "default_currency" | "workspace_icon">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("workspaces")
    .update(values)
    .eq("id", workspaceId)
    .select("*")
    .single()

  return requireData(response, "Workspace was not updated.")
}

export async function markWorkspaceOnboardingComplete(workspaceId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("workspaces")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", workspaceId)
    .select("*")
    .single()

  return requireData(response, "Workspace onboarding was not completed.")
}

export async function deleteWorkspace(workspaceId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("workspaces")
    .delete()
    .eq("id", workspaceId)

  if (response.error) throw new Error(response.error.message)
}

export async function listWorkspaceAccounts(workspaceId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("name", { ascending: true })

  return requireData(response, "No accounts returned.")
}

export async function listArchivedAccounts(workspaceId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false, nullsFirst: false })

  return requireData(response, "No archived accounts returned.")
}

export async function createAccount(values: TablesInsert<"accounts">, client?: SalesFrameClient) {
  const accountValues = applyAccountLogoMetadata(values)
  const response = await getSupabase(client)
    .from("accounts")
    .insert(accountValues)
    .select("*")
    .single()

  return requireData(response, "Account was not created.")
}

export async function updateAccount(
  accountId: string,
  values: TablesUpdate<"accounts">,
  client?: SalesFrameClient
) {
  const accountValues = applyAccountLogoMetadata(values)
  const response = await getSupabase(client)
    .from("accounts")
    .update(accountValues)
    .eq("id", accountId)
    .select("*")
    .single()

  return requireData(response, "Account was not updated.")
}

export async function listAccountEnrichmentProfiles(
  accountIds: string[],
  client?: SalesFrameClient
) {
  if (accountIds.length === 0) return []

  const response = await getSupabase(client)
    .from("account_enrichment_profiles")
    .select("*")
    .in("account_id", accountIds)

  if (isMissingRelationError(response.error)) return []

  return requireData(response, "Account enrichment profiles were not returned.")
}

export async function upsertAccountEnrichmentProfile(
  values: TablesInsert<"account_enrichment_profiles">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("account_enrichment_profiles")
    .upsert(values, { onConflict: "workspace_id,account_id" })
    .select("*")
    .single()

  if (isMissingRelationError(response.error)) {
    throw new Error(missingAccountEnrichmentStorageMessage())
  }

  return requireData(response, "Account enrichment profile was not saved.")
}

export async function listWorkspaceContacts(workspaceId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("full_name", { ascending: true })

  return requireData(response, "No contacts returned.")
}

export async function listArchivedWorkspaceContacts(workspaceId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false, nullsFirst: false })

  return requireData(response, "No archived contacts returned.")
}

export async function listAccountContacts(accountId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("contacts")
    .select("*")
    .eq("account_id", accountId)
    .is("archived_at", null)
    .order("full_name", { ascending: true })

  return requireData(response, "No contacts returned.")
}

export async function listArchivedAccountContacts(accountId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("contacts")
    .select("*")
    .eq("account_id", accountId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false, nullsFirst: false })

  return requireData(response, "No archived contacts returned.")
}

export async function getContact(contactId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle()

  if (response.error) throw new Error(response.error.message)

  return response.data
}

export async function createContact(values: TablesInsert<"contacts">, client?: SalesFrameClient) {
  const userId = await getCurrentUserId(client)
  const response = await getSupabase(client)
    .from("contacts")
    .insert({
      ...values,
      created_by_user_id: userId,
      updated_by_user_id: userId,
    })
    .select("*")
    .single()

  return requireData(response, "Contact was not created.")
}

export async function updateContact(
  contactId: string,
  values: TablesUpdate<"contacts">,
  client?: SalesFrameClient
) {
  const userId = await getCurrentUserId(client)
  const response = await getSupabase(client)
    .from("contacts")
    .update({
      ...values,
      updated_by_user_id: userId,
    })
    .eq("id", contactId)
    .select("*")
    .single()

  return requireData(response, "Contact was not updated.")
}

export async function archiveContact(contactId: string, reason = "", client?: SalesFrameClient) {
  const userId = await getCurrentUserId(client)
  const response = await getSupabase(client)
    .from("contacts")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: reason.trim() || null,
      updated_by_user_id: userId,
    })
    .eq("id", contactId)
    .select("*")
    .single()

  return requireData(response, "Contact was not archived.")
}

export async function restoreContact(contactId: string, client?: SalesFrameClient) {
  const userId = await getCurrentUserId(client)
  const response = await getSupabase(client)
    .from("contacts")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      updated_by_user_id: userId,
    })
    .eq("id", contactId)
    .select("*")
    .single()

  return requireData(response, "Contact was not restored.")
}

export const unarchiveContact = restoreContact

export async function listContactEnrichmentProfiles(
  contactIds: string | string[],
  client?: SalesFrameClient
) {
  const ids = Array.isArray(contactIds) ? contactIds : [contactIds]
  if (ids.length === 0) return []

  const response = await getSupabase(client)
    .from("contact_enrichment_profiles")
    .select("*")
    .in("contact_id", ids)

  return requireData(response, "Contact enrichment profiles were not returned.")
}

export async function getContactEnrichmentProfile(contactId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("contact_enrichment_profiles")
    .select("*")
    .eq("contact_id", contactId)
    .maybeSingle()

  if (response.error) throw new Error(response.error.message)

  return response.data
}

export async function listContactEnrichmentRuns(
  contactIds: string | string[],
  client?: SalesFrameClient
) {
  const ids = Array.isArray(contactIds) ? contactIds : [contactIds]
  if (ids.length === 0) return []

  const response = await getSupabase(client).rpc("get_latest_contact_enrichment_runs", {
    target_contact_ids: ids,
  })

  return requireData(response, "Contact enrichment runs were not returned.")
}

export async function listContactEnrichmentRunsForContacts(
  contactIds: string[],
  client?: SalesFrameClient
) {
  return listContactEnrichmentRuns(contactIds, client)
}

export async function deleteAccount(accountId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("accounts")
    .delete()
    .eq("id", accountId)

  if (response.error) throw new Error(response.error.message)
}

export async function archiveAccount(accountId: string, reason = "", client?: SalesFrameClient) {
  const userId = await getCurrentUserId(client)
  const response = await getSupabase(client)
    .from("accounts")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: reason.trim() || null,
    })
    .eq("id", accountId)
    .select("*")
    .single()

  return requireData(response, "Account was not archived.")
}

export async function unarchiveAccount(accountId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("accounts")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    .eq("id", accountId)
    .select("*")
    .single()

  return requireData(response, "Account was not restored.")
}

export async function listWorkspaceOpportunities(
  workspaceId: string,
  accountId?: string,
  client?: SalesFrameClient
) {
  let query = getSupabase(client)
    .from("opportunities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })

  if (accountId) {
    query = query.eq("account_id", accountId)
  }

  return requireData(await query, "No opportunities returned.")
}

export async function listArchivedOpportunities(workspaceId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("opportunities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false, nullsFirst: false })

  return requireData(response, "No archived opportunities returned.")
}

export async function createOpportunity(values: TablesInsert<"opportunities">, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("opportunities")
    .insert(values)
    .select("*")
    .single()

  return requireData(response, "Opportunity was not created.")
}

export async function updateOpportunity(
  opportunityId: string,
  values: TablesUpdate<"opportunities">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("opportunities")
    .update(values)
    .eq("id", opportunityId)
    .select("*")
    .single()

  return requireData(response, "Opportunity was not updated.")
}

export async function deleteOpportunity(opportunityId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("opportunities")
    .delete()
    .eq("id", opportunityId)

  if (response.error) throw new Error(response.error.message)
}

export async function archiveOpportunity(opportunityId: string, reason = "", client?: SalesFrameClient) {
  const userId = await getCurrentUserId(client)
  const response = await getSupabase(client)
    .from("opportunities")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: reason.trim() || null,
    })
    .eq("id", opportunityId)
    .select("*")
    .single()

  return requireData(response, "Opportunity was not archived.")
}

export async function unarchiveOpportunity(opportunityId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("opportunities")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    .eq("id", opportunityId)
    .select("*")
    .single()

  return requireData(response, "Opportunity was not restored.")
}

export async function listWorkspacePlaybooks(workspaceId?: string, client?: SalesFrameClient) {
  const supabase = getSupabase(client)
  const systemQuery = supabase
    .from("playbooks")
    .select("*")
    .eq("is_system", true)
    .order("name", { ascending: true })

  if (!workspaceId) {
    return requireData(await systemQuery, "No playbooks returned.")
  }

  const [systemResponse, workspaceResponse] = await Promise.all([
    systemQuery,
    supabase
      .from("playbooks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true }),
  ])

  return [
    ...requireData(systemResponse, "No system playbooks returned."),
    ...requireData(workspaceResponse, "No workspace playbooks returned."),
  ]
}

export async function listPlaybookFields(playbookIds: string[], client?: SalesFrameClient) {
  if (playbookIds.length === 0) return []

  const response = await getSupabase(client)
    .from("playbook_fields")
    .select("*")
    .in("playbook_id", playbookIds)
    .order("sort_order", { ascending: true })

  return requireData(response, "No playbook fields returned.")
}

export async function upsertWorkspaceCustomPlaybook(
  workspaceId: string,
  values: Pick<
    TablesInsert<"playbooks">,
    "name" | "description" | "best_for" | "evidence_standard" | "live_guidance"
  >,
  client?: SalesFrameClient
) {
  const supabase = getSupabase(client)
  const existingResponse = await supabase
    .from("playbooks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("slug", "custom")
    .maybeSingle()

  if (existingResponse.error) throw new Error(existingResponse.error.message)

  const payload: TablesInsert<"playbooks"> = {
    ...values,
    is_system: false,
    slug: "custom",
    workspace_id: workspaceId,
  }

  const response = existingResponse.data
    ? await supabase
        .from("playbooks")
        .update(payload)
        .eq("id", existingResponse.data.id)
        .select("*")
        .single()
    : await supabase.from("playbooks").insert(payload).select("*").single()

  return requireData(response, "Custom framework was not saved.")
}

export async function replacePlaybookFields(
  playbookId: string,
  fields: Array<
    Pick<TablesInsert<"playbook_fields">, "label" | "description" | "evidence_standard" | "sort_order">
  >,
  client?: SalesFrameClient
) {
  const supabase = getSupabase(client)
  const deleteResponse = await supabase.from("playbook_fields").delete().eq("playbook_id", playbookId)

  if (deleteResponse.error) throw new Error(deleteResponse.error.message)
  if (fields.length === 0) return []

  const response = await supabase
    .from("playbook_fields")
    .insert(fields.map((field) => ({ ...field, playbook_id: playbookId })))
    .select("*")
    .order("sort_order", { ascending: true })

  return requireData(response, "Custom framework fields were not saved.")
}

export async function replaceOpportunityPlaybooks(
  opportunityId: string,
  playbookIds: string[],
  client?: SalesFrameClient
) {
  const supabase = getSupabase(client)
  const deleteResponse = await supabase
    .from("opportunity_playbooks")
    .delete()
    .eq("opportunity_id", opportunityId)

  if (deleteResponse.error) throw new Error(deleteResponse.error.message)
  if (playbookIds.length === 0) return []

  const response = await supabase
    .from("opportunity_playbooks")
    .insert(playbookIds.map((playbookId) => ({ opportunity_id: opportunityId, playbook_id: playbookId })))
    .select("*")

  return requireData(response, "Opportunity playbooks were not saved.")
}

export async function listOpportunityPlaybookAssignments(
  opportunityIds: string[],
  client?: SalesFrameClient
) {
  if (opportunityIds.length === 0) return []

  const response = await getSupabase(client)
    .from("opportunity_playbooks")
    .select("*")
    .in("opportunity_id", opportunityIds)

  return requireData(response, "Opportunity playbook assignments were not returned.")
}

export async function listOpportunityContacts(
  opportunityIds: string | string[],
  client?: SalesFrameClient
) {
  const ids = Array.isArray(opportunityIds) ? opportunityIds : [opportunityIds]
  if (ids.length === 0) return []

  const response = await getSupabase(client)
    .from("opportunity_contacts")
    .select("*")
    .in("opportunity_id", ids)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })

  return requireData(response, "Opportunity contacts were not returned.")
}

export async function upsertOpportunityContact(
  values: TablesInsert<"opportunity_contacts">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("opportunity_contacts")
    .upsert(values, { onConflict: "opportunity_id,contact_id" })
    .select("*")
    .single()

  return requireData(response, "Opportunity contact was not saved.")
}

export async function updateOpportunityContact(
  relationshipId: string,
  values: TablesUpdate<"opportunity_contacts">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("opportunity_contacts")
    .update(values)
    .eq("id", relationshipId)
    .select("*")
    .single()

  return requireData(response, "Opportunity contact was not updated.")
}

export async function removeOpportunityContact(relationshipId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("opportunity_contacts")
    .delete()
    .eq("id", relationshipId)

  if (response.error) throw new Error(response.error.message)
}

export async function replaceOpportunityContacts(
  opportunityId: string,
  assignments: OpportunityContactAssignment[],
  client?: SalesFrameClient
) {
  const payload = assignments.map((assignment) => ({
    contact_id: assignment.contact_id,
    buying_roles: assignment.buying_roles ?? [],
    influence: assignment.influence ?? "unknown",
    relationship_strength: assignment.relationship_strength ?? "unknown",
    stance: assignment.stance ?? "unknown",
    is_primary: assignment.is_primary ?? false,
    notes: assignment.notes ?? null,
  })) as Json

  const response = await getSupabase(client).rpc("replace_opportunity_contacts", {
    assignments: payload,
    target_opportunity_id: opportunityId,
  })

  return requireData(response, "Opportunity contacts were not saved.")
}

export async function listWorkspaceCalls(workspaceId: string, client?: SalesFrameClient) {
  const supabase = getSupabase(client)
  const response = await supabase
    .from("calls")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("started_at", { ascending: false, nullsFirst: false })

  return withSignedRecordingUrls(requireData(response, "No calls returned."), supabase)
}

async function withSignedRecordingUrls(calls: CallRow[], supabase: SalesFrameClient) {
  return Promise.all(
    calls.map(async (call) => {
      if (!call.recording_storage_path) return call

      const signedUrlResponse = await supabase.storage
        .from("call-recordings")
        .createSignedUrl(call.recording_storage_path, 60 * 60)

      if (signedUrlResponse.error || !signedUrlResponse.data?.signedUrl) return call

      return {
        ...call,
        recording_url: signedUrlResponse.data.signedUrl,
      }
    })
  )
}

export async function createCallRecordingSignedUrl(storagePath: string, client?: SalesFrameClient) {
  const response = await getSupabase(client).storage
    .from("call-recordings")
    .createSignedUrl(storagePath, 60 * 60)

  if (response.error || !response.data?.signedUrl) {
    throw new Error(response.error?.message ?? "Recording link needs another refresh.")
  }

  return response.data.signedUrl
}

export async function listCallSpeakers(callIds: string[], client?: SalesFrameClient) {
  if (callIds.length === 0) return []

  const response = await getSupabase(client)
    .from("call_speakers")
    .select("*")
    .in("call_id", callIds)
    .order("created_at", { ascending: true })

  return requireData(response, "No call speakers returned.")
}

export async function listTranscriptSegments(callIds: string[], client?: SalesFrameClient) {
  if (callIds.length === 0) return []

  const response = await getSupabase(client)
    .from("transcript_segments")
    .select("*")
    .in("call_id", callIds)
    .order("start_ms", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })

  return requireData(response, "No transcript segments returned.")
}

export async function listCallNotes(callIds: string[], client?: SalesFrameClient) {
  if (callIds.length === 0) return []

  const response = await getSupabase(client)
    .from("call_notes")
    .select("*")
    .in("call_id", callIds)
    .order("created_at", { ascending: false })

  return requireData(response, "No call notes returned.")
}

export async function listPostCallOutputs(callIds: string[], client?: SalesFrameClient) {
  if (callIds.length === 0) return []

  const response = await getSupabase(client)
    .from("post_call_outputs")
    .select("*")
    .in("call_id", callIds)
    .order("created_at", { ascending: false })

  return requireData(response, "No post-call outputs returned.")
}

export async function listNextCallBriefs(opportunityIds: string[], client?: SalesFrameClient) {
  if (opportunityIds.length === 0) return []

  const response = await getSupabase(client)
    .from("next_call_briefs")
    .select("*")
    .in("opportunity_id", opportunityIds)
    .order("created_at", { ascending: false })

  return requireData(response, "No next-call briefs returned.")
}

export async function listOpportunityFieldEvidence(opportunityIds: string[], client?: SalesFrameClient) {
  if (opportunityIds.length === 0) return []

  const response = await getSupabase(client)
    .from("opportunity_field_evidence")
    .select("*")
    .in("opportunity_id", opportunityIds)
    .order("updated_at", { ascending: false })

  return requireData(response, "No opportunity field evidence returned.")
}

export async function insertLiveGuidanceFeedback(
  values: TablesInsert<"live_guidance_feedback">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("live_guidance_feedback")
    .insert(values)
    .select("*")
    .single()

  return requireData(response, "Live guidance feedback was not saved.")
}

export async function createCall(values: TablesInsert<"calls">, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("calls")
    .insert(values)
    .select("*")
    .single()

  return requireData(response, "Call was not created.")
}

export async function replaceCallPlaybooks(callId: string, playbookIds: string[], client?: SalesFrameClient) {
  const supabase = getSupabase(client)
  const deleteResponse = await supabase
    .from("call_playbooks")
    .delete()
    .eq("call_id", callId)

  if (deleteResponse.error) throw new Error(deleteResponse.error.message)
  if (playbookIds.length === 0) return []

  const response = await supabase
    .from("call_playbooks")
    .insert(playbookIds.map((playbookId) => ({ call_id: callId, playbook_id: playbookId })))
    .select("*")

  return requireData(response, "Call playbooks were not saved.")
}

export async function listCallContacts(callIds: string | string[], client?: SalesFrameClient) {
  const ids = Array.isArray(callIds) ? callIds : [callIds]
  if (ids.length === 0) return []

  const response = await getSupabase(client)
    .from("call_contacts")
    .select("*")
    .in("call_id", ids)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })

  return requireData(response, "Call contacts were not returned.")
}

export async function upsertCallContact(
  values: TablesInsert<"call_contacts">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("call_contacts")
    .upsert(values, { onConflict: "call_id,contact_id" })
    .select("*")
    .single()

  return requireData(response, "Call contact was not saved.")
}

export async function updateCallContact(
  relationshipId: string,
  values: TablesUpdate<"call_contacts">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("call_contacts")
    .update(values)
    .eq("id", relationshipId)
    .select("*")
    .single()

  return requireData(response, "Call contact was not updated.")
}

export async function removeCallContact(relationshipId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("call_contacts")
    .delete()
    .eq("id", relationshipId)

  if (response.error) throw new Error(response.error.message)
}

export async function replaceCallContacts(
  callId: string,
  assignments: CallContactAssignment[],
  client?: SalesFrameClient
) {
  const payload = assignments.map((assignment) => ({
    contact_id: assignment.contact_id,
    attendance_status: assignment.attendance_status ?? "expected",
    is_primary: assignment.is_primary ?? false,
  })) as Json

  const response = await getSupabase(client).rpc("replace_call_contacts", {
    assignments: payload,
    target_call_id: callId,
  })

  return requireData(response, "Call contacts were not saved.")
}

export async function updateCall(callId: string, values: TablesUpdate<"calls">, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("calls")
    .update(values)
    .eq("id", callId)
    .select("*")
    .single()

  return requireData(response, "Call was not updated.")
}

export async function deleteCall(callId: string, client?: SalesFrameClient) {
  const supabase = getSupabase(client)
  const callResponse = await supabase
    .from("calls")
    .select("recording_storage_path")
    .eq("id", callId)
    .maybeSingle()

  if (callResponse.error) throw new Error(callResponse.error.message)

  if (callResponse.data?.recording_storage_path) {
    const storageResponse = await supabase.storage
      .from("call-recordings")
      .remove([callResponse.data.recording_storage_path])

    if (storageResponse.error) throw new Error(storageResponse.error.message)
  }

  const response = await supabase
    .from("calls")
    .delete()
    .eq("id", callId)

  if (response.error) throw new Error(response.error.message)
}

export async function upsertCallSpeaker(values: TablesInsert<"call_speakers">, client?: SalesFrameClient) {
  const supabase = getSupabase(client)
  const existingSpeaker = await getCallSpeaker(values.call_id, values.label, supabase)

  if (existingSpeaker) {
    const speakerUpdates: TablesUpdate<"call_speakers"> = {}
    if ("display_name" in values) speakerUpdates.display_name = values.display_name
    if ("role" in values) speakerUpdates.role = values.role

    if (Object.keys(speakerUpdates).length === 0) return existingSpeaker

    const updateResponse = await supabase
      .from("call_speakers")
      .update(speakerUpdates)
      .eq("id", existingSpeaker.id)
      .select("*")
      .single()

    return requireData(updateResponse, "Call speaker was not updated.")
  }

  const response = await supabase
    .from("call_speakers")
    .insert(values)
    .select("*")
    .single()

  if (isDuplicateKeyError(response.error)) {
    const concurrentSpeaker = await getCallSpeaker(values.call_id, values.label, supabase)
    if (concurrentSpeaker) return concurrentSpeaker
  }

  return requireData(response, "Call speaker was not saved.")
}

export async function confirmCallSpeakerContact(
  speakerId: string,
  contactId: string | null,
  client?: SalesFrameClient
) {
  const userId = contactId ? await getCurrentUserId(client) : null
  const response = await getSupabase(client)
    .from("call_speakers")
    .update({
      contact_id: contactId,
      contact_confirmed_at: contactId ? new Date().toISOString() : null,
      contact_confirmed_by: userId,
    })
    .eq("id", speakerId)
    .select("*")
    .single()

  return requireData(response, "Speaker contact was not confirmed.")
}

export async function confirmOpportunityStakeholderContact(
  stakeholderId: string,
  contactId: string | null,
  client?: SalesFrameClient
) {
  const userId = contactId ? await getCurrentUserId(client) : null
  const response = await getSupabase(client)
    .from("opportunity_stakeholders")
    .update({
      contact_id: contactId,
      contact_confirmed_at: contactId ? new Date().toISOString() : null,
      contact_confirmed_by: userId,
    })
    .eq("id", stakeholderId)
    .select("*")
    .single()

  return requireData(response, "Stakeholder contact was not confirmed.")
}

export async function getCallSpeaker(callId: string, label: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("call_speakers")
    .select("*")
    .eq("call_id", callId)
    .eq("label", label)
    .maybeSingle()

  if (response.error) throw new Error(response.error.message)

  return response.data
}

export async function ensureCallSpeaker(values: TablesInsert<"call_speakers">, client?: SalesFrameClient) {
  const existingSpeaker = await getCallSpeaker(values.call_id, values.label, client)
  if (existingSpeaker) return existingSpeaker

  return upsertCallSpeaker(values, client)
}

export async function insertTranscriptSegment(
  values: TablesInsert<"transcript_segments">,
  client?: SalesFrameClient
) {
  const supabase = getSupabase(client)
  const existingBeforeInsert = await findExistingTranscriptSegment(values, supabase)
  if (existingBeforeInsert) {
    return updateExistingTranscriptSegmentFromInsert(existingBeforeInsert.id, values, supabase)
  }

  const response = await supabase
    .from("transcript_segments")
    .insert(values)
    .select("*")
    .single()

  if (isDuplicateKeyError(response.error)) {
    const existingSegment = await findExistingTranscriptSegmentWithRetry(values, supabase)
    if (existingSegment) {
      return updateExistingTranscriptSegmentFromInsert(existingSegment.id, values, supabase)
    }
  }

  return requireData(response, "Transcript segment was not saved.")
}

export async function updateTranscriptSegment(
  segmentId: string,
  values: TablesUpdate<"transcript_segments">,
  client?: SalesFrameClient
) {
  const supabase = getSupabase(client)
  const response = await supabase
    .from("transcript_segments")
    .update(values)
    .eq("id", segmentId)
    .select("*")
    .single()

  if (isDuplicateKeyError(response.error) && hasTranscriptIdentityValues(values)) {
    const safeValues = omitTranscriptIdentityValues(values)
    const retryResponse = await supabase
      .from("transcript_segments")
      .update(safeValues)
      .eq("id", segmentId)
      .select("*")
      .single()

    return requireData(retryResponse, "Transcript segment was not updated.")
  }

  return requireData(response, "Transcript segment was not updated.")
}

async function findExistingTranscriptSegment(
  values: TablesInsert<"transcript_segments">,
  supabase: SalesFrameClient
) {
  const sourceKind = values.audio_source_kind ?? values.speaker_source ?? null
  const transcriptionProvider = values.transcription_provider ?? null

  if (sourceKind && transcriptionProvider && values.provider_session_id && typeof values.provider_turn_index === "number") {
    const existingSegment = await selectFirstTranscriptSegment(
      supabase
      .from("transcript_segments")
      .select("*")
      .eq("call_id", values.call_id)
      .eq("audio_source_kind", sourceKind)
      .eq("transcription_provider", transcriptionProvider)
      .eq("provider_session_id", values.provider_session_id)
      .eq("provider_turn_index", values.provider_turn_index)
      .order("updated_at", { ascending: false })
      .limit(1)
    )

    if (existingSegment) return existingSegment
  }

  if (sourceKind && transcriptionProvider && values.provider_event_id) {
    const existingSegment = await selectFirstTranscriptSegment(
      supabase
      .from("transcript_segments")
      .select("*")
      .eq("call_id", values.call_id)
      .eq("audio_source_kind", sourceKind)
      .eq("transcription_provider", transcriptionProvider)
      .eq("provider_event_id", values.provider_event_id)
      .order("updated_at", { ascending: false })
      .limit(1)
    )

    if (existingSegment) return existingSegment
  }

  if (sourceKind && values.openai_segment_id) {
    const existingSegment = await selectFirstTranscriptSegment(
      supabase
      .from("transcript_segments")
      .select("*")
      .eq("call_id", values.call_id)
      .eq("audio_source_kind", sourceKind)
      .eq("openai_segment_id", values.openai_segment_id)
      .order("updated_at", { ascending: false })
      .limit(1)
    )

    if (existingSegment) return existingSegment
  }

  if (values.openai_segment_id) {
    const existingSegment = await selectFirstTranscriptSegment(
      supabase
      .from("transcript_segments")
      .select("*")
      .eq("call_id", values.call_id)
      .eq("openai_segment_id", values.openai_segment_id)
      .order("updated_at", { ascending: false })
      .limit(1)
    )

    if (existingSegment) return existingSegment
  }

  if (sourceKind && values.openai_item_id) {
    const existingSegment = await selectFirstTranscriptSegment(
      supabase
      .from("transcript_segments")
      .select("*")
      .eq("call_id", values.call_id)
      .eq("audio_source_kind", sourceKind)
      .eq("openai_item_id", values.openai_item_id)
      .order("updated_at", { ascending: false })
      .limit(1)
    )

    if (existingSegment) return existingSegment
  }

  if (values.openai_item_id) {
    const existingSegment = await selectFirstTranscriptSegment(
      supabase
      .from("transcript_segments")
      .select("*")
      .eq("call_id", values.call_id)
      .eq("openai_item_id", values.openai_item_id)
      .order("updated_at", { ascending: false })
      .limit(1)
    )

    if (existingSegment) return existingSegment
  }

  if (values.client_turn_id) {
    const existingSegment = await selectFirstTranscriptSegment(
      supabase
      .from("transcript_segments")
      .select("*")
      .eq("call_id", values.call_id)
      .eq("client_turn_id", values.client_turn_id)
      .order("updated_at", { ascending: false })
      .limit(1)
    )

    if (existingSegment) return existingSegment
  }

  return null
}

async function findExistingTranscriptSegmentWithRetry(
  values: TablesInsert<"transcript_segments">,
  supabase: SalesFrameClient
) {
  for (const delayMs of transcriptDuplicateRecoveryDelaysMs) {
    if (delayMs > 0) await wait(delayMs)

    const existingSegment = await findExistingTranscriptSegment(values, supabase)
    if (existingSegment) return existingSegment
  }

  return null
}

async function selectFirstTranscriptSegment(
  query: PromiseLike<{
    data: TranscriptSegmentRow[] | null
    error: { code?: string; message: string } | null
  }>
) {
  const response = await query

  if (response.error) throw new Error(response.error.message)

  return response.data?.[0] ?? null
}

async function updateExistingTranscriptSegmentFromInsert(
  segmentId: string,
  values: TablesInsert<"transcript_segments">,
  supabase: SalesFrameClient
) {
  const safeValues = omitTranscriptIdentityValues(values)
  const response = await supabase
    .from("transcript_segments")
    .update(safeValues)
    .eq("id", segmentId)
    .select("*")
    .single()

  return requireData(response, "Transcript segment was not updated.")
}

function isDuplicateKeyError(error: { code?: string; message: string } | null) {
  return Boolean(
    error &&
      (error.code === "23505" ||
        error.message.includes("duplicate key value violates unique constraint"))
  )
}

function wait(delayMs: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
}

function hasTranscriptIdentityValues(values: TablesUpdate<"transcript_segments">) {
  return Boolean(
    values.openai_item_id ||
      values.openai_segment_id ||
      values.client_turn_id ||
      values.provider_event_id ||
      values.provider_session_id ||
      typeof values.provider_turn_index === "number"
  )
}

function omitTranscriptIdentityValues(values: TablesUpdate<"transcript_segments">) {
  const {
    client_turn_id: _clientTurnId,
    openai_item_id: _openaiItemId,
    openai_segment_id: _openaiSegmentId,
    provider_event_id: _providerEventId,
    provider_session_id: _providerSessionId,
    provider_turn_index: _providerTurnIndex,
    transcription_provider: _transcriptionProvider,
    ...safeValues
  } = values

  return safeValues
}

export async function insertCallNote(values: TablesInsert<"call_notes">, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("call_notes")
    .insert(values)
    .select("*")
    .single()

  return requireData(response, "Call note was not saved.")
}

export async function getSellerResearchProfile(workspaceId: string, client?: SalesFrameClient) {
  const response = await getSupabase(client)
    .from("seller_research_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (response.error) throw new Error(response.error.message)

  return response.data
}

export async function listCustomerResearchRunsForAccounts(
  accountIds: string[],
  client?: SalesFrameClient
) {
  if (accountIds.length === 0) return []

  const response = await getSupabase(client)
    .from("customer_research_runs")
    .select("*")
    .in("account_id", accountIds)
    .order("created_at", { ascending: false })

  return requireData(response, "Customer research runs were not returned.")
}

export async function createCustomerResearchRun(
  values: TablesInsert<"customer_research_runs">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("customer_research_runs")
    .insert(values)
    .select("*")
    .single()

  return requireData(response, "Customer research run was not created.")
}

export async function upsertSellerResearchProfile(
  values: TablesInsert<"seller_research_profiles">,
  client?: SalesFrameClient
) {
  const response = await getSupabase(client)
    .from("seller_research_profiles")
    .upsert(values, { onConflict: "workspace_id,user_id" })
    .select("*")
    .single()

  return requireData(response, "Seller research profile was not saved.")
}

export function createCallStoragePath({
  callId,
  fileName,
  workspaceId,
}: {
  callId: string
  fileName: string
  workspaceId: string
}) {
  const sanitizedFileName = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/(^-|-$)/g, "")

  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("Secure recording storage is unavailable in this browser.")
  }

  const objectId = crypto.randomUUID()

  return `${workspaceId}/${callId}/${objectId}-${sanitizedFileName || "recording.webm"}`
}

function getRecordingContentType(file: File | Blob) {
  const baseType = file.type.split(";")[0]?.trim().toLowerCase()

  return baseType || "audio/webm"
}

function getRecordingExtension(contentType: string) {
  if (contentType.includes("mp4")) return "m4a"
  if (contentType.includes("mpeg")) return "mp3"
  if (contentType.includes("ogg")) return "ogg"
  if (contentType.includes("wav")) return "wav"
  if (contentType.includes("aac")) return "aac"
  if (contentType.includes("flac")) return "flac"

  return "webm"
}

function getRecordingFileName(file: File | Blob) {
  if (file instanceof File && file.name.trim()) return file.name

  return `recording.${getRecordingExtension(getRecordingContentType(file))}`
}

export async function uploadCallRecording({
  callId,
  file,
  workspaceId,
  client,
}: {
  callId: string
  file: File | Blob
  workspaceId: string
  client?: SalesFrameClient
}) {
  const supabase = getSupabase(client)
  const contentType = getRecordingContentType(file)
  const fileName = getRecordingFileName(file)
  const path = createCallStoragePath({ callId, fileName, workspaceId })
  const sizeBytes = file.size

  const existingPointerResponse = await supabase
    .from("calls")
    .select("recording_storage_path")
    .eq("id", callId)
    .maybeSingle()

  if (existingPointerResponse.error) throw new Error(existingPointerResponse.error.message)
  if (!existingPointerResponse.data) throw new Error("The call is no longer available for this recording.")

  const existingRecordingPath = existingPointerResponse.data.recording_storage_path
  if (existingRecordingPath) {
    throw new Error("This call already has a recording attached.")
  }

  if (sizeBytes <= 0) {
    await updateCall(callId, {
      recording_error: "Recording was empty.",
      recording_mime_type: contentType,
      recording_size_bytes: 0,
      recording_status: "failed",
    }, supabase).catch(() => undefined)
    throw new Error("Recording was empty.")
  }

  const registrationResponse = await supabase.rpc("register_call_recording_upload", {
    target_call_id: callId,
    target_storage_path: path,
    target_workspace_id: workspaceId,
  })

  if (registrationResponse.error || registrationResponse.data !== true) {
    throw new Error("SalesFrame could not secure this recording upload. Try again.")
  }

  const uploadResponse = await supabase.storage
    .from("call-recordings")
    .upload(path, file, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    })

  if (uploadResponse.error) throw new Error(uploadResponse.error.message)

  let pointerUpdateFailure = new Error("The recording upload could not be linked to its call.")
  let pointerUpdateLinked = false

  try {
    const pointerUpdateResponse = await supabase
      .from("calls")
      .update({
        recording_error: null,
        recording_mime_type: contentType,
        recording_size_bytes: sizeBytes,
        recording_status: "processing",
        recording_storage_path: path,
      })
      .eq("id", callId)
      .is("recording_storage_path", null)
      .select("recording_storage_path")
      .maybeSingle()

    if (pointerUpdateResponse.error) {
      pointerUpdateFailure = new Error(pointerUpdateResponse.error.message)
    } else {
      pointerUpdateLinked = pointerUpdateResponse.data?.recording_storage_path === path
    }
  } catch (error) {
    pointerUpdateFailure = error instanceof Error ? error : pointerUpdateFailure
  }

  if (!pointerUpdateLinked) {
    let pointerSnapshot: RecordingPointerSnapshot = { status: "read-failed" }

    try {
      const currentPointerResponse = await supabase
        .from("calls")
        .select("recording_storage_path")
        .eq("id", callId)
        .maybeSingle()

      if (!currentPointerResponse.error) {
        pointerSnapshot = currentPointerResponse.data
          ? { status: "found", path: currentPointerResponse.data.recording_storage_path }
          : { status: "call-missing" }
      }
    } catch {
      // Preserve the immutable upload when the pointer cannot be read safely.
    }

    const recoveryAction = getRecordingUploadRecoveryAction({
      pointer: pointerSnapshot,
      uploadedPath: path,
    })

    if (recoveryAction === "linked") {
      pointerUpdateLinked = true
    } else if (recoveryAction === "remove-upload") {
      const cleanupResponse = await supabase.storage
        .from("call-recordings")
        .remove([path])

      if (cleanupResponse.error) {
        throw new Error("The recording upload could not be linked to its call, and secure cleanup needs another attempt.")
      }

      throw pointerUpdateFailure
    }

    if (!pointerUpdateLinked) {
      throw new Error(
        "SalesFrame could not confirm the recording link. The uploaded audio was preserved to avoid data loss."
      )
    }
  }

  return {
    ...uploadResponse.data,
    contentType,
    sizeBytes,
  }
}
