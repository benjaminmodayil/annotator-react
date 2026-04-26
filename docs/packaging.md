# Packaging notes

## Package shape

`@miku/annotator-react` publishes only:

- `dist/`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `package.json`

The package exposes two public entrypoints:

```ts
import { SourceAnnotator } from "@miku/annotator-react";
import "@miku/annotator-react/register";
```

## Build outputs

`tsup` emits:

- ESM: `dist/index.js`, `dist/register.js`
- CJS: `dist/index.cjs`, `dist/register.cjs`
- Types: `dist/index.d.ts`, `dist/register.d.ts`
- Sourcemaps

`dist/index.js` and `dist/index.cjs` include a top-level `"use client"` directive because `SourceAnnotator` uses React hooks and browser APIs. Treat `SourceAnnotator` as a client-only component in React Server Component frameworks.

Runtime dependencies are externalized from the bundle:

- `react`
- `react-dom`
- `sonner`
- `element-source`
- `bippy`

This keeps the package small and avoids bundling a second React copy.

## Release automation

This repo uses Changesets plus GitHub Actions:

- `.changeset/config.json` configures versioning/changelog behavior.
- `npm run changeset` creates a release note and requested semver bump.
- `npm run version-packages` applies pending changesets to `package.json`, `package-lock.json`, and `CHANGELOG.md`.
- `npm run release` runs the full verification suite and publishes changed packages.
- `.github/workflows/ci.yml` runs `npm run check:all` on PRs and `main` pushes.
- `.github/workflows/release.yml` opens/updates a Version Packages PR when changesets exist, then publishes to npm after that PR is merged.

Typical PR flow:

```bash
# Make code/docs changes.
npm run check:all
npm run changeset
```

Commit the generated `.changeset/*.md` file with the feature/fix. Pick:

- `patch` for bug fixes, docs/package polish, and small behavior improvements.
- `minor` for new backwards-compatible features.
- `major` for breaking API/import/package behavior.

After merge to `main`, the Release workflow creates or updates a PR titled `chore: version packages`. Review that PR's `package.json`, `package-lock.json`, and `CHANGELOG.md`. Merging it triggers the publish path.

The publish path is designed for npm Trusted Publishing with provenance. In the npm package settings, add this GitHub repository and workflow as a trusted publisher for `.github/workflows/release.yml`. The workflow sets `id-token: write` and `NPM_CONFIG_PROVENANCE=true`, so no long-lived `NPM_TOKEN` secret should be needed in GitHub.

Keep the local `~/.npmrc` token only for manual emergency publishes.

## Registry metadata checklist

Before the first publish, verify `package.json` has final public values for:

- `author`
- `repository.url`
- `homepage`
- `bugs.url`
- `publishConfig.access`

## Release checks

Run before publishing:

```bash
npm run check:all
```

This runs:

1. TypeScript typecheck
2. Vitest unit tests
3. Library build
4. Vite example production build
5. `npm pack --dry-run`

Also inspect the package manifest from the dry run. Expected files are `dist/**`, `README.md`, `CHANGELOG.md`, `LICENSE`, and `package.json` only.

## Temp-project smoke tests

After `npm run build`, verify both module systems from outside this repo:

```bash
tmpdir=$(mktemp -d)
npm pack --pack-destination "$tmpdir"
pkg="$tmpdir"/miku-annotator-react-0.1.0.tgz

mkdir "$tmpdir/smoke"
cd "$tmpdir/smoke"
npm init -y
npm install "$pkg" react react-dom

node --input-type=module -e 'import("@miku/annotator-react").then((m) => console.log(typeof m.SourceAnnotator))'
node -e 'const m = require("@miku/annotator-react"); console.log(typeof m.SourceAnnotator)'
node --input-type=module -e 'import("@miku/annotator-react/register").then(() => console.log("esm register ok"))'
node -e 'require("@miku/annotator-react/register"); console.log("cjs register ok")'
```

Expected output includes `function`, `function`, `esm register ok`, and `cjs register ok`.

## Host integration caveats

- `@miku/annotator-react/register` must run before React imports so the DevTools hook is installed early enough for source capture.
- `SourceAnnotator` renders its own Sonner `<Toaster />` by default. Apps that already own Sonner rendering should use `<SourceAnnotator renderToaster={false} />`.
- Clipboard writes require a browser context with clipboard permissions.

## Publishing

For a release candidate:

```bash
npm version patch --no-git-tag-version
npm run check:all
# run temp-project smoke tests above
npm publish --access public
```

Use the correct semver bump (`patch`, `minor`, `major`, or explicit version) for the actual release. Create the git tag and GitHub release after the package is verified.

Prefer the automated Changesets workflow above for normal releases.

`prepublishOnly` runs `npm run check:all` automatically.

## Local example caveat

The Vite example imports the package source directly via aliases. Because the root package has its own `node_modules`, the example aliases `react` and `react-dom` to the root install to avoid invalid hook calls from duplicate React instances.
