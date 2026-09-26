import { z } from "zod";

export const transactionSchema = z.object({
  date: z.string().min(1, "Date is required"),
  projectId: z.string().min(1, "Please select a construction project"),
  type: z.enum(["income", "expense", "subcontractor_payout", "material_purchase"]),
  category: z.string().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  payeeOrPayer: z.string().min(2, "Payee or Payer name is required"),
  accountName: z.string().min(1, "Payment account is required"),
  description: z.string().min(3, "Description must be at least 3 characters"),
});

export interface TransactionFormValues {
  date: string;
  projectId: string;
  type: "income" | "expense" | "subcontractor_payout" | "material_purchase";
  category: string;
  amount: number;
  payeeOrPayer: string;
  accountName: string;
  description: string;
}

export const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  code: z.string().min(2, "Project code/ID is required (e.g. PRJ-2026-01)"),
  ownerName: z.string().min(2, "Owner name is required"),
  address: z.string().min(2, "Project address is required"),
  startDate: z.string().min(1, "Start date is required"),
  // End date is optional — it's often unknown when a project starts.
  estimatedCompletion: z.string().optional(),
  status: z.enum(["planning", "running", "completed", "on_hold"]),
  manager: z.string().min(2, "Project manager name is required"),
  notes: z.string().optional(),
});

export interface ProjectFormValues {
  name: string;
  code: string;
  ownerName: string;
  address: string;
  startDate: string;
  estimatedCompletion?: string;
  status: "planning" | "running" | "completed" | "on_hold";
  manager: string;
  notes?: string;
}

/**
 * Separate "construction fee" calculator. The fee (contractValue) can be a
 * lump-sum total or derived from area × rate per square foot. Material cost is
 * optional because clients often supply materials themselves.
 */
export const feeSchema = z.object({
  feeMode: z.enum(["total", "per_sqft"]),
  contractValue: z.coerce.number().min(0, "Fee cannot be negative").optional(),
  areaSqFt: z.coerce.number().min(0, "Area cannot be negative").optional(),
  ratePerSqFt: z.coerce.number().min(0, "Rate cannot be negative").optional(),
  includeMaterial: z.boolean().optional(),
  materialCost: z.coerce.number().min(0, "Material cost cannot be negative").optional(),
  includeArchitect: z.boolean().optional(),
  architectCost: z.coerce.number().min(0, "Architect fee cannot be negative").optional(),
});

export interface FeeFormValues {
  feeMode: "total" | "per_sqft";
  contractValue?: number;
  areaSqFt?: number;
  ratePerSqFt?: number;
  includeMaterial?: boolean;
  materialCost?: number;
  includeArchitect?: boolean;
  architectCost?: number;
}

export const workerSchema = z.object({
  name: z.string().min(2, "Worker name must be at least 2 characters"),
  phone: z.string().min(7, "Valid phone number is required"),
  address: z.string().min(3, "Residential address is required"),
  trade: z.enum([
    "Mason",
    "Carpenter",
    "Electrician",
    "Plumber",
    "Steel Fixer",
    "Painter",
    "Welder",
    "General Laborer",
  ]),
  dailyWage: z.coerce.number().positive("Daily wage must be greater than 0"),
  joiningDate: z.string().min(1, "Joining date is required"),
  status: z.enum(["active", "inactive", "deactivated"]),
  projectId: z.string().min(1, "Worker must belong to a project"),
});

export interface WorkerFormValues {
  name: string;
  phone: string;
  address: string;
  trade:
    | "Mason"
    | "Carpenter"
    | "Electrician"
    | "Plumber"
    | "Steel Fixer"
    | "Painter"
    | "Welder"
    | "General Laborer";
  dailyWage: number;
  joiningDate: string;
  status: "active" | "inactive" | "deactivated";
  projectId: string;
}

export const accountSchema = z.object({
  name: z.string().min(2, "Account name is required"),
  type: z.enum(["bank", "cash_on_hand", "vendor_credit", "petty_cash"]),
  institution: z.string().optional(),
  accountNumberMasked: z.string().optional(),
  balance: z.coerce.number(),
  currency: z.string().min(1, "Currency is required"),
});

export interface AccountFormValues {
  name: string;
  type: "bank" | "cash_on_hand" | "vendor_credit" | "petty_cash";
  institution?: string;
  accountNumberMasked?: string;
  balance: number;
  currency: string;
}

export const materialSchema = z.object({
  projectId: z.string().min(1, "Please select a construction project"),
  itemCode: z.string().min(1, "Item code is required"),
  name: z.string().min(2, "Material name is required"),
  category: z.enum([
    "Concrete & Masonry",
    "Steel & Rebar",
    "Lumber & Carpentry",
    "Electrical",
    "Plumbing",
    "Finishes",
  ]),
  unit: z.enum(["tons", "bags", "pcs", "sq_ft", "linear_ft", "gallons"]),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  quantityInStock: z.coerce.number().min(0, "Stock quantity cannot be negative"),
  reorderLevel: z.coerce.number().min(0, "Reorder level cannot be negative"),
  supplier: z.string().min(2, "Supplier name is required"),
  lastPurchasedDate: z.string().min(1, "Last purchased date is required"),
});

export interface MaterialFormValues {
  projectId: string;
  itemCode: string;
  name: string;
  category:
    | "Concrete & Masonry"
    | "Steel & Rebar"
    | "Lumber & Carpentry"
    | "Electrical"
    | "Plumbing"
    | "Finishes";
  unit: "tons" | "bags" | "pcs" | "sq_ft" | "linear_ft" | "gallons";
  unitPrice: number;
  quantityInStock: number;
  reorderLevel: number;
  supplier: string;
  lastPurchasedDate: string;
}

export const dailyWageSchema = z.object({
  date: z.string().min(1, "Date is required"),
  workerId: z.string().min(1, "Please select a worker"),
  attendanceStatus: z.enum(["present", "absent", "half_day", "overtime"]),
  overtimeHours: z.coerce.number().min(0, "Overtime hours cannot be negative"),
  dailyWage: z.coerce.number().positive("Daily wage rate is required"),
  paymentStatus: z.enum(["paid", "pending"]),
  notes: z.string().optional(),
});

export interface DailyWageFormValues {
  date: string;
  workerId: string;
  attendanceStatus: "present" | "absent" | "half_day" | "overtime";
  overtimeHours: number;
  dailyWage: number;
  paymentStatus: "paid" | "pending";
  notes?: string;
}
