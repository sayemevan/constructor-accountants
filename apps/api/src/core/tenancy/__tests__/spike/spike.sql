-- Tenancy spike (ADR-0005) — TEST-ONLY. Applied by the integration test as app_owner after the real migrations.
-- This is the template every tenant-owned table's migration follows (05 §9, 06 "RLS implementation").

CREATE TABLE spike_tenants (
  id   uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE spike_projects (
  id        uuid PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id', true), ''))::uuid
            REFERENCES spike_tenants (id),
  name      text NOT NULL,
  CONSTRAINT spike_projects_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE INDEX spike_projects_tenant_id_name_idx ON spike_projects (tenant_id, name);

CREATE TABLE spike_project_notes (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id', true), ''))::uuid
             REFERENCES spike_tenants (id),
  project_id uuid NOT NULL,
  body       text NOT NULL,
  CONSTRAINT spike_project_notes_tenant_id_id_key UNIQUE (tenant_id, id),
  -- Composite FK (05 §1): referencing another tenant's project is impossible, whatever role inserts the row.
  CONSTRAINT spike_project_notes_project_fkey FOREIGN KEY (tenant_id, project_id)
    REFERENCES spike_projects (tenant_id, id)
);
CREATE INDEX spike_project_notes_tenant_id_project_id_idx ON spike_project_notes (tenant_id, project_id);

-- RLS. NULLIF matters: once a pooled session has run set_config(..., true), the setting reverts to '' (not NULL)
-- after commit, and ''::uuid would raise instead of matching nothing.
ALTER TABLE spike_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE spike_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON spike_projects
  USING (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid)
  WITH CHECK (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid);

ALTER TABLE spike_project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE spike_project_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON spike_project_notes
  USING (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid)
  WITH CHECK (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid);

-- Grants come from the default privileges in the role bootstrap (app_user: DML on everything app_owner creates).
