# 23 — Module Registry

Load when: working in any module, adding a module, or adding a cross-module call. This is the source of truth
for ownership and allowed dependencies. Update it in the same PR as any change to these facts.

## Registry

| Module | Kind | Phase | Owns tables | Public services (index.ts) | Context file |
|---|---|---|---|---|---|
| `core` (infra) | platform | 0–1 | outbox_events, idempotency_keys, number_sequences | TransactionRunner, TenantContext, AppTenantDatabase (repositories), Outbox (`core/outbox`), NumberSequenceService (`core/sequences`), Clock, Config, `uuidv7`, `omitUndefined`; worker only (`core/jobs`): `@OutboxEventHandler`, TenantJobRunner, JobQueue; PlatformDatabase (platform module only). Built: outbox_events, number_sequences (session 3); idempotency_keys in session 6 | 03, 06, 12 |
| `tenant` | core | 1 | tenants, tenant_settings | TenantService, SettingsService (built); DeploymentModeService, EntitlementService (session 8) | modules/tenant-management.md |
| `auth` | core | 1 | sessions, auth_tokens | SessionService (current user/session) | modules/authentication.md |
| `user` | core | 1 | users, tenant_memberships | MembershipQueryService, UserService | modules/user-management.md |
| `authorization` | core | 1 | permissions, roles, role_permissions, membership_roles | PermissionService (`can`, scope resolution), RoleService | modules/authorization.md |
| `audit` | core | 1 | audit_logs | AuditService | 21 |
| `files` | core | 2 | files | FileService (intents, complete, signed URLs) | 15 |
| `notification` | core | 7 (in-app basics 2) | notifications, notification_preferences, notification_deliveries | NotificationService (only for tests/admin; business uses events) | modules/notification.md |
| `party` | business | 2 | parties, party_roles | PartyQueryService (`getById`, `assertHasRole`) | modules/party.md |
| `project` | business | 2 | projects, project_status_history, project_parties, project_members, project_updates | ProjectQueryService (`getById`, `assertWritable`, `assignedProjectIds`) | modules/project.md |
| `contract` | business | 2 (bills 5) | contracts, contract_variations, client_bills | ContractQueryService (`currentValue`) | modules/contract.md |
| `document` | business | 2 | documents | DocumentService, `AttachmentTargetRegistry` (other modules register resolvers) | modules/document-management.md |
| `finance` | business | 3 | money_accounts, finance_categories, financial_transactions, finance_obligations, finance_obligation_lines, payment_allocations | **FinancePostingService**, FinanceQueryService | modules/finance.md, 24 |
| `employee` | business | 4 | employees, employee_pay_rates, employee_assignments | EmployeeQueryService (`getPayRateOn`, `getActiveAssignments`) | modules/employee.md |
| `attendance` | business | 4 | attendance_records | AttendanceQueryService (`summarizeForPeriod`), AttendanceLockService | modules/attendance.md |
| `payroll` | business | 4 | payroll_runs, payroll_items, payroll_item_lines | PayrollQueryService | modules/payroll.md |
| `subcontractor` | business | 5 | subcontracts, subcontract_bills | SubcontractQueryService | modules/subcontractor.md |
| `reporting` | business | 6 | report_exports (+ future summary tables) | — (HTTP only) | modules/reporting.md |
| `machinery` | business | 8 | machines, machine_assignments, machine_usage_logs, machine_maintenance_records | MachineQueryService | modules/machinery.md |
| `equipment-rental` | business | 8 | equipment_rentals, rental_charges | RentalQueryService | modules/equipment-rental.md |
| `platform` | ops | 1 (SaaS) | — (uses BYPASSRLS client) | — | modules/tenant-management.md |

Future (not scaffolded): `inventory`, `procurement`, `boq`, `client-portal`, `tasks`, `quality`, `safety`,
`subscription`, `general-ledger`.

## Allowed dependencies (code-level, via index.ts only)

```text
core ◄── every module
tenant, auth, user, authorization, audit, files ◄── business modules
party        → (core only)
project      → party
contract     → project, party, finance
document     → files, authorization                (others register resolvers INTO document)
finance      → project, party                      (employee/machine references validated by composite FKs)
employee     → project
attendance   → employee, project
payroll      → employee, attendance, project, finance
subcontractor→ party, project, finance
machinery    → project, party, employee, finance
equipment-rental → project, party, finance
notification → user, authorization, project (recipient resolution only); consumes events from all
reporting    → authorization, project (scope); reads all tables via read-only SQL
```
Forbidden: any cycle; `finance → payroll/subcontractor/contract/rental/machinery` (finance never knows its
callers — it stores `source_module/source_type/source_id` as data); `party → project`; `employee → payroll`;
anything → `reporting`; anything → `legacy`.
Enforced by dependency-cruiser rules in `/.dependency-cruiser.cjs` (added in Phase 0).

## Scheduled scans ownership
Each module owns the scans for its own due conditions and emits events; notification only reacts:
finance → `PaymentDue`, `ReceivableDue`; payroll → `SalaryDue`; project → `ProjectDeadlineApproaching`;
equipment-rental → `EquipmentReturnDue`; machinery → `MachineServiceDue`.

## Adding a new module — checklist
1. Write `ai-context/modules/<name>.md` (all sections of the template in `prompts/new-module.md`).
2. Add a registry row + dependency line here and in `MODULE_DEPS` in `/.dependency-cruiser.cjs`; confirm no cycle.
3. Create an ADR if it introduces new infrastructure or changes the financial model.
4. Scaffold folder per 03; Prisma schema file `apps/api/prisma/schema/<name>.prisma`; permissions file;
   contracts folder; web `features/<name>`.
5. Register attachment resolvers / notification types / report definitions if applicable.
