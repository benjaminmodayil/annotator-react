# @mikuexe/annotator-react

React devtool overlay for source-aware UI annotations. Select live DOM elements, write notes, then copy an agent-ready Markdown prompt.

## Start here first

If you want a polished, supported tool in this space, look at these first:

- [react-grab](https://www.react-grab.com/)
- [Agentation](https://www.agentation.com/)

This package exists for my own local-agent UI workflow. It is intentionally small, experimental, and likely to change whenever my needs change.

Important credit: Aiden Bai created [react-grab](https://www.react-grab.com/) and [`element-source`](https://github.com/aidenybai/element-source), the source-resolution library this package builds on.

I made this repo because I wanted custom UI behavior on top of `element-source`. You are welcome to use it, but please treat it as personal tooling, not a supported product. I am not committing to issue triage, feature requests, roadmap stability, or compatibility guarantees. Requests are fine, but this package will continue to follow my own needs first.

## Install

```bash
npm install @mikuexe/annotator-react
```

Peer deps:

```bash
npm install react react-dom
```

## Quick start

`register` must load before React.

```tsx
// src/main.tsx
import "@mikuexe/annotator-react/register";

import { createRoot } from "react-dom/client";
import { SourceAnnotator } from "@mikuexe/annotator-react";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <SourceAnnotator />
  </>
);
```

`SourceAnnotator` is a client component: render it only from browser/client React trees.

Click **Annotate**, select an element, write a note, then click **Collect**.

Desktop multi-select: while annotating, hold **Ctrl** (Windows/Linux) or **⌘ Cmd** (macOS) and click more elements to attach them to the same note. You can also use **Link element** on an existing annotation to attach one more element to that same comment.

## API

```ts
type SourceAnnotatorProps = {
  enabled?: boolean;
  hotkey?: string; // default: "alt+a"
  output?: "markdown" | "json" | "both"; // default: "markdown"
  target?: Document | HTMLIFrameElement | null; // default: document
  onCollect?: (payload: AnnotationCollection) => void;
  renderToaster?: boolean; // default: true
};
```

`onCollect(payload)` fires after the clipboard write succeeds. The payload includes collection-level page context as `page: { domain, path }`.

### Annotating same-origin iframes

Pass a same-origin iframe element as `target` when the annotator UI lives in a parent shell but users need to select elements inside the framed app. The annotator listens inside the iframe document, captures the actual clicked element, and offsets highlights, pins, and popovers into the parent viewport.

```tsx
import { useState } from "react";
import { SourceAnnotator } from "@mikuexe/annotator-react";

export function ReviewShell() {
  const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null);

  return (
    <>
      <iframe ref={setIframe} src="/prototype/" />
      <SourceAnnotator target={iframe} />
    </>
  );
}
```

The iframe must be same-origin so the browser allows access to `iframe.contentDocument`. Cross-origin iframes cannot expose their internal DOM to the parent page.

### Sonner toaster ownership

By default, `SourceAnnotator` renders its own Sonner `<Toaster />` so copy success and failure toasts work without host setup. If your app already renders a Sonner toaster, disable the internal one to avoid duplicate toaster roots:

```tsx
<SourceAnnotator renderToaster={false} />
```

## Output modes

Default output is Markdown only:

```tsx
<SourceAnnotator />
```

Opt into structured JSON:

```tsx
<SourceAnnotator output="both" />
<SourceAnnotator output="json" />
```

Markdown includes available fields only. Missing source data is omitted instead of printed as `Unavailable`.

Example copied Markdown:

```md
Please update the UI based on these source-linked annotations.

Collected at: 2026-04-25T00:00:00.000Z
Domain: example.com
Path: /prototype

## Annotation 1

ID: ann-1
Note: Make this CTA full width.
Source: src/App.tsx:42:7
Nearest React component: ActionButton
React owner path: ActionButton › HeroSection › App
React source stack:

- src/App.tsx:42:7 (ActionButton)
- src/App.tsx:18:3 (HeroSection)
  Element tag: button
  Element HTML: <button class="primary-cta" type="button">Start annotation pass</button>
  Element text: Start annotation pass
  Selector: #root main.app-shell section.hero button.primary-cta:nth-of-type(1)
```

## Captured data

```ts
type AnnotationSource = {
  filePath: string;
  lineNumber: number | null;
  columnNumber: number | null;
  componentName: string | null;
};

type AnnotationTarget = {
  source: AnnotationSource | null;
  sourceStack: AnnotationSource[];
  componentPath: string[];
  element: {
    tagName: string;
    text: string;
    html: string;
    selector: string;
  };
};

type Annotation = {
  id: string;
  note: string;
  targets: AnnotationTarget[];
};

type AnnotationCollection = {
  createdAt: string;
  page: {
    domain: string;
    path: string;
  };
  annotations: Annotation[];
};
```

## How source capture works

`@mikuexe/annotator-react/register` installs the React DevTools hook through `bippy/install-hook-only`. `element-source` then uses React ownership data to resolve selected DOM elements back to React components/source.

If source resolution fails, annotations still include DOM context: tag, HTML, text, selector, and any nearest React component/owner path that could be resolved. Copied/exported payloads contain only serializable data and never internal DOM references.

## Local example

```bash
cd examples/vite-react
npm install
npm run dev
```

The example app aliases linked source to one React copy in Vite to avoid duplicate-React invalid hook errors during local development.

## Current constraints

- Vite-first support.
- React-first API; not framework agnostic.
- No backend, accounts, persistence, screenshots, or collaboration in v1.
- Next.js support is not validated yet.
- Source capture depends on `register` running before React imports.
