# 21 — Logging and Auditing

Load when: adding logs, audited actions, or anything touching the audit trail.

## Two different things
| | Application logs | Audit logs |
|---|---|---|
| Purpose | Debugging, errors, performance, operations | Accountability: who did what to which record, when, from where |
| Audience | Engineers/operators | Tenant owners/admins, auditors, support (with consent) |
| Storage | stdout JSON → log platform (30-day retention) | PostgreSQL `audit_logs` (years; per retention policy) |
| Content | Technical context, no PII/financial details | Business before/after values (sensitive fields redacted) |
| Mutability | Rotated/expired | Append-only; app role has INSERT/SELECT only |
| Failure mode | Best effort | Written in the **same DB transaction** as the change — if audit fails, the change fails |

## Application logs (pino)
- JSON, one event per line; fields: `time, level, msg, requestId, tenantId, userId, module, route, durationMs`
  plus event-specific context.
- Levels: `error` (5xx, job permanent failures, reconciliation drift), `warn` (retries, 401/403 spikes, deprecated
  usage), `info` (request summary, job completed, lifecycle), `debug` (off in production).
- One access log line per request (method, route template, status, duration, sizes) — not bodies.
- Redaction paths configured centrally: `password`, `newPassword`, `token`, `authorization`, `cookie`,
  `nationalId`, `*.accountNumber`, `smtpPassword`, and query strings with tokens.
- Correlation: `requestId` from `X-Request-Id` (if from trusted proxy) or generated (ULID); propagated to jobs and
  outbox events as `correlationId`.
- Security log events (tagged `security: true`): login failures, lockouts, permission denials, RLS violations,
  idempotency conflicts, suspicious enumeration.

## Audit logs
### Table `audit_logs`
id, tenant_id NULL (NULL only for platform/global events), occurred_at, actor_type (USER|SYSTEM|PLATFORM_ADMIN),
actor_user_id NULL, actor_membership_id NULL, action (e.g., `finance.transaction.voided`), module, entity_type,
entity_id, project_id NULL, summary (safe short text), changes jsonb (`{ field: { from, to } }`), metadata jsonb
(reason, approval info, idempotency key), ip, user_agent, request_id.
Indexes: (tenant_id, occurred_at DESC), (tenant_id, entity_type, entity_id), (tenant_id, actor_user_id, occurred_at).
DB: `REVOKE UPDATE, DELETE ON audit_logs FROM app_user`. Partition by month when volume requires.

### What must be audited
- **Auth/security:** login success/failure, logout, password change/reset, sessions revoked, lockouts, MFA changes.
- **Access control:** invitations, membership activation/deactivation, role create/update/delete, role permission
  changes, member role changes, project member add/remove.
- **Tenant/settings:** company profile, settings (with diff), books lock date changes, numbering changes.
- **Finance (all):** transaction created/approved/rejected/cancelled/voided, allocation created/reversed,
  obligation created/voided, money account created/updated/archived, category changes.
- **Payroll:** run created/calculated/approved/cancelled/voided, manual line adjustments, pay rate changes.
- **Attendance:** create/update/delete (with before/after) — wage disputes depend on it.
- **Contracts/bills:** contract create/update/status, variations, client/subcontract bill submit/approve/void.
- **Master data:** create/update/archive/restore of projects (incl. status changes), parties, employees, machines,
  rentals.
- **Documents:** upload/attach/delete; downloads of sensitive document types.
- **Exports:** report exports (report key + filters, not data).
- **Platform admin actions** on tenants.

### Rules
- Use `AuditService.record(tx, { action, entity, before, after, metadata })` inside the business transaction.
  The service computes diffs and redacts sensitive fields (password hashes, tokens, national IDs → `"[REDACTED]"`).
- `action` naming: `<module>.<entity>.<past_tense_verb>` (`project.project.created` may be shortened to
  `project.created` when entity = module).
- Never write audit rows from controllers or the frontend.
- Audit viewer: `GET /api/v1/audit-logs` (permission `audit.view`, TENANT scope), filters by entity, actor, action,
  date; cursor pagination; record pages show their history via `entity_type/entity_id` filter.
- Retention: default 7 years; purge only via documented platform job respecting tenant retention settings.
