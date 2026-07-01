export function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function parseDateValue(value: string) {
  const trimmed = value.trim()

  if (!trimmed || /^not set$/i.test(trimmed)) return undefined

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatCloseDateValue(value?: string | null) {
  const trimmed = (value ?? "").trim()
  const parsed = parseDateValue(trimmed)

  if (parsed) return formatDisplayDate(parsed)
  return trimmed || "Not set"
}

export function normalizeCloseDateForPersistence(value: string, defaultValue?: string) {
  const rawValue = value.trim() || defaultValue?.trim() || ""
  const parsed = parseDateValue(rawValue)

  if (!rawValue || /^not set$/i.test(rawValue)) {
    return {
      date: null,
      display: "Not set",
      note: "Not set",
    }
  }

  if (!parsed) {
    return {
      date: null,
      display: rawValue,
      note: rawValue,
    }
  }

  const display = formatDisplayDate(parsed)

  return {
    date: toIsoDate(parsed),
    display,
    note: display,
  }
}
