# Template: Security Review

```text
Perform a security review of <diff/module/feature>.

Load: 07-security-rules.md, 06-multi-tenancy.md, 08, 09, 15 (if files), 21, the module file.

Checklist (report each item as pass / fail / n/a with evidence):
- AuthN: all non-public routes guarded; @Public only on allowed endpoints; session handling unchanged/safe
- AuthZ: permission per route; ASSIGNED_PROJECTS scope enforced in queries (not post-filter); field-level gating;
  no privilege escalation paths (role grants, invitations)
- Tenancy: no tenantId from input; tenant-scoped Prisma only; raw SQL has tenant predicate; composite FKs; RLS
  enabled+forced on new tables; jobs/outbox/exports/notifications carry and enforce tenant
- IDOR: every id in path/body re-loaded under tenant+scope; references to other records validated
- Input: strict schemas; money/date bounds; file type sniffing & size; CSV/XLSX injection neutralized
- Output: DTO mapping (no password/token/tenant internals); errors without stack/SQL; 404 vs 403 correctness
- Financial: no update/delete of posted rows; void requires permission+reason; maker-checker; lock date;
  idempotency; concurrency locks
- Files: private storage, signed short-lived URLs after authz, no user-controlled keys, dangerous types blocked
- Secrets/config: none hardcoded; env validated; nothing sensitive logged (check redaction)
- Rate limiting on sensitive endpoints; CSRF protections intact (header/origin checks)
- Audit: security-relevant actions recorded
- Dependencies: new packages justified, no known vulns
Provide exploit scenario for each fail, severity (critical/high/medium/low), and the fix.
```
