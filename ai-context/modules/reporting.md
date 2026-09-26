# Module: Reporting (`reporting`) — includes dashboards and exports

Financial definitions come from `24-financial-model.md` §4. Performance rules: `22-performance-rules.md`.

## Purpose
Read-only business insight: project profitability, costs, income, dues, ledgers, cash flow, workforce reports and
dashboards, with filters and exports — always tenant-scoped and permission-filtered.

## Responsibilities
Report definitions (key, params schema, required permission, SQL query service), dashboard aggregates, export
jobs (CSV/XLSX; PDF later), report_exports lifecycle, scope application (ASSIGNED_PROJECTS → project filter),
consistent labelling of financial basis.

## Entities
`report_exports`; future summary tables (e.g., `project_financial_summaries`) if performance requires (22).

## Relationships
Reads (SQL, read-only) from finance, payroll, attendance, project, party, contract, subcontractor, rental,
machinery tables. No module depends on reporting. Uses authorization for scopes.

## Initial reports (MVP)
| Key | Content | Permission |
|---|---|---|
| `project.profitability` | Per project: contract value, billed, income received, cost incurred by category, profit, margin %, payables/receivables outstanding, cash position | `report.financial.view` + `project.financials.view` |
| `project.cost-breakdown` | Cost lines by category/month/source for one project | same |
| `finance.income` | Receipts by project/party/category/month | `report.financial.view` |
| `finance.expense` | Cost incurred (obligation lines) by project/category/party/month; option: cash paid | `report.financial.view` |
| `finance.cash-flow` | Opening, in, out, closing per money account and period | `report.financial.view` |
| `finance.party-ledger` | Chronological obligations/transactions/allocations with running balance for a party | `finance.ledger.view` |
| `finance.dues-aging` | Payables/receivables by party with 0–30/31–60/61–90/90+ buckets | `report.financial.view` |
| `workforce.attendance` | Days/OT per employee per project and period | `attendance.view` |
| `workforce.wages` | Payroll items: gross, deductions, recovered advances, paid, due per employee | `payroll.view` + `employee.compensation.view` |
| `workforce.assignments` | Employee–project assignment history | `employee.view` |
| `subcontract.status` | Per subcontract: contract, billed, paid, advance outstanding, balance | `subcontract.view` + `report.financial.view` |
| `dashboard.owner` | KPIs (active projects, income/cost/profit MTD & YTD, cash balances, payables/receivables due in 7 days, pending approvals, alerts) | `report.dashboard.view` (fields filtered by other permissions) |
Later: rental & machinery cost reports (Phase 8), trends/comparisons, PDF.

## Business rules
- Every report query includes tenant filter + scope filter + bounded date range (default current month; max 5 years).
- Reports use only POSTED/active data per 24 §4; pending approvals shown separately when relevant.
- Running balances computed in SQL window functions, not stored.
- Export: rows > 5k or estimated > 2 s → async job; file in storage (purpose EXPORT), link valid 24 h, deleted after
  7 days; exports audited (report key + params). CSV/XLSX cells sanitized against formula injection.
- Numbers in exports as numeric cells (XLSX) with tenant currency format; dates as dates.
- Every financial report shows the basis note (e.g., "Profit = income received − cost incurred").

## APIs
- `GET /api/v1/reports` (catalog available to caller) · `GET /api/v1/reports/{key}?…params`
- `POST /api/v1/reports/exports` `{ reportKey, params, format: 'CSV' | 'XLSX' }` → 202 · `GET /api/v1/reports/exports/{id}`
- `GET /api/v1/dashboard/owner` · `GET /api/v1/dashboard/projects/{projectId}`
(Spec's `/reports/projects`, `/reports/profit-loss`, `/reports/expenses` map to report keys above.)

## Permissions
`report.dashboard.view`, `report.financial.view`, `report.workforce.view`, `report.export`, plus underlying data
permissions listed per report. Defaults: Owner all; Accountant financial/workforce/export (TENANT); PM (ASSIGNED)
project reports incl. financials + workforce; Supervisor (ASSIGNED) attendance report only.

## Events
None emitted; may consume `PaymentRecorded`, `TransactionVoided`, etc. to refresh summary tables once they exist.

## Validation
Params validated by per-report Zod schemas; date range limits; projectIds within scope.

## Financial impact
None (read-only). Must match finance query service figures exactly — shared SQL fragments/definitions, tested.

## Audit
Exports (who, what, filters); viewing of financial reports is not audited (volume), exports are.

## Future extension
Custom report builder, scheduled email reports, budget vs actual, trend analytics & predictions, cross-project
comparisons, BI connector (read replica), PDF statements for parties and payslips.

## Must NOT
Write to business tables; compute figures with different formulas than 24; load raw rows into memory for
aggregation; bypass scope filters; embed report logic in the frontend.
