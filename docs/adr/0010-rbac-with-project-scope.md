# ADR-0010: Configurable RBAC with code-defined permissions and project scope

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 09, modules/authorization.md

## Context
Roles must be configurable per company; project managers and supervisors should see only their projects; wages
and financials need field-level protection. The spec had module/action permissions but no data scope.

## Decision
Permission codes defined in code per module and synced to a catalog; tenant-owned roles grant permissions with
scope TENANT or ASSIGNED_PROJECTS (via `project_members`); default roles copied per tenant (Owner locked);
dedicated view permissions for sensitive fields; checks via guards + `PermissionService`, never role names.

## Alternatives considered
Hard-coded roles (inflexible); full ABAC/policy engine (e.g., CASL/OPA — more complexity than needed now);
per-record ACLs everywhere (costly; reserved for future sensitive documents).

## Consequences
+ Flexible, testable. − Every list query must apply scope filters (enforced by tests).
