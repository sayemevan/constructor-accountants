# Template: Bug Fix

```text
Bug: <short title>
Module: <module>
Problem description: <what is wrong, for whom>
Expected behaviour: <per which rule/file: e.g., modules/payroll.md "DAILY" rule>
Actual behaviour: <observed>
Steps to reproduce: <1…n, tenant/role/data>
Error message / logs / requestId: <paste>
Related code (if known): <paths>

Instructions:
1. Load the module file and relevant standards; read the code path end-to-end (controller → service → domain → repo).
2. Reproduce with a failing test first (unit if domain logic, integration/API if wiring/tenancy/permission).
3. Identify the root cause (not the symptom). Explain it briefly before fixing.
4. Fix minimally in the correct layer; do not refactor unrelated code.
5. Check for the same bug pattern elsewhere (search) and list occurrences (fix only if same module/in scope).
6. If the bug affected stored financial data, do NOT patch data silently — propose a corrective posting/adjustment
   or a reviewed data migration with audit.
7. Run tests; report root cause, fix, tests added, commands + results.
```
