# Module: Attendance (`attendance`)

## Purpose
Record who worked where, on which date, for how long — the source data for daily-wage and salary payroll and
project labour cost. Primary mobile workflow for site supervisors.

## Responsibilities
Single and bulk (crew) attendance entry per project/date, edits before lock, daily sheet view, period summaries
for payroll (`AttendanceQueryService.summarizeForPeriod`), locking on payroll approval
(`AttendanceLockService.lock(runId, recordIds)` / `unlock` on payroll void), attendance reports data.

## Entities
`attendance_records` (see 05).

## Relationships
Employee (who), project (where; nullable for office staff), payroll (lock marker `payroll_run_id`).

## Business rules
- Unique per (employee, work_date, project). A worker may split a day: Σ day_fraction across projects ≤ 1.0
  (`ATTENDANCE_DAY_EXCEEDED`).
- Status → default day_fraction: PRESENT 1.0, HALF_DAY 0.5, ABSENT 0, PAID_LEAVE 1.0 (paid, no project cost),
  UNPAID_LEAVE 0, HOLIDAY 0 (paid for MONTHLY per settings).
- hours_worked ≤ 24; overtime_hours ≤ 16 and ≤ 24 − hours; overtime only with PRESENT/HALF_DAY.
- work_date not in the future (max today in tenant timezone); not before employee joining_date or after exit_date.
- Records referenced by an APPROVED payroll run are **locked** (`ATTENDANCE_LOCKED`); corrections become payroll
  adjustments in the next run. Unlocked on payroll run void.
- Editing window for supervisors: records they created, until lock; older than N days (setting, default 7) need
  `attendance.update_past`.
- Bulk entry is an idempotent upsert keyed by (employee, date, project) — safe for mobile retries / future offline sync.
- Records for closed projects require `project.modify_closed`.

## APIs
- `GET /api/v1/attendance?projectId=&date=` (daily sheet: assigned employees + existing records)
- `GET /api/v1/attendance?employeeId=&dateFrom=&dateTo=` (history)
- `PUT /api/v1/attendance/sheet` `{ projectId, workDate, entries: [{ employeeId, status, hoursWorked, overtimeHours, dayFraction?, notes? }] }` (bulk upsert, `Idempotency-Key`)
- `PATCH /api/v1/attendance/{id}` · `DELETE /api/v1/attendance/{id}` (only unlocked; audited)
- `GET /api/v1/attendance/summary?projectId=&dateFrom=&dateTo=` (days/OT per employee)

## Permissions
`attendance.view`, `attendance.record`, `attendance.update_past`, `attendance.delete`.
Defaults: Owner all; PM & Supervisor (ASSIGNED) view/record; Accountant view (TENANT); `update_past` Owner/PM.

## Events
`AttendanceRecorded` (per sheet save; no MVP consumer), `AttendanceLocked`/`Unlocked` (internal).

## Validation
As business rules; employee ACTIVE (or TERMINATED with date ≤ exit_date); project exists & not cancelled;
decimals: hours 2 dp, fraction in {0, 0.25, 0.5, 0.75, 1} (configurable).

## Financial impact
Indirect: payroll derives wages and project labour cost split from attendance.

## Audit
Every create/update/delete with before/after (wage disputes); sheet saves summarized per record.

## Future extension
Offline capture with background sync (PWA), GPS/geo-fence and photo check-in, biometric device import, shift
patterns, leave management integration, crew templates.

## Must NOT
Calculate wages or amounts; store rates; modify locked records; create finance postings; allow future dates.
