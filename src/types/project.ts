import { ProjectWorkspaceFolders } from "./google";

export type ProjectStatus = "planning" | "running" | "completed" | "on_hold";

export interface ConstructionProject {
  id: string;
  code: string;
  name: string;
  ownerName: string;
  address: string;
  startDate: string;
  estimatedCompletion: string;
  status: ProjectStatus;
  
  // Financial Contract Summary
  contractValue: number;
  amountReceived: number;
  remainingBalance: number; // contractValue - amountReceived

  // Quick Statistics & Expense Breakdown
  totalExpense: number;
  laborCost: number;
  materialCost: number;
  architectCost: number;
  currentProfit: number; // amountReceived - totalExpense

  manager: string;
  clientName?: string;
  notes?: string;
  folders?: ProjectWorkspaceFolders;
  sheetRowIndex?: number;

  /**
   * How the construction fee (contractValue) was determined:
   *  - "total"    → a lump-sum figure entered directly.
   *  - "per_sqft" → areaSqFt × ratePerSqFt.
   * Undefined until a fee has been calculated (it can be set later).
   */
  feeMode?: "total" | "per_sqft";
  areaSqFt?: number;
  ratePerSqFt?: number;

  /** Per-project data model: this project's own Google Spreadsheet + folder. */
  projectSpreadsheetId?: string;
  projectFolderId?: string;
}
