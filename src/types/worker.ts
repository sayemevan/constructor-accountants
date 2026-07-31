export type WorkerTrade =
  | "Mason"
  | "Carpenter"
  | "Electrician"
  | "Plumber"
  | "Steel Fixer"
  | "Painter"
  | "Welder"
  | "General Laborer";

export type WorkerStatus = "active" | "inactive" | "deactivated";

export interface WorkerPayment {
  id: string;
  workerId: string;
  date: string;
  amount: number;
  daysWorked: number;
  paymentMethod: "Cash" | "Bank Transfer" | "Check";
  transactionNo: string;
  notes?: string;
}

export interface SiteWorker {
  id: string;
  name: string;
  phone: string;
  address: string;
  trade: WorkerTrade;
  dailyWage: number;
  joiningDate: string;
  status: WorkerStatus;
  projectId: string;
  projectName: string;
  totalDaysWorked?: number;
  totalPaidOut?: number;
  payments?: WorkerPayment[];
}
