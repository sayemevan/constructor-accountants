"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  CURRENCIES,
  CurrencyOption,
  DEFAULT_CURRENCY,
  getCurrency,
  isSupportedCurrency,
} from "@/lib/currencies";
import { formatCurrency as baseFormatCurrency } from "@/utils/formatters";

const STORAGE_KEY = "cca_currency";

interface SettingsContextType {
  /** Selected display currency code (e.g. "BDT"). */
  currency: string;
  /** Change the global display currency and persist it. */
  setCurrency: (code: string) => void;
  /** Narrow symbol for the selected currency (e.g. "৳"). */
  currencySymbol: string;
  /** Full list of currencies the user can pick from. */
  currencies: CurrencyOption[];
  /**
   * Format an amount using the globally selected currency. Pass an explicit
   * `currencyOverride` (e.g. a per-account currency) to bypass the global one.
   */
  formatCurrency: (amount: number, currencyOverride?: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isSupportedCurrency(saved)) {
      setCurrencyState(saved as string);
    }
  }, []);

  const setCurrency = useCallback((code: string) => {
    if (!isSupportedCurrency(code)) return;
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const formatCurrency = useCallback(
    (amount: number, currencyOverride?: string) =>
      baseFormatCurrency(amount, currencyOverride || currency),
    [currency]
  );

  const currencySymbol = getCurrency(currency).symbol;

  return (
    <SettingsContext.Provider
      value={{ currency, setCurrency, currencySymbol, currencies: CURRENCIES, formatCurrency }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
