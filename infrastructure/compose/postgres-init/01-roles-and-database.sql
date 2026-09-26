-- Dev-only bootstrap, run once by the postgres image on an empty data volume.
-- Mirrors the production role model (ai-context/06-multi-tenancy.md):
--   app_owner — owns the database and tables, runs migrations (DATABASE_MIGRATION_URL)
--   app_user  — used by the API and worker: DML only, never BYPASSRLS (DATABASE_URL)
-- CREATEDB on app_owner is dev-only: `prisma migrate dev` needs it for its shadow database.

CREATE ROLE app_owner LOGIN PASSWORD 'app_owner' CREATEDB NOSUPERUSER NOBYPASSRLS;
CREATE ROLE app_user LOGIN PASSWORD 'app_user' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

CREATE DATABASE construction_erp OWNER app_owner;

\connect construction_erp

-- PostgreSQL 15+: the public schema belongs to the database owner and PUBLIC cannot create in it.
ALTER SCHEMA public OWNER TO app_owner;
REVOKE ALL ON DATABASE construction_erp FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE construction_erp TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Everything app_owner creates later (via migrations) is usable by app_user.
-- Tables that must be append-only (audit_logs, financial_transactions, …) REVOKE UPDATE/DELETE in their migration.
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app_user;
