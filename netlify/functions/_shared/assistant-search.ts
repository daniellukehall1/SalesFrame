type SearchableRecord = Record<string, unknown>

export type AssistantSearchMatch<T> = {
  item: T
  score: number
}

export function normalizeAssistantSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function rankAssistantSearch<T extends SearchableRecord>(
  rows: T[],
  queryValue: string,
  keys: string[],
  limit: number
): AssistantSearchMatch<T>[] {
  const query = normalizeAssistantSearchText(queryValue)
  if (!query) return []

  return rows
    .map((item, index) => ({
      index,
      item,
      score: scoreAssistantSearchRecord(item, query, keys),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map(({ item, score }) => ({ item, score }))
}

export function scoreAssistantSearchRecord(
  row: SearchableRecord,
  queryValue: string,
  keys: string[]
) {
  const query = normalizeAssistantSearchText(queryValue)
  if (!query) return 0

  const fields = keys
    .map((key) => normalizeAssistantSearchText(row[key]))
    .filter(Boolean)
  if (fields.length === 0) return 0

  if (fields.some((field) => field === query)) return 1_000
  if (fields.some((field) => hasWholePhrase(field, query))) return 900

  const aliases = buildSearchAliases(fields)
  if (aliases.has(query)) return 860

  const queryTokens = query.split(" ").filter(Boolean)
  const tokenScores: number[] = []
  for (const token of queryTokens) {
    const score = scoreSearchToken(fields, aliases, token)
    if (score === 0) return 0
    tokenScores.push(score)
  }

  // Keep the ranking tiers strict. Multiple weak token matches should gain a
  // modest full-query coverage bonus, but can never outrank a phrase or alias.
  const averageScore = tokenScores.reduce((total, score) => total + score, 0) / tokenScores.length
  const coverageBonus = Math.min(80, Math.max(0, tokenScores.length - 1) * 40)
  return Math.min(840, Math.round(averageScore + coverageBonus))
}

function buildSearchAliases(fields: string[]) {
  const aliases = new Set<string>()
  const primaryWords = fields[0]?.split(" ").filter(Boolean) ?? []
  const primaryInitials = initialism(primaryWords)

  for (const field of fields) {
    const words = field.split(" ").filter(Boolean)
    if (words.length === 0) continue
    aliases.add(words.join(""))
    if (words.length > 1) aliases.add(initialism(words))
    for (const word of words) aliases.add(word)
  }

  // Sellers commonly use a company initialism that includes a country or
  // region omitted from the account's display name (for example, CBA for a
  // "Commonwealth Bank" account whose region includes Australia).
  if (primaryInitials.length >= 2) {
    for (const field of fields.slice(1)) {
      const words = field.split(" ").filter(Boolean)
      for (const word of words) aliases.add(`${primaryInitials}${word[0]}`)
      if (words.length > 1) aliases.add(`${primaryInitials}${initialism(words)}`)
    }
  }

  return aliases
}

function scoreSearchToken(fields: string[], aliases: Set<string>, token: string) {
  if (aliases.has(token)) return 820 + token.length
  const words = fields.flatMap((field) => field.split(" ").filter(Boolean))
  if (words.includes(token)) return 650 + token.length
  if (token.length >= 2 && words.some((word) => word.startsWith(token))) return 560 + token.length
  if (token.length >= 4 && words.some((word) => isSmallTypo(word, token))) return 430 + token.length
  return 0
}

function hasWholePhrase(text: string, query: string) {
  return ` ${text} `.includes(` ${query} `)
}

function initialism(words: string[]) {
  return words.map((word) => word[0]).join("")
}

function isSmallTypo(word: string, token: string) {
  const maximumDistance = Math.max(word.length, token.length) >= 8 ? 2 : 1
  if (Math.abs(word.length - token.length) > maximumDistance) return false
  return boundedEditDistance(word, token, maximumDistance) <= maximumDistance
}

function boundedEditDistance(left: string, right: string, maximum: number) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    let rowMinimum = current[0]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      const value = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        substitution
      )
      current.push(value)
      rowMinimum = Math.min(rowMinimum, value)
    }
    if (rowMinimum > maximum) return maximum + 1
    previous = current
  }
  return previous[right.length]
}
