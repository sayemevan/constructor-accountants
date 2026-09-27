/** A tenant-owned table (has a `tenant_id` column) that is not fully protected by row-level security. */
export interface RlsGap {
  readonly table: string;
  readonly rlsEnabled: boolean;
  readonly rlsForced: boolean;
  readonly policyCount: number;
}

/**
 * The DB meta-check required by 06/14: every table in `public` with a `tenant_id` column has RLS enabled AND
 * forced AND at least one policy. Returns the tables that fail. Run it as any role that can read the catalogs.
 */
export const RLS_GAPS_SQL = `
  SELECT c.relname                                  AS "table",
         c.relrowsecurity                           AS "rlsEnabled",
         c.relforcerowsecurity                      AS "rlsForced",
         (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS "policyCount"
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND EXISTS (SELECT 1 FROM pg_attribute a
                WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped)
    AND NOT (c.relrowsecurity AND c.relforcerowsecurity
             AND EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid))
  ORDER BY c.relname`;
