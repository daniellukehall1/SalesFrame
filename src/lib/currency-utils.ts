import {
  defaultCurrencyCode,
  normalizeCurrencyCode,
  type CurrencyCode,
} from "@/lib/salesframe-core"

export function parseCurrencyAmount(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase()
  if (!normalized || normalized === "unqualified") return null

  const multiplier = normalized.includes("m")
    ? 1_000_000
    : normalized.includes("k")
      ? 1_000
      : 1
  const match = normalized.replace(/,/g, "").match(/-?\d+(\.\d+)?/)

  if (!match) return null

  return Number(match[0]) * multiplier
}

export function formatCurrencyAmount(
  value: string | number | null | undefined,
  currency: CurrencyCode | string | null | undefined = defaultCurrencyCode,
  options: { compact?: boolean } = {}
) {
  const amount = typeof value === "number" ? value : parseCurrencyAmount(value)
  if (amount === null || !Number.isFinite(amount)) return typeof value === "string" && value.trim() ? value : "Unqualified"

  const resolvedCurrency = normalizeCurrencyCode(currency)

  return new Intl.NumberFormat("en-AU", {
    currency: resolvedCurrency,
    maximumFractionDigits: amount >= 1000 || options.compact ? 0 : 2,
    notation: options.compact ? "compact" : "standard",
    style: "currency",
  }).format(amount)
}
