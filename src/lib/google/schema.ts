import { ConstructionProject, ProjectStatus } from "@/types/project";
import { SiteWorker, WorkerPayment, WorkerStatus, WorkerTrade } from "@/types/worker";
import { Transaction, TransactionType, TransactionCategory } from "@/types/transaction";
import { MaterialItem } from "@/types/material";
import { Account, AccountType } from "@/types/account";
import { ProjectMember, ProjectRole, MemberStatus } from "@/types/member";

/** Master spreadsheet identity — used to detect an app-created workspace in Drive. */
export const WORKSPACE_FOLDER_NAME = "Construction Keeper";
export const MASTER_SPREADSHEET_NAME = "Construction Keeper — Ledger";
export const APP_MARKER_KEY = "ckApp";
export const APP_MARKER_VALUE = "construction-keeper";
/** Distinguishes the contractor's master registry sheet from per-project sheets. */
export const APP_TYPE_KEY = "ckType";
export const MASTER_TYPE = "master";
export const PROJECT_TYPE = "project";
export const APP_PROJECT_ID_KEY = "ckProjectId";
export const SCHEMA_VERSION = "1.0.0";

export const TABS = {
  projects: "Projects",
  workers: "Workers",
  workerPayments: "WorkerPayments",
  transactions: "Transactions",
  materials: "Materials",
  accounts: "Accounts",
  members: "Members",
  settings: "Settings",
} as const;

export type Row = (string | number)[];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v == null ? "" : String(v));

export interface EntitySchema<T> {
  tab: string;
  headers: string[];
  toRow: (item: T) => Row;
  fromRow: (row: Row) => T;
}

export const projectSchema: EntitySchema<ConstructionProject> = {
  tab: TABS.projects,
  headers: [
    "id", "code", "name", "ownerName", "address", "startDate", "estimatedCompletion",
    "status", "contractValue", "amountReceived", "remainingBalance", "totalExpense",
    "laborCost", "materialCost", "architectCost", "currentProfit", "manager", "clientName", "notes",
    "projectSpreadsheetId", "projectFolderId", "feeMode", "areaSqFt", "ratePerSqFt",
  ],
  toRow: (p) => [
    p.id, p.code, p.name, p.ownerName, p.address, p.startDate, p.estimatedCompletion,
    p.status, p.contractValue, p.amountReceived, p.remainingBalance, p.totalExpense,
    p.laborCost, p.materialCost, p.architectCost, p.currentProfit, p.manager,
    p.clientName ?? "", p.notes ?? "", p.projectSpreadsheetId ?? "", p.projectFolderId ?? "",
    p.feeMode ?? "", p.areaSqFt ?? "", p.ratePerSqFt ?? "",
  ],
  fromRow: (r) => ({
    id: str(r[0]), code: str(r[1]), name: str(r[2]), ownerName: str(r[3]), address: str(r[4]),
    startDate: str(r[5]), estimatedCompletion: str(r[6]), status: (str(r[7]) || "planning") as ProjectStatus,
    contractValue: num(r[8]), amountReceived: num(r[9]), remainingBalance: num(r[10]), totalExpense: num(r[11]),
    laborCost: num(r[12]), materialCost: num(r[13]), architectCost: num(r[14]), currentProfit: num(r[15]),
    manager: str(r[16]), clientName: str(r[17]) || undefined, notes: str(r[18]) || undefined,
    projectSpreadsheetId: str(r[19]) || undefined, projectFolderId: str(r[20]) || undefined,
    feeMode: (str(r[21]) as "total" | "per_sqft") || undefined,
    areaSqFt: num(r[22]) || undefined, ratePerSqFt: num(r[23]) || undefined,
  }),
};

export const workerSchema: EntitySchema<Omit<SiteWorker, "payments">> = {
  tab: TABS.workers,
  headers: [
    "id", "name", "phone", "address", "trade", "dailyWage", "joiningDate",
    "status", "projectId", "projectName", "totalDaysWorked", "totalPaidOut",
  ],
  toRow: (w) => [
    w.id, w.name, w.phone, w.address, w.trade, w.dailyWage, w.joiningDate,
    w.status, w.projectId, w.projectName, w.totalDaysWorked ?? 0, w.totalPaidOut ?? 0,
  ],
  fromRow: (r) => ({
    id: str(r[0]), name: str(r[1]), phone: str(r[2]), address: str(r[3]),
    trade: (str(r[4]) || "General Laborer") as WorkerTrade, dailyWage: num(r[5]), joiningDate: str(r[6]),
    status: (str(r[7]) || "active") as WorkerStatus, projectId: str(r[8]), projectName: str(r[9]),
    totalDaysWorked: num(r[10]), totalPaidOut: num(r[11]),
  }),
};

export const workerPaymentSchema: EntitySchema<WorkerPayment> = {
  tab: TABS.workerPayments,
  headers: ["id", "workerId", "date", "amount", "daysWorked", "paymentMethod", "transactionNo", "notes"],
  toRow: (p) => [
    p.id, p.workerId, p.date, p.amount, p.daysWorked, p.paymentMethod, p.transactionNo, p.notes ?? "",
  ],
  fromRow: (r) => ({
    id: str(r[0]), workerId: str(r[1]), date: str(r[2]), amount: num(r[3]), daysWorked: num(r[4]),
    paymentMethod: (str(r[5]) || "Cash") as WorkerPayment["paymentMethod"], transactionNo: str(r[6]),
    notes: str(r[7]) || undefined,
  }),
};

