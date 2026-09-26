# Design Review — Issues Found in the Source Specification

Source: `docs/reference/construction-accounting-architecture.pdf` (Chapters 1–19) and the existing repository.
Each issue: **Problem → Why it matters → Resolution → Where updated.** No major requirement was dropped; changes
are corrections or clarifications. Items needing a product decision are in the last section.

## A. Repository & process

**1. Existing code contradicts the target architecture.**
The repo contains a browser-only Next.js app that stores data in Google Sheets via OAuth (no backend, no DB, no
tenancy, balances mutated directly, names copied into financial rows).
→ It cannot satisfy tenant isolation, RBAC, auditability or self-hosting.
→ Freeze as UX/domain reference; new monorepo; optional future import tool.
→ ADR-0016, CLAUDE.md, 26 (Phase 0).

**2. Two different AI documentation structures** (Ch. 9.5 `/docs/*` vs Ch. 19.4 `/ai-context/*`).
→ Agents would load conflicting or duplicate context.
→ One system: `ai-context/` (rules/context) + `docs/` (ADRs, review, reference). → ai-context/README.md.

**3. Technology choices left open** (NestJS *or* Laravel; Prisma *or* TypeORM; tenant strategy "to be selected";
no queue technology).
→ Undecided foundations cause rework and inconsistent AI output.
→ Decided with rationale. → 04, ADR-0001/0004/0005/0013.

## B. Financial model

**4. `Transaction` and `Expense` duplicate the same money facts** (5.14).
→ Double counting; which one do reports read?
→ Expenses are payable obligations; cash movements are transactions; allocations link them. → 24, 05, ADR-0007.

**5. No concept of amounts owed** although outstanding balances are required for parties (3.5.3), payroll (5.12
Paid/Due), subcontracts (3.8.2), rentals (3.11) and clients.
→ Outstanding balances would be hand-maintained fields that drift.
→ `finance_obligations` (payables/receivables) with derived settled/outstanding. → 24, modules/finance.md.

**6. Advances are not modeled** (payroll and subcontract "advance payment" only as calculation inputs).
→ Unrecovered advances become invisible; double payment risk.
→ Advance = unallocated payment with context; recovery = allocation at payroll/bill approval. → 24, payroll, subcontractor.

**7. Event-driven financial updates** ("Employee payment created → Finance transaction created", 2.9, 4.19, 6.12).
→ Async posting can leave approved payroll without payables (or payments without source) after failures.
→ Financial postings synchronous via `FinancePostingService` in one DB transaction; events only for side effects
through an outbox. → ADR-0008, 03, 25.

**8. "Account balance updated" on each transaction** (6.2.3; prototype mutates balances).
→ Stored running balances drift under concurrency and are not auditable.
→ All balances derived; only `settled_amount` cached on obligations, maintained transactionally and reconciled
nightly. → 24 §4, §7.

**9. Profit formula basis undefined** (6.7.3: income − expense — cash or accrual? Is machinery purchase an expense?
Deposits?).
→ Different screens would show different "profit".
→ Defined: income received − cost incurred; CAPEX, deposits and transfers excluded; basis labelled on reports;
cash position shown separately. → 24 §4, modules/reporting.md.

**10. Void/cancel/adjustment semantics undefined** (6.11.2) and report stability after voids unclear.
→ Inconsistent implementations; historical reports change retroactively.
→ Cancel (never posted), Void (reversal entry dated at void), Adjustment (new entry); books lock date. → 24 §5.

**11. Approval workflow vague** (7.7.2: "large payments" — who, what threshold, self-approval?).
→ Either no control or blocking friction.
→ Tenant thresholds, `PENDING_APPROVAL` status, maker-checker default on. → 24 §6, tenant settings.

**12. "Completed project should not allow modification… without permission"** — no mechanism.
→ Unenforceable rule.
→ `project.modify_closed` permission + `assertWritable` used by all posting modules; books lock for periods. → project, 24.

**13. Missing money accounts** (cash/bank/wallet) though cash-flow reports are required (3.14).
→ Cash flow impossible to compute.
→ `money_accounts` with derived balances and transfers. → 05, finance.

**14. Machinery usage "Cost" (5.15) double counts** with fuel/repair expenses; purchase treated like expense.
→ Inflated project cost.
→ MVP project machine cost = tagged fuel/repair expenses; purchase = CAPEX; internal charge-out is future. → machinery.

**15. Equipment rental "Payment Status" as a stored field** (5.16) duplicates finance; deposits unaddressed.
→ Drift; deposits misreported as cost.
→ Derived status from charges/allocations; deposits as DEPOSIT purpose transactions. → equipment-rental, 24.

