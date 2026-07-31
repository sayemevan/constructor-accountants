/**
 * Supported display currencies for BuildLedger.
 *
 * The app stores raw numeric amounts only — currency is purely a display
 * preference chosen by the contractor in Settings. Bangladeshi Taka (BDT)
 * is the default.
 */

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export const DEFAULT_CURRENCY = "BDT";

export const CURRENCIES: CurrencyOption[] = [
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
];

export function getCurrency(code: string): CurrencyOption {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function isSupportedCurrency(code: string | null | undefined): boolean {
  return !!code && CURRENCIES.some((c) => c.code === code);
}
