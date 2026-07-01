import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    try {
      const contents = readFileSync(resolve(process.cwd(), fileName), "utf8")
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
        const [key, ...valueParts] = trimmed.split("=")
        if (!process.env[key]) process.env[key] = valueParts.join("=")
      }
    } catch {
      // Local env files are optional for deployed or CI-style runs.
    }
  }
}

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function addDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function iso(date) {
  return date.toISOString()
}

function currencyAmount(value) {
  return String(value)
}

function assertNoError(response, label) {
  if (response.error) {
    throw new Error(`${label}: ${response.error.message}`)
  }
  return response.data
}

async function optionalWrite(writePromise, label, options = {}) {
  const response = await writePromise
  if (!response.error) return { data: response.data, skipped: false }

  const missingTable = /could not find the table|schema cache/i.test(response.error.message)
  if (options.skipMissingTable && missingTable) {
    console.warn(`${label} skipped: ${response.error.message}`)
    return { data: [], skipped: true }
  }

  throw new Error(`${label}: ${response.error.message}`)
}

function cycle(items, index) {
  return items[index % items.length]
}

loadLocalEnv()

const SUPABASE_URL = requireEnv("VITE_SUPABASE_URL")
const SUPABASE_KEY = requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY")
const email = process.env.SALESFRAME_QA_EMAIL || `heavy.qa.${Date.now()}@example.com`
const password = process.env.SALESFRAME_QA_PASSWORD || "SalesFrameQA!2026"
const workspaceName = process.env.SALESFRAME_QA_WORKSPACE || "Heavy Usage QA"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureSignedIn() {
  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: "Heavy QA Seller",
      },
    },
  })

  if (signUp.error && !/already|registered|exists/i.test(signUp.error.message)) {
    throw new Error(`Sign up failed: ${signUp.error.message}`)
  }

  if (signUp.data.session) {
    return signUp.data.session.user
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (signIn.error) throw new Error(`Sign in failed: ${signIn.error.message}`)
  return signIn.data.user
}

const accountFixtures = [
  ["Apex Logistics Group", "apexlogistics.example", "Logistics", "1,800", "Australia", "AUD"],
  ["Bright Health Network", "brighthealth.example", "Healthcare", "3,200", "Australia", "AUD"],
  ["Cobalt Mining Services", "cobaltmining.example", "Mining", "6,500", "Australia", "AUD"],
  ["Delta Education Trust", "deltaeducation.example", "Education", "920", "Australia", "AUD"],
  ["Evergreen Retail Collective", "evergreenretail.example", "Retail", "4,100", "Australia", "AUD"],
  ["Fjord Financial Services", "fjordfinancial.example", "Financial services", "2,700", "Australia", "AUD"],
  ["Gridline Energy", "gridlineenergy.example", "Energy", "1,450", "Australia", "AUD"],
  ["Harbour City Council", "harbourcity.example", "Government", "1,050", "Australia", "AUD"],
  ["Ironbark Construction", "ironbarkconstruction.example", "Construction", "760", "Australia", "AUD"],
  ["Juno Travel Group", "junotravel.example", "Travel", "1,250", "Australia", "AUD"],
  ["Keystone Insurance", "keystoneinsurance.example", "Insurance", "2,050", "Australia", "AUD"],
  ["Luma Media", "lumamedia.example", "Media", "640", "Australia", "AUD"],
  ["MetroBank Digital", "metrobankdigital.example", "Banking", "5,800", "Australia", "AUD"],
  ["Northstar Manufacturing", "northstarmanufacturing.example", "Manufacturing", "3,450", "Australia", "AUD"],
  ["Orion SaaS Labs", "orionsaas.example", "Software", "480", "Australia", "AUD"],
  ["Pacific Freight Co", "pacificfreight.example", "Transport", "2,250", "Australia", "AUD"],
  ["Quartz Property Group", "quartzproperty.example", "Property", "870", "Australia", "AUD"],
  ["Riverstone Utilities", "riverstoneutilities.example", "Utilities", "2,900", "Australia", "AUD"],
  ["Summit Super Fund", "summitsuper.example", "Superannuation", "1,150", "Australia", "AUD"],
  ["Tandem Robotics", "tandemrobotics.example", "Advanced manufacturing", "390", "Australia", "AUD"],
  ["Union Foods", "unionfoods.example", "Food production", "2,600", "Australia", "AUD"],
  ["Vista Telecom", "vistatelecom.example", "Telecommunications", "7,200", "Australia", "AUD"],
  ["WaveWorks Marine", "waveworksmarine.example", "Marine services", "540", "Australia", "AUD"],
  ["Xenon Cyber Defence", "xenoncyber.example", "Cybersecurity", "680", "Australia", "AUD"],
  ["Yarra BioTech", "yarrabiotech.example", "Biotech", "740", "Australia", "AUD"],
  ["Zephyr Airlines", "zephyrairlines.example", "Aviation", "4,900", "Australia", "AUD"],
  ["Atlas Payroll", "atlaspayroll.example", "HR technology", "330", "Australia", "AUD"],
  ["Beacon Legal Group", "beaconlegal.example", "Legal services", "510", "Australia", "AUD"],
  ["CoreGov Platforms", "coregov.example", "Public sector technology", "1,900", "Australia", "AUD"],
  ["Daintree Hospitality", "daintreehospitality.example", "Hospitality", "2,300", "Australia", "AUD"],
]