export const transactionSchema: EntitySchema<Transaction> = {
  tab: TABS.transactions,
  headers: [
    "id", "transactionNo", "date", "projectId", "projectName", "type", "category",
    "amount", "payeeOrPayer", "accountName", "status", "receiptDriveUrl", "description",
  ],
  toRow: (t) => [
    t.id, t.transactionNo, t.date, t.projectId, t.projectName, t.type, t.category,
    t.amount, t.payeeOrPayer, t.accountName, t.status, t.receiptDriveUrl ?? "", t.description,
  ],
  fromRow: (r) => ({
    id: str(r[0]), transactionNo: str(r[1]), date: str(r[2]), projectId: str(r[3]), projectName: str(r[4]),
    type: (str(r[5]) || "expense") as TransactionType, category: (str(r[6]) || "Misc") as TransactionCategory,
    amount: num(r[7]), payeeOrPayer: str(r[8]), accountName: str(r[9]),
    status: (str(r[10]) || "cleared") as Transaction["status"], receiptDriveUrl: str(r[11]) || undefined,
    description: str(r[12]),
  }),
};

export const materialSchema: EntitySchema<MaterialItem> = {
  tab: TABS.materials,
  headers: [
    "id", "projectId", "projectName", "itemCode", "name", "category", "unit", "unitPrice",
    "quantityInStock", "reorderLevel", "supplier", "lastPurchasedDate",
  ],
  toRow: (m) => [
    m.id, m.projectId, m.projectName, m.itemCode, m.name, m.category, m.unit, m.unitPrice,
    m.quantityInStock, m.reorderLevel, m.supplier, m.lastPurchasedDate,
  ],
  fromRow: (r) => ({
    id: str(r[0]), projectId: str(r[1]), projectName: str(r[2]), itemCode: str(r[3]), name: str(r[4]),
    category: (str(r[5]) || "Concrete & Masonry") as MaterialItem["category"],
    unit: (str(r[6]) || "pcs") as MaterialItem["unit"], unitPrice: num(r[7]),
    quantityInStock: num(r[8]), reorderLevel: num(r[9]), supplier: str(r[10]), lastPurchasedDate: str(r[11]),
  }),
};

export const accountSchema: EntitySchema<Account> = {
  tab: TABS.accounts,
  headers: ["id", "name", "type", "accountNumberMasked", "balance", "currency", "institution", "lastSynced"],
  toRow: (a) => [
    a.id, a.name, a.type, a.accountNumberMasked, a.balance, a.currency, a.institution, a.lastSynced,
  ],
  fromRow: (r) => ({
    id: str(r[0]), name: str(r[1]), type: (str(r[2]) || "bank") as AccountType,
    accountNumberMasked: str(r[3]), balance: num(r[4]), currency: str(r[5]) || "USD",
    institution: str(r[6]), lastSynced: str(r[7]),
  }),
};

export const memberSchema: EntitySchema<ProjectMember> = {
  tab: TABS.members,
  headers: ["id", "email", "name", "role", "status", "invitedAt"],
  toRow: (m) => [m.id, m.email, m.name, m.role, m.status, m.invitedAt],
  fromRow: (r) => ({
    id: str(r[0]), email: str(r[1]), name: str(r[2]),
    role: (str(r[3]) || "client") as ProjectRole,
    status: (str(r[4]) || "pending") as MemberStatus,
    invitedAt: str(r[5]),
  }),
};

/**
 * Master ledger tabs (the contractor's private registry). Per-project data lives
 * in each project's own spreadsheet, so the master only holds the Projects
 * registry and workspace-level Accounts (plus the hidden Settings tab).
 */
export const DATA_TAB_HEADERS: { tab: string; headers: string[] }[] = [
  { tab: projectSchema.tab, headers: projectSchema.headers },
  { tab: accountSchema.tab, headers: accountSchema.headers },
];

/**
 * Tabs created inside each *per-project* spreadsheet (Phase 2+ data model).
 * A project's own spreadsheet holds only that project's data plus its Members
 * registry, so it can be shared with a single collaborator in isolation.
 */
export const PROJECT_DATA_TAB_HEADERS: { tab: string; headers: string[] }[] = [
  // A single-row copy of this project's registry entry, so an invited
  // collaborator (who can't see the contractor's master ledger) can still read
  // the project header (name, contract value, financials) from the shared sheet.
  { tab: projectSchema.tab, headers: projectSchema.headers },
  { tab: workerSchema.tab, headers: workerSchema.headers },
  { tab: workerPaymentSchema.tab, headers: workerPaymentSchema.headers },
  { tab: transactionSchema.tab, headers: transactionSchema.headers },
  { tab: materialSchema.tab, headers: materialSchema.headers },
  { tab: memberSchema.tab, headers: memberSchema.headers },
];
