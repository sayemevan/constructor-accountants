# 04 — Technology Stack

Load when: adding a dependency, setting up tooling, or choosing a library. Adding anything not listed here
requires justification in the PR (and an ADR if it is infrastructure or cross-cutting).

## Runtime & language
| Choice | Why |
|---|---|
| **Node.js 24 LTS** | Current LTS; one runtime for web, api, worker |
| **TypeScript (strict)** | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` where practical |
| **pnpm workspaces** | Fast, strict dependency isolation for a monorepo; Turborepo only if CI times demand it |

## Backend
| Concern | Choice | Why / notes |
|---|---|---|
| Framework | **NestJS** | Modules, DI, guards, pipes map directly onto our architecture; chosen over Laravel to keep one language (ADR-0001) |
| ORM | **Prisma** (multi-file schema in `apps/api/prisma/schema/`) | Type safety, migrations, composite relations; raw SQL via `Prisma.sql` for reports (ADR-0004). TypeORM rejected: weaker typing, more runtime surprises |
| Database | **PostgreSQL 17+** | Transactions, RLS, partial/exclusion constraints, `numeric`, JSONB, `pg_trgm`, `citext` |
| Validation | **Zod** schemas from `packages/contracts` + a global `ZodValidationPipe` | One schema for frontend forms and backend validation; OpenAPI generated from it. class-validator not used |
| Money math | **Prisma `Decimal`** (decimal.js) | Never floating point |
| Jobs / cron | **pg-boss** | Uses PostgreSQL — no Redis needed for self-hosted (ADR-0013) |
| In-process events | `@nestjs/event-emitter` only for after-commit, in-process fan-out of outbox events | Durable delivery is via outbox + pg-boss |
| Passwords | **argon2** (argon2id) | OWASP recommended |
| Logging | **pino** via `nestjs-pino` | Structured JSON, redaction, request context |
| Security headers | `helmet` | Standard headers |
| Rate limiting | `@nestjs/throttler` | In-memory store by default; Redis store optional for multi-instance SaaS |
| Email | **nodemailer** (SMTP) | Works with any provider and self-hosted SMTP |
| File type sniffing | `file-type` | Magic-byte validation of uploads |
| Images | `sharp` (worker only) | Thumbnails, EXIF stripping |
| Object storage | `@aws-sdk/client-s3` + presigner behind `FileStorage` interface | S3, R2, DO Spaces, MinIO-compatible; local driver for self-hosted |
| Spreadsheet export | `exceljs` (when XLSX export is built) | Streaming XLSX |
| API docs | OpenAPI generated from Zod (e.g., `zod-openapi`) served at `/api/docs` in non-prod | Contract visibility |

## Frontend
| Concern | Choice | Why / notes |
|---|---|---|
| Framework | **Next.js (App Router)** + **React** | Layouts, route groups, server components for shells |
| Styling | **Tailwind CSS** | Mobile-first utilities |
| Components | **shadcn/ui** (Radix primitives, copied into `apps/web/src/components/ui`) | Accessible, owned code, no heavy runtime lib |
| Server state | **TanStack Query** | Caching, invalidation, retries, optimistic updates |
| Tables | **TanStack Table** | Headless; server-side pagination/sort/filter |
| Forms | **React Hook Form** + `@hookform/resolvers/zod` | Uses shared schemas |
| Charts | **Recharts** (lazy-loaded) | Already familiar from prototype; adequate for dashboards |
| Icons | `lucide-react` | |
| Dates | `date-fns` (+ `date-fns-tz`) | Tree-shakable; tenant timezone formatting |
| i18n | Central `formatMoney/formatDate/formatNumber` via `Intl` now; string externalization (next-intl) decided by ADR before non-English launch |

## Testing (ADR-0018)
| Level | Tool |
|---|---|
| Unit (domain, utils, hooks) | **Vitest** (api uses `unplugin-swc` for decorator metadata) |
| Component | Vitest + **React Testing Library** + `jsdom`; **MSW** for API mocking |
| Integration (services + real DB) | Vitest + **Testcontainers** (PostgreSQL) |
| API (HTTP) | **Supertest** against a Nest app booted on Testcontainers DB |
| End-to-end | **Playwright** (desktop + mobile viewport projects) |
| Money invariants (optional, recommended) | `fast-check` property tests for payroll/allocation math |

## Tooling
ESLint (typescript-eslint, next, import rules) · Prettier · **dependency-cruiser** (module boundary rules) ·
Husky + lint-staged (format/lint on commit) · GitHub Actions CI · Docker (multi-stage builds) ·
Renovate or Dependabot for updates.

## Infrastructure
| Concern | SaaS | Self-hosted |
|---|---|---|
| Containers | Any container platform (ECS, Fly, Render, DO App Platform, VM + compose) | Docker Compose |
| DB | Managed PostgreSQL with PITR | PostgreSQL container/volume or customer DB |
| Files | S3-compatible bucket (private) | Local volume driver or any S3-compatible store |
| TLS / proxy | Cloud LB or Caddy | Caddy (automatic HTTPS) |
| Email | Any SMTP provider | Customer SMTP (optional) |
| Error tracking | Sentry-compatible DSN (optional) | Optional (e.g., GlitchTip) |

## Version policy
Pin exact versions in lockfile; upgrade deliberately (Renovate PRs, CI green). Verify current major-version
APIs (Next.js, Prisma, NestJS) against official docs at scaffold time rather than relying on memory.
Scaffold (2026-09): Next 16, NestJS 12 (ESM-only → all workspace packages are `"type": "module"`), React 19,
TypeScript **6.0** and ESLint **9** — held back from TS 7 / ESLint 10 until typescript-eslint and
eslint-config-next's plugins support them.
