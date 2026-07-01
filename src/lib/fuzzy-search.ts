import type { AccountNavItem } from "@/components/nav-projects"
import type {
  Opportunity,
  OpportunityCoverageFilter,
  OpportunityDraft,
  OpportunitySort,
} from "@/lib/salesframe-core"
import { parseCurrencyAmount } from "@/lib/currency-utils"

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function getFuzzySearchScore(text: string, query: string) {
  const normalizedText = normalizeSearchText(text)
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean)

  if (!tokens.length) return 1
  if (!normalizedText) return 0

  let score = 0
  for (const token of tokens) {
    const tokenScore = scoreSearchToken(normalizedText, token)
    if (tokenScore < getMinimumTokenScore(token)) return 0
    score += tokenScore
  }

  return score
}

export function getFuzzyMatches<T>(items: T[], query: string, getText: (item: T) => string) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return items

  return items
    .map((item, index) => ({
      item,
      index,
      score: getFuzzySearchScore(getText(item), normalizedQuery),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((match) => match.item)
}

export function getOpportunitySearchText(
  opportunity: Opportunity,
  account?: AccountNavItem,
  draft?: OpportunityDraft
) {
  return [
    opportunity.name,
    account?.name,
    account?.description,
    opportunity.stage,
    opportunity.amount,
    opportunity.closeDate,
    opportunity.callType,
    opportunity.nextQuestion,
    opportunity.questionReason,
    draft?.frameworks,
    draft?.source,
    draft?.nextStep,
    draft?.pain,
    draft?.decisionProcess,
    draft?.manualNotes,
    ...opportunity.notes,
    ...opportunity.stakeholders.flatMap((stakeholder) => [
      stakeholder.name,
      stakeholder.role,
      stakeholder.status,
    ]),
    ...opportunity.meddicc.flatMap((field) => [field.label, field.status, field.detail]),
    ...opportunity.bant.flatMap((field) => [field.label, field.status, field.detail]),
    ...opportunity.transcript.flatMap((line) => [
      line.speaker,
      line.speakerDisplayName,
      line.speakerLabel,
      line.time,
      line.text,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
}

export function matchesCoverageFilter(opportunity: Opportunity, filter: OpportunityCoverageFilter) {
  if (filter === "all") return true
  if (filter === "needs-attention") return opportunity.coverage < 65 || opportunity.missing >= 5

  return getCoverageTone(opportunity.coverage) === filter
}

export function sortOpportunities(items: Opportunity[], sort: OpportunitySort) {
  return [...items].sort((left, right) => {
    if (sort === "coverage-asc") return left.coverage - right.coverage
    if (sort === "coverage-desc") return right.coverage - left.coverage
    if (sort === "value-desc") return parseOpportunityAmount(right.amount) - parseOpportunityAmount(left.amount)
    if (sort === "close-date") return left.closeDate.localeCompare(right.closeDate)

    return right.missing + right.weak - (left.missing + left.weak)
  })
}

function scoreSearchToken(text: string, token: string) {
  if (!token) return 0

  const words = text.split(" ").filter(Boolean)
  if (words.some((word) => word === token)) return 360 + token.length * 10
  if (words.some((word) => word.startsWith(token))) return 300 + token.length * 8

  if (token.length === 1) return 0

  if (token.length >= 3 && text.includes(token)) return 240 + token.length * 7
  if (token.length === 2 && words.some((word) => word.endsWith(token) && word.length <= 8)) {
    return 170 + token.length * 6
  }

  const acronym = words.map((word) => word[0]).join("")
  if (token.length >= 2 && acronym.startsWith(token)) return 210 + token.length * 6

  let bestScore = 0
  for (const word of words) {
    bestScore = Math.max(
      bestScore,
      scoreTypoCandidate(word, token),
      scoreSearchWord(word, token)
    )
  }

  return bestScore
}

function scoreSearchWord(word: string, token: string) {
  if (token.length < 3) return 0

  let tokenIndex = 0
  let score = 0
  let previousMatch = -1
  let firstMatch = -1

  for (let textIndex = 0; textIndex < word.length && tokenIndex < token.length; textIndex += 1) {
    if (word[textIndex] !== token[tokenIndex]) continue

    if (firstMatch === -1) firstMatch = textIndex
    score += previousMatch === textIndex - 1 ? 12 : 5
    if (textIndex === 0) score += 8
    previousMatch = textIndex
    tokenIndex += 1
  }

  if (tokenIndex !== token.length) return 0
  if (firstMatch > 2) return 0

  const span = previousMatch - firstMatch + 1
  const density = token.length / span
  const minimumDensity = token.length <= 4 ? 0.72 : 0.58
  if (density < minimumDensity) return 0

  const spreadPenalty = Math.max(0, span - token.length) * 4
  return Math.max(0, 110 + density * 70 + score - spreadPenalty)
}

function scoreTypoCandidate(word: string, token: string) {
  if (token.length < 4) return 0
  if (word[0] !== token[0]) return 0

  const candidates = [
    word,
    word.slice(0, token.length),
    word.slice(0, token.length + 1),
  ].filter((candidate) => Math.abs(candidate.length - token.length) <= 2)

  let bestScore = 0
  for (const candidate of candidates) {
    const distance = getEditDistance(candidate, token)
    const maxDistance = token.length <= 5 ? 1 : 2
    if (distance <= maxDistance) {
      bestScore = Math.max(bestScore, 205 - distance * 35)
    }
  }

  return bestScore
}

function getMinimumTokenScore(token: string) {
  if (token.length <= 2) return 160
  if (token.length <= 4) return 115

  return 100
}

function getEditDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost
      )
    }

    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

export function parseOpportunityAmount(value: string) {
  return parseCurrencyAmount(value) ?? 0
}

function getCoverageTone(value: number) {
  if (value < 40) return "low"
  if (value < 67) return "mid"
  return "high"
}
