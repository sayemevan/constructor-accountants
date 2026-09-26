# Prompt Templates

Copy a template, fill the `<…>` fields, and give it to the AI agent. Each template tells the agent exactly which
context to load, so you don't paste specs into the prompt. Templates assume `CLAUDE.md` (and therefore
`00-master-context.md`) is already loaded.

| Template | Use for |
|---|---|
| [new-feature.md](new-feature.md) | A feature inside an existing module |
| [new-module.md](new-module.md) | A new business/core module |
| [database-change.md](database-change.md) | Schema/migration changes |
| [api-development.md](api-development.md) | New/changed endpoints |
| [backend-development.md](backend-development.md) | Services, domain logic, jobs |
| [frontend-development.md](frontend-development.md) | Pages, components, forms |
| [bug-fix.md](bug-fix.md) | Defects |
| [refactoring.md](refactoring.md) | Behaviour-preserving restructuring |
| [code-review.md](code-review.md) | Reviewing a diff/PR |
| [security-review.md](security-review.md) | Security audit of a change or module |
| [test-generation.md](test-generation.md) | Adding tests to existing code |
| [performance-optimization.md](performance-optimization.md) | Slow queries/pages/jobs |
| [documentation-update.md](documentation-update.md) | Keeping context/docs in sync |

Rules for writing prompts: state the goal and acceptance criteria, name the module, cite business rules by file
section rather than re-describing them, say what is out of scope, and say whether you want a plan first.
