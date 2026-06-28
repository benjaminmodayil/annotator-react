# Changelog

## 0.3.3

### Patch Changes

- 7a88f12: Focus the annotation note textbox after selecting a target so typing works immediately.

## 0.3.2

### Patch Changes

- e981412: Use explicit annotator colors for light and dark color schemes instead of relying on inherited text colors.

## 0.3.1

### Patch Changes

- f92bfe3: Add explicit annotation-session cancellation with Escape and a panel Cancel control, discarding unsent annotations when exiting.

## 0.3.0

### Minor Changes

- cf6965c: Add same-origin iframe target support, page-aware linked annotations, multi-element collections, and follow-up element linking for existing notes.

### Patch Changes

- a0f1522: Remove Fallow baselines by cleaning up validated dead-code and duplication findings without changing the public annotation API.

## 0.2.2

### Patch Changes

- 24b4250: Show editable annotation popovers from collapsed pins and use icon-only delete controls.

## 0.2.1

### Patch Changes

- 41c21a6: Clarify README positioning, upstream credit, and support expectations.

## 0.2.0

### Minor Changes

- d9ab7b3: Add collection page context, multi-element annotations, and link-element follow-up selection for existing notes.
- 533db2a: Add same-origin iframe target support so parent review shells can annotate elements inside framed prototypes.

## 0.1.2

### Patch Changes

- cb4043a: Improve annotation mode interactions: block host pointer events while selecting, edit/delete saved annotations, preview pins on hover, and clear copied annotations after collect.

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
