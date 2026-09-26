# ADR-0012: File storage abstraction

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 15, modules/document-management.md

## Context
SaaS needs cloud object storage; self-hosted customers may have none. Business logic must not depend on AWS.

## Decision
`FileStorage` interface with `S3CompatibleStorage` (AWS S3, R2, Spaces, MinIO-compatible) and `LocalFileStorage`
(volume + HMAC-signed API URLs). Metadata in `files`; business attachments in `documents`. Direct-to-storage
presigned uploads, verification + processing in worker, short-lived signed downloads after authorization.

## Alternatives considered
Storing files in PostgreSQL (backup bloat, performance); separate class per S3-compatible vendor (unnecessary);
provider SDK calls in modules (lock-in).

## Consequences
+ Portable, secure. − Local driver must implement streaming/range downloads itself.
