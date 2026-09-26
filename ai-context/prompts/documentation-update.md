# Template: Documentation Update

```text
Task: Update documentation to match the implementation of <change/PR>.

Check and update as needed:
- ai-context/modules/<module>.md — entities, rules, APIs, permissions, events, validation, must-not
- ai-context/23-module-registry.md — tables owned, public services, dependencies, phase
- ai-context/05-database-architecture.md — new tables/constraints/indexes
- ai-context/25-domain-events.md — new/changed events
- ai-context/24-financial-model.md — any posting rule change (requires ADR reference)
- docs/adr/ — new ADR for decisions (template 0000); mark superseded ADRs
- CLAUDE.md — phase status, commands, routing table if new files were added
- .env.example and 17-deployment-architecture.md — new env vars

Rules: document what IS implemented (not wishes); keep 00-master-context.md concise (only always-needed facts);
don't duplicate content across files — link instead; remove outdated statements rather than adding contradictions.
Output: list of files changed with a one-line reason each.
```
