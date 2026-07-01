import {
  openAiKeyStateStorageKey,
  type SavedOpenAiKeyState,
} from "@/lib/salesframe-core"

export function loadSavedOpenAiKeyState(): SavedOpenAiKeyState | null {
  try {
    const storedValue = window.localStorage.getItem(openAiKeyStateStorageKey)
    if (!storedValue) return null

    const parsedValue = JSON.parse(storedValue) as Partial<SavedOpenAiKeyState>
    const storageMode = typeof parsedValue.storageMode === "string" ? parsedValue.storageMode : ""

    if (storageMode !== "browser-managed") {
      return null
    }

    if (
      typeof parsedValue.maskedKey !== "string" ||
      typeof parsedValue.fingerprint !== "string" ||
      typeof parsedValue.savedAt !== "string"
    ) {
      return null
    }

    return {
      maskedKey: parsedValue.maskedKey,
      fingerprint: parsedValue.fingerprint,
      savedAt: parsedValue.savedAt,
      storageMode: "browser-managed",
    }
  } catch {
    return null
  }
}

export function createSavedOpenAiKeyState(value: string): SavedOpenAiKeyState {
  const trimmedValue = value.trim()

  return {
    maskedKey: maskOpenAiKey(trimmedValue),
    fingerprint: createLocalKeyFingerprint(trimmedValue),
    savedAt: new Date().toISOString(),
    storageMode: "browser-managed",
  }
}

export function formatSavedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Saved"

  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function maskOpenAiKey(value: string) {
  if (value.length <= 10) return "Saved key"

  const prefix = value.startsWith("sk-")
    ? value.slice(0, Math.min(7, value.length - 4))
    : value.slice(0, 3)
  const suffix = value.slice(-4)

  return `${prefix}...${suffix}`
}

function createLocalKeyFingerprint(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(16).padStart(8, "0").toUpperCase()
}
