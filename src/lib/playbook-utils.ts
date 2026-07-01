import {
  callPlaybookAliases,
  callPlaybookOptions,
  defaultCallPlaybooks,
  type CallPlaybook,
} from "@/lib/salesframe-core"

export function parsePlaybookSelection(value?: string): CallPlaybook[] {
  const tokens = (value ?? "")
    .split(/[,·]/)
    .map((item) => item.trim())
    .filter(Boolean)

  return normalizePlaybooks(tokens)
}

export function normalizePlaybooks(value: readonly string[]): CallPlaybook[] {
  const selected: CallPlaybook[] = []

  value.forEach((item) => {
    const normalizedItem = item.toLowerCase()
    const matchedPlaybook =
      callPlaybookOptions.find((playbook) => playbook.toLowerCase() === normalizedItem) ??
      callPlaybookAliases[normalizedItem]

    if (matchedPlaybook && !selected.includes(matchedPlaybook)) {
      selected.push(matchedPlaybook)
    }
  })

  return selected.length ? selected : [...defaultCallPlaybooks]
}

export function formatPlaybooks(value: readonly string[]) {
  return normalizePlaybooks(value).join(", ")
}