const stages = ["Qualification", "Discovery", "Solution Fit", "Proposal", "Negotiation", "Procurement"]
const callTypes = ["Discovery", "Inbound", "Outbound", "Expansion", "Renewal"]
const sourceTypes = ["Manual entry", "Inbound demo", "Partner referral", "Outbound prospecting", "Customer expansion"]
const painThemes = [
  "Manual reporting creates delays before leaders can see risk.",
  "Teams are asking strong discovery questions inconsistently across regions.",
  "Customer handoffs are creating duplicate work and unclear ownership.",
  "Leaders need better visibility into buying committee progress.",
  "Existing tools capture activity but not deal quality.",
]
const decisionProcesses = [
  "Business sponsor validates fit, then commercial review with procurement.",
  "Department leader shortlists options before CIO and finance approval.",
  "Pilot team evaluates workflow impact before executive steering group.",
  "Procurement requires security review, business case, and implementation owner.",
]
const nextSteps = [
  "Confirm quantified impact and identify executive sponsor.",
  "Run a workshop with operations and revenue leadership.",
  "Share tailored success plan and agree evaluation criteria.",
  "Map buying influences and prepare mutual action plan.",
]
const frameworks = [
  ["meddicc", "bant"],
  ["meddicc", "force-management", "spin-selling"],
  ["spiced", "gap-selling"],
  ["sandler", "value-selling"],
  ["strategic-selling", "meddicc"],
  ["challenger-sale", "force-management"],
  ["meddpicc", "spiced"],
]
const recordingDataUrl =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA="

const transcriptTemplate = [
  ["Seller", "To make sure I understand the context, what prompted the team to look at this now?"],
  ["Customer", "The biggest issue is that managers cannot see whether discovery is actually progressing until late in the quarter."],
  ["Seller", "Where does that show up operationally for the team day to day?"],
  ["Customer", "It creates coaching gaps and our reps end up asking commercial questions before pain is clear."],
  ["Seller", "If this improved, how would you measure whether the change was worth it?"],
  ["Customer", "We would expect cleaner opportunity notes, fewer slipped deals, and better manager confidence before forecast calls."],
]

const guidanceQuestions = [
  "What is the current process making harder than it needs to be?",
  "How are you measuring whether this initiative is working today?",
  "Who else needs to feel confident before this moves forward?",
  "What would make the next conversation useful for your team?",
]

