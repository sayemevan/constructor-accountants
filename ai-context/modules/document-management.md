# Module: Document Management (`document`)

Storage mechanics are in `15-file-storage.md` (files module). This module handles business attachment.

## Purpose
Attach files (contracts, agreements, drawings, designs, site/progress photos, receipts, approvals, other) to
business records with correct access control, and let users browse a project's documents and photo gallery.

## Responsibilities
Attach/detach READY files to entities, document types and titles, sensitivity flag, project document library
(filters by type/entity/date), photo gallery (thumbnails, captured_at), `AttachmentTargetRegistry` through which
modules register resolvers, download URL issuance after authorization, sensitive-download audit.

## Entities
`documents`: tenant_id, file_id, entity_type (PROJECT|PROJECT_UPDATE|CONTRACT|CLIENT_BILL|TRANSACTION|OBLIGATION|
EMPLOYEE|PARTY|SUBCONTRACT|SUBCONTRACT_BILL|MACHINE|MAINTENANCE|RENTAL), entity_id, project_id NULL (denormalized
from resolver for scope filtering), document_type, title, description, is_sensitive, taken_at NULL, created_by_id,
created_at, deleted_at, deleted_by_id.
Indexes: (tenant_id, entity_type, entity_id), (tenant_id, project_id, document_type, created_at DESC).

## Attachment resolvers (dependency inversion)
Each owning module registers:
```ts
registry.register('SUBCONTRACT_BILL', {
  resolve: (id) => Promise<{ exists: boolean; projectId: string | null; isFinancial: boolean }>,
  viewPermission: 'subcontract.view', attachPermission: 'subcontract.update',
});
```
The document module never imports business modules; it asks the registry. Unknown entity types are rejected.

## Business rules
- To attach: caller needs the entity's attach permission (+ scope) and `document.upload`; file must belong to the
  tenant, be READY (or PENDING with auto-attach on READY), and not already attached to the same entity.
- To view/download: entity view permission + scope; `is_sensitive` documents additionally require
  `document.sensitive.view` (default: Owner, Accountant, PM). Employee documents require `employee.personal.view`.
- Default sensitivity by type: CONTRACT, AGREEMENT, EMPLOYEE docs → sensitive; SITE_PHOTO/PROGRESS_PHOTO → not.
- Delete (detach) = soft delete; documents attached to financial entities (TRANSACTION, OBLIGATION, bills) cannot
  be deleted after the entity is posted/approved (`DOCUMENT_LOCKED`) — they are evidence.
- Photos keep `taken_at` from EXIF (before stripping) or device time.
- Bulk photo upload (up to 20 per batch) for mobile.

## APIs
- `POST /api/v1/documents` `{ fileId, entityType, entityId, documentType, title?, description?, isSensitive? }`
- `POST /api/v1/documents/bulk` (photos)
- `GET /api/v1/documents?entityType=&entityId=` · `GET /api/v1/documents?projectId=&documentType=&dateFrom=`
- `GET /api/v1/documents/{id}` · `PATCH /api/v1/documents/{id}` (title/description/type/sensitivity)
- `DELETE /api/v1/documents/{id}` (soft) · `GET /api/v1/documents/{id}/download-url`
- `POST /api/v1/documents/thumbnail-urls` `{ ids[] }` (batch signed thumbnail URLs)
- Upload intents/complete are files-module endpoints (15).

## Permissions
`document.view`, `document.upload`, `document.update`, `document.delete`, `document.sensitive.view`.
Plus entity-level permissions via resolvers. Defaults: Owner all; PM (ASSIGNED) all except delete of others' docs;
Supervisor (ASSIGNED) view (non-sensitive) + upload; Accountant view + upload + sensitive.view.

## Events
`DocumentUploaded` (optional notification to project members for drawings/approvals).

## Validation
documentType enum; title ≤ 200; entity exists via resolver; file READY/tenant match; batch size ≤ 20.

## Financial impact
None; receipts/invoices serve as evidence for financial records.

## Audit
Attach, update, delete; downloads of sensitive documents.

## Future extension
Versioning of drawings (revision numbers, supersedes), folders/tags, OCR of receipts to prefill expenses,
full-text search, sharing links for clients (client portal), annotations on drawings, expiry dates on permits.

## Must NOT
Talk to storage SDKs directly (files module does); import business modules; expose public/permanent URLs;
hard-delete evidence attached to financial records; bypass entity permissions.
