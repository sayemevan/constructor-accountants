# Template: Performance Optimization

```text
Problem: <endpoint/page/job> is slow: <metric, e.g., p95 3.2 s for GET /reports/project.profitability, tenant X size>.
Target: <budget from 22-performance-rules.md>

Load: 22-performance-rules.md, 05 (indexes), the module file, 24 if financial aggregates.

Instructions:
1. Measure first: reproduce with the performance dataset; capture query plans (EXPLAIN ANALYZE, BUFFERS), query
   counts (N+1), payload sizes, React profiler/Lighthouse for UI.
2. Identify the bottleneck; propose options in order of simplicity: query rewrite / select fewer columns → index →
   batching → pagination/limits → async job → summary table/materialized view → caching (tenant-keyed).
3. Any summary table/cache must define ownership, update path (same transaction or outbox), invalidation and a
   verification job; propose before implementing (may need ADR).
4. Preserve correctness: results must equal the unoptimized version (add a test comparing both on fixtures).
5. Re-measure and report before/after numbers.
```
