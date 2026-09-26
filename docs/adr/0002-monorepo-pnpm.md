# ADR-0002: pnpm monorepo

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 03, 04

## Context
Web and API share validation schemas, enums, permission and error codes. Separate repos would duplicate or drift.

## Decision
pnpm workspaces: `apps/web`, `apps/api`, `packages/contracts` (Zod schemas, types, codes), `packages/config`
(tsconfig/eslint). No shared UI package until a second UI consumer exists. Turborepo added only if CI time requires.

## Alternatives considered
Polyrepo (drift, version juggling); Nx (heavier than needed); npm/yarn workspaces (pnpm is stricter and faster).

## Consequences
+ One PR can change contract + API + UI atomically. − Must keep `contracts` free of server-only code (no Prisma,
no Node APIs) so it bundles for the browser.

## Compliance
Lint rule: `packages/contracts` may import only `zod` and itself.