async function main() {
  const user = await ensureSignedIn()

  assertNoError(
    await supabase
      .from("user_profiles")
      .update({
        full_name: "Heavy QA Seller",
        company_name: "SalesFrame QA Co",
        role_title: "Enterprise Account Executive",
        timezone: "Australia/Sydney",
      })
      .eq("id", user.id),
    "Update profile"
  )

  const workspaces = assertNoError(
    await supabase.from("workspaces").select("*").order("created_at", { ascending: true }),
    "Load workspaces"
  )
  const workspace = workspaces[0] || assertNoError(
    await supabase
      .from("workspaces")
      .insert({ name: workspaceName, description: "Loaded workspace for heavy UX QA", default_currency: "AUD" })
      .select("*")
      .single(),
    "Create workspace"
  )

  const workspaceId = workspace.id
  assertNoError(
    await supabase
      .from("workspaces")
      .update({
        name: workspaceName,
        description: "Loaded workspace for heavy UX QA across accounts, opportunities, calls, and transcripts.",
        default_currency: "AUD",
        onboarding_completed_at: iso(new Date()),
      })
      .eq("id", workspaceId),
    "Update workspace"
  )

  assertNoError(
    await supabase
      .from("seller_research_profiles")
      .upsert(
        {
          workspace_id: workspaceId,
          user_id: user.id,
          seller_company: "SalesFrame",
          seller_domain: "salesframe.ai",
          product_context:
            "SalesFrame helps sellers ask natural next-best questions in live calls while keeping MEDDICC, BANT, SPICED, Force Management, Sandler, Challenger, Gap Selling, Value Selling, and Strategic Selling evidence updated.",
        },
        { onConflict: "workspace_id,user_id" }
      ),
    "Upsert seller research profile"
  )

  const existingAccounts = assertNoError(
    await supabase.from("accounts").select("id").eq("workspace_id", workspaceId),
    "Load existing accounts"
  )
  if (existingAccounts.length) {
    assertNoError(await supabase.from("accounts").delete().eq("workspace_id", workspaceId), "Reset workspace accounts")
  }

  const playbooks = assertNoError(
    await supabase.from("playbooks").select("id,slug,name").is("workspace_id", null).eq("is_system", true),
    "Load playbooks"
  )
  const playbookBySlug = new Map(playbooks.map((playbook) => [playbook.slug, playbook]))
  const playbookIds = playbooks.map((playbook) => playbook.id)
  const fields = playbookIds.length
    ? assertNoError(
        await supabase
          .from("playbook_fields")
          .select("id,playbook_id,label,sort_order")
          .in("playbook_id", playbookIds)
          .order("sort_order", { ascending: true }),
        "Load playbook fields"
      )
    : []

  const accountRows = accountFixtures.map(([name, website, industry, employees, region, currency], index) => ({
    workspace_id: workspaceId,
    name,
    website,
    industry,
    employee_count: employees,
    region,
    currency,
    owner_user_id: user.id,
    current_tools: cycle(["Salesforce, Gong, Google Workspace", "HubSpot, Zoom, Slack", "Dynamics, Teams, Power BI", "Spreadsheets, Zoom, Jira"], index),
    strategic_initiatives: cycle(
      [
        "Improve forecast confidence and reduce late-stage deal surprises.",
        "Standardise customer discovery across distributed sales teams.",
        "Modernise customer onboarding and executive reporting.",
        "Reduce manual admin while improving coaching visibility.",
      ],
      index
    ),
    competitors: cycle(["Clari, Gong, spreadsheet-based deal reviews", "Otter, Fireflies, manual manager coaching", "Salesforce notes, Chorus, Avoma", "In-house call notes and CRM task lists"], index),
    notes: cycle(
      [
        "Leadership prefers practical, low-friction workflows. Avoid over-indexing on admin-heavy rollout language.",
        "Strong executive interest, but frontline adoption risk needs to be handled carefully.",
        "Customer is analytical and responds well to quantified business cases.",
        "Buyer is skeptical of generic AI. Keep questions grounded in their process and language.",
      ],
      index
    ),
  }))

  const accounts = assertNoError(
    await supabase.from("accounts").insert(accountRows).select("*"),
    "Insert accounts"
  )

  const enrichmentRows = accounts.map((account, index) => ({
    workspace_id: workspaceId,
    account_id: account.id,
    business_summary: `${account.name} is a ${account.industry?.toLowerCase()} organisation with a visible need to improve sales execution consistency and management visibility.`,
    likely_buying_triggers: cycle(
      [
        "Forecast misses, inconsistent discovery quality, and manager pressure to improve inspection hygiene.",
        "Revenue leadership is standardising sales methodology and looking for evidence-led coaching.",
        "Expansion motion is growing, making account context and next-call planning more important.",
      ],
      index
    ),
    strategic_priorities: account.strategic_initiatives,
    current_tech_stack: account.current_tools,
    hiring_growth_signals: "Hiring and growth signals should be reviewed before executive outreach.",
    recent_news_signals: "Recent public updates suggest operational efficiency and customer experience are board-level themes.",
    procurement_signals: "Procurement likely requires security review, business case, and clear implementation ownership.",
    review_sentiment_signals: "Customer-facing teams value fast response and consistent handoffs.",
    likely_stakeholders: cycle(["CRO, VP Sales, RevOps, Sales Enablement", "Head of Sales, COO, Finance, Procurement", "Revenue Operations, Sales Managers, CIO"], index),
    discovery_angles: "Anchor questions around consistency, visibility, coaching moments, and evidence quality rather than generic AI productivity.",
    risk_flags: cycle(["AI skepticism; prove control and explainability.", "Procurement and security may slow the cycle.", "Adoption risk if managers see this as another admin surface."], index),
    source_notes: "Seeded QA enrichment profile for heavy-workspace UX testing.",
    confidence: cycle(["High", "Medium", "Medium-high"], index),
    last_enriched_at: iso(addDays(new Date(), -index)),
  }))
  const enrichmentWrite = await optionalWrite(
    supabase.from("account_enrichment_profiles").insert(enrichmentRows),
    "Insert enrichment profiles",
    { skipMissingTable: true }
  )

  const opportunityRows = Array.from({ length: 45 }, (_, index) => {
    const account = accounts[index % accounts.length]
    const coverage =
      index < 3
        ? [18, 26, 32][index]
        : index < 6
          ? [42, 54, 66][index - 3]
          : [84, 88, 92, 96, 100][(index - 6) % 5]
    const missing = Math.max(0, Math.round((100 - coverage) / 9))
    const weak = Math.max(0, Math.round((100 - coverage) / 20))
    return {
      workspace_id: workspaceId,
      account_id: account.id,
      name: cycle(
        [
          "Sales Methodology Rollout",
          "Digital Onboarding Expansion",
          "Revenue Coaching Pilot",
          "Enterprise Forecast Quality",
          "Manager Inspection Workflow",
          "Customer Expansion Motion",
          "Call Intelligence Modernisation",
          "Buying Committee Visibility",
        ],
        index
      ),
      stage: cycle(stages, index),
      amount: currencyAmount(65000 + ((index * 37000) % 620000)),
      close_date: isoDate(addDays(new Date(), 21 + index * 4)),
      owner_user_id: user.id,
      source: cycle(sourceTypes, index),
      pain: cycle(painThemes, index),
      decision_process: cycle(decisionProcesses, index),
      next_step: cycle(nextSteps, index),
      manual_notes: cycle(
        [
          "Keep discovery light early; buyer responds better to operational language than methodology jargon.",
          "Executive sponsor wants proof this will improve manager confidence before quarter-end.",
          "Do not ask heavy procurement questions until success criteria are clearer.",
          "Account has multiple stakeholders; connect pain to measurable impact before commercial detail.",
        ],
        index
      ),
      coverage_score: coverage,
      missing_count: missing,
      weak_count: weak,
      call_type: cycle(callTypes, index),
      next_question: cycle(guidanceQuestions, index),
      question_reason: "Seeded from previous call context and methodology gaps for heavy workspace QA.",
    }
  })

  const opportunities = assertNoError(
    await supabase.from("opportunities").insert(opportunityRows).select("*"),
    "Insert opportunities"
  )

  const opportunityPlaybooks = opportunities.flatMap((opportunity, index) =>
    cycle(frameworks, index)
      .map((slug) => playbookBySlug.get(slug)?.id)
      .filter(Boolean)
      .map((playbook_id) => ({ opportunity_id: opportunity.id, playbook_id }))
  )
  if (opportunityPlaybooks.length) {
    assertNoError(await supabase.from("opportunity_playbooks").insert(opportunityPlaybooks), "Insert opportunity playbooks")
  }

  const callRows = opportunities.flatMap((opportunity, index) => {
    const account = accounts.find((candidate) => candidate.id === opportunity.account_id)
    const callCount = index < 18 ? 2 : index < 27 ? 3 : 1
    return Array.from({ length: callCount }, (_, callIndex) => {
      const startedAt = addDays(new Date(), -(index * 2 + callIndex + 1))
      const duration = 1450 + ((index + callIndex) * 173) % 2600
      return {
        workspace_id: workspaceId,
        account_id: account.id,
        opportunity_id: opportunity.id,
        title: `${opportunity.name} ${callIndex === 0 ? "Discovery" : callIndex === 1 ? "Validation" : "Next Step"} Call`,
        call_type: cycle(callTypes, index + callIndex),
        status: cycle(["post_call_draft", "reviewed", "needs_attention"], index + callIndex),
        started_at: iso(startedAt),
        ended_at: iso(addDays(startedAt, 0)),
        duration_seconds: duration,
        recording_url: recordingDataUrl,
        audio_preflight: {
          sellerMicReady: true,
          customerAudioReady: true,
          mixedRoomReady: true,
          mode: callIndex % 3 === 0 ? "meeting_audio" : callIndex % 3 === 1 ? "microphone" : "in_person_microphone",
          seeded: true,
        },
        audio_source_summary: {
          sources: callIndex % 3 === 0 ? ["seller_mic", "meeting_audio"] : ["mixed_microphone"],
          seeded: true,
        },
        guidance_readiness: {
          openaiKeyReady: true,
          firstGuidanceReady: true,
          seeded: true,
        },
        retention_expires_at: iso(addDays(new Date(), 90)),
        created_by_user_id: user.id,
      }
    })
  })

  const calls = assertNoError(await supabase.from("calls").insert(callRows).select("*"), "Insert calls")

  const callPlaybooks = calls.flatMap((call) => {
    const opportunityIndex = opportunities.findIndex((opportunity) => opportunity.id === call.opportunity_id)
    return cycle(frameworks, Math.max(0, opportunityIndex))
      .map((slug) => playbookBySlug.get(slug)?.id)
      .filter(Boolean)
      .map((playbook_id) => ({ call_id: call.id, playbook_id }))
  })
  if (callPlaybooks.length) {
    assertNoError(await supabase.from("call_playbooks").insert(callPlaybooks), "Insert call playbooks")
  }

  const speakerRows = calls.flatMap((call) => [
    { call_id: call.id, label: "Seller", display_name: "Heavy QA Seller", role: "seller" },
    { call_id: call.id, label: "Customer", display_name: "Customer buyer", role: "customer" },
  ])
  const speakers = assertNoError(await supabase.from("call_speakers").insert(speakerRows).select("*"), "Insert speakers")
  const speakersByCall = new Map()
  for (const speaker of speakers) {
    const current = speakersByCall.get(speaker.call_id) || {}
    current[speaker.label] = speaker
    speakersByCall.set(speaker.call_id, current)
  }

  const transcriptRows = []
  for (const [callIndex, call] of calls.entries()) {
    const speakerSet = speakersByCall.get(call.id)
    transcriptTemplate.forEach(([label, text], segmentIndex) => {
      const speaker = speakerSet[label]
      transcriptRows.push({
        call_id: call.id,
        speaker_id: speaker?.id ?? null,
        start_ms: segmentIndex * 19000,
        end_ms: segmentIndex * 19000 + 12000,
        text:
          segmentIndex % 2 === 1
            ? `${text} ${cycle(["That is why this is getting attention this quarter.", "The team wants a cleaner way to know what to ask next.", "We need this to feel useful without adding admin."], callIndex)}`
            : text,
        is_final: true,
        speaker_attribution: label,
        speaker_confidence: label === "Seller" ? 0.96 : 0.88,
        speaker_needs_review: false,
        speaker_source: label === "Seller" ? "seller_mic" : "meeting_audio",
        openai_item_id: `seed-${call.id}-${segmentIndex}`,
        openai_segment_id: `seed-segment-${call.id}-${segmentIndex}`,
        audio_source_kind: label === "Seller" ? "seller_mic" : "meeting_audio",
        client_turn_id: `seed-turn-${call.id}-${segmentIndex}`,
        turn_sequence: segmentIndex + 1,
        transcription_delay: "medium",
        quality_flags: { seeded: true },
      })
    })
  }
  const transcriptSegments = assertNoError(
    await supabase.from("transcript_segments").insert(transcriptRows).select("*"),
    "Insert transcript segments"
  )

  const firstSegmentByCall = new Map()
  for (const segment of transcriptSegments) {
    if (!firstSegmentByCall.has(segment.call_id)) firstSegmentByCall.set(segment.call_id, segment)
  }

  const noteRows = calls.flatMap((call, index) => [
    {
      call_id: call.id,
      note_type: "summary",
      text: `${cycle(["Buyer confirmed the current process is too manual", "Customer wants clearer coaching visibility", "Sponsor needs proof of measurable impact"], index)} and agreed to a focused next step.`,
      source_transcript_segment_id: firstSegmentByCall.get(call.id)?.id ?? null,
    },
    {
      call_id: call.id,
      note_type: "evidence",
      text: `${cycle(["Pain", "Metrics", "Decision process", "Champion"], index)} evidence was captured but needs follow-up validation.`,
      source_transcript_segment_id: firstSegmentByCall.get(call.id)?.id ?? null,
    },
    {
      call_id: call.id,
      note_type: "action_item",
      text: cycle(["Send tailored recap and success criteria draft.", "Book stakeholder mapping session.", "Confirm executive sponsor and next evaluation date."], index),
      source_transcript_segment_id: null,
    },
  ])
  assertNoError(await supabase.from("call_notes").insert(noteRows), "Insert call notes")

  const postCallRows = calls.map((call, index) => ({
    call_id: call.id,
    follow_up_email: `Hi team,\n\nThanks for the time today. I captured that the current process is creating visibility gaps and making it harder for managers to coach consistently.\n\nThe useful next step is to confirm success criteria, map who else needs confidence, and agree what evidence would make this worth progressing.\n\nBest,\nHeavy QA Seller`,
    next_call_plan: cycle(
      [
        "Open with a concise recap, confirm whether the pain is still accurate, then quantify impact.",
        "Focus on stakeholder confidence, decision process, and the strongest success criteria.",
        "Use the next call to validate the business case and identify any procurement risk.",
      ],
      index
    ),
    account_updates: { seeded: true, suggestedNote: "Account shows a strong need for guided discovery and manager visibility." },
    opportunity_updates: { seeded: true, suggestedNextStep: cycle(nextSteps, index) },
    missing_info: ["Economic buyer confirmation", "Quantified impact", "Decision criteria"].slice(0, 1 + (index % 3)),
  }))
  assertNoError(await supabase.from("post_call_outputs").insert(postCallRows), "Insert post-call outputs")

  const latestCallByOpportunity = new Map()
  for (const call of calls) {
    const existing = latestCallByOpportunity.get(call.opportunity_id)
    if (!existing || new Date(call.started_at).getTime() > new Date(existing.started_at).getTime()) {
      latestCallByOpportunity.set(call.opportunity_id, call)
    }
  }

  const briefRows = opportunities.map((opportunity, index) => ({
    opportunity_id: opportunity.id,
    previous_call_id: latestCallByOpportunity.get(opportunity.id)?.id ?? null,
    objective: cycle(
      [
        "Validate the pain in the buyer's words and connect it to measurable business impact.",
        "Confirm decision criteria and identify who else needs to be involved.",
        "Move from discovery into a clear mutual action plan with owner and date.",
      ],
      index
    ),
    suggested_opening: "Last time we discussed the visibility gap and coaching consistency. Has anything changed since then?",
    focus_questions: [
      "What would make this worth prioritising this quarter?",
      "Who else needs confidence before this can move forward?",
      "How would you measure whether this improved the team’s process?",
    ],
    missing_evidence: ["Economic buyer", "Quantified impact", "Decision criteria"].slice(0, 1 + (index % 3)),
    risk_notes: [cycle(["Buyer may resist heavy methodology language.", "Procurement path is not clear yet.", "Champion strength still needs validation."], index)],
    recommended_next_step: cycle(nextSteps, index),
  }))
  assertNoError(await supabase.from("next_call_briefs").insert(briefRows), "Insert next call briefs")

  const evidenceRows = []
  const fieldCandidatesByPlaybook = new Map()
  for (const field of fields) {
    const list = fieldCandidatesByPlaybook.get(field.playbook_id) || []
    list.push(field)
    fieldCandidatesByPlaybook.set(field.playbook_id, list)
  }
  for (const [index, opportunity] of opportunities.entries()) {
    const assignedIds = cycle(frameworks, index).map((slug) => playbookBySlug.get(slug)?.id).filter(Boolean)
    const chosenFields = assignedIds.flatMap((playbookId) => fieldCandidatesByPlaybook.get(playbookId) || [])
    const targetCoverage = opportunity.coverage_score ?? 0
    const confirmedCount = Math.round(chosenFields.length * (targetCoverage / 100))
    const weakCount = Math.max(0, Math.round(chosenFields.length * (Math.max(0, 100 - targetCoverage) / 260)))
    for (const [fieldIndex, field] of chosenFields.entries()) {
      const status =
        fieldIndex < confirmedCount
          ? "confirmed"
          : fieldIndex < confirmedCount + weakCount
            ? "weak"
            : fieldIndex % 5 === 0
              ? "asked"
              : "missing"
      evidenceRows.push({
        opportunity_id: opportunity.id,
        playbook_field_id: field.id,
        status,
        value: status === "missing" ? null : cycle(["Manual admin delays", "Manager visibility", "Executive confidence", "Success criteria"], fieldIndex + index),
        evidence_summary:
          status === "missing"
            ? "Still needs direct customer evidence."
            : `Seeded evidence for ${field.label} from historical call context.`,
        confidence: status === "confirmed" ? 0.88 : status === "weak" ? 0.67 : status === "asked" ? 0.52 : 0.35,
        source: "seeded_heavy_qa",
        source_call_id: latestCallByOpportunity.get(opportunity.id)?.id ?? null,
      })
    }
  }
  if (evidenceRows.length) {
    assertNoError(await supabase.from("opportunity_field_evidence").insert(evidenceRows), "Insert opportunity evidence")
  }

  const guidanceRows = calls.slice(0, 50).map((call, index) => ({
    call_id: call.id,
    opportunity_id: call.opportunity_id,
    recommended_question: cycle(guidanceQuestions, index),
    reason: "Seeded heavy workspace guidance event showing how the coach would move the conversation forward.",
    selected_call_type: call.call_type,
    selected_playbooks: cycle(frameworks, index),
    covered_intents: ["pain_problem"],
    missing_gaps: ["impact_value_metrics", "authority_influence"],
    conversation_flow: {
      stage: cycle(["opening", "discovery", "impact", "decision", "wrap-up"], index),
      buyerMood: cycle(["engaged", "curious", "skeptical", "rushed"], index),
      seeded: true,
    },
    ui_mode: cycle(["ask_now", "clarify", "park_and_follow_flow", "recover_before_close"], index),
    conversation_state: {
      seeded: true,
      questionLifecycle: {
        currentQuestionState: cycle(["active", "answered", "parked"], index),
        awkwardnessRisk: cycle(["low", "medium"], index),
      },
    },
    candidate_scores: [
      { label: "Pain and impact", score: 91 },
      { label: "Authority", score: 72 },
    ],
    source_turn_ids: [],
    guidance_latency_ms: 850 + (index % 9) * 130,
  }))
  assertNoError(await supabase.from("live_guidance_events").insert(guidanceRows), "Insert guidance events")

  console.log(
    JSON.stringify(
      {
        email,
        password,
        workspaceId,
        workspaceName,
        counts: {
          accounts: accounts.length,
          opportunities: opportunities.length,
          calls: calls.length,
          transcriptSegments: transcriptRows.length,
          callNotes: noteRows.length,
          postCallOutputs: postCallRows.length,
          nextCallBriefs: briefRows.length,
          evidenceRows: evidenceRows.length,
          accountEnrichmentProfiles: enrichmentWrite.skipped ? 0 : enrichmentRows.length,
        },
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
