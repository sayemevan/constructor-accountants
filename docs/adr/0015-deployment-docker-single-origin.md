# ADR-0015: Docker images, single-origin reverse proxy, identical artifacts for SaaS and self-hosted

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 17

## Context
Must deploy on any cloud and on customer servers without code differences; cookies/CSRF simpler on one origin.

## Decision
Two images (`api` with HTTP/worker/CLI commands, `web` standalone). Reverse proxy routes `/api/*` to api and the
rest to web on one origin. Config via env only; `DEPLOYMENT_MODE` toggles behaviour. Migrations as a separate
pre-deploy step. Self-hosted package = docker compose + Caddy + backup scripts. No Kubernetes requirement.

## Alternatives considered
Vercel for web + separate API origin (CORS/cookie complexity, vendor coupling for self-hosted parity); Kubernetes
Helm-first (overkill for customers and early SaaS).

## Consequences
+ Same artifacts everywhere; simple security model. − We operate our own proxy config (documented templates).
