# AGENTS.md

Agent guidance for this repo. Read `@README.md` for package usage/API and `@docs/packaging.md` for release details.

## Project purpose

This is personal local-agent tooling for the maintainer's custom UI annotation workflow. It wraps `element-source` with the overlay/output behavior needed for local coding agents.

Upstream/reference projects to remember:

- Aiden Bai created `element-source`: https://github.com/aidenybai/element-source
- Aiden Bai also created react-grab: https://www.react-grab.com/
- Agentation is another recommended product in this space: https://www.agentation.com/

Optimize this repo for maintainer needs first. Do not promise stable roadmap, broad framework support, issue triage, or support commitments in docs.

## Commands

```bash
npm run check      # typecheck + tests + build
npm run check:all  # full verification: check + example build + pack dry-run
```

Use `npm run check` for code changes. Use `npm run check:all` for package/release/docs/publish-readiness changes.

## Release workflow

This repo uses Changesets + GitHub Actions + npm Trusted Publishing.

For user-facing changes:

```bash
npm run changeset
```

Commit the generated `.changeset/*.md` with the change.

CI enforces this for package-facing changes. Use the `no-changeset-needed` PR label only when the guard is a false positive.

Semver choice:

- `patch`: fixes, docs/package polish, small behavior improvements
- `minor`: backwards-compatible features
- `major`: breaking API/import/package behavior

Normal release path:

```txt
merge change to main
→ Release workflow opens/updates "chore: version packages" PR
→ review package.json/package-lock.json/CHANGELOG.md
→ merge version PR
→ workflow publishes to npm
```

## Guardrails

- Package scope is `@mikuexe`, not `@execmd`.
- Do not commit `.npmrc`.
- Do not commit `opensrc/`.
- Keep published files limited to `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`.
- Preserve top-level `"use client"` in built main outputs.
- `@mikuexe/annotator-react/register` must load before React.
- Export/copy payloads must not include internal DOM refs.

## When editing

- Public API changes: update `@README.md`, `src/types.ts`, and tests.
- Packaging/release changes: update `@docs/packaging.md`.
- Behavior changes: add/update tests in `src/__tests__/`.
- Package export/import changes: smoke-test packed tarball from a temp project when practical.
