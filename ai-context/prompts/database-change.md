# Template: Database Change

```text
Task: <add/alter> <table/column/index/constraint> for <reason/feature>.

Before proposing:
1. Read 05-database-architecture.md, 06-multi-tenancy.md, the owning module file, and 24 if financial.
2. Inspect apps/api/prisma/schema/ (all files — check the concept doesn't already exist) and existing migrations.
3. Identify the owning module (23). If the table belongs to another module, stop and propose, don't edit.

Proposal must include:
- Prisma model changes with @@map/@map, types (numeric(18,2) for money, date vs timestamptz), defaults, nullability
- tenant_id, @@unique([tenantId, id]), composite FKs to tenant-owned parents
- Indexes (with the query each serves), unique/partial/exclusion constraints, CHECKs
- RLS policy + grants SQL for new tables; soft-delete/archival policy (05 §2)
- Migration strategy: expand → backfill → contract; backward compatibility with the previous app version;
  behaviour on non-empty data; rollback/forward-fix plan
- Impact: repositories, contracts, API, reports, tests

After approval: create migration via Prisma (raw SQL section for RLS/constraints), update repository and tests,
add/extend tenant-isolation meta-test coverage, update 05 and the module file.
Never: edit applied migrations, use db push/migrate reset on shared DBs, drop columns in the same release that
stops using them.
```
