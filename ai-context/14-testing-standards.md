# 14 — Testing Standards

Load when: writing or changing tests, or finishing any feature.

## Pyramid & tools (ADR-0018)
| Level | Tool | Location | Runs |
|---|---|---|---|
| Unit — domain logic, utils, hooks | Vitest | `apps/*/src/**/__tests__/*.test.ts` | every commit |
| Component | Vitest + RTL + MSW | `apps/web/src/**/__tests__/*.test.tsx` | every commit |
| Integration — services + real PostgreSQL | Vitest + Testcontainers | `apps/api/src/modules/<m>/__tests__/*.int.test.ts` | every PR |
| API — HTTP contract, guards, errors | Supertest on booted Nest app + Testcontainers | `apps/api/test/api/<m>/*.api.test.ts` | every PR |
| E2E — user journeys | Playwright (desktop + mobile projects) | `tests/e2e/*.spec.ts` | PR (smoke) + main (full) |
| Security suites | Vitest/Supertest | `apps/api/test/security/*` | every PR |
| Performance | k6 or autocannon scripts | `tests/perf/` | before release |

## What must be tested (non-negotiable)
1. **Every money calculation** (domain unit tests): payroll (daily, monthly proration, overtime, half-days,
   split days, rate change mid-period, deductions, advance recovery caps), contract value (square-feet, variations),
   allocation limits, obligation status transitions, profit aggregation, rounding at line level.
   Include edge cases: zero, max values, negative adjustments, leap years/month lengths.
2. **Tenant isolation** for every tenant-owned endpoint: tenant B gets 404 on A's record (GET, PATCH, actions),
   lists never contain A's rows, references to A's ids are rejected. Plus the DB meta-test: every table with
   `tenant_id` has RLS enabled+forced with a policy.
3. **Permission matrix** per endpoint: 401 no session, 403 missing permission, 404 outside assigned projects,
   success with permission; sensitive fields stripped.
4. **Financial integrity**: void creates reversal and reopens obligations; posted records can't be edited/deleted;
   idempotency replays; concurrent payments can't over-allocate (parallel test); books lock enforced;
   maker-checker enforced.
5. **Audit**: significant actions write an audit row with correct actor/before/after.
6. **State machines**: allowed and forbidden transitions.
7. **Validation**: at least one invalid-payload test per create endpoint (strict schema, money format).

## Conventions
- Arrange-Act-Assert; one behaviour per test; names read as specs: `it('recovers advance up to net pay')`.
- Test data via factories/builders (`makeProject({ status: 'ACTIVE' })`) in `test/factories`; each integration test
  creates its own tenants (always two) — no shared mutable fixtures, no dependency on test order.
- Integration tests run against real PostgreSQL with migrations applied (Testcontainers, one container per worker,
  truncate or transactional isolation per test). **Never mock Prisma** in integration tests.
- Unit tests mock only boundaries (clock, storage, email). Inject a fixed `Clock`.
- Money assertions compare `Decimal` strings (`expect(net.toFixed(2)).toBe('12500.00')`).
- Frontend: test behaviour via roles/labels (`getByRole`), not implementation details; MSW handlers from contract types.
- E2E: seeded tenant via API/CLI; run mobile viewport (e.g., 390×844) for field workflows; no reliance on
  third-party services (email captured by a local SMTP sink in tests).

## Core E2E journeys (grow with features)
1. Signup/setup → invite user → user accepts → login.
2. Create party (client) → create project with square-feet contract → add variation.
3. Add employees + pay rates → assign to project → record attendance on mobile → run payroll → approve → pay partially.
4. Record client receipt → allocate to client bill → project summary shows income/profit.
5. Subcontract → advance → bill → approve (advance recovered) → pay.
6. Void a payment → balances and reports revert; audit entry visible.
7. Site supervisor on mobile: upload site photo, cannot see wages or financials.

## Coverage
Targets (guidance, not a goal in itself): domain ≥ 90% lines, application ≥ 80%, overall ≥ 70%. Coverage never
replaces the mandatory categories above.

## CI gates
lint → typecheck → unit → integration/API/security (Testcontainers) → build → E2E smoke. A PR cannot merge with
failing or skipped (`.only`/`.skip`) tests. Flaky tests are fixed or quarantined with an issue within 48 h.

## AI agent rules
Write/extend tests in the same change as the code. Never delete or weaken an assertion to make a test pass —
fix the code, or explain why the expectation was wrong. Run the relevant test suites and report results honestly.
