# Template: Refactoring

```text
Task: Refactor <target code> in <module> to <goal: e.g., extract domain calculation, remove duplication>.
Motivation: <why now>
Constraints: behaviour must not change; public APIs, contracts, events, DB schema unchanged unless stated.

Instructions:
1. Read 03 (layers), 12/11 (standards), 13 (coding), the module file.
2. Ensure characterization tests exist for current behaviour; add them first if missing.
3. Refactor in small steps, keeping tests green after each step.
4. Don't widen scope; list other smells found as follow-ups instead of fixing them.
5. Verify boundaries (dependency-cruiser), lint, typecheck, all module tests.
Output: summary of structural change, confirmation that behaviour/tests are unchanged, follow-up list.
```
