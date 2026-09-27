import { z } from 'zod';

/**
 * Shared value formats (05 §1, 10). Money and decimals travel as strings, never JS numbers (00 rule 5).
 */

/** A non-negative `numeric(18,2)` amount as a string: `"0"`, `"12500"`, `"12500.5"`, `"12500.50"`. */
export const MoneyAmount = z
  .string()
  .regex(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/, 'Must be a non-negative amount with up to 2 decimals.');
export type MoneyAmount = z.infer<typeof MoneyAmount>;

/** A business date, `YYYY-MM-DD` (no time, no zone). */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

/**
 * Active ISO 4217 currency codes (allowlist, 05 "Currency"). Explicit rather than `Intl.supportedValuesOf`,
 * whose answer depends on the runtime's ICU data — browser and server must agree.
 */
export const CURRENCY_CODES = (
  'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD ' +
  'CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ ' +
  'GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR ' +
  'LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN ' +
  'PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB ' +
  'TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWG'
).split(' ');
const CURRENCY_SET = new Set(CURRENCY_CODES);

export const CurrencyCode = z
  .string()
  .refine((code) => CURRENCY_SET.has(code), 'Must be a supported ISO 4217 currency code.');
export type CurrencyCode = z.infer<typeof CurrencyCode>;

/** ISO 3166-1 alpha-2, upper case (`BD`, `US`). */
export const CountryCode = z.string().regex(/^[A-Z]{2}$/, 'Must be an ISO 3166-1 alpha-2 code.');
export type CountryCode = z.infer<typeof CountryCode>;

/** An IANA time zone the runtime knows (`Asia/Dhaka`, `UTC`). */
export const TimeZone = z
  .string()
  .min(1)
  .max(64)
  .refine(isTimeZone, 'Must be a valid IANA time zone.');
export type TimeZone = z.infer<typeof TimeZone>;

/** A BCP 47 language tag in canonical form (`en`, `en-US`, `bn-BD`). */
export const Locale = z
  .string()
  .min(2)
  .max(35)
  .refine(isCanonicalLocale, 'Must be a canonical BCP 47 language tag, e.g. en-US.');
export type Locale = z.infer<typeof Locale>;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isCanonicalLocale(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value)[0] === value;
  } catch {
    return false;
  }
}
