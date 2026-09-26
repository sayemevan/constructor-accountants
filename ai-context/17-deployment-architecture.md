# 17 — Deployment Architecture

Load when: Docker, CI/CD, environment variables, migrations, backups, monitoring, or self-hosted packaging.

## Artifacts (same for every environment and deployment mode — ADR-0015)
| Image | Contents | Commands |
|---|---|---|
| `api` | NestJS build + Prisma client + migrations | `node dist/main.js` (HTTP) · `node dist/worker.js` (jobs) · `node dist/cli.js migrate` · `cli.js setup` |
| `web` | Next.js `output: 'standalone'` | `node server.js` |
Plus off-the-shelf: `postgres:17`, `caddy:2` (self-hosted), optional MinIO-compatible storage, optional SMTP.
Images: multi-stage, non-root user, pinned base digests, healthchecks, no secrets baked in, SBOM generated in CI.

## Environments
| Env | Purpose | Data | Notes |
|---|---|---|---|
| Local dev | Development, AI coding | Seed data | `docker compose -f infrastructure/compose/dev.yml up` (Postgres, S3-compatible RustFS, Mailpit); apps run with `pnpm dev` |
| CI/test | Automated tests | Ephemeral (Testcontainers) | No shared DB; no external services |
| Staging | QA, UAT, release rehearsal | Synthetic/anonymized only | Same topology as production, smaller |
| Production SaaS | Customers | Real | Multi-tenant |
| Self-hosted | Customer infra | Customer | Single tenant, customer-operated |
Never copy production data into non-production without anonymization.

## Environment variables (validated at boot; documented in `.env.example`)
```text
NODE_ENV, DEPLOYMENT_MODE=saas|self_hosted, APP_BASE_URL, LOG_LEVEL
DATABASE_URL (app_user), DATABASE_MIGRATION_URL (app_owner), DATABASE_POOL_SIZE
SESSION_IDLE_DAYS, SESSION_ABSOLUTE_DAYS, SIGNUP_ENABLED, TRUST_PROXY
STORAGE_DRIVER=s3|local, S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
  S3_FORCE_PATH_STYLE, LOCAL_STORAGE_PATH, FILE_URL_SIGNING_SECRET, FILE_SCAN_ENABLED, CLAMAV_HOST
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, (email disabled if unset)
FIELD_ENCRYPTION_KEY (base64 32 bytes; supports key id for rotation)
REDIS_URL (optional), SENTRY_DSN (optional), OTEL_EXPORTER_OTLP_ENDPOINT (optional)
WEB: API_INTERNAL_URL (server-side session check), NEXT_PUBLIC_APP_NAME
```

## Networking & HTTPS
Single origin via reverse proxy: `/api/*` → api:3001, everything else → web:3000. TLS terminated at proxy
(Caddy auto-HTTPS for self-hosted; cloud LB/managed certs for SaaS); HSTS; HTTP→HTTPS redirect.
`TRUST_PROXY` set so client IPs are correct for rate limiting and audit. Custom domains for self-hosted via
`APP_BASE_URL`. SaaS tenant subdomains/custom domains are a future feature (would map host → tenant only to
pre-select the login tenant, never as the authorization source).

## Database migrations
- Run `cli.js migrate` (Prisma migrate deploy with `DATABASE_MIGRATION_URL`) as a **separate one-off step before**
  rolling out new app containers. App processes never migrate on startup.
- Migrations must be backward compatible with the previous app version (expand/contract, 05 §9) to allow rolling
  deploys and rollback of app containers.
- Permission catalog sync + system category seed run after migrate (idempotent).

## Background workers
`worker` runs as its own container (1+ replicas; pg-boss handles concurrency and singleton cron). Scale
separately from `api`.

## SaaS production topology
Managed PostgreSQL (HA, PITR ≥ 7 days, automated daily snapshots retained 30 days), private S3-compatible bucket
(versioning on), 2+ api replicas, 2+ web replicas, 1–2 worker replicas behind a load balancer on any container
platform. Optional Redis for distributed rate limiting. No Kubernetes requirement.

## Self-hosted package
`infrastructure/self-hosted/`: `docker-compose.yml` (caddy, web, api, worker, postgres, optional minio),
`.env.example`, `backup.sh`/`restore.sh`, `upgrade.md`. Install = set env + `docker compose up -d` + open URL →
setup wizard creates the company and owner. Must run with no internet egress except optional SMTP.
Upgrades: pull new tag → run migrate → restart. Versioning: SemVer; release notes flag migrations and breaking config.

## Backups & recovery
- DB: SaaS → provider PITR + daily logical dump to separate storage/account; self-hosted → nightly `pg_dump`
  (compressed, encrypted) + retention (7 daily, 4 weekly, 12 monthly) documented.
- Files: bucket versioning/replication (SaaS); volume snapshot or `rclone` sync (self-hosted).
- Config: env files stored in secret manager (SaaS); customer responsibility (self-hosted, documented).
- **Restore drills** quarterly (SaaS) with measured RPO ≤ 15 min, RTO ≤ 4 h targets. Single-tenant restore
  procedure documented (restore to side DB, export tenant, import).

## Monitoring & observability
- Health: `GET /api/health/live` (process), `/api/health/ready` (DB reachable, migrations current).
- Logs: JSON to stdout → platform log aggregation; retention 30 days (app logs), audit logs are in DB.
- Errors: Sentry-compatible SDK (optional DSN), PII scrubbing on.
- Metrics/tracing: OpenTelemetry (optional exporter): request rate/latency/errors per route, DB pool, job queue depth,
  job failures, outbox lag, reconciliation drift.
- Alerts: 5xx rate, p95 latency, failed jobs, outbox lag > 5 min, backup failure, disk usage, cert expiry,
  failed-login spikes.

## CI/CD workflow
```text
PR: install → lint → typecheck → unit → integration/API/security (Testcontainers) → build → E2E smoke → review
main: all above + full E2E → build & push images (tag = git SHA + semver) → deploy staging (migrate → roll out)
release: manual promote same image digest to production → migrate → roll out → smoke → monitor
```
Rollback: redeploy previous image digest (migrations are backward compatible). Database rollbacks are forward fixes.

## Security requirements
Firewall: only proxy ports public; DB and storage private network only. Least-privilege DB roles (06). Secrets
from secret manager/env files with restricted permissions. OS/image patching monthly or on critical CVE.
Access to production is audited and limited to named operators.
