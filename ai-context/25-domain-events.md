# 25 — Domain Events

Load when: emitting or handling events, adding notifications, or deciding between a direct call and an event.

## When to use events (and when not)
| Use a **direct synchronous call** (inside the same DB transaction) | Use a **domain event** (outbox → worker) |
|---|---|
| The other module's change must succeed or fail with mine | The reaction can happen later and may fail independently |
| Anything that creates/changes money (obligations, transactions, allocations) | Notifications, emails |
| Validation that needs another module's data | Cache/summary refresh, search indexing |
| Locking attendance on payroll approval | Analytics counters, webhooks (future), integrations |
Do not introduce events where a single module handles everything; do not chain events to implement a business
transaction (no sagas in MVP).

## Mechanism: transactional outbox
1. Inside the business transaction: `outbox.add({ type, aggregateType, aggregateId, payload })` inserts into
   `outbox_events` (with tenantId, correlationId, occurredAt, schemaVersion).
2. After commit, a dispatcher (worker, polling every ~1 s with `FOR UPDATE SKIP LOCKED`, plus pg `NOTIFY` wake-up)
   fans each event out to registered handlers as pg-boss jobs (one job per handler) and marks it processed.
3. Handlers are idempotent (dedupe by `eventId` + handler name), run in the event's TenantContext, retry with
   backoff, and dead-letter after N attempts (alert).
Guarantee: at-least-once delivery, in-order per aggregate not guaranteed (handlers must not assume ordering;
re-read current state when it matters).

## Event conventions
- Name: PascalCase past tense (`PayrollRunApproved`). Payload type exported from the emitting module's `index.ts`.
- Payload: ids and small facts only (no PII, no full entities): `{ eventId, tenantId, occurredAt, actorUserId,
  correlationId, schemaVersion, data: { … } }`.
- Changing a payload is an API change: add fields only; bump `schemaVersion` for breaking changes and support
  both during transition.

## Catalog (initial)
| Event | Emitted by | Data | Consumers |
|---|---|---|---|
| `TenantCreated` | tenant | tenantId | seeding follow-ups (none sync-critical), analytics |
| `UserInvited` | user | membershipId, email | notification (invite email) |
| `MembershipDeactivated` | user | membershipId | auth (session cleanup), notification |
| `RolePermissionsChanged` | authorization | roleId | cache invalidation (if caching added) |
| `ProjectCreated` | project | projectId | notification (optional), reporting summary init |
| `ProjectStatusChanged` | project | projectId, from, to | notification |
| `ProjectDeadlineApproaching` | project (scan) | projectId, expectedEndDate, daysLeft | notification |
| `ContractActivated` / `ContractVariationApproved` | contract | contractId, projectId | reporting summary refresh |
| `ClientBillApproved` | contract | billId, obligationId | notification |
| `DocumentUploaded` | document | documentId, entityType, entityId, projectId | notification (optional), thumbnails already via files job |
| `ClientPaymentReceived` | finance | transactionId, partyId, projectId | notification, reporting refresh |
| `PaymentRecorded` | finance | transactionId, counterparty, projectId | reporting refresh |
| `TransactionVoided` | finance | transactionId, reversalId | notification (owners), reporting refresh |
| `ApprovalRequired` | finance, payroll, subcontractor, contract | entityType, entityId, permissionCode | notification |
| `PaymentDue` / `ReceivableDue` | finance (scan) | obligationId, dueDate, daysBefore | notification |
| `AttendanceRecorded` | attendance | projectId, workDate, count | (none in MVP; future dashboards) |
| `PayrollRunCalculated` | payroll | runId | notification (approvers) |
| `PayrollRunApproved` (= "SalaryGenerated") | payroll | runId, obligationIds | notification (accountant) |
| `SalaryDue` | payroll (scan) | runId or periodEnd | notification |
| `EmployeePaymentMade` | finance (counterparty employee) | transactionId, employeeId | notification (optional) |
| `SubcontractBillApproved` | subcontractor | billId, obligationId | notification |
| `SubcontractorPaymentMade` | finance (context subcontract) | transactionId, subcontractId | notification |
| `EquipmentRentalCreated` | equipment-rental | rentalId, projectId | notification |
| `EquipmentReturnDue` | equipment-rental (scan) | rentalId, expectedReturnDate | notification |
| `EquipmentReturned` | equipment-rental | rentalId | notification, charge proposal |
| `MachineServiceDue` | machinery (scan) | machineId, dueDate | notification |

Spec names mapping: `EmployeePaymentCreated` → `EmployeePaymentMade`; `SalaryGenerated` → `PayrollRunApproved`;
`SubcontractorPaymentCreated` → `SubcontractorPaymentMade`. Note the spec's "Finance Transaction Created" is **not**
an event reaction — it is a synchronous posting (ADR-0008).
