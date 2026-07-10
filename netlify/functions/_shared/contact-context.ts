import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../../src/lib/supabase/database.types"

const MAX_CONTACTS_FOR_COACHING = 6
const MAX_CONTACT_CONTEXT_BYTES = 4 * 1024

type ContactEnrichmentContext = {
  caveats: string
  confidence: number | null
  discoveryAngles: string
  lastEnrichedAt: string
  likelyKpis: string
  likelyPriorities: string
  professionalSummary: string
  recentSignals: string
  relevantExperience: string
  roleScope: string
}

type ContactSummaryContext = {
  attendanceStatus: string
  buyingRoles: string[]
  department: string
  influence: string
  jobTitle: string
  name: string
  preferredName: string
  relationshipStrength: string
  seniority: string
  speakerConfirmed: boolean
  stance: string
  enrichment?: ContactEnrichmentContext
}

export type CallContactCoachingContext = {
  additionalContacts: ContactSummaryContext[]
  addressingGuidance: string
  groupConversation: boolean
  primaryContact: ContactSummaryContext
  selectedCount: number
  sentCount: number
  speakerAttribution: "confirmed" | "mixed" | "unconfirmed"
}

function cleanText(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function cleanStringArray(value: unknown, limit = 4) {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const text = cleanText(item, 48)
        return text ? [text] : []
      }).slice(0, limit)
    : []
}

function cleanConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null
}

function isMissingContactSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false

  return error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    /Could not find the table|Could not find .* column|relation .* does not exist|column .* does not exist|schema cache/i.test(error.message ?? "")
}

function contactContextByteLength(value: CallContactCoachingContext) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

function fitContactContextToBudget(value: CallContactCoachingContext) {
  if (contactContextByteLength(value) <= MAX_CONTACT_CONTEXT_BYTES) return value

  const enrichment = value.primaryContact.enrichment
  if (enrichment) {
    const optionalFields: (keyof ContactEnrichmentContext)[] = [
      "caveats",
      "recentSignals",
      "relevantExperience",
      "likelyKpis",
      "likelyPriorities",
      "roleScope",
      "professionalSummary",
      "discoveryAngles",
      "lastEnrichedAt",
    ]

    for (const field of optionalFields) {
      ;(enrichment as unknown as Record<string, string | number | null>)[field] = ""
      if (contactContextByteLength(value) <= MAX_CONTACT_CONTEXT_BYTES) return value
    }

    delete value.primaryContact.enrichment
    if (contactContextByteLength(value) <= MAX_CONTACT_CONTEXT_BYTES) return value
  }

  while (value.additionalContacts.length > 0 && contactContextByteLength(value) > MAX_CONTACT_CONTEXT_BYTES) {
    value.additionalContacts.pop()
    value.sentCount = 1 + value.additionalContacts.length
  }

  if (contactContextByteLength(value) > MAX_CONTACT_CONTEXT_BYTES) {
    value.addressingGuidance = "Keep attribution generic unless the seller confirmed the speaker mapping."
    value.primaryContact.buyingRoles = value.primaryContact.buyingRoles.slice(0, 2)
    for (const field of ["department", "jobTitle", "name", "preferredName", "seniority"] as const) {
      value.primaryContact[field] = value.primaryContact[field].slice(0, 64)
    }
  }

  return value
}