**16. Extra work income (3.9.1) has no contract-side concept; running bills (3.6.2) have no bill entity.**
→ Contract value and client receivables can't be tracked.
→ `contract_variations` and `client_bills` (→ receivables). → contract module, 05.

**17. Accounting expansion path unclear** ("Ledger" mentioned without definition).
→ Risk of a dead-end model.
→ Sub-ledger designed to map 1:1 to double-entry journals; MVP vs future table. → 24 §8, ADR-0007.

## C. Payroll & attendance

**18. No pay-rate history** — employee has a single "Salary Type"; rate changes would rewrite past payroll.
→ Wrong recalculations, disputes.
→ Effective-dated `employee_pay_rates` (non-overlap constraint) + rate snapshots on payroll items. → employee, payroll.

**19. Attendance ↔ payroll double payment possible** (no lock, overlapping payroll periods).
→ Workers paid twice or attendance edited after payment.
→ Attendance locked by approved runs; overlap rule per employee; corrections via next-run adjustments. → attendance, payroll.

**20. Split days across projects and attendance uniqueness undefined.**
→ Duplicates or impossible >1 day totals.
→ Unique (employee, date, project), day_fraction with Σ ≤ 1. → attendance.

**21. Monthly salary proration and overtime rate rules undefined** (3.7.4, 6.5.4).
→ Every implementation would differ; disputes.
→ Tenant setting for basis (calendar / 30 / working days), explicit or derived overtime rate, rounding rule. → payroll.

**22. Labour cost allocation to projects undefined** when a worker spans projects.
→ Wrong project profitability.
→ Payroll lines split by project from attendance; remainder = overhead. → payroll, 24.

## D. Data model

**23. `tenant_id` missing on many entities** (Contract, Attendance, Payroll, Machinery, Document, Notification,
Audit Log in Ch. 5) and no DB-level guarantee against cross-tenant references.
→ Leakage via joins/child tables; one missed filter exposes data.
→ tenant_id everywhere + composite FKs + RLS. → 05, 06, ADR-0005.

**24. User belongs to exactly one tenant** (5.5).
→ External accountants serving several companies need multiple accounts; email uniqueness ambiguous.
→ Global users + `tenant_memberships`. → 05, user-management.

**25. Contract cardinality contradictory** ("multiple contracts" 5.8 vs optional single contract 3.6.2/6.3).
→ Ambiguous UI/data.
→ 0..1 non-cancelled contract per project (partial unique index) + variations; multiple contracts future. → contract.

**26. "Project Status entity"** (5.8) instead of a controlled state machine; no history.
→ Arbitrary transitions, no audit of who closed a project.
→ Enum + transition rules + `project_status_history`. → project.

**27. Documents linked only to projects** (5.17) while 6.9 requires links to employees and transactions.
→ Receipts/ID documents can't be attached properly.
→ Polymorphic attachments with resolvers and denormalized project_id for access control. → document-management.

**28. "Client/Owner" ambiguity and no model for other project stakeholders** (architect, consultant).
→ Duplicate parties or misuse of roles.
→ Owner = CLIENT role; `project_parties` for stakeholder roles. → party, project, ADR-0006.

**29. "Should not create duplicate party records"** — no enforceable key.
→ Rule can't be implemented as stated.
→ Duplicate-check warnings (name similarity/phone/email); merge tool future. → party.

**30. Site progress updates referenced** (Site Supervisor permissions 7.4.2, mobile use cases) **but no entity.**
→ Key field workflow missing.
→ `project_updates` with photos. → project.

**31. Audit log lacks tenant, actor type, request id and immutability guarantees** (5.19).
→ Weak forensic value; tamperable.
→ Extended schema; append-only via DB grants; written in the same transaction. → 21.

**32. Notifications lack tenant, delivery tracking and preferences** (5.18 vs 16.5).
→ Can't retry, audit delivery, or honour preferences.
→ `notifications`, `notification_deliveries`, `notification_preferences`, dedupe keys. → 16.

**33. Money/date types unspecified.**
→ Float rounding errors, timezone off-by-one on business dates.
→ ADR-0017 conventions. → 05, 13.

## E. Security & API

**34. RBAC has no data scope** — "Project Manager: manage assigned projects" (4.6.3) is not expressible.
→ PMs would see every project or nothing.
→ Permission scope (TENANT / ASSIGNED_PROJECTS) + `project_members`. → 09, ADR-0010.

