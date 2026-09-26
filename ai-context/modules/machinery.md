# Module: Machinery Management (`machinery`) — Phase 8

## Purpose
Track company-owned construction machinery as assets: purchase, status, where it is used, usage hours,
maintenance/repair, fuel and related costs.

## Responsibilities
Machine register (create/update/archive/sell/retire), assignments to projects (history), usage logs, maintenance
& repair records (cost posted as payable via finance, tagged with machine and optional project), fuel expenses
(finance expense lines with machine_id), service-due scan, machine cost summary (via finance query),
attachment resolver (MACHINE, MAINTENANCE documents such as invoices, registration papers).

## Entities
`machines`, `machine_assignments`, `machine_usage_logs`, `machine_maintenance_records` (see 05).

## Relationships
Project (assignments/usage), party (supplier, maintenance vendor), employee (operator), finance (purchase CAPEX
obligation, maintenance/fuel expense obligations with `machine_id` on lines).

## Business rules
- Owned machinery is an **asset**: purchase recorded as CAPEX category obligation (+ payment) and linked to the
  machine; purchase is **not** a project expense.
- Status: AVAILABLE ⇄ IN_USE (derived from an open assignment) ⇄ UNDER_MAINTENANCE; RETIRED/SOLD terminal
  (sale proceeds = finance RECEIPT with NON_OPERATING category, linked).
- One open assignment per machine at a time (DB exclusion on date ranges); assignment to closed projects blocked.
- Usage logs require a project where the machine was assigned on that date (warn/error per setting); meter
  readings non-decreasing.
- Maintenance/repair cost → PAYABLE obligation (vendor or none), category MACHINERY_REPAIR/SERVICE, line with
  machine_id and project (if performed for a specific project, else overhead).
- Fuel → finance expense with category MACHINERY_FUEL + machine_id (+ project).
- MVP costing: project machinery cost = fuel/repair/operator expenses tagged to the project. **Internal usage
  charge-out** (hours × internal rate) is NOT posted in MVP to avoid double counting — future feature with explicit
  allocation rules.

## APIs
- `GET|POST /api/v1/machines` · `GET|PATCH /api/v1/machines/{id}` · `POST /api/v1/machines/{id}/archive|retire|sell`
- `GET|POST /api/v1/machines/{id}/assignments` · `POST /api/v1/machine-assignments/{id}/end`
- `GET|POST /api/v1/machines/{id}/usage-logs` · `PATCH|DELETE /api/v1/machine-usage-logs/{id}`
- `GET|POST /api/v1/machines/{id}/maintenance` (POST posts the obligation; `Idempotency-Key`)
- `GET /api/v1/machines/{id}/cost-summary` · `GET /api/v1/projects/{projectId}/machines`

## Permissions
`machinery.view`, `machinery.create`, `machinery.update`, `machinery.archive`, `machinery.assign`,
`machinery.usage.record`, `machinery.maintenance.record`, `machinery.financials.view`.
Defaults: Owner all; PM (ASSIGNED) view/assign/usage/maintenance; Accountant view + financials; Supervisor
(ASSIGNED) view + usage.record.

## Events
`MachineAssigned`, `MachineReturned`, `MachineMaintenanceRecorded`, `MachineServiceDue` (scan).

## Validation
Asset code unique per tenant; purchase cost ≥ 0; dates consistent; hours ≥ 0 and ≤ 24 per day; meter readings
monotonic; maintenance cost > 0 when posting.

## Financial impact
CAPEX on purchase (excluded from project P&L); maintenance/fuel expenses (project or overhead).

## Audit
Register changes, assignments, usage edits, maintenance postings, disposal.

## Future extension
Depreciation schedules and depreciation-based project charge-out, internal hire rates, telematics/meter
integrations, spare parts inventory, insurance/registration expiry reminders, utilization dashboards.

## Must NOT
Treat rented equipment as machines; post purchases as project expenses; write finance tables directly; store
cost totals; double-count usage charges with fuel/repair costs.
