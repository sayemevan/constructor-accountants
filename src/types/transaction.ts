export type TransactionType = "income" | "expense" | "subcontractor_payout" | "material_purchase";

export type TransactionCategory =
  | "Client Invoice"
  | "Labor / Payroll"
  | "Equipment Rental"
  | "Building Materials"
  | "Permits & Licenses"
  | "Subcontractor Fee"
  | "Utilities & Site Overhead"
  | "Misc";

export interface Transaction {
  id: string;
  transactionNo: string;
  date: string;
  projectId: string;
  projectName: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  payeeOrPayer: string;
  accountName: string;
  status: "cleared" | "pending" | "reconciled";
  receiptDriveUrl?: string;
  description: string;
  sheetRowIndex?: number;
}
