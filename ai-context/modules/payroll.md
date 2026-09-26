# Module: Payroll (`payroll`)

Read with `24-financial-model.md`.

## Purpose
Turn attendance and pay terms into correct, reviewable, auditable wage obligations; recover advances; split
labour cost by project; support partial payments through finance.

## Responsibilities
Payroll runs (create, calculate, review/adjust, approve, cancel, void), calculation engine (pure domain),
payroll items and lines, advance recovery at approval, posting payables via `FinancePostingService`, attendance
locking, payslip data, salary-due scan, payroll reports data.

## Entities
`payroll_runs`, `payroll_items`, `payroll_item_lines` (see 05).

## Relationships
Reads employee pay rates (EmployeeQueryService) and attendance summaries (AttendanceQueryService); locks
attendance (AttendanceLockService); posts obligations and advance-recovery allocations (FinancePostingService);
payments are made in finance (allocated to payroll obligations).

## Run lifecycle
`DRAFT → CALCULATED → APPROVED`; `DRAFT/CALCULATED → CANCELLED`; `APPROVED → VOIDED` (only if no payment
allocations remain on its obligations; unlocks attendance; voids obligations). Recalculate allowed in
DRAFT/CALCULATED (overwrites calculated lines, keeps manual lines).

## Calculation rules (domain, pure, fully unit-tested)
Inputs: period [start, end], employees (filter by pay type/project), pay rate versions overlapping the period,
attendance records in period, manual lines, tenant settings (proration basis, overtime multiplier, rounding).
Each line rounded to 2 dp (half-up); totals = Σ lines.

**DAILY** (per attendance record, using the rate effective on `work_date`):
- BASE line per project: Σ(day_fraction × daily_rate) over PRESENT/HALF_DAY/PAID_LEAVE* records.
  (*PAID_LEAVE paid only if setting `payroll.dailyPaidLeave = true`; has no project → overhead line.)
- OVERTIME line per project: Σ(overtime_hours × ot_rate), ot_rate = overtime_hourly_rate ??
  (daily_rate / standard_hours_per_day × overtimeMultiplier).
**MONTHLY** (per rate version segment inside the period):
- Basis days per settings `payroll.monthlyBasis`: CALENDAR_DAYS (days in month), FIXED_30, or WORKING_DAYS
  (calendar days − configured weekly offs − holidays).
- Payable days = basis days in segment − UNPAID_LEAVE days − ABSENT days (ABSENT counted only if setting
  `payroll.deductAbsence = true`).
- Gross base = monthly_salary × payable_days / basis_days_of_month.
- Project split of base: proportional to attendance day_fraction per project; remainder (no-project/leave/holiday)
  → line with project NULL (overhead). Split lines rounded; rounding difference assigned to the largest line.
- OVERTIME as for DAILY (hourly rate required or derived from salary / basis / standard hours × multiplier).
**CONTRACT**: no automatic base; CONTRACT_WORK lines entered manually (description, quantity × rate, project).
**Manual lines** (any type): ALLOWANCE (+), DEDUCTION (−, e.g., penalty, damage, loan repayment), ADJUSTMENT (±,
e.g., correction of a previous locked period) — each with reason and optional project.
**Advance recovery** (not a line): at approval, `advanceRecoveryAmount` per item ≤ min(outstanding unallocated
advances of the employee, net amount). Default proposal = min(outstanding, net × max recovery % setting, default 100%).
**Net** = Σ lines (gross + allowances − deductions ± adjustments) — must be ≥ 0 (`PAYROLL_NEGATIVE_NET`);
payable after approval = net − advance recovery.

## Business rules
- An employee cannot appear in two non-cancelled/non-voided runs whose periods overlap for the same pay type
  (`PAYROLL_PERIOD_OVERLAP`).
- Approval (permission `payroll.run.approve`, maker-checker per settings) in one DB transaction:
  create PAYABLE obligation per item (lines → obligation lines, category LABOR, deduction lines negative) →
  allocate employee advances for recovery amounts → lock included attendance → status APPROVED → audit → outbox
  `PayrollRunApproved`.
- Rate snapshot stored per item (`rate_snapshot`) — later rate changes never alter approved runs.
- Payments: finance `PAYMENT` to employee allocated to payroll obligations (oldest first default); partial allowed;
  payslip shows gross, deductions, advance recovered, paid, balance due (derived from finance).
- Runs can be scoped to a project (e.g., weekly site payroll) — the overlap rule still applies per employee.
- Dates on/before books lock date cannot be approved/voided.

## APIs
- `GET /api/v1/payroll/runs` · `POST /api/v1/payroll/runs` `{ periodStart, periodEnd, payType, projectId?, employeeIds? }`
- `GET /api/v1/payroll/runs/{id}` (items summary) · `GET /api/v1/payroll/runs/{id}/items/{itemId}` (lines)
- `POST /api/v1/payroll/runs/{id}/calculate`
- `POST /api/v1/payroll/runs/{id}/items/{itemId}/lines` · `PATCH|DELETE …/lines/{lineId}` (manual lines, pre-approval)
- `PATCH /api/v1/payroll/runs/{id}/items/{itemId}` `{ advanceRecoveryAmount, version }`
- `POST /api/v1/payroll/runs/{id}/approve|cancel|void` (`Idempotency-Key` for approve/void)
- `GET /api/v1/payroll/employees/{employeeId}/history` · `GET /api/v1/payroll/items/{itemId}/payslip`
(Spec's `POST /payroll/generate` = create + calculate; `GET /payroll/history` = list runs/items.)

## Permissions
`payroll.view`, `payroll.run.create`, `payroll.run.calculate`, `payroll.run.adjust`, `payroll.run.approve`,
`payroll.run.void`. Requires `employee.compensation.view` to see amounts.
Defaults: Owner all; Accountant all; PM (ASSIGNED) view + create/calculate for their project-scoped runs.

## Events
`PayrollRunCalculated`, `PayrollRunApproved`, `PayrollRunVoided`, `SalaryDue` (scan: approved runs unpaid after
N days; month end with no approved MONTHLY run).

## Validation
Period start ≤ end, max 31 days; employees ACTIVE in period with a pay rate; manual line amounts non-zero;
advance recovery ≥ 0 and ≤ allowed maximum.

## Financial impact
Creates LABOR payables per employee split by project; recovers advances; payments settle them. Project labour
cost = obligation lines (not payments).

## Audit
Run lifecycle, recalculations (totals before/after), manual lines, recovery changes, approval/void.

## Future extension
Statutory deductions/taxes, provident fund, bonuses, loans module with installment schedules, bank payment
files, payslip PDF/SMS, piece-rate engine for contract workers, leave accruals, multiple pay frequencies per
employee, retro-pay automation.

## Must NOT
Record attendance; edit employee rates; write finance tables directly; mark items "paid" (derived from finance);
do calculations in controllers or the frontend; modify approved runs (void + new run or next-run adjustment).
