# MVP validation notes

## What the example verifies

- `examples/vite-react/src/main.tsx` imports `@mikuexe/annotator-react/register` before React imports.
- The default `<SourceAnnotator />` renders a floating Annotate button.
- Annotate mode highlights hovered elements and excludes the overlay from selection.
- Clicking a page element opens a note popover.
- Saved notes appear as pins/list items.
- Collect copies agent-ready Markdown by default, shows a Sonner toast, then collapses annotation UI. JSON is opt-in via `output="json"` or `output="both"`.
- Copied payload includes component path/source stack when `element-source` can resolve React ownership.

## Constraints for v1

- Vite-first support only.
- No backend/storage/accounts.
- No screenshots.
- No framework-agnostic API.
- No Next.js support guarantee in v1.
- Source resolution relies on the `bippy` React DevTools hook being installed before React loads. If import order is wrong, annotations still capture element text/html/selector, but source can be `null`.

## Collection timing

`onCollect(payload)` fires after clipboard write succeeds, so host apps can treat it as confirmation that the payload was handed off.
