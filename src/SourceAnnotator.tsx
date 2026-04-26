import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Toaster, toast } from "sonner";
import { captureElementAnnotation } from "./capture";
import { copyTextToClipboard } from "./clipboard";
import { createAnnotationCollection, formatAnnotationCollection } from "./format";
import type { Annotation, SourceAnnotatorOutput, SourceAnnotatorProps } from "./types";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type SelectedElement = {
  element: Element;
  rect: Rect;
  annotation: Annotation | null;
  loading: boolean;
};

type StoredAnnotation = Annotation & {
  targetElement: Element;
  rect: Rect;
};

const ROOT_ATTR = "data-miku-annotator-root";
const DEFAULT_HOTKEY = "alt+a";
const DEFAULT_OUTPUT: SourceAnnotatorOutput = "markdown";

export function SourceAnnotator({
  enabled = true,
  hotkey = DEFAULT_HOTKEY,
  output = DEFAULT_OUTPUT,
  onCollect,
  renderToaster = true,
}: SourceAnnotatorProps) {
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [hoverRect, setHoverRect] = useState<Rect | null>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [note, setNote] = useState("");
  const [annotations, setAnnotations] = useState<StoredAnnotation[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const selectedRef = useRef<SelectedElement | null>(null);

  selectedRef.current = selected;

  const collection = useMemo(
    () => createAnnotationCollection(annotations.map(({ rect: _rect, targetElement: _targetElement, ...annotation }) => annotation)),
    [annotations],
  );

  const refreshTrackedRects = useCallback(() => {
    setHoverRect(null);
    setSelected((current) => (current ? { ...current, rect: getRect(current.element) } : current));
    setAnnotations((existing) => existing.map((annotation) => ({ ...annotation, rect: getRect(annotation.targetElement) })));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsAnnotating(false);
    }
  }, [enabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesHotkey(event, hotkey)) {
        return;
      }

      event.preventDefault();
      setIsAnnotating((current) => enabled && !current);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, hotkey]);

  useEffect(() => {
    if (!enabled || !isAnnotating) {
      setHoverRect(null);
      return;
    }

    const onPointerOver = (event: PointerEvent) => {
      const target = getAnnotatableTarget(event.target);
      if (!target) {
        setHoverRect(null);
        return;
      }

      setHoverRect(getRect(target));
    };

    const onClick = (event: MouseEvent) => {
      const target = getAnnotatableTarget(event.target);
      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = getRect(target);
      setSelected({ element: target, rect, annotation: null, loading: true });
      setNote("");
      setStatus("Resolving source…");

      captureElementAnnotation(target, "")
        .then((annotation) => {
          setSelected((current) => {
            if (current?.element !== target) {
              return current;
            }

            return { ...current, annotation, loading: false };
          });
          setStatus(annotation.source ? "Source captured." : "Element captured without source info.");
        })
        .catch(() => {
          setSelected((current) => (current?.element === target ? { ...current, loading: false } : current));
          setStatus("Element captured without source info.");
        });
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled, isAnnotating]);

  useEffect(() => {
    if (!enabled || !isAnnotating) {
      return;
    }

    document.addEventListener("scroll", refreshTrackedRects, true);
    window.addEventListener("resize", refreshTrackedRects);

    return () => {
      document.removeEventListener("scroll", refreshTrackedRects, true);
      window.removeEventListener("resize", refreshTrackedRects);
    };
  }, [enabled, isAnnotating, refreshTrackedRects]);

  const addAnnotation = useCallback(async () => {
    const current = selectedRef.current;
    if (!current || current.loading) {
      return;
    }

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setStatus("Add a note before saving this annotation.");
      return;
    }

    const annotation = current.annotation
      ? { ...current.annotation, note: trimmedNote }
      : await captureElementAnnotation(current.element, trimmedNote);

    setAnnotations((existing) => [...existing, { ...annotation, targetElement: current.element, rect: getRect(current.element) }]);
    setSelected(null);
    setNote("");
    setStatus("Annotation saved.");
  }, [note]);

  const collect = useCallback(async () => {
    const payload = createAnnotationCollection(annotations.map(({ rect: _rect, targetElement: _targetElement, ...annotation }) => annotation));
    const text = formatAnnotationCollection(payload, output);

    try {
      await copyTextToClipboard(text);
      onCollect?.(payload);
      setIsAnnotating(false);
      setSelected(null);
      setHoverRect(null);
      setNote("");
      toast.success("Annotations copied", { description: `${payload.annotations.length} copied to clipboard.` });
      setStatus(`Copied ${payload.annotations.length} annotation${payload.annotations.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error("Copy failed", { description: error instanceof Error ? error.message : "Clipboard copy failed." });
      setStatus(error instanceof Error ? error.message : "Clipboard copy failed.");
    }
  }, [annotations, onCollect, output]);

  if (!enabled) {
    return null;
  }

  return (
    <div {...{ [ROOT_ATTR]: "" }} style={styles.root} aria-live="polite">
      {renderToaster ? <Toaster position="bottom-right" richColors /> : null}
      <button
        type="button"
        onClick={() => setIsAnnotating((current) => !current)}
        style={{ ...styles.floatingButton, ...(isAnnotating ? styles.floatingButtonActive : null) }}
        aria-pressed={isAnnotating}
        title={`Toggle annotator (${hotkey})`}
      >
        {isAnnotating ? "Annotating" : "Annotate"}
      </button>

      {isAnnotating && hoverRect ? <Box rect={hoverRect} kind="hover" /> : null}
      {selected ? <Box rect={selected.rect} kind="selected" /> : null}
      {isAnnotating
        ? annotations.map((annotation, index) => (
            <Pin key={annotation.id} annotation={annotation} index={index} />
          ))
        : null}

      {selected ? (
        <div style={getPopoverStyle(selected.rect)} role="dialog" aria-label="Add source annotation">
          <div style={styles.popoverTitle}>Annotation</div>
          <div style={styles.metaText}>{selected.loading ? "Resolving source…" : formatSelectedSource(selected.annotation)}</div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What should change here?"
            style={styles.textarea}
            rows={4}
            autoFocus
          />
          <div style={styles.popoverActions}>
            <button type="button" onClick={() => setSelected(null)} style={styles.secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={addAnnotation} style={styles.primaryButton} disabled={selected.loading}>
              Save note
            </button>
          </div>
        </div>
      ) : null}

      {isAnnotating ? (
        <section style={styles.panel} aria-label="Collected annotations">
          <div style={styles.panelHeader}>
            <strong>Annotations</strong>
            <span style={styles.badge}>{collection.annotations.length}</span>
          </div>
          {annotations.length ? (
            <ol style={styles.annotationList}>
              {annotations.map((annotation) => (
                <li key={annotation.id} style={styles.annotationItem}>
                  <div style={styles.noteText}>{annotation.note}</div>
                  <div style={styles.metaText}>{formatSelectedSource(annotation)}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p style={styles.emptyText}>Hover an element, click it, then add a note.</p>
          )}
          <button type="button" onClick={collect} style={styles.collectButton} disabled={!annotations.length}>
            Collect
          </button>
          {status ? <div style={styles.status}>{status}</div> : null}
        </section>
      ) : null}
    </div>
  );
}

function Box({ rect, kind }: { rect: Rect; kind: "hover" | "selected" }) {
  return (
    <div
      style={{
        ...styles.box,
        ...(kind === "selected" ? styles.selectedBox : styles.hoverBox),
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}

function Pin({ annotation, index }: { annotation: StoredAnnotation; index: number }) {
  return (
    <div
      style={{ ...styles.pin, top: Math.max(8, annotation.rect.top - 10), left: Math.max(8, annotation.rect.left - 10) }}
      title={annotation.note}
    >
      {index + 1}
    </div>
  );
}

function getAnnotatableTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }

  if (target.closest(`[${ROOT_ATTR}]`)) {
    return null;
  }

  if (target === document.body || target === document.documentElement) {
    return null;
  }

  return target;
}

function getRect(element: Element): Rect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function getPopoverStyle(rect: Rect): CSSProperties {
  const top = Math.min(window.innerHeight - 260, rect.top + rect.height + 8);
  const left = Math.min(window.innerWidth - 340, Math.max(8, rect.left));

  return {
    ...styles.popover,
    top: Math.max(8, top),
    left,
  };
}

function formatSelectedSource(annotation: Annotation | null): string {
  const componentPath = annotation?.componentPath.length ? annotation.componentPath.join(" › ") : null;

  if (!annotation) {
    return "Source unavailable";
  }

  if (!annotation.source?.filePath) {
    return `${annotation.element.selector} · source unavailable`;
  }

  const line = annotation.source.lineNumber ? `:${annotation.source.lineNumber}` : "";
  const component = componentPath ? ` · ${componentPath}` : "";
  return `${annotation.source.filePath}${line}${component}`;
}

function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey.toLowerCase().split("+").map((part) => part.trim()).filter(Boolean);
  const key = parts.find((part) => !["ctrl", "control", "cmd", "meta", "mod", "shift", "alt", "option"].includes(part));

  const wantsMeta = parts.includes("meta") || parts.includes("cmd") || (parts.includes("mod") && isMac());
  const wantsCtrl = parts.includes("ctrl") || parts.includes("control") || (parts.includes("mod") && !isMac());
  const wantsShift = parts.includes("shift");
  const wantsAlt = parts.includes("alt") || parts.includes("option");

  return (
    event.key.toLowerCase() === key &&
    event.metaKey === wantsMeta &&
    event.ctrlKey === wantsCtrl &&
    event.shiftKey === wantsShift &&
    event.altKey === wantsAlt
  );
}

function isMac(): boolean {
  return typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

const baseFont = '13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const styles = {
  root: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483647,
    pointerEvents: "none",
    font: baseFont,
    color: "#0f172a",
  } satisfies CSSProperties,
  floatingButton: {
    position: "fixed",
    right: 16,
    bottom: 16,
    pointerEvents: "auto",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 999,
    padding: "10px 14px",
    font: baseFont,
    fontWeight: 700,
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.16)",
    cursor: "pointer",
  } satisfies CSSProperties,
  floatingButtonActive: {
    background: "#0f172a",
    color: "#ffffff",
    borderColor: "#0f172a",
  } satisfies CSSProperties,
  box: {
    position: "fixed",
    borderRadius: 6,
    pointerEvents: "none",
    boxSizing: "border-box",
  } satisfies CSSProperties,
  hoverBox: {
    border: "2px solid #38bdf8",
    background: "rgba(56, 189, 248, 0.08)",
  } satisfies CSSProperties,
  selectedBox: {
    border: "2px solid #f97316",
    background: "rgba(249, 115, 22, 0.1)",
  } satisfies CSSProperties,
  popover: {
    position: "fixed",
    width: 320,
    pointerEvents: "auto",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
  } satisfies CSSProperties,
  popoverTitle: {
    fontWeight: 800,
    marginBottom: 4,
  } satisfies CSSProperties,
  metaText: {
    color: "#64748b",
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 10,
    resize: "vertical",
    font: baseFont,
  } satisfies CSSProperties,
  popoverActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  } satisfies CSSProperties,
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    padding: "7px 10px",
    cursor: "pointer",
  } satisfies CSSProperties,
  primaryButton: {
    border: "1px solid #0f172a",
    borderRadius: 8,
    background: "#0f172a",
    color: "#ffffff",
    padding: "7px 10px",
    cursor: "pointer",
  } satisfies CSSProperties,
  panel: {
    position: "fixed",
    right: 16,
    bottom: 68,
    width: 300,
    pointerEvents: "auto",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
  } satisfies CSSProperties,
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  } satisfies CSSProperties,
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#e2e8f0",
    color: "#334155",
    fontWeight: 700,
    fontSize: 12,
  } satisfies CSSProperties,
  annotationList: {
    listStyle: "decimal",
    margin: "0 0 10px 18px",
    padding: 0,
    maxHeight: 180,
    overflow: "auto",
  } satisfies CSSProperties,
  annotationItem: {
    marginBottom: 8,
  } satisfies CSSProperties,
  noteText: {
    color: "#0f172a",
    fontWeight: 650,
  } satisfies CSSProperties,
  emptyText: {
    color: "#64748b",
    margin: "6px 0 10px",
  } satisfies CSSProperties,
  collectButton: {
    width: "100%",
    border: "1px solid #0f172a",
    borderRadius: 8,
    background: "#0f172a",
    color: "#ffffff",
    padding: "9px 10px",
    fontWeight: 800,
    cursor: "pointer",
  } satisfies CSSProperties,
  status: {
    marginTop: 8,
    color: "#475569",
    fontSize: 12,
  } satisfies CSSProperties,
  pin: {
    position: "fixed",
    width: 20,
    height: 20,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    background: "#f97316",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 800,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.2)",
  } satisfies CSSProperties,
};
