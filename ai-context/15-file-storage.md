# 15 — File Storage Architecture

Load when: uploads, downloads, photos, attachments, exports, or storage configuration.
Business rules for documents: `modules/document-management.md`.

## Separation of concerns
- **`files` module (core infrastructure):** binary lifecycle — upload intents, verification, storage, variants
  (thumbnails), signed downloads, retention/purge. Knows nothing about projects or contracts.
- **`document` module (business):** attaches a READY file to a business record with a document type, title,
  project and sensitivity; enforces who may see/attach/remove.
- Business modules never call the storage SDK. They reference `file_id`/`document_id`.

## FileStorage abstraction (ADR-0012)
```ts
interface FileStorage {
  createUploadTarget(key: string, opts: { contentType: string; sizeBytes: number; expiresInSec: number }):
    Promise<{ url: string; method: 'PUT' | 'POST'; headers: Record<string, string>; fields?: Record<string,string> }>;
  createDownloadUrl(key: string, opts: { expiresInSec: number; fileName: string; disposition: 'inline' | 'attachment' }): Promise<string>;
  head(key: string): Promise<{ sizeBytes: number; contentType?: string } | null>;
  getStream(key: string): Promise<NodeJS.ReadableStream>;   // worker: scanning, thumbnails
  put(key: string, body: Buffer | NodeJS.ReadableStream, contentType: string): Promise<void>; // worker outputs
  delete(key: string): Promise<void>;
}
```
Implementations (selected by `STORAGE_DRIVER`):
- `S3CompatibleStorage` — AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO/Ceph/Garage (endpoint, region,
  bucket, credentials, `forcePathStyle` configurable). One implementation covers all S3-compatible providers;
  separate "R2Storage" classes are unnecessary unless a provider needs special behaviour.
- `LocalFileStorage` — filesystem volume for self-hosted/dev. Upload/download URLs point to API endpoints
  (`/api/v1/files/{id}/content?token=…`) using short-lived HMAC-signed tokens; streams with range support.
Contract tests run the same suite against both drivers (MinIO container for S3 in CI).

## Metadata (`files` table)
id, tenant_id, storage_driver, storage_key UNIQUE, original_name (sanitized), mime_type (sniffed),
size_bytes, checksum_sha256, status (PENDING|READY|QUARANTINED|REJECTED|DELETED), purpose
(DOCUMENT|PHOTO|AVATAR|LOGO|EXPORT), variants jsonb (e.g., `{ thumb: key, medium: key }`), width/height NULL,
captured_at NULL (from EXIF before stripping), uploaded_by_id, created_at, deleted_at, purge_after.

## Keys
`tenants/{tenantId}/{purpose}/{yyyy}/{mm}/{fileId}` (+ `/variants/{name}.webp`). Never user-supplied names or
paths in keys. Original filename kept in DB and returned via `Content-Disposition`.

## Upload flow
1. Client asks for an upload intent (declares name, type, size, purpose). Server checks permission, tenant quota,
   allowlist and max size → creates PENDING file row → returns target (expires in 10 min).
2. Client uploads directly to storage (S3) or to the API endpoint (local).
3. Client calls `complete`. Server `head`s the object, verifies size, then the worker sniffs magic bytes,
   computes checksum, optionally scans (ClamAV if `FILE_SCAN_ENABLED`), strips EXIF from images, generates
   variants (320px thumb, 1600px medium, WebP). Status → READY (or REJECTED/QUARANTINED).
4. Client attaches via `POST /documents`. Attachments may reference a PENDING file only if it becomes READY;
   UI shows processing state.
5. Orphan PENDING/unattached files purged after 24 h.

## Limits & allowlist (tenant-configurable within platform maxima)
| Kind | MIME | Max |
|---|---|---|
| Photos | image/jpeg, image/png, image/webp, image/heic (converted) | 20 MB |
| Documents | application/pdf, docx, xlsx, txt, csv | 50 MB |
| Drawings | application/pdf, image/*, dwg/dxf (attachment-only, no preview) | 100 MB |
SVG, HTML, JS, executables and archives are rejected in MVP.

## Downloads
`GET /documents/{id}/download-url` → authorize (tenant, project scope, document sensitivity, permission) →
signed URL valid 5 min, `Content-Disposition: attachment` except images/PDF previews (`inline`), response
content-type forced to the stored sniffed type. Never expose permanent/public URLs. Thumbnails in lists use
batch-issued signed URLs (one API call per page).

## Security
Private bucket, no public ACLs, bucket CORS limited to app origin for PUT. Server-side encryption enabled at
provider. Download access audited for sensitive document types (contracts, agreements, personal documents).

## Backups & portability
SaaS: bucket versioning + replication/lifecycle; self-hosted: include storage volume in backup script. Tenant
export bundles DB data + files with a manifest. Changing provider = copy objects with same keys + change env.

## Quotas
Track `SUM(size_bytes)` per tenant (cached nightly) for future plan limits (subscriptions); enforce platform max.
