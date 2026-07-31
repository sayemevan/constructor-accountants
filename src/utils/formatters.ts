/**
 * Formatting utility functions for Construction Account Keeper
 */

export function formatCurrency(
  amount: number,
  currency: string = "BDT",
  locale: string = "en-US"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for environments/currencies that don't support "narrowSymbol".
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

export function formatDate(dateString: string | Date, fallback: string = "—"): string {
  if (dateString == null || dateString === "") return fallback;
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  // Guard against invalid dates (e.g. empty/malformed strings) — Intl throws on these.
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}
