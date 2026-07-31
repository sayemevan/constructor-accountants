export type AttendanceStatus = "present" | "absent" | "half_day" | "overtime";

export type WagePaymentStatus = "paid" | "pending";

export interface DailyWageLog {
  id: string;
  date: string;
  workerId: string;
  workerName: string;
  trade: string;
  projectId: string;
  projectName: string;
  attendanceStatus: AttendanceStatus;
  overtimeHours: number;
  dailyWage: number;
  totalAmount: number;
  paymentStatus: WagePaymentStatus;
  notes?: string;
}
