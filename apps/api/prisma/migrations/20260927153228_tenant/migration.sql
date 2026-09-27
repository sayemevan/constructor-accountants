-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "slug" TEXT NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'ACTIVE',
    "base_currency" CHAR(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "country_code" CHAR(2),
    "tax_id" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postal_code" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo_file_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "settings" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------------------------
-- Hand-written (05 §9, 06 "RLS implementation")
-- ---------------------------------------------------------------------------------------------------------------

-- Slug: lowercase letters, digits and inner hyphens, 3–63 chars (future subdomain). Immutable (TenantService).
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_format_check"
  CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$');
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_base_currency_format_check"
  CHECK ("base_currency" ~ '^[A-Z]{3}$');
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_country_code_format_check"
  CHECK ("country_code" ~ '^[A-Z]{2}$');
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_settings_object_check"
  CHECK (jsonb_typeof("settings") = 'object');

-- tenants is global (no tenant_id, no RLS): the tenant module's repository scopes every query by id.
-- tenant_settings is tenant-owned: tenant_id defaults to the transaction's tenant and RLS enforces it.
ALTER TABLE "tenant_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_settings"
  USING (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid)
  WITH CHECK (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid);

-- Tenants are closed, never deleted (06 "Tenant lifecycle"); purging is a runbook step run as the owner.
-- Other DML comes from the default privileges in the role bootstrap. app_platform is optional (06), so it is
-- revoked only where it exists.
REVOKE DELETE ON "tenants", "tenant_settings" FROM app_user;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform') THEN
    REVOKE DELETE ON "tenants", "tenant_settings" FROM app_platform;
  END IF;
END
$$;
