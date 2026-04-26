# @mikuexe/annotator-react

## Problem Statement

How might we let React developers annotate live UI elements and copy source-aware feedback directly into any coding agent workflow?

## Recommended Direction

Build `@mikuexe/annotator-react`: a tiny React devtool package around `element-source`.

The package provides one default component:

```tsx
<SourceAnnotator />
```

It lets users hover/select React-rendered DOM elements, write inline notes in a popover, then click **Collect** to copy both:

1. human-readable Markdown prompt
2. structured JSON annotation payload

The product stance: **no backend, no accounts, no persistence requirement**. The core workflow is annotate live UI → collect context → paste into any coding agent.

The library can expose small hooks/primitives later, but the first public surface should stay intentionally narrow.

## Key Assumptions to Validate

- [ ] `element-source` reliably resolves React/Vite source locations when the React DevTools hook from `bippy` is installed before React loads.
- [ ] Clipboard handoff is enough for the core workflow; backend/storage is unnecessary for v1.
- [ ] Coding agents can act better with source path + element HTML + user note than with note alone.
- [ ] A single overlay component is simpler and more adoptable than requiring provider/composition setup.

## MVP Scope

### Package API

```tsx
import "@mikuexe/annotator-react/register";
import { SourceAnnotator } from "@mikuexe/annotator-react";

<SourceAnnotator />;
```

Optional props:

```ts
type SourceAnnotatorProps = {
  enabled?: boolean;
  hotkey?: string;
  output?: "markdown" | "json" | "both";
  onCollect?: (payload: AnnotationCollection) => void;
};
```

### UX

```txt
[Annotate] floating button
    ↓
hover element → highlight
    ↓
click element → popover textarea
    ↓
add multiple notes
    ↓
[Collect] → copy Markdown + JSON to clipboard
```

### Captured per annotation

```ts
type Annotation = {
  id: string;
  note: string;
  source: {
    filePath: string;
    lineNumber: number | null;
    columnNumber: number | null;
    componentName: string | null;
  } | null;
  element: {
    tagName: string;
    text: string;
    html: string;
    selector: string;
  };
};
```

### Clipboard Output

Optimize for any coding agent, not Pi-specific.

Output should include:

- concise task framing
- numbered annotations
- source file/line when available
- selected element text/html snippet
- CSS-ish selector
- embedded JSON payload for structured consumers

Example shape:

```md
Please update the UI based on these source-linked annotations.

## Annotation 1

Note: Make this CTA more prominent.
Source: src/App.tsx:42
Component: Hero
Element: <button>Start now</button>
Selector: #root main section button

## JSON Payload

```json
{ "annotations": [] }
```
```

### Examples

Add:

```txt
examples/
  vite-react/
    src/main.tsx
    src/App.tsx
```

Example must prove:

- register import order works
- hover/select works
- source info captured
- clipboard output useful

## Bippy / Import Order Note

`bippy` is available transitively because `element-source` depends on it. But source resolution only works reliably if the React DevTools hook is installed before React loads.

So the package should provide a tiny explicit register entrypoint:

```ts
import "@mikuexe/annotator-react/register";
```

For Vite, this must appear at the very top of `src/main.tsx`, before any React imports. The register entrypoint can likely import `bippy/install-hook-only` to install the hook with minimal overhead.

## Not Doing (and Why)

- **Backend persistence** — copy-to-clipboard is the wedge.
- **Screenshots** — useful later, not core.
- **Framework agnostic API** — `element-source` can be agnostic; this package is React-first.
- **Full headless primitive system** — premature for v1.
- **Browser extension** — heavier install path.
- **Next.js support** — document later; Vite first.
- **Comment threads / collaboration** — not the job.
- **Agent-specific output** — should work with any coding agent.

## Open Questions

- Should the exported component be named `SourceAnnotator`, `Annotator`, or `ReactAnnotator`?
- Should `onCollect` fire before or after clipboard write?
- Should v1 include local draft state if the user accidentally closes the popover?
- How noisy should the captured HTML snippet be before trimming attributes/classes?
