import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("contact schema enforces tenant, account, opportunity, and call integrity", async () => {
  const migration = await read("supabase/migrations/202607100001_contact_management.sql")
  const preflight = await read("supabase/preflight/202607100001_contact_management.sql")

  for (const table of [
    "contacts",
    "opportunity_contacts",
    "call_contacts",
    "contact_enrichment_profiles",
    "contact_enrichment_runs",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
  }

  assert.match(migration, /foreign key \(workspace_id, account_id, opportunity_id\)[\s\S]*references public\.opportunities\(workspace_id, account_id, id\)/)
  assert.match(migration, /foreign key \(workspace_id, account_id, opportunity_id, call_id\)[\s\S]*references public\.calls\(workspace_id, account_id, opportunity_id, id\)/)
  assert.match(migration, /calls_workspace_account_opportunity_id_fkey/)
  assert.match(migration, /calls_workspace_account_opportunity_id_fkey[\s\S]*not valid/)
  assert.doesNotMatch(migration, /alter table public\.calls\s+validate constraint calls_workspace_account_opportunity_id_fkey/)
  assert.match(preflight, /call_row\.account_id is distinct from opportunity\.account_id/)
  assert.match(preflight, /validate constraint calls_workspace_account_opportunity_id_fkey/)
  assert.match(migration, /is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /Contacts cannot be moved between accounts or workspaces/)
  assert.match(migration, /new\.created_at = old\.created_at/)
  assert.match(migration, /new\.created_by_user_id = auth\.uid\(\);[\s\S]*new\.created_at = now\(\);[\s\S]*new\.updated_at = now\(\);/)
  assert.match(migration, /new\.created_by_user_id = old\.created_by_user_id/)
  assert.match(migration, /set_contact_relationship_audit_fields/)
  assert.match(migration, /Contact relationship IDs cannot be changed/)
  assert.match(migration, /new\.archived_by = auth\.uid\(\)/)
  assert.match(migration, /new\.created_by_user_id = old\.created_by_user_id/)
  assert.match(migration, /contacts_active_email_key/)
  assert.match(migration, /contacts_active_linkedin_key/)
  assert.match(migration, /normalize_linkedin_contact_url/)
  assert.match(migration, /btrim\(linkedin_url\) ~\* '\^https\?\:\/\/'/)
  assert.match(migration, /'\[\?#\]\.\*\$'/)
  assert.match(migration, /'\^https\?\:\/\/'/)
  assert.match(migration, /'\^\(\[a-z0-9-\]\+\\\.\)\*linkedin\\\.com\/'/)
  assert.match(migration, /opportunity_contacts_one_primary_idx/)
  assert.match(migration, /call_contacts_one_primary_idx/)
  assert.match(migration, /contact_enrichment_runs_one_active_idx/)
  assert.match(migration, /where status in \('queued', 'running'\)/)
  assert.match(migration, /contact_enrichment_profiles for select/)
  assert.match(migration, /contact_enrichment_runs for select/)
  assert.match(migration, /create or replace function public\.get_latest_contact_enrichment_runs\(target_contact_ids uuid\[\]\)/)
  assert.match(migration, /select distinct on \(run\.contact_id\)/)
  assert.match(migration, /grant execute on function public\.get_latest_contact_enrichment_runs\(uuid\[\]\) to authenticated/)
  assert.doesNotMatch(migration, /contact_enrichment_(?:profiles|runs) for all/)
})

test("contact relationships are transactional and identity links require seller confirmation", async () => {
  const migration = await read("supabase/migrations/202607100001_contact_management.sql")
  const data = await read("src/lib/supabase/salesframe-data.ts")
  const types = await read("src/lib/supabase/database.types.ts")

  assert.match(migration, /create or replace function public\.replace_opportunity_contacts/)
  assert.match(migration, /create or replace function public\.replace_call_contacts/)
  assert.match(migration, /on conflict \(opportunity_id, contact_id\) do nothing/)
  assert.match(migration, /validate_call_speaker_contact/)
  assert.match(migration, /validate_opportunity_stakeholder_contact/)
  assert.match(migration, /new\.contact_confirmed_by = auth\.uid\(\)/)
  assert.match(migration, /update public\.call_contacts[\s\S]*set attendance_status = 'attended'/)
  assert.match(migration, /contact_id is null and contact_confirmed_at is null and contact_confirmed_by is null/)
  assert.match(migration, /clear_call_speaker_contact_before_relationship_delete/)
  assert.match(migration, /clear_opportunity_stakeholder_contact_before_relationship_delete/)
  assert.match(migration, /validate_active_contact_relationship/)
  assert.match(migration, /Contact relationships cannot be moved between records/)
  assert.match(migration, /contact\.archived_at is null/)
  assert.match(migration, /on conflict \(opportunity_id, contact_id\) do update/)
  assert.match(migration, /on conflict \(call_id, contact_id\) do update/)
  assert.match(migration, /add column contact_id uuid references public\.contacts\(id\) on delete set null/)
  assert.match(migration, /alter table public\.customer_research_runs[\s\S]*add column contact_id uuid/)

  for (const helper of [
    "listAccountContacts",
    "createContact",
    "updateContact",
    "archiveContact",
    "replaceOpportunityContacts",
    "replaceCallContacts",
    "confirmCallSpeakerContact",
    "confirmOpportunityStakeholderContact",
  ]) {
    assert.match(data, new RegExp(`export (?:async function|const) ${helper}`))
  }

  assert.match(data, /rpc\("replace_opportunity_contacts"/)
  assert.match(data, /rpc\("replace_call_contacts"/)
  assert.match(data, /export async function listContactEnrichmentRunsForContacts/)
  assert.match(data, /rpc\("get_latest_contact_enrichment_runs", \{[\s\S]*target_contact_ids: ids/)
  const enrichmentRunLoader = data.slice(
    data.indexOf("export async function listContactEnrichmentRuns("),
    data.indexOf("export async function listContactEnrichmentRunsForContacts")
  )
  assert.doesNotMatch(enrichmentRunLoader, /select\("\*"\)/)
  assert.doesNotMatch(data, /export async function (?:upsertContactEnrichmentProfile|createContactEnrichmentRun|updateContactEnrichmentRun)/)
  assert.match(types, /contacts: TableDefinition</)
  assert.match(types, /opportunity_contacts: TableDefinition</)
  assert.match(types, /call_contacts: TableDefinition</)
  assert.match(types, /contact_confirmed_at: string \| null/)
  assert.match(types, /get_latest_contact_enrichment_runs: \{[\s\S]*target_contact_ids: string\[\][\s\S]*error_message: string \| null/)
  assert.match(types, /finalize_contact_enrichment_run: \{[\s\S]*target_run_id: string[\s\S]*Returns: boolean/)

  const speakerUpsert = data.slice(
    data.indexOf("export async function upsertCallSpeaker"),
    data.indexOf("export async function confirmCallSpeakerContact")
  )
  assert.match(speakerUpsert, /\.update\(speakerUpdates\)/)
  assert.match(speakerUpsert, /\.eq\("id", existingSpeaker\.id\)/)
  assert.doesNotMatch(speakerUpsert, /\.upsert\(/)
  assert.doesNotMatch(speakerUpsert, /speakerUpdates\.contact_id/)
})
