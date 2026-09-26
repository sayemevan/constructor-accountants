-- Baseline: PostgreSQL extensions the schema relies on (05 §1, §9).
--   citext     — case-insensitive emails
--   pg_trgm    — trigram indexes for name search
--   btree_gist — exclusion constraints on date ranges (pay rates, machine assignments)
-- All three are trusted extensions, so the database owner (app_owner) can create them without superuser.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