**35. No field-level sensitivity** (supervisors must not see wages or company financials, 7.2.1).
→ Data exposure through general "view" permissions.
→ Dedicated view permissions and response stripping. → 09, employee, project.

**36. Hard DELETE endpoints** for users, projects, documents (12.5, 12.7, 12.12).
→ Conflicts with auditability and financial history.
→ Deactivate/archive/cancel; soft-delete documents; DELETE only for unreferenced non-financial data. → 10, modules.

**37. API response format** `{status: true}` lacks error codes/request id; PUT for partial updates; no pagination,
idempotency or concurrency rules.
→ Unpredictable clients, duplicate payments on flaky mobile networks, lost updates.
→ Envelope with codes, PATCH/actions, pagination standard, Idempotency-Key, optimistic `version`. → 10, 20, ADR-0011.

**38. Authentication design undefined** (token type, revocation, invitations, self-hosted onboarding, CSRF).
→ Insecure or inconsistent implementations.
→ DB-backed opaque sessions, invitations, setup wizard, CSRF strategy. → 08, ADR-0009.

**39. Tenant context source not specified.**
→ Clients might pass tenantId (classic IDOR).
→ Tenant only from session; 404 on foreign records. → 06.

**40. Notification privacy rule (7.12) not reconciled with in-app details.**
→ Either leaky emails or useless in-app messages.
→ External channels generic; in-app minimal; details after login with current permissions. → 16.

**41. PII handling absent** (employee phone/address/national ID).
→ Privacy and legal exposure.
→ Minimize, restrict via permissions, encrypt national ID, redaction without deleting financial history. → 07.

## F. Deployment, scalability, operations

**42. "Separate database per tenant" suggested as an in-app option** (2.7, 8.11, 11.13).
→ Operational explosion (migrations, pooling, backups) for little benefit.
→ Shared schema for SaaS; dedicated instance for isolation needs. → ADR-0005, 17.

**43. Background jobs listed without technology; self-hosted infrastructure weight not considered.**
→ Redis/broker dependencies complicate self-hosting.
→ pg-boss on PostgreSQL; Redis optional. → ADR-0013.

**44. Migration strategy, zero-downtime deploys and rollback undefined.**
→ Outages or broken rollbacks.
→ Separate migrate step, expand/contract, image rollback. → 17, 05 §9.

**45. Backups mentioned without RPO/RTO, restore testing, or file/DB consistency.**
→ Backups that can't be restored.
→ Targets, schedule, restore drills, self-hosted scripts. → 17.

**46. Live-computed reports may not scale** (thousands of transactions, many documents).
→ Slow dashboards.
→ Indexes, SQL aggregation, bounded ranges, async exports, summary tables when measured. → 22, reporting.

**47. Poor site connectivity not addressed** for mobile field workflows.
→ Lost or duplicated attendance/payments.
→ Idempotent bulk upserts now; offline PWA queue later; client-side image compression. → 11, attendance, 26.

**48. Subscriptions/licensing (Ch. 17) have no architectural hook; self-hosted licensing could imply phone-home.**
→ Retrofitting plan limits later touches every module.
→ `EntitlementService` hook now (all enabled); offline-verifiable license file later. → tenant-management.

**49. Implementation order puts Payroll/Subcontractor before Finance** (10.11).
→ Payroll would need its own payment storage then be rewritten.
→ Finance core in Phase 3, before workforce. → 26.

## Open questions for the product owner
1. **Jurisdiction & currency:** which countries first? (Affects tax fields, number formats such as lakh/crore,
   statutory payroll deductions, retention law.) Default assumption: single currency per tenant, no tax engine.
2. **Profit basis:** is "income received − cost incurred" the view owners expect, or "billed − incurred"? Both can be
   offered; which is the default?
3. **Client required on every project?** Spec says yes; internal/overhead projects would then need a placeholder
   client. Current decision: required; overhead costs use "no project".
4. **Language:** English-only MVP, or Bangla/other UI languages from launch? (Decides i18n setup timing.)
5. **Offline attendance:** is it an MVP requirement for your sites, or acceptable in Phase 9?
6. **Payroll cadence:** weekly for daily workers? Which monthly proration basis is customary for your customers?
7. **Approval defaults:** should payments above a threshold require a second person by default?
8. **Retention money** on subcontract/client bills — needed in MVP?
9. **Legacy data:** do existing prototype (Google Sheets) users need their data imported?
10. **Worker self-service** (viewing own attendance/payslips) — ever planned? Affects user/employee linking.
