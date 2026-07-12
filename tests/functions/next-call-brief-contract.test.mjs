import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createNextCallBriefWorkDispatch,
  dispatchNextCallBriefWork,
  verifyNextCallBriefWorkDispatch,
} from "../../netlify/functions/_shared/next-call-brief-dispatch.ts"

const migrationUrl = new URL("../../supabase/migrations/202607130001_next_call_brief_v2.sql", import.meta.url)
const preflightUrl = new URL("../../supabase/preflight/202607130001_next_call_brief_v2.sql", import.meta.url)
const helperUrl = new URL("../../netlify/functions/_shared/next-call-brief.ts", import.meta.url)
const endpointUrl = new URL("../../netlify/functions/next-call-brief.ts", import.meta.url)
const evidenceUrl = new URL("../../netlify/functions/next-call-brief-evidence.ts", import.meta.url)
const applyUrl = new URL("../../netlify/functions/next-call-brief-apply.ts", import.meta.url)
const postCallUrl = new URL("../../netlify/functions/post-call-outputs.ts", import.meta.url)
const databaseTypesUrl = new URL("../../src/lib/supabase/database.types.ts", import.meta.url)
const envUrl = new URL("../../netlify/functions/_shared/env.ts", import.meta.url)
const recoveryUrl = new URL("../../netlify/functions/next-call-brief-recovery.ts", import.meta.url)
const backgroundUrl = new URL("../../netlify/functions/next-call-brief-background.ts", import.meta.url)

const [migration, preflight, helper, endpoint, evidenceEndpoint, applyEndpoint, postCall, databaseTypes, env, recovery, background] = await Promise.all([
  readFile(migrationUrl, "utf8"),
  readFile(preflightUrl, "utf8"),
  readFile(helperUrl, "utf8"),
  readFile(endpointUrl, "utf8"),
  readFile(evidenceUrl, "utf8"),
  readFile(applyUrl, "utf8"),
  readFile(postCallUrl, "utf8"),
  readFile(databaseTypesUrl, "utf8"),
  readFile(envUrl, "utf8"),
  readFile(recoveryUrl, "utf8"),
  readFile(backgroundUrl, "utf8"),
])

test("next-call v2 keeps legacy fields and adds normalized, scoped storage", () => {
  assert.match(migration, /alter table public\.next_call_briefs[\s\S]*add column if not exists workspace_id uuid/)
  assert.match(migration, /add column if not exists schema_version smallint not null default 1/)
  assert.match(migration, /add column if not exists generated_at timestamptz/)
  assert.match(migration, /generated_at = coalesce\(brief\.generated_at, brief\.created_at\)/)
  assert.match(migration, /alter column generated_at set default now\(\)/)
  assert.match(migration, /alter column generated_at set not null/)
  assert.match(migration, /create table public\.next_call_brief_attempts/)
  assert.match(migration, /create table public\.next_call_brief_refresh_requests/)
  assert.match(migration, /create table public\.next_call_brief_items/)
  assert.match(migration, /create table public\.next_call_brief_item_sources/)
  assert.match(migration, /next_call_briefs_workspace_account_opportunity_call_fkey[\s\S]*references public\.calls\(workspace_id, account_id, opportunity_id, id\)/)
  assert.match(migration, /next_call_briefs_v2_source_call_key/)
  assert.match(migration, /next_call_brief_attempts_one_active_opportunity_idx/)
  assert.match(migration, /focus_questions = legacy_questions/)
  assert.match(migration, /risk_notes = legacy_risks/)
  assert.match(migration, /missing_evidence = '\[\]'::jsonb/)
})

test("source retention preserves safe tombstones without blocking source deletion", () => {
  assert.match(migration, /references public\.calls\(workspace_id, account_id, opportunity_id, id\)[\s\S]*on delete no action/)
  assert.match(migration, /references public\.transcript_segments\(call_id, id\)[\s\S]*on delete set null \(transcript_segment_id\)/)
  assert.match(migration, /references public\.call_notes\(call_id, id\)[\s\S]*on delete set null \(call_note_id\)/)
  assert.match(migration, /references public\.opportunity_field_evidence\(opportunity_id, id\)[\s\S]*on delete set null \(opportunity_field_evidence_id\)/)
  assert.match(migration, /or transcript_segment_id is null/)
  assert.match(migration, /or call_note_id is null/)
  assert.match(migration, /source_kind = 'transcript_segment' then[\s\S]*source_call\.retention_expires_at > now\(\)[\s\S]*transcript_segment_id/)
  assert.match(migration, /detach_next_call_brief_sources_on_call_delete[\s\S]*source_call_id = null[\s\S]*transcript_segment_id = null[\s\S]*call_note_id = null/)
  assert.match(helper, /evidence\.push\(\{ \.\.\.summary, available: false \}\)/)
})

