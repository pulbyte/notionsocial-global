# Domain Docs

This repo has no domain docs of its own. CONTEXT.md, ADRs and the engineering rules for all three
NotionSocial repos live in notionsocial-backend.

## Before exploring, read these

```
local     ../backend/CONTEXT.md · ../backend/docs/adr/ · ../backend/docs/engineering/
remote    gh api repos/pulbyte/notionsocial-backend/contents/<path> -H "Accept: application/vnd.github.raw"
```

- **`CONTEXT.md`**: the glossary.
- **`docs/adr/`**: ADRs that touch the area you're about to work in.
- **`docs/engineering/CODE-RULES.md`** before writing or reviewing code; **`SAFE-CHANGES.md`** when a
  change replaces a live path; **`ARCHITECTURE.md`** for module ownership.

If any of these files don't exist, **proceed silently**. The `/domain-modeling` skill creates
CONTEXT.md and ADRs lazily, in notionsocial-backend, when terms or decisions get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test
name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, either you're inventing language the project
doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (stack and code rules), but worth reopening because…_
