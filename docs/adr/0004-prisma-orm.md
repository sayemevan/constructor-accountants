# ADR-0004: Prisma ORM

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 05, 06, 12

## Context
Need type-safe data access, migrations, composite keys/relations, and a way to enforce tenant scoping.

## Decision
Prisma with a multi-file schema (`apps/api/prisma/schema/<module>.prisma`), Prisma Migrate (raw SQL sections for
RLS, exclusion/partial constraints, grants, extensions), a tenant-scoped client extension, and `Prisma.sql` tagged
templates for reporting/aggregations and row locks. Prisma access only inside `infrastructure/`.

## Alternatives considered
TypeORM (weaker type safety, decorator entities couple domain to ORM); Drizzle (good SQL control, smaller NestJS
ecosystem, team familiarity with Prisma); Kysely/raw SQL only (more boilerplate for CRUD).

## Consequences
+ Strong types, readable schema per module. − Some features need raw SQL in migrations (documented);
− client-extension + RLS pattern must be validated (ADR-0005 spike); − verify current major version APIs at scaffold.
