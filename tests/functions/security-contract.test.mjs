import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import ts from "typescript"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

async function loadSharedHttpModule() {
  const source = await read("netlify/functions/_shared/http.ts")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}

test("protected OpenAI functions use typed envelopes and authorization helpers", async () => {
  const customerResearch = await read("netlify/functions/customer-research.ts")
  const sharedOpenAi = await read("netlify/functions/_shared/openai.ts")
  const liveGuidance = await read("netlify/functions/live-guidance.ts")
  const liveState = await read("netlify/functions/live-state.ts")
  const postCallOutputs = await read("netlify/functions/post-call-outputs.ts")
  const deepgramToken = await read("netlify/functions/deepgram-token.ts")
  const speakerAttribution = await read("netlify/functions/speaker-attribution.ts")
  const accountEnrichment = await read("netlify/functions/account-enrichment.ts")
  const sharedSupabase = await read("netlify/functions/_shared/supabase.ts")

  assert.match(customerResearch, /authorizeAccount/)
  assert.match(customerResearch, /authorizeOpportunity/)
  assert.match(customerResearch, /authorizeCall/)
  assert.match(customerResearch, /dataResponse/)

  assert.match(liveGuidance, /authorizeAccount/)
  assert.match(liveGuidance, /authorizeOpportunity/)
  assert.match(liveGuidance, /authorizeCall/)
  assert.match(liveGuidance, /assertLiveGuidanceResult/)
  assert.match(liveGuidance, /accountProfile/)
  assert.match(liveGuidance, /profileNotes/)
  assert.match(liveGuidance, /account profile notes/)
  assert.match(liveGuidance, /buildAccountProfileContext/)
  assert.match(liveGuidance, /live_guidance_events/)
  assert.match(liveGuidance, /ui_mode: result\.uiMode/)
  assert.match(liveGuidance, /conversation_state: \{[\s\S]*questionLifecycle: result\.questionLifecycle,[\s\S]*parkedIntents: result\.parkedIntents/)
  assert.match(liveGuidance, /candidate_scores: result\.candidateScores/)
  assert.match(liveGuidance, /source_turn_ids: transcript\.map/)
  assert.match(liveGuidance, /guidance_latency_ms: guidanceLatencyMs/)
  assert.match(liveGuidance, /dataResponse/)
  assert.match(liveGuidance, /Live guidance needs another playbook intent check\./)
  assert.doesNotMatch(liveGuidance, /Live guidance could not build playbook intent clusters/)
  assert.match(liveState, /Live state needs another context check\./)
  assert.doesNotMatch(liveState, /Live state context could not be loaded/)
  assert.doesNotMatch(sharedOpenAi, /client_secrets/)
  assert.doesNotMatch(sharedOpenAi, /audio\/transcriptions/)

  assert.match(postCallOutputs, /authorizeCall/)
  assert.match(postCallOutputs, /assertPostCallResult/)
  assert.match(postCallOutputs, /live_guidance_events/)
  assert.match(postCallOutputs, /parkedIntents/)
  assert.match(postCallOutputs, /intentionally parked because the conversation moved on/)
  assert.match(postCallOutputs, /dataResponse/)

  assert.match(deepgramToken, /authorizeCall/)
  assert.match(deepgramToken, /callId is required/)
  assert.match(deepgramToken, /dataResponse/)
  assert.match(deepgramToken, /DEEPGRAM_API_KEY/)

  assert.match(speakerAttribution, /authorizeCall/)
  assert.match(speakerAttribution, /segmentText is required/)
  assert.match(speakerAttribution, /salesframe_speaker_attribution/)
  assert.match(speakerAttribution, /dataResponse/)

  assert.match(accountEnrichment, /authorizeAccount/)
  assert.match(accountEnrichment, /getDecryptedOpenAiKey/)
  assert.match(accountEnrichment, /account_enrichment_profiles/)
  assert.match(accountEnrichment, /account_enrichment_runs/)
  assert.match(accountEnrichment, /account_enrichment_storage_missing/)
  assert.match(accountEnrichment, /Account enrichment is still getting ready for this workspace/)
  assert.doesNotMatch(accountEnrichment, /Customer research is still getting ready/)
  assert.doesNotMatch(accountEnrichment, /Apply the latest Supabase migration/)
  assert.doesNotMatch(accountEnrichment, /being prepared/)
  assert.match(accountEnrichment, /function normalizeEmployeeCountCoreField/)
  assert.match(accountEnrichment, /function normalizeEmployeeNumberMatch/)
  assert.match(accountEnrichment, /valueHasNonEmployeeScaleSignal/)
  assert.match(accountEnrichment, /valueLooksLikeAudienceScale/)
  assert.match(accountEnrichment, /Rejected for employee count because the source describes users, customers, revenue, market scale, or another non-workforce metric rather than headcount/)
  assert.match(accountEnrichment, /Rejected for employee count because the value could not be normalized to a plain workforce number/)
  assert.match(accountEnrichment, /For employeeCount, return only a plain numeric workforce headcount value as digits/)
  assert.match(accountEnrichment, /employeeCount must be employee\/headcount\/workforce only and must be digits only/)
  assert.match(accountEnrichment, /callOpenAiWebSearchJson/)
  assert.match(accountEnrichment, /dataResponse/)

  assert.match(sharedSupabase, /getEnv\("SUPABASE_SERVICE_ROLE_KEY"\)/)
  assert.match(sharedSupabase, /getSupabaseForUser\(token\)/)
  assert.match(sharedSupabase, /VITE_SUPABASE_PUBLISHABLE_KEY/)
  assert.match(sharedSupabase, /Authorization: `Bearer \$\{token\}`/)
  assert.match(sharedSupabase, /supabase: SupabaseClient<Database> = getSupabaseAdmin\(\)/)
})

test("post-call outputs run a speaker correction pass before generation", async () => {
  const postCallOutputs = await read("netlify/functions/post-call-outputs.ts")
  const migration = await read("supabase/migrations/202606270006_speaker_attribution.sql")

  assert.match(postCallOutputs, /salesframe_speaker_correction/)
  assert.match(postCallOutputs, /post_call_correction/)
  assert.match(postCallOutputs, /Customer 3/)
  assert.match(migration, /speaker_confidence/)
  assert.match(migration, /speaker_needs_review/)
  assert.match(migration, /customer_3/)
})

test("shared HTTP errors use structured codes and expected statuses", async () => {
  const http = await read("netlify/functions/_shared/http.ts")
  const functionsClient = await read("src/lib/server-functions.ts")
  const browserSupabaseClient = await read("src/lib/supabase/client.ts")

  assert.match(http, /class AppError/)
  assert.match(http, /code: appError\.code/)
  assert.match(http, /"Cache-Control": "no-store"/)
  assert.match(http, /"Content-Type": "application\/json"/)
  assert.match(http, /"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"/)
  assert.match(http, /"Referrer-Policy": "strict-origin-when-cross-origin"/)
  assert.match(http, /"Strict-Transport-Security": "max-age=31536000; includeSubDomains"/)
  assert.match(http, /"X-Content-Type-Options": "nosniff"/)
  assert.match(http, /"X-Frame-Options": "DENY"/)
  assert.match(http, /badRequest/)
  assert.match(http, /unauthorized/)
  assert.match(http, /forbidden/)
  assert.match(http, /notFound/)
  assert.match(http, /tooManyRequests/)
  assert.match(http, /rate_limit_exceeded/)
  assert.match(http, /429/)
  assert.match(http, /server_configuration_missing/)
  assert.match(http, /SalesFrame's AI setup needs attention\. Contact support if this keeps happening\./)
  assert.doesNotMatch(http, /not configured/)
  assert.match(http, /new AppError\("server_error", defaultMessage\)/)
  assert.doesNotMatch(http, /new AppError\("server_error", error instanceof Error \? error\.message/)
  assert.match(http, /getPublicErrorMessage/)
  assert.match(http, /getMissingContextMessage/)
  assert.match(http, /technicalErrorPatterns/)
  assert.match(http, /duplicate key value violates/)
  assert.match(http, /parameter is not supported/)
  assert.match(http, /SalesFrame needs another moment to prepare this\. Try again in a moment\./)
  assert.match(http, /getPublicAiProviderMessage/)
  assert.match(http, /The connected OpenAI key did not work/)
  assert.match(http, /connected OpenAI key needs billing or quota attention/)
  assert.match(http, /The AI is busy right now/)
  assert.match(http, /SalesFrame's live AI model is not available right now/)
  assert.match(http, /SalesFrame is taking longer than expected\. Give it a moment/)
  assert.doesNotMatch(http, /OpenAI is receiving too many requests at once/)
  assert.doesNotMatch(http, /The selected OpenAI model is not available/)
  assert.match(http, /isMissingServerConfiguration/)
  assert.match(browserSupabaseClient, /SalesFrame needs the workspace connection before it can continue\. Contact support if this keeps happening\./)
  assert.doesNotMatch(browserSupabaseClient, /workspace service connection/)
  assert.doesNotMatch(browserSupabaseClient, /SalesFrame could not connect to the workspace service/)
  assert.doesNotMatch(browserSupabaseClient, /Missing Supabase environment variables/)
  assert.match(functionsClient, /async function readFunctionPayload/)
  assert.match(functionsClient, /await response\.text\(\)/)
  assert.match(functionsClient, /JSON\.parse\(text\)/)
  assert.match(functionsClient, /function getFunctionErrorMessage/)
  assert.doesNotMatch(functionsClient, /await response\.json\(\)/)
})

test("shared HTTP error envelopes sanitize internal database and provider messages", async () => {
  const { badRequest, errorResponse, getPublicErrorMessageForError, upstreamFailure } = await loadSharedHttpModule()

  const databaseResponse = errorResponse(
    new Error('duplicate key value violates unique constraint "transcript_segments_call_source_openai_segment_unique_idx"')
  )
  const databasePayload = await databaseResponse.json()

  assert.equal(databaseResponse.status, 500)
  assert.equal(databasePayload.error.code, "server_error")
  assert.equal(databasePayload.error.message, "SalesFrame needs another moment with that request. Try again shortly.")
  assert.match(databasePayload.error.traceId, /^sf_/)
  assert.equal(databaseResponse.headers.get("X-SalesFrame-Trace-Id"), databasePayload.error.traceId)

  const providerResponse = errorResponse(
    upstreamFailure("The 'delay' parameter is not supported for this model.", "openai_request_failed")
  )
  const providerPayload = await providerResponse.json()

  assert.equal(providerResponse.status, 502)
  assert.equal(providerPayload.error.code, "openai_request_failed")
  assert.equal(providerPayload.error.message, "SalesFrame needs another moment to prepare this. Try again in a moment.")

  const quotaResponse = errorResponse(
    upstreamFailure("insufficient_quota: You exceeded your current quota.", "openai_quota_exceeded")
  )
  const quotaPayload = await quotaResponse.json()

  assert.equal(quotaResponse.status, 502)
  assert.equal(quotaPayload.error.code, "openai_quota_exceeded")
  assert.equal(
    quotaPayload.error.message,
    "The connected OpenAI key needs billing or quota attention. Check it in Settings, then try again."
  )

  const rateLimitResponse = errorResponse(
    upstreamFailure("Rate limit reached for requests.", "openai_rate_limit")
  )
  const rateLimitPayload = await rateLimitResponse.json()

  assert.equal(rateLimitResponse.status, 502)
  assert.equal(rateLimitPayload.error.code, "openai_rate_limit")
  assert.equal(rateLimitPayload.error.message, "The AI is busy right now. Wait a moment, then try again.")

  const modelResponse = errorResponse(
    upstreamFailure("The model `gpt-example` does not exist.", "openai_model_error")
  )
  const modelPayload = await modelResponse.json()

  assert.equal(modelResponse.status, 502)
  assert.equal(modelPayload.error.code, "openai_model_error")
  assert.equal(modelPayload.error.message, "SalesFrame's live AI model is not available right now. Contact support if this keeps happening.")

  const htmlPlatformResponse = errorResponse(
    upstreamFailure("<!doctype html><html><body>Bad Gateway</body></html>", "openai_gateway_html")
  )
  const htmlPlatformPayload = await htmlPlatformResponse.json()

  assert.equal(htmlPlatformResponse.status, 502)
  assert.equal(htmlPlatformPayload.error.code, "openai_gateway_html")
  assert.equal(htmlPlatformPayload.error.message, "SalesFrame needs another moment to prepare this. Try again in a moment.")

  const runtimeResponse = errorResponse(new Error("TypeError: Cannot read properties of undefined (reading 'id')\nstack trace"))
  const runtimePayload = await runtimeResponse.json()

  assert.equal(runtimeResponse.status, 500)
  assert.equal(runtimePayload.error.code, "server_error")
  assert.equal(runtimePayload.error.message, "SalesFrame needs another moment with that request. Try again shortly.")

  const validationResponse = errorResponse(badRequest("workspaceId is required.", "workspace_id_required"))
  const validationPayload = await validationResponse.json()

  assert.equal(validationResponse.status, 400)
  assert.equal(validationPayload.error.code, "workspace_id_required")
  assert.equal(validationPayload.error.message, "Choose a workspace before continuing.")
  assert.match(validationPayload.error.traceId, /^sf_/)

  assert.equal(
    getPublicErrorMessageForError(
      new Error('duplicate key value violates unique constraint "accounts_workspace_name_key"'),
      "Row needs review before it can be imported."
    ),
    "Row needs review before it can be imported."
  )
  assert.equal(
    getPublicErrorMessageForError(new Error("Choose a duplicate account before updating this row."), "Row needs review before it can be imported."),
    "Choose a duplicate account before updating this row."
  )
})

test("expensive AI functions enforce authenticated rate limits", async () => {
  const rateLimit = await read("netlify/functions/_shared/rate-limit.ts")
  const customerResearch = await read("netlify/functions/customer-research.ts")
  const accountEnrichment = await read("netlify/functions/account-enrichment.ts")
  const sellerDomainResearch = await read("netlify/functions/seller-domain-research.ts")
  const liveGuidance = await read("netlify/functions/live-guidance.ts")
  const liveState = await read("netlify/functions/live-state.ts")
  const speakerAttribution = await read("netlify/functions/speaker-attribution.ts")
  const deepgramToken = await read("netlify/functions/deepgram-token.ts")
  const postCallOutputs = await read("netlify/functions/post-call-outputs.ts")
  const smokeChecklist = await read("docs/production-smoke-checklist.md")

  assert.match(rateLimit, /export function assertRateLimit/)
  assert.match(rateLimit, /tooManyRequests/)
  assert.match(rateLimit, /maxBuckets = 5000/)
  assert.match(rateLimit, /cleanupExpiredBuckets/)

  for (const source of [
    customerResearch,
    accountEnrichment,
    sellerDomainResearch,
    liveGuidance,
    liveState,
    speakerAttribution,
    deepgramToken,
    postCallOutputs,
  ]) {
    assert.match(source, /assertRateLimit/)
    assert.match(source, /requireUser\(request\)/)
  }

  assert.match(liveState, /authorizeCall\(user\.id, payload\.callId\)/)
  assert.match(liveState, /authorizeAccount\(user\.id, payload\.accountId\)/)
  assert.match(liveState, /authorizeOpportunity\(user\.id, payload\.opportunityId\)/)
  assert.match(liveState, /buildLiveStateContext/)
  assert.match(liveState, /liveStateContext/)
  assert.match(liveState, /Do not expose database identifiers/)
  assert.doesNotMatch(liveState, /input: JSON\.stringify\(\{[\s\S]*account,[\s\S]*call,[\s\S]*opportunity,/)
  assert.match(deepgramToken, /authorizeCall\(user\.id, payload\.callId\)/)
  assert.match(deepgramToken, /DEEPGRAM_API_KEY/)
  assert.match(deepgramToken, /https:\/\/api\.deepgram\.com\/v1\/auth\/grant/)
  assert.match(deepgramToken, /wss:\/\/api\.deepgram\.com\/v2\/listen/)
  assert.match(deepgramToken, /model", config\.model/)
  assert.match(deepgramToken, /diarize_model", config\.diarizeModel/)
  assert.match(deepgramToken, /eager_eot_threshold/)
  assert.match(deepgramToken, /eot_threshold/)
  assert.doesNotMatch(deepgramToken, /VITE_DEEPGRAM/)

  assert.match(customerResearch, /name: "customer research"/)
  assert.match(accountEnrichment, /name: "account enrichment"/)
  assert.match(sellerDomainResearch, /name: "seller research"/)
  assert.match(liveGuidance, /name: "live guidance"/)
  assert.match(liveState, /name: "live state"/)
  assert.match(speakerAttribution, /name: "speaker attribution"/)
  assert.match(deepgramToken, /name: "deepgram transcription setup"/)
  assert.match(postCallOutputs, /name: "post-call generation"/)
  assert.match(smokeChecklist, /Repeated AI requests are throttled with `429`/)
})

test("environment readiness endpoint requires an authenticated user", async () => {
  const envCheck = await read("netlify/functions/env-check.ts")

  assert.match(envCheck, /requireUser\(request\)/)
  assert.match(envCheck, /dataResponse/)
})

test("retention cleanup only accepts scheduled POST payloads before service-role work", async () => {
  const retentionCleanup = await read("netlify/functions/retention-cleanup.ts")

  assert.match(retentionCleanup, /methodNotAllowed/)
  assert.match(retentionCleanup, /readJson<ScheduledCleanupPayload>/)
  assert.match(retentionCleanup, /function assertScheduledPayload/)
  assert.match(retentionCleanup, /invalid_scheduled_cleanup_request/)
  assert.match(retentionCleanup, /if \(request\.method !== "POST"\) throw methodNotAllowed\(\)/)
  assert.ok(retentionCleanup.indexOf("assertScheduledPayload") < retentionCleanup.indexOf("const supabase = getSupabaseAdmin()"))
  assert.match(retentionCleanup, /method: \["POST"\]/)
  assert.match(retentionCleanup, /schedule: "@daily"/)
})

test("OpenAI helper supports strict structured output schemas", async () => {
  const openai = await read("netlify/functions/_shared/openai.ts")

  assert.match(openai, /type: "json_schema"/)
  assert.match(openai, /callOpenAiWebSearchJson/)
  assert.match(openai, /type: "web_search"/)
  assert.match(openai, /tool_choice: useWebSearch \? "required" : undefined/)
  assert.match(openai, /web_search_call\.action\.sources/)
  assert.doesNotMatch(openai, /web_search_preview/)
  assert.match(openai, /schemaName/)
  assert.match(openai, /strictSchema/)
  assert.match(openai, /async function readOpenAiPayload/)
  assert.match(openai, /await response\.text\(\)/)
  assert.match(openai, /function getOpenAiErrorMessage/)
  assert.doesNotMatch(openai, /OPENAI_REALTIME_TRANSCRIPTION_MODEL/)
  assert.doesNotMatch(openai, /OPENAI_TRANSCRIPTION_MODEL/)
  assert.doesNotMatch(openai, /OPENAI_DIARIZATION_MODEL/)
  assert.doesNotMatch(openai, /gpt-realtime-whisper/)
  assert.doesNotMatch(openai, /gpt-4o-transcribe-diarize/)
  assert.doesNotMatch(openai, /\/v1\/realtime\/client_secrets/)
  assert.doesNotMatch(openai, /\/v1\/audio\/transcriptions/)
  assert.doesNotMatch(openai, /type: "transcription"/)
  assert.doesNotMatch(openai, /input_audio_transcription/)
  assert.doesNotMatch(openai, /await response\.json\(\)/)
})

test("OpenAI keys are scoped to the active workspace", async () => {
  const openaiKeyFunction = await read("netlify/functions/openai-key.ts")
  const openaiKeyHelper = await read("netlify/functions/_shared/openai-key.ts")
  const liveGuidance = await read("netlify/functions/live-guidance.ts")
  const sellerDomainResearch = await read("netlify/functions/seller-domain-research.ts")
  const functionsClient = await read("src/lib/server-functions.ts")
  const types = await read("src/lib/supabase/database.types.ts")
  const migration = await read("supabase/migrations/202606300001_workspace_scoped_ai_settings.sql")

  assert.match(openaiKeyFunction, /workspaceId is required/)
  assert.match(openaiKeyFunction, /authorizeWorkspace\(user\.id, workspaceId, supabase\)/)
  assert.match(openaiKeyHelper, /\.eq\("workspace_id", workspaceId\)/)
  assert.match(openaiKeyHelper, /onConflict: "workspace_id,user_id,provider"/)
  assert.match(liveGuidance, /getDecryptedOpenAiKey\(supabase, user\.id, authorizedCall\.workspace_id\)/)
  assert.match(sellerDomainResearch, /workspaceId is required when using a saved OpenAI key/)
  assert.match(functionsClient, /getOpenAiKeyStatus\(workspaceId: string\)/)
  assert.match(functionsClient, /saveOpenAiKey\(apiKey: string, workspaceId: string\)/)
  assert.match(functionsClient, /deleteOpenAiKey\(workspaceId: string\)/)
  assert.doesNotMatch(functionsClient, /createRealtimeTranscriptionSession/)
  assert.match(types, /workspace_id: string/)
  assert.match(migration, /add column if not exists workspace_id/)
  assert.match(migration, /unique \(workspace_id, user_id, provider\)/)
})

test("elite live-call migration stores audio preflight and transcript reconciliation metadata", async () => {
  const migration = await read("supabase/migrations/202606280005_elite_live_call_pipeline.sql")
  const deepgramMigration = await read("supabase/migrations/202607060001_deepgram_flux_transcription.sql")
  const types = await read("src/lib/supabase/database.types.ts")

  assert.match(migration, /audio_preflight jsonb/)
  assert.match(migration, /audio_source_summary jsonb/)
  assert.match(migration, /guidance_readiness jsonb/)
  assert.match(migration, /openai_item_id text/)
  assert.match(migration, /openai_segment_id text/)
  assert.match(migration, /audio_source_kind text/)
  assert.match(migration, /client_turn_id text/)
  assert.match(migration, /turn_sequence integer/)
  assert.match(migration, /quality_flags jsonb/)
  assert.match(migration, /transcript_segments_call_source_openai_item_unique_idx/)
  assert.match(migration, /candidate_scores jsonb/)
  assert.match(deepgramMigration, /transcription_provider text/)
  assert.match(deepgramMigration, /provider_session_id text/)
  assert.match(deepgramMigration, /provider_turn_index integer/)
  assert.match(deepgramMigration, /provider_event_id text/)
  assert.match(deepgramMigration, /end_of_turn_confidence numeric\(4,3\)/)
  assert.match(deepgramMigration, /word_confidence numeric\(4,3\)/)
  assert.match(deepgramMigration, /language_detected text/)
  assert.match(deepgramMigration, /diarization_speaker text/)
  assert.match(deepgramMigration, /transcript_segments_call_provider_turn_unique_idx/)
  assert.match(deepgramMigration, /transcript_segments_call_provider_event_unique_idx/)
  assert.match(types, /audio_preflight: Json/)
  assert.match(types, /openai_item_id: string \| null/)
  assert.match(types, /transcription_provider: string \| null/)
  assert.match(types, /provider_session_id: string \| null/)
  assert.match(types, /provider_turn_index: number \| null/)
  assert.match(types, /guidance_latency_ms: number \| null/)
})

test("CSV import functions authorize the active workspace and reject cross-workspace writes", async () => {
  const accountImport = await read("netlify/functions/import-accounts.ts")
  const opportunityImport = await read("netlify/functions/import-opportunities.ts")
  const csvImport = await read("src/lib/csv-import.ts")

  assert.match(accountImport, /path: "\/api\/import\/accounts"/)
  assert.match(accountImport, /requireUser\(request\)/)
  assert.match(accountImport, /workspaceId is required/)
  assert.match(accountImport, /authorizeWorkspace\(user\.id, workspaceId, supabase\)/)
  assert.match(accountImport, /\.from\("accounts"\)[\s\S]*\.eq\("workspace_id", workspaceId\)/)
  assert.match(accountImport, /workspace_id: workspaceId/)
  assert.match(accountImport, /assertAccountInWorkspace/)
  assert.match(accountImport, /\.eq\("id", row\.matchedAccountId\)[\s\S]*\.eq\("workspace_id", workspaceId\)/)
  assert.match(accountImport, /cross_workspace_account_rejected/)
  assert.match(accountImport, /getPublicErrorMessageForError\(error, "Row needs review before it can be imported\."\)/)
  assert.doesNotMatch(accountImport, /Row could not be imported/)
  assert.doesNotMatch(accountImport, /getDecryptedOpenAiKey/)
  assert.doesNotMatch(accountImport, /openai/i)

  assert.match(opportunityImport, /path: "\/api\/import\/opportunities"/)
  assert.match(opportunityImport, /requireUser\(request\)/)
  assert.match(opportunityImport, /workspaceId is required/)
  assert.match(opportunityImport, /authorizeWorkspace\(user\.id, workspaceId, supabase\)/)
  assert.match(opportunityImport, /\.from\("accounts"\)\.select\("id,name,website,currency"\)\.eq\("workspace_id", workspaceId\)/)
  assert.match(opportunityImport, /\.from\("opportunities"\)\.select\("id,name,account_id"\)\.eq\("workspace_id", workspaceId\)/)
  assert.match(opportunityImport, /workspace_id: workspaceId/)
  assert.match(opportunityImport, /assertOpportunityInWorkspace/)
  assert.match(opportunityImport, /\.eq\("id", row\.matchedOpportunityId\)[\s\S]*\.eq\("workspace_id", workspaceId\)/)
  assert.match(opportunityImport, /cross_workspace_opportunity_rejected/)
  assert.match(opportunityImport, /replaceOpportunityPlaybooks/)
  assert.match(opportunityImport, /callPlaybookAliases/)
  assert.match(opportunityImport, /canonicalPlaybook/)
  assert.match(opportunityImport, /getPublicErrorMessageForError\(error, "Row needs review before it can be imported\."\)/)
  assert.doesNotMatch(opportunityImport, /Row could not be imported/)
  assert.doesNotMatch(opportunityImport, /getDecryptedOpenAiKey/)
  assert.doesNotMatch(opportunityImport, /openai/i)

  assert.match(csvImport, /maxFileSizeBytes: 5 \* 1024 \* 1024/)
  assert.match(csvImport, /maxRows: 5000/)
  assert.match(csvImport, /reviewPageSize: 25/)
  assert.match(csvImport, /Account name is required\./)
  assert.match(csvImport, /Opportunity name is required\./)
  assert.match(csvImport, /Account name is required to import opportunities\./)
  assert.match(csvImport, /account website\/domain/)
  assert.match(csvImport, /const action: CsvImportAction = hasErrors \|\| duplicateKind !== "none" \? "skip" : "create"/)
  assert.match(csvImport, /SalesFrame will keep this close date as a note\. Choose a calendar date after import if needed\./)
  assert.doesNotMatch(csvImport, /Close date could not be parsed/)
  assert.match(csvImport, /SalesFrame will keep this stage exactly as written\./)
  assert.doesNotMatch(csvImport, /Stage is not one of the standard SalesFrame stages/)
  assert.match(csvImport, /SalesFrame will use \$\{defaultCurrency\} for this row because "\$\{values\.currency\}" is not a supported currency\./)
  assert.doesNotMatch(csvImport, /Currency "\$\{values\.currency\}" is not supported; \$\{defaultCurrency\} will be used\./)
  assert.match(csvImport, /const headers = \["Row", "Review note", "Values"\]/)
  assert.doesNotMatch(csvImport, /const headers = \["Row", "Error", "Values"\]/)
  assert.match(csvImport, /normalizeCsvImportPlaybooks/)
})
