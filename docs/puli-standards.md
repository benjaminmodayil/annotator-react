# Puli standards

This repository owns a local copy of the Puli agent standards under `.puli/`. The copy is intentionally repo-local so agents can inspect, adapt, and ratchet strictness without depending on a published package.

The active ESLint entrypoint is `eslint.config.mjs`, which composes the Puli React profile with package-specific rules because `@mikuexe/annotator-react` is a publishable React library.

CI uses reviewdog-first feedback for private/personal-repo compatibility:

- ESLint emits SARIF and reviewdog posts inline PR comments on changed lines.
- Fallow emits SARIF and reviewdog posts structural findings on changed lines.
- GitHub Code Scanning upload is intentionally omitted; it can require a paid GitHub Code Security plan for private personal repositories.
- React Doctor runs through its own pinned GitHub Action for React PR feedback.

When updating the copied standards, prefer narrow project overrides in `.puli/policies/project-overrides.mjs` over broad global disables. Keep package checks (`publint` and `attw`) enabled because this repo publishes an npm package.

## Package checks

`package:check` currently gates on `publint`. The `attw:check` script is available for manual type-resolution audits, but it is not part of Strict CI yet because the current published/local tarball makes `@arethetypeswrong/cli` crash internally with `Cannot read properties of undefined (reading 'filename')`. Keep `attw:check` as a follow-up ratchet target once that package-shape/tooling issue is understood.
