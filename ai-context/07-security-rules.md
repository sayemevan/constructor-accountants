# 07 — Security Rules

Load when: any backend endpoint, auth, file handling, financial logic, config, or dependency change.
These rules are **never** relaxed for convenience, demos, tests in shared environments, or "temporary" code.
If a rule blocks you, stop and ask.

## 1. Authentication (details: 08)
- DB-backed opaque session tokens in `__Host-` HttpOnly, Secure, SameSite=Lax cookies; Bearer header accepted
  for future mobile clients. Tokens stored only as SHA-256 hashes.
- Passwords hashed with argon2id. Never logged, never returned, never stored reversibly.
- Generic login failure message; rate limiting and progressive lockout on failures.

## 2. Authorization (details: 09)
- Global guards: every route is authenticated and permission-checked unless explicitly `@Public()`.
- Check permission code **and** data scope (assigned projects) **and** record tenant, on every request.
- Authorization happens in the API. Hiding a button in the UI is UX, not security.
- Sensitive data has dedicated view permissions (e.g., `employee.compensation.view`, `project.financials.view`,
  `employee.personal.view` for national IDs). Responses omit fields the caller may not see.

## 3. Tenant isolation (details: 06)
Tenant from session only; repository + composite FK + RLS; 404 for foreign records; jobs/exports/files scoped.

## 4. API security
- Input validated by Zod (strict objects: unknown keys rejected) on body, query and params.
- Mass assignment prevented: DTO → explicit mapping to persistence fields; never spread request bodies into Prisma.
- IDs are UUIDs; still authorize every access (UUIDs are not secrets).
- CSRF: SameSite=Lax cookie + mutating requests must send `X-Requested-With: fetch` (or custom header) and a
  matching `Origin`; the API rejects cross-origin state-changing requests.
- CORS disabled by default (single origin). If a separate origin is ever required, allowlist exact origins.
- Security headers via helmet (API) and Next.js headers (web): HSTS, `X-Content-Type-Options`, frame-ancestors
  none, strict CSP on web (nonce-based scripts), Referrer-Policy `strict-origin-when-cross-origin`.
- Request size limits: JSON 1 MB; uploads go direct to storage or through the upload endpoint with type limits.
- Rate limits: auth endpoints strict (e.g., 5/min/IP+account for login); general API per user; exports lower.
- Idempotency keys on financial create endpoints (10).

## 5. Input & output handling
- Never build SQL with string concatenation; only Prisma query API or `Prisma.sql` tagged templates.
- Never render user HTML. React escapes by default; `dangerouslySetInnerHTML` is forbidden.
- CSV/XLSX exports: neutralize formula injection (prefix cells starting with `= + - @ \t \r` with `'`).
- Validate money: positive where required, max 2 decimals, upper bound (e.g., < 10^15), currency = tenant currency.
- Validate dates: sane ranges, not after lock date for postings, business-date format only.

## 6. File security (details: 15)
Private bucket; tenant-prefixed random keys; MIME allowlist verified by magic bytes; size limits; SVG/HTML
rejected (or served as attachment only); short-lived signed URLs issued after authorization; EXIF stripped
from served images; optional malware scan with quarantine.

## 7. Financial record protection
- No UPDATE of amount/date/account/party/project on posted transactions or approved documents — void & re-enter.
- No DELETE endpoints for financial records; DB grants deny DELETE on financial tables to `app_user`.
- Voids and approvals require explicit permissions, a reason, and are audited with before/after.
- Maker-checker: approver ≠ creator (tenant setting `allowSelfApproval`, default false).
- Books lock date blocks postings, voids and back-dated entries on/before it.
- Amount thresholds (tenant settings) route payments/expenses to `PENDING_APPROVAL`.
- Nightly reconciliation job verifies derived caches (obligation settled_amount) and alerts on drift.

## 8. Audit (details: 21)
Security events (login success/failure, logout, password change/reset, session revocation, role/permission
changes, membership changes, settings changes) and business events are audited, append-only.

## 9. Secrets & configuration
- All secrets from environment variables (or files mounted by the orchestrator), validated by a Zod config
  schema at boot — the process exits if invalid/missing.
- `.env*` never committed; `.env.example` documents every variable with safe placeholders.
- No secrets in client bundles: only `NEXT_PUBLIC_*` values that are genuinely public.
- Rotate: session signing isn't used (opaque tokens), but storage keys, SMTP creds, DB passwords must be rotatable
  without code changes.
- Never print config values in logs; log only which keys are set.

## 10. Data protection & privacy
- TLS everywhere (HTTPS only; HSTS). DB and storage connections over TLS in SaaS.
- Encryption at rest provided by DB/storage infrastructure; application-level encryption (AES-256-GCM with a
  key from env) for especially sensitive fields such as employee national ID numbers.
- Minimize PII: collect only fields with a business purpose; restrict with dedicated permissions.
- Retention: financial records ≥ 7 years by default (configurable per jurisdiction); PII of departed employees
  may be redacted on request **without** deleting financial history (replace with placeholder, keep amounts).

## 11. Error handling (details: 20)
No stack traces, SQL, internal ids of other tenants, or library messages in API responses. Return code +
safe message + requestId; log details server-side.

## 12. Notifications
External channels (email/SMS/push/WhatsApp) carry no amounts, party names or project financials — only a
generic message and a link. Details are shown after login, subject to current permissions.

## 13. Dependencies & supply chain
Lockfile committed; `pnpm audit`/Renovate in CI; no packages with install scripts from unknown publishers;
prefer well-maintained libraries; each new dependency justified in the PR.

## 14. Monitoring
Alert on: spikes in failed logins, 403/404 bursts per user (enumeration), rate-limit hits, 5xx rate,
reconciliation drift, job failures, RLS violations (policy errors) — see 17/21.

## AI agent reminders
Never: disable guards, add `@Public()` to business endpoints, use the base Prisma client, accept tenantId from
input, log request bodies containing credentials, commit `.env`, weaken validation to make a test pass, or add
a "debug" endpoint. If a test fails because of a security rule, fix the code, not the rule.