test("completion enforces evidence semantics and bounded calm output", () => {
  assert.match(migration, /question_count not between 1 and 3/)
  assert.match(migration, /watch_count > 2/)
  assert.match(migration, /jsonb_array_length[\s\S]*> 3/)
  assert.match(migration, /item_record\.basis = 'transcript' and transcript_source_count < 1/)
  assert.match(migration, /item_record\.kind = 'watch' and source_count < 1/)
  assert.match(migration, /item_record\.basis = 'inference' and source_count < 2/)
  assert.match(migration, /item_record\.basis = 'seller_context' and seller_source_count < 1/)
  assert.match(migration, /Methodology-gap guidance requires a selected weak or missing field/)
  assert.match(migration, /coalesce\(evidence\.status, 'missing'::public\.field_evidence_status\) in \('missing', 'weak'\)/)
  assert.match(migration, /speaker\.role in \('customer', 'customer_2', 'customer_3'\)/)
  assert.match(migration, /speaker\.call_id = segment\.call_id/)
  assert.match(migration, /transcript_segments_call_id_speaker_id_fkey[\s\S]*foreign key \(call_id, speaker_id\)[\s\S]*references public\.call_speakers\(call_id, id\)/)
  assert.match(preflight, /speaker\.call_id <> segment\.call_id/)
  assert.match(helper, /\.eq\("call_id", source\.source_call_id\)/)
  assert.match(helper, /requiredSentenceText\(rawResult\.outcome, 1200, 1/)
  assert.match(helper, /requiredSentenceText\(openingText, 1200, 2/)
})

test("request IDs are scoped while active attempts are shared safely", () => {
  assert.match(migration, /existing_attempt\.opportunity_id <> opportunity_record\.id/)
  assert.match(migration, /existing_attempt\.requested_by_user_id is distinct from target_user_id/)
  assert.match(migration, /Client request id is already in use/)
  assert.match(helper, /attempt\.opportunity_id !== opportunityId/)
  assert.doesNotMatch(helper, /attempt\.opportunity_id !== opportunityId \|\| attempt\.requested_by_user_id !== userId/)
  assert.match(helper, /next_call_attempt_scope_mismatch/)
  assert.match(helper, /claim_next_call_brief_refresh_request/)
  assert.match(migration, /next_call_brief_refresh_requests_rate_idx/)
})

test("authenticated access is active-session read-only and mutations are service-owned", () => {
  assert.match(migration, /drop policy if exists "Workspace members can manage next call briefs"/)
  assert.match(migration, /on public\.next_call_briefs for select[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /on public\.next_call_brief_attempts for select[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /on public\.next_call_brief_items for select[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /on public\.next_call_brief_item_sources for select[\s\S]*is_workspace_member_with_active_session\(workspace_id\)/)
  assert.match(migration, /revoke all on table public\.next_call_briefs from public, anon, authenticated/)
  assert.match(migration, /revoke all on table public\.next_call_brief_refresh_requests from public, anon, authenticated/)
  assert.match(migration, /grant select on table public\.next_call_briefs to authenticated/)
  assert.match(migration, /if auth\.role\(\) <> 'service_role'/)
  assert.match(migration, /revoke all on function public\.apply_next_call_brief_step[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.apply_next_call_brief_step[\s\S]*to service_role/)
  assert.match(preflight, /privilege_type <> 'SELECT'/)
})

test("modern functions authorize the opportunity and expose the agreed routes", () => {
  assert.match(endpoint, /authorizeOpportunity\(user\.id, opportunityId, supabase, \{ token \}\)/)
  assert.match(endpoint, /context\.waitUntil\(/)
  assert.match(endpoint, /briefId: queued\.briefId[\s\S]*status: queued\.status/)
  assert.match(endpoint, /path: "\/api\/opportunities\/:opportunityId\/next-call-brief"/)
  assert.match(evidenceEndpoint, /getBriefScope\(supabase, briefId\)[\s\S]*authorizeOpportunity/)
  assert.match(evidenceEndpoint, /path: "\/api\/next-call-briefs\/:briefId\/items\/:itemId\/evidence"/)
  assert.match(applyEndpoint, /getBriefScope\(supabase, briefId\)[\s\S]*authorizeOpportunity/)
  assert.match(applyEndpoint, /expectedOpportunityUpdatedAt/)
  assert.match(applyEndpoint, /return value\.trim\(\)/)
  assert.doesNotMatch(applyEndpoint, /new Date\(value\)\.toISOString\(\)/)
  assert.match(helper, /next_call_opportunity_changed[\s\S]*409/)
  assert.match(migration, /opportunity\.updated_at = expected_opportunity_updated_at/)
  assert.match(applyEndpoint, /path: "\/api\/next-call-briefs\/:briefId\/apply-next-step"/)
  assert.doesNotMatch(endpoint, /exports\.handler|export (?:async )?function handler/)
})

test("GET is summary-only while evidence excerpts are resolved lazily", () => {
  assert.match(helper, /export async function readNextCallBrief\(/)
  assert.match(helper, /sourceSummary\(source, row\.needs_confirmation, \{/)
  assert.match(helper, /export async function readNextCallBriefEvidence\(/)
  assert.match(helper, /\.from\("transcript_segments"\)[\s\S]*\.select\("id,speaker_id,start_ms,text,is_final,speaker_needs_review"\)/)
  assert.match(helper, /available: false/)
  assert.match(helper, /callDateIso: sourceCall\.ended_at \?\? undefined/)
  assert.match(helper, /kind: "transcript"[\s\S]*sourceLabel\(\[[\s\S]*"Customer said"/)
  assert.match(helper, /kind: "seller_note"[\s\S]*sourceLabel\(\[[\s\S]*"Seller note"/)
  assert.match(helper, /"Methodology evidence"[\s\S]*context\.fieldLabelById/)
  assert.match(helper, /Date\.parse\(sourceCall\.retention_expires_at\) > Date\.now\(\)/)
  assert.match(helper, /note\.note_type === "manual_note"/)
})

test("model source tokens are validated and post-call writes remain scoped", () => {
  assert.match(helper, /const candidate = sourceCandidates\.get\(token\)/)
  assert.match(helper, /openai_invalid_next_call_source/)
  assert.match(helper, /basis === "transcript"[\s\S]*source\.kind === "transcript_segment"/)
  assert.match(helper, /basis === "inference" && sources\.length < 2/)
  assert.match(helper, /basis === "seller_context" && !sources\.some/)
  assert.match(helper, /target_items: items as unknown as Json/)
  assert.doesNotMatch(postCall, /const nextCallBriefValues =/)
  assert.match(postCall, /apiKeyUserId: string/)
  assert.match(postCall, /userId: apiKeyUserId/)
  assert.match(postCall, /workerId: `post-call:\$\{call\.id\}:\$\{randomUUID\(\)\}`/)
  assert.match(postCall, /queueNextCallBriefGeneration/)
  assert.match(postCall, /generateNextCallBrief/)
})

test("freshness tracks material conversation context and accepted actions", () => {
  assert.match(helper, /resolve_next_call_source_call/)
  assert.match(helper, /\.select\("id,call_id,speaker_id,speaker_needs_review,start_ms,updated_at"\)[\s\S]*\.eq\("is_final", true\)/)
  assert.match(helper, /\.select\("id,call_id,role,updated_at"\)/)
  assert.match(helper, /playbookFieldRevisionResponse/)
  assert.match(helper, /refresh_next_call_brief_fingerprint/)
  assert.match(helper, /expected_opportunity_updated_at: opportunity\.updated_at/)
  assert.match(migration, /refresh_next_call_brief_fingerprint[\s\S]*opportunity\.updated_at = expected_opportunity_updated_at/)
  assert.match(migration, /resolve_next_call_source_call[\s\S]*retention_expires_at > now\(\)/)
  assert.match(helper, /\.order\("start_ms", \{ ascending: false \}\)[\s\S]*\.limit\(240\)/)
  assert.match(helper, /const transcriptSegments = \[\.\.\.\(transcriptResponse\.data \?\? \[\]\)\]\.reverse\(\)/)
  assert.match(helper, /const contextFingerprint = brief[\s\S]*\? await computeContextFingerprint[\s\S]*: null/)
})

test("next-call model selection is optional server-only configuration", () => {
  assert.match(env, /optionalServerEnvNames[\s\S]*"OPENAI_NEXT_CALL_BRIEF_MODEL"/)
  assert.match(helper, /OPENAI_NEXT_CALL_BRIEF_MODEL/)
  assert.doesNotMatch(env, /VITE_OPENAI_NEXT_CALL_BRIEF_MODEL/)
})

test("generated database types include the v2 tables and service RPCs", () => {
  assert.match(databaseTypes, /next_call_brief_attempts: TableDefinition/)
  assert.match(databaseTypes, /next_call_brief_refresh_requests: TableDefinition/)
  assert.match(databaseTypes, /next_call_brief_items: TableDefinition/)
  assert.match(databaseTypes, /next_call_brief_item_sources: TableDefinition/)
  assert.match(databaseTypes, /claim_next_call_brief_generation:/)
  assert.match(databaseTypes, /claim_next_call_brief_refresh_request:/)
  assert.match(databaseTypes, /complete_next_call_brief_generation:/)
  assert.match(databaseTypes, /apply_next_call_brief_step:/)
})

test("scheduled recovery only claims and dispatches bounded durable attempts", () => {
  assert.match(recovery, /claim_due_next_call_brief_dispatches/)
  assert.match(recovery, /batch_limit: 10/)
  assert.match(recovery, /dispatchNextCallBriefWork\(attempt\.id\)/)
  assert.doesNotMatch(recovery, /generateNextCallBrief/)
  assert.match(migration, /claim_due_next_call_brief_dispatches[\s\S]*for update skip locked/)
  assert.match(migration, /attempt\.status = 'queued'/)
  assert.match(migration, /attempt\.status = 'processing'[\s\S]*attempt\.worker_locked_at </)
  assert.match(migration, /next_call_retry_exhausted[\s\S]*attempt\.attempt_count >= 3/)
  assert.match(migration, /release_next_call_brief_generation/)
  assert.match(migration, /worker_locked_by = left\(target_worker_id, 160\)/)
  assert.match(helper, /target_worker_id: workerId/)
  assert.match(background, /verifyNextCallBriefWorkDispatch/)
  assert.match(background, /generateNextCallBrief/)
  assert.match(background, /Buffer\.byteLength\(rawBody\) > maximumDispatchBytes/)
  assert.match(background, /background: true/)
  assert.match(recovery, /schedule: "\*\/2 \* \* \* \*"/)
  assert.doesNotMatch(recovery, /path:/)
})

test("next-call background dispatch is tamper evident and stays on the active deploy", async () => {
  const previous = {
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
    OPENAI_KEY_ENCRYPTION_SECRET: process.env.OPENAI_KEY_ENCRYPTION_SECRET,
    URL: process.env.URL,
  }
  process.env.OPENAI_KEY_ENCRYPTION_SECRET = "next-call-work-test-secret-with-more-than-thirty-two-characters"
  process.env.DEPLOY_PRIME_URL = "https://deploy-preview-77--salesframe.netlify.app"
  process.env.URL = "https://salesframe.ai"
  const attemptId = "11111111-1111-4111-8111-111111111111"

  try {
    const dispatch = createNextCallBriefWorkDispatch(attemptId, 5_000)
    assert.equal(
      verifyNextCallBriefWorkDispatch({
        nowSeconds: 5_100,
        payload: dispatch.payload,
        signature: dispatch.signature,
      }).attemptId,
      attemptId
    )
    assert.throws(
      () => verifyNextCallBriefWorkDispatch({
        nowSeconds: 5_100,
        payload: { ...dispatch.payload, attemptId: "22222222-2222-4222-8222-222222222222" },
        signature: dispatch.signature,
      }),
      (error) => error?.code === "next_call_work_unverified"
    )

    let dispatchedUrl = ""
    await dispatchNextCallBriefWork(attemptId, {
      nowSeconds: 5_000,
      fetcher: async (url) => {
        dispatchedUrl = String(url)
        return new Response(null, { status: 202 })
      },
    })
    assert.equal(
      dispatchedUrl,
      "https://deploy-preview-77--salesframe.netlify.app/api/internal/next-call-brief-work"
    )
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})
