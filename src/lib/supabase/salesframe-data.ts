import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import { buildAccountLogoMetadata } from "@/lib/account-logo"

export type SalesFrameClient = SupabaseClient<Database>

export type WorkspaceRow = Tables<"workspaces">
export type AccountRow = Tables<"accounts">
export type OpportunityRow = Tables<"opportunities">
export type PlaybookRow = Tables<"playbooks">
export type PlaybookFieldRow = Tables<"playbook_fields">
export type OpportunityPlaybookRow = Tables<"opportunity_playbooks">
export type CallPlaybookRow = Tables<"call_playbooks">
export type CallRow = Tables<"calls">
export type CallSpeakerRow = Tables<"call_speakers">
export type TranscriptSegmentRow = Tables<"transcript_segments">
export type CallNoteRow = Tables<"call_notes">
export type OpportunityFieldEvidenceRow = Tables<"opportunity_field_evidence">
export type LiveGuidanceFeedbackRow = Tables<"live_guidance_feedback">
export type SellerResearchProfileRow = Tables<"seller_research_profiles">
export type CustomerResearchRunRow = Tables<"customer_research_runs">
export type AccountEnrichmentProfileRow = Tables<"account_enrichment_profiles">
export type AccountEnrichmentRunRow = Tables<"account_enrichment_runs">
export type PostCallOutputRow = Tables<"post_call_outputs">
export type NextCallBriefRow = Tables<"next_call_briefs">

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

export async function createWorkspace(
  values: Pick<TablesInsert<"workspaces">, "name"> &
    Partial<Pick<TablesInsert<"workspaces">, "description" | "default_currency">>,
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
    })
    .select("*")
    .single()

  return requireData(response, "Workspace was not created.")
}

export async function updateWorkspace(
  workspaceId: string,
  values: Pick<TablesUpdate<"workspaces">, "name" | "description" | "default_currency">,
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
  let query = getSupabase(client)
    .from("playbooks")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name", { ascending: true })

  query = workspaceId ? query.or(`is_system.eq.true,workspace_id.eq.${workspaceId}`) : query.eq("is_system", true)

  return requireData(await query, "No playbooks returned.")
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
  const response = await getSupabase(client)
    .from("call_speakers")
    .upsert(values, { onConflict: "call_id,label" })
    .select("*")
    .single()

  return requireData(response, "Call speaker was not saved.")
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

  const response = await getSupabase(client)
    .from("call_speakers")
    .upsert(values, { onConflict: "call_id,label" })
    .select("*")
    .single()

  return requireData(response, "Call speaker was not saved.")
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

  return `${workspaceId}/${callId}/${sanitizedFileName || "recording.webm"}`
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

  if (sizeBytes <= 0) {
    await updateCall(callId, {
      recording_error: "Recording was empty.",
      recording_mime_type: contentType,
      recording_size_bytes: 0,
      recording_status: "failed",
    }, supabase).catch(() => undefined)
    throw new Error("Recording was empty.")
  }

  const uploadResponse = await supabase.storage
    .from("call-recordings")
    .upload(path, file, {
      cacheControl: "3600",
      contentType,
      upsert: true,
    })

  if (uploadResponse.error) throw new Error(uploadResponse.error.message)

  await updateCall(callId, {
    recording_error: null,
    recording_mime_type: contentType,
    recording_size_bytes: sizeBytes,
    recording_status: "processing",
    recording_storage_path: path,
  }, supabase)

  return {
    ...uploadResponse.data,
    contentType,
    sizeBytes,
  }
}
