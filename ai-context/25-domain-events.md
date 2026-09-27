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
Built in Phase 1 session 3: writer `Outbox` (`core/outbox`, every module), delivery in `core/jobs` (worker only).
1. Inside the business transaction: `outbox.add({ type, aggregateType, aggregateId, data, schemaVersion? })`
   inserts into `outbox_events`; tenant, occurredAt (Clock), correlationId and actorUserId come from context
   (the last two are filled once auth exists — sessions 4–5; until then null).
2. After commit, `OutboxDispatcher` (worker; LISTEN `outbox_events` wake-up + ~1 s polling) claims pending events
   with `FOR UPDATE SKIP LOCKED` (dispatcher RLS flag — 06), inserts **one pg-boss job per handler through the same
   transaction** and sets `processed_at`. So each (event, handler) is enqueued exactly once, even with several
   worker replicas. A failed enqueue counts `attempts`/`last_error`; after 10 the event is left for an operator
   (logged as error).
3. Handlers: a provider with `@OutboxEventHandler({ name: 'kebab-name', events: ['ProjectCreated'] })` implementing
   `handle(envelope)`, in the consuming module's `events/` folder, whose module is imported by `WorkerModule`.
   Queue `outbox.<name>`; the job runs in the event's TenantContext via `TenantJobRunner` (skipped for inactive
   tenants), is retried with exponential backoff (5 retries), then moved to `outbox.dead-letter` (logged as error).
   Handlers must be idempotent (dedupe by `eventId` + handler name — a helper table arrives with the first real
   handler that needs it).
Guarantee: at-least-once delivery, in-order per aggregate not guaranteed (handlers must not assume ordering;
re-read current state when it matters). Processed-event retention/cleanup: not yet (future cleanup job).

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
