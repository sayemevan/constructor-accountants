# Module: Employee Management (`employee`)

## Purpose
Maintain the company's workforce: profiles, pay terms over time, and project assignment history.

## Responsibilities
Employee CRUD/archive, effective-dated pay rates, project assignments (start/end), status (ACTIVE, INACTIVE,
TERMINATED), optional link to a user account, `EmployeeQueryService` (`getPayRateOn(employeeId, date)`,
`getPayRatesForPeriod`, `getActiveAssignments(projectId, date)`), attachment resolver (EMPLOYEE documents).

## Entities
`employees`, `employee_pay_rates`, `employee_assignments` (see 05).

## Relationships
Assignments reference projects. Attendance and payroll consume employee data. Finance uses employee as
counterparty for advances/payroll payments. Not a Party (internal person).

## Business rules
- Pay types: DAILY (daily_rate), MONTHLY (monthly_salary), CONTRACT (agreed per-job amounts entered in payroll).
  Every active employee must have a pay rate effective today to be included in payroll.
- Pay rates are **effective-dated, non-overlapping**; changing a rate = new row with `effective_from`, previous row
  gets `effective_to = new.effective_from − 1 day`. Rates used in approved payroll are never edited; back-dating a
  rate into an approved payroll period is blocked (`PAY_RATE_PERIOD_LOCKED`).
- Overtime: `overtime_hourly_rate` explicit; if null, derived = daily_rate / standard_hours × tenant overtime
  multiplier (default 1.0 unless settings say otherwise) — computed in payroll domain, not here.
- Assignments: an employee may be assigned to several projects concurrently; `end_date ≥ start_date`; assignment
  history is kept (end, don't delete). Attendance for a project without an active assignment → warning (setting
  can make it an error).
- TERMINATED employees: exit_date required; excluded from new attendance after exit date; outstanding payables
  remain payable.
- Sensitive fields (national_id, address, pay rates) visible only with `employee.personal.view` /
  `employee.compensation.view`. national_id encrypted at application level.

## APIs
- `GET /api/v1/employees` (q, status, payType, projectId assigned, skill) · `POST /api/v1/employees`
- `GET/PATCH /api/v1/employees/{id}` · `POST /api/v1/employees/{id}/archive|restore|terminate`
- `GET /api/v1/employees/{id}/pay-rates` · `POST /api/v1/employees/{id}/pay-rates` (new effective version)
- `GET /api/v1/employee-assignments?projectId=&employeeId=&activeOn=` · `POST /api/v1/employee-assignments`
  (supports bulk `employeeIds[]`) · `POST /api/v1/employee-assignments/{id}/end` `{ endDate }`

## Permissions
`employee.view`, `employee.create`, `employee.update`, `employee.archive`, `employee.compensation.view`,
`employee.compensation.manage`, `employee.personal.view`, `employee.assignment.manage`.
Defaults: Owner all; Accountant view + compensation view/manage; PM (ASSIGNED) view + assignment.manage;
Supervisor (ASSIGNED) view only (no compensation/personal). HR Manager template: all employee permissions.

## Events
`EmployeeCreated`, `EmployeePayRateChanged`, `EmployeeAssigned`, `EmployeeTerminated`.

## Validation
Name required; phone format; joining_date ≤ today + 30 days; pay rate amounts > 0 matching pay type; no overlapping
rates (DB exclusion constraint + friendly 422 `PAY_RATE_OVERLAP`); assignment project not CANCELLED.

## Financial impact
Pay rates drive payroll cost. No postings from this module.

## Audit
Profile changes, pay rate additions (old/new), assignments, termination, sensitive field access (view of national id).

## Future extension
Skills/certifications with expiry reminders, leave balances & leave requests, documents (ID copies) with
expiry, worker groups/crews, biometric/geo attendance devices, worker self-service.

## Must NOT
Calculate wages or payroll; record attendance; post payments or advances (finance); store salary paid/due;
treat employees as parties; expose compensation to users without permission.
