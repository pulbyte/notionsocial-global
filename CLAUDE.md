# CLAUDE.md

## Code rules

Standards: `../backend/CODING_STANDARDS.md`.
Live paths: `../backend/docs/standards/live-changes.md`.
Changes go through a PR; enable the hook once per clone: `git config core.hooksPath .githooks`.
New code goes in a module, `src/<module>/`.
`npm run check` gates module code: strict tsc, oxlint + anti-slop, depcruise, knip, vitest.
Flat files in `src/*.ts` are legacy and are not checked until their logic moves into a module.

## Builds and release

- Two entry points: `src/index.ts` (Node) and `src/browser.ts` (browser subset; no Node modules).
  A module the app needs is exported from both.
- effect is bundled into the Node build (tsup noExternal) because it is ESM-only and the
  functions jest tests run CommonJS; consumers call modules through Promise APIs.
- Import Node built-ins with `node:` (`node:crypto`): tsconfig baseUrl resolves a bare `crypto`
  to `src/crypto.ts`.
- Release: bump the version in the PR; merging to main runs the publish workflow (GitHub
  Packages). Consumers install the exact version after the run finishes.
- Legacy jest tests live in `tests/` (6 known failures on main).
- Module tests are vitest beside the code.

## Agent skills

### Issue tracker

GitHub Issues in pulbyte/notionsocial-backend, not this repo; always pass `-R`.
See `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles. See `docs/agents/triage-labels.md`.

### Domain docs

Shared docs live in notionsocial-backend (../backend locally). See `docs/agents/domain.md`.
