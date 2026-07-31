export type AccountType = "bank" | "cash_on_hand" | "vendor_credit" | "petty_cash";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  accountNumberMasked: string;
  balance: number;
  currency: string;
  institution: string;
  lastSynced: string;
}
