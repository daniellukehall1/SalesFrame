export type IntentClusterStatus = "confirmed" | "asked" | "weak" | "missing"

export type IntentClusterField = {
  playbookFieldId: string
  playbookId: string
  playbookSlug: string
  playbookLabel: string
  fieldLabel: string
  fieldDescription: string
  evidenceStandard: string
  sortOrder: number
  status: IntentClusterStatus
  confidence?: number
  evidenceSummary?: string
  value?: string
}

export type PlaybookIntentCluster = {
  id: string
  label: string
  guidance: string
  fields: IntentClusterField[]
  status: IntentClusterStatus
  confirmedCount: number
  weakCount: number
  missingCount: number
}

type SourceRecord = Record<string, unknown>

type IntentAlias = {
  playbooks: string[]
  fields: string[]
}

export const playbookIntentCatalog: Array<{
  id: string
  label: string
  guidance: string
  aliases: IntentAlias[]
}> = [
  {
    id: "opening_contract",
    label: "Opening contract",
    guidance: "Set the agenda, desired outcomes, timing, and next-step expectation before deeper discovery.",
    aliases: [
      { playbooks: ["sandler"], fields: ["upfront contract"] },
    ],
  },
  {
    id: "pain_problem",
    label: "Pain and problem",
    guidance: "Understand the problem the customer is trying to solve before moving into impact or buying process.",
    aliases: [
      { playbooks: ["meddicc", "meddpicc"], fields: ["identify pain"] },
      { playbooks: ["spin", "spin selling"], fields: ["problem"] },
      { playbooks: ["force management", "force management command of the message"], fields: ["business pain"] },
      { playbooks: ["gap selling"], fields: ["current state", "gap"] },
      { playbooks: ["spiced", "spiced winning by design"], fields: ["pain"] },
      { playbooks: ["sandler"], fields: ["pain"] },
      { playbooks: ["value selling"], fields: ["business issue"] },
    ],
  },
  {
    id: "impact_value_metrics",
    label: "Impact, value, and metrics",
    guidance: "Quantify the business consequence and value of change only after the customer has given problem context.",
    aliases: [
      { playbooks: ["meddicc", "meddpicc"], fields: ["metrics"] },
      { playbooks: ["force management", "force management command of the message"], fields: ["metrics", "positive business outcomes"] },
      { playbooks: ["value selling"], fields: ["impact", "value"] },
      { playbooks: ["spin", "spin selling"], fields: ["implication"] },
      { playbooks: ["gap selling"], fields: ["impact"] },
      { playbooks: ["the challenger sale", "challenger"], fields: ["rational drowning"] },
      { playbooks: ["spiced", "spiced winning by design"], fields: ["impact"] },
    ],
  },
  {
    id: "authority_influence",
    label: "Authority and influence",
    guidance: "Map who can approve, influence, block, or economically sponsor the decision once the problem is real.",
    aliases: [
      { playbooks: ["meddicc", "meddpicc"], fields: ["economic buyer"] },
      { playbooks: ["bant"], fields: ["authority"] },
      { playbooks: ["strategic selling", "strategic selling miller heiman", "miller heiman"], fields: ["economic buying influence"] },
    ],
  },
  {
    id: "decision_timing",
    label: "Decision and timing",
    guidance: "Clarify timing, critical events, decision steps, and buying process when the buyer gives permission.",
    aliases: [
      { playbooks: ["meddicc", "meddpicc"], fields: ["decision process"] },
      { playbooks: ["bant"], fields: ["timeline"] },
      { playbooks: ["spiced", "spiced winning by design"], fields: ["critical event", "decision"] },
      { playbooks: ["sandler"], fields: ["decision process"] },
    ],
  },
  {
    id: "criteria_capabilities",
    label: "Criteria and capabilities",
    guidance: "Identify what the customer needs the solution to do before positioning product strengths.",
    aliases: [
      { playbooks: ["meddicc", "meddpicc"], fields: ["decision criteria"] },
      { playbooks: ["force management", "force management command of the message"], fields: ["required capabilities"] },
      { playbooks: ["value selling"], fields: ["required capabilities"] },
      { playbooks: ["spiced", "spiced winning by design"], fields: ["success criteria"] },
      { playbooks: ["gap selling"], fields: ["decision criteria"] },
    ],
  },
  {
    id: "competition_differentiation",
    label: "Competition and differentiation",
    guidance: "Understand alternatives and differentiation after the customer has named the problem and criteria.",
    aliases: [
      { playbooks: ["meddicc", "meddpicc"], fields: ["competition"] },
      { playbooks: ["force management", "force management command of the message"], fields: ["differentiation"] },
      { playbooks: ["the challenger sale", "challenger"], fields: ["unique strengths"] },
    ],
  },
  {
    id: "champion_coach",
    label: "Champion and coach",
    guidance: "Validate whether there is an internal guide or advocate through actions, not positive sentiment alone.",
    aliases: [
      { playbooks: ["meddicc", "meddpicc"], fields: ["champion"] },
      { playbooks: ["strategic selling", "strategic selling miller heiman", "miller heiman"], fields: ["coach"] },
    ],
  },
]

