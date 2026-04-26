# Changelog

## 0.1.1

### Patch Changes

- be9d607: update naming around package

## 0.1.0 - Initial MVP

### Added

- React `SourceAnnotator` overlay for selecting live DOM elements and attaching notes.
- Clipboard output as Markdown, JSON, or both.
- Source-aware capture through `@mikuexe/annotator-react/register`, `bippy`, and `element-source`.
- Graceful fallback output when React source data is unavailable.
- Sonner copy success/error toasts, with `renderToaster={false}` for host-owned toaster setups.
- ESM and CommonJS package entrypoints for the main API and `./register`.

### Package behavior

- Published files are limited to `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`, and `package.json`.
- Runtime dependencies are externalized to avoid bundling React or host app dependencies.
- Built main entrypoints include a `"use client"` directive for React Server Component/client-boundary tooling.

### Known constraints

- Vite-first support; Next.js usage is documented but not fully validated.
- `@mikuexe/annotator-react/register` must import before React loads.
- Source capture quality depends on React owner/source metadata availability.
- No persistence, accounts, screenshots, backend sync, or collaboration features in this MVP.