export async function loadCallContactCoachingContext({
  accountId,
  callId,
  opportunityId,
  supabase,
  workspaceId,
}: {
  accountId: string
  callId: string
  opportunityId: string
  supabase: SupabaseClient<Database>
  workspaceId: string
}): Promise<CallContactCoachingContext | null> {
  const { data: callContactRows, error: callContactsError } = await supabase
    .from("call_contacts")
    .select("contact_id,is_primary,attendance_status")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("opportunity_id", opportunityId)
    .eq("call_id", callId)
    .order("is_primary", { ascending: false })
    .limit(50)

  if (isMissingContactSchemaError(callContactsError)) return null
  if (callContactsError) throw new Error(callContactsError.message)
  if (!callContactRows?.length) return null

  const contactIds = Array.from(new Set(callContactRows.map((row) => row.contact_id)))
  const [contactResponse, opportunityContactResponse, profileResponse, speakerResponse] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,full_name,preferred_name,job_title,department,seniority")
      .eq("workspace_id", workspaceId)
      .eq("account_id", accountId)
      .in("id", contactIds),
    supabase
      .from("opportunity_contacts")
      .select("contact_id,buying_roles,influence,relationship_strength,stance,is_primary")
      .eq("workspace_id", workspaceId)
      .eq("account_id", accountId)
      .eq("opportunity_id", opportunityId)
      .in("contact_id", contactIds),
    supabase
      .from("contact_enrichment_profiles")
      .select("contact_id,professional_summary,role_scope,likely_priorities,likely_kpis,relevant_experience,recent_professional_signals,discovery_angles,confidence,caveats,last_enriched_at")
      .eq("workspace_id", workspaceId)
      .eq("account_id", accountId)
      .in("contact_id", contactIds),
    supabase
      .from("call_speakers")
      .select("contact_id,contact_confirmed_at")
      .eq("call_id", callId)
      .in("contact_id", contactIds),
  ])

  for (const response of [contactResponse, opportunityContactResponse, profileResponse, speakerResponse]) {
    if (response.error && !isMissingContactSchemaError(response.error)) {
      throw new Error(response.error.message)
    }
  }

  const contactsById = new Map((contactResponse.data ?? []).map((row) => [row.id, row]))
  const opportunityContactsById = new Map(
    (opportunityContactResponse.data ?? []).map((row) => [row.contact_id, row])
  )
  const profilesById = new Map((profileResponse.data ?? []).map((row) => [row.contact_id, row]))
  const confirmedSpeakerContactIds = new Set(
    (speakerResponse.data ?? [])
      .filter((row) => Boolean(row.contact_confirmed_at))
      .map((row) => row.contact_id)
  )
  const selectedRows = callContactRows
    .filter((row) => contactsById.has(row.contact_id))
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary))
  const selectedCount = selectedRows.length
  const coachingRows = selectedRows.slice(0, MAX_CONTACTS_FOR_COACHING)

  if (!coachingRows.length) return null

  const toSummary = (row: typeof coachingRows[number], includeEnrichment: boolean): ContactSummaryContext => {
    const contact = contactsById.get(row.contact_id)!
    const relationship = opportunityContactsById.get(row.contact_id)
    const profile = profilesById.get(row.contact_id)
    const enrichment = includeEnrichment && profile
      ? {
          caveats: cleanText(profile.caveats, 220),
          confidence: cleanConfidence(profile.confidence),
          discoveryAngles: cleanText(profile.discovery_angles, 300),
          lastEnrichedAt: cleanText(profile.last_enriched_at, 40),
          likelyKpis: cleanText(profile.likely_kpis, 220),
          likelyPriorities: cleanText(profile.likely_priorities, 260),
          professionalSummary: cleanText(profile.professional_summary, 300),
          recentSignals: cleanText(profile.recent_professional_signals, 240),
          relevantExperience: cleanText(profile.relevant_experience, 220),
          roleScope: cleanText(profile.role_scope, 220),
        }
      : undefined

    return {
      attendanceStatus: cleanText(row.attendance_status, 24),
      buyingRoles: cleanStringArray(relationship?.buying_roles),
      department: cleanText(contact.department, 100),
      influence: cleanText(relationship?.influence, 24),
      jobTitle: cleanText(contact.job_title, 140),
      name: cleanText(contact.full_name, 140),
      preferredName: cleanText(contact.preferred_name, 80),
      relationshipStrength: cleanText(relationship?.relationship_strength, 24),
      seniority: cleanText(contact.seniority, 80),
      speakerConfirmed: confirmedSpeakerContactIds.has(row.contact_id),
      stance: cleanText(relationship?.stance, 24),
      ...(enrichment ? { enrichment } : {}),
    }
  }

  const confirmedCount = coachingRows.filter((row) => confirmedSpeakerContactIds.has(row.contact_id)).length
  const groupConversation = selectedCount > 1
  const context: CallContactCoachingContext = {
    additionalContacts: coachingRows.slice(1).map((row) => toSummary(row, false)),
    addressingGuidance: groupConversation && confirmedCount === 0
      ? "Address the customer group generically. Do not attribute statements or questions to a named person until the seller confirms a speaker mapping."
      : "Use a person's name only when their speaker mapping is seller-confirmed; otherwise keep attribution generic.",
    groupConversation,
    primaryContact: toSummary(coachingRows[0], true),
    selectedCount,
    sentCount: coachingRows.length,
    speakerAttribution: confirmedCount === 0
      ? "unconfirmed"
      : confirmedCount === coachingRows.length
        ? "confirmed"
        : "mixed",
  }

  return fitContactContextToBudget(context)
}

export const contactCoachingContextLimits = {
  maxBytes: MAX_CONTACT_CONTEXT_BYTES,
  maxContacts: MAX_CONTACTS_FOR_COACHING,
}
