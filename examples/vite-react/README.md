# @miku/annotator-react Vite example

Local playground for the package.

```bash
npm install
npm run dev
```

What to verify:

1. `src/main.tsx` imports `@miku/annotator-react/register` before React imports.
2. Click **Annotate**.
3. Hover elements — highlight should follow page DOM, not the overlay.
4. Click an element, write a note, save it.
5. Click **Collect**.
6. Clipboard output should be Markdown by default and a Sonner toast should appear.
7. Annotation UI should collapse after copy.

## Local linked-package note

This example imports source files from `../../src` so development changes are immediate. Vite aliases `react` and `react-dom` to the root install so the linked package and example app share one React instance.