export function buildPlaybookIntentClusters({
  opportunityEvidence = [],
  playbookFields,
  playbooks,
}: {
  opportunityEvidence?: SourceRecord[]
  playbookFields: SourceRecord[]
  playbooks: SourceRecord[]
}): PlaybookIntentCluster[] {
  const playbookById = new Map(
    playbooks.flatMap((playbook) => {
      const id = getString(playbook.id)
      return id ? [[id, playbook]] : []
    })
  )
  const evidenceByFieldId = new Map(
    opportunityEvidence.flatMap((evidence) => {
      const fieldId = getString(evidence.playbook_field_id)
      return fieldId ? [[fieldId, evidence]] : []
    })
  )
  const clustersById = new Map<string, PlaybookIntentCluster>()
  const standaloneClusters: PlaybookIntentCluster[] = []

  playbookFields.forEach((field) => {
    const playbookFieldId = getString(field.id)
    const playbookId = getString(field.playbook_id)
    const fieldLabel = getString(field.label)
    if (!playbookFieldId || !playbookId || !fieldLabel) return

    const playbook = playbookById.get(playbookId)
    const playbookSlug = getString(playbook?.slug)
    const playbookLabel = getString(playbook?.name) || playbookSlug || "Selected playbook"
    const evidence = evidenceByFieldId.get(playbookFieldId)
    const clusterDefinition = findIntentClusterDefinition({
      fieldLabel,
      playbookLabel,
      playbookSlug,
    })
    const clusterField: IntentClusterField = {
      playbookFieldId,
      playbookId,
      playbookSlug,
      playbookLabel,
      fieldLabel,
      fieldDescription: getString(field.description),
      evidenceStandard: getString(field.evidence_standard),
      sortOrder: getInteger(field.sort_order),
      status: normalizeEvidenceStatus(evidence?.status),
      confidence: getNumber(evidence?.confidence),
      evidenceSummary: getString(evidence?.evidence_summary),
      value: getString(evidence?.value),
    }

    if (!clusterDefinition) {
      standaloneClusters.push(createClusterFromFields({
        fields: [clusterField],
        guidance: `Gather enough evidence for ${playbookLabel} ${fieldLabel} without forcing a checklist-style question.`,
        id: `field_${sanitizeId(playbookFieldId)}`,
        label: `${playbookLabel} ${fieldLabel}`,
      }))
      return
    }

    const existingCluster = clustersById.get(clusterDefinition.id)
    if (existingCluster) {
      existingCluster.fields.push(clusterField)
      return
    }

    clustersById.set(
      clusterDefinition.id,
      createClusterFromFields({
        fields: [clusterField],
        guidance: clusterDefinition.guidance,
        id: clusterDefinition.id,
        label: clusterDefinition.label,
      })
    )
  })

  return [
    ...playbookIntentCatalog
      .map((definition) => clustersById.get(definition.id))
      .filter((cluster): cluster is PlaybookIntentCluster => Boolean(cluster))
      .map(recalculateClusterStatus),
    ...standaloneClusters.map(recalculateClusterStatus),
  ]
}

function createClusterFromFields({
  fields,
  guidance,
  id,
  label,
}: {
  fields: IntentClusterField[]
  guidance: string
  id: string
  label: string
}): PlaybookIntentCluster {
  return recalculateClusterStatus({
    id,
    label,
    guidance,
    fields,
    status: "missing",
    confirmedCount: 0,
    weakCount: 0,
    missingCount: 0,
  })
}

function findIntentClusterDefinition({
  fieldLabel,
  playbookLabel,
  playbookSlug,
}: {
  fieldLabel: string
  playbookLabel: string
  playbookSlug: string
}) {
  const normalizedField = normalizeIntentKey(fieldLabel)
  const playbookKeys = [playbookLabel, playbookSlug].map(normalizeIntentKey).filter(Boolean)
  const isCustomPlaybook = playbookKeys.includes("custom") || playbookKeys.includes("custom framework")

  return playbookIntentCatalog.find((definition) =>
    definition.aliases.some((alias) => {
      const fieldMatches = alias.fields.map(normalizeIntentKey).includes(normalizedField)
      if (!fieldMatches) return false
      if (isCustomPlaybook) return true

      return alias.playbooks.map(normalizeIntentKey).some((aliasPlaybook) =>
        playbookKeys.some((playbookKey) => playbookKey === aliasPlaybook || playbookKey.includes(aliasPlaybook))
      )
    })
  )
}

function recalculateClusterStatus(cluster: PlaybookIntentCluster): PlaybookIntentCluster {
  const confirmedCount = cluster.fields.filter((field) => field.status === "confirmed").length
  const weakCount = cluster.fields.filter((field) => field.status === "weak" || field.status === "asked").length
  const missingCount = Math.max(0, cluster.fields.length - confirmedCount - weakCount)
  const status =
    confirmedCount === cluster.fields.length && cluster.fields.length > 0
      ? "confirmed"
      : weakCount > 0 || confirmedCount > 0
        ? "weak"
        : "missing"

  return {
    ...cluster,
    status,
    confirmedCount,
    weakCount,
    missingCount,
  }
}

function normalizeEvidenceStatus(value: unknown): IntentClusterStatus {
  if (value === "confirmed") return "confirmed"
  if (value === "asked") return "asked"
  if (value === "weak") return "weak"

  return "missing"
}

function normalizeIntentKey(value: unknown) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : ""
}

function sanitizeId(value: string) {
  return normalizeIntentKey(value).replace(/\s+/g, "_") || "unknown"
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : undefined
}

function getInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}
