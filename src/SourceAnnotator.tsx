import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Toaster, toast } from "sonner";
import { captureElementAnnotation } from "./capture";
import { copyTextToClipboard } from "./clipboard";
import { createAnnotationCollection, formatAnnotationCollection } from "./format";
import type { Annotation, SourceAnnotatorOutput, SourceAnnotatorProps, SourceAnnotatorTarget } from "./types";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type SelectedElement = {
  element: Element;
  rect: Rect;
  frameElement: HTMLIFrameElement | null;
  annotation: Annotation | null;
  loading: boolean;
  editingId?: string;
};

type StoredAnnotation = Annotation & {
  targetElement: Element;
  rect: Rect;
  frameElement: HTMLIFrameElement | null;
};

type ResolvedTarget = {
  document: Document | null;
  frameElement: HTMLIFrameElement | null;
};

const ROOT_ATTR = "data-mikuexe-annotator-root";
const DEFAULT_HOTKEY = "alt+a";
const DEFAULT_OUTPUT: SourceAnnotatorOutput = "markdown";
const BLOCKED_INTERACTION_EVENTS = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "dblclick",
  "auxclick",
  "contextmenu",
  "touchstart",
  "touchend",
] as const;

export function SourceAnnotator({
  enabled = true,
  hotkey = DEFAULT_HOTKEY,
  output = DEFAULT_OUTPUT,
  target,
  onCollect,
  renderToaster = true,
}: SourceAnnotatorProps) {
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [hoverRect, setHoverRect] = useState<Rect | null>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [note, setNote] = useState("");
  const [annotations, setAnnotations] = useState<StoredAnnotation[]>([]);
  const [previewedAnnotation, setPreviewedAnnotation] = useState<StoredAnnotation | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const selectedRef = useRef<SelectedElement | null>(null);

  const resolvedTarget = useResolvedTarget(target);

  selectedRef.current = selected;

  useEffect(() => {
    setHoverRect(null);
    setSelected(null);
    setAnnotations([]);
    setPreviewedAnnotation(null);
    setNote("");
  }, [resolvedTarget.document, resolvedTarget.frameElement]);

  const collection = useMemo(
    () =>
      createAnnotationCollection(
        annotations.map(({ rect: _rect, targetElement: _targetElement, frameElement: _frameElement, ...annotation }) => annotation),
      ),
    [annotations],
  );

  const refreshTrackedRects = useCallback(() => {
    setHoverRect(null);
    setSelected((current) => (current ? { ...current, rect: getRect(current.element, current.frameElement) } : current));
    setAnnotations((existing) =>
      existing.map((annotation) => ({ ...annotation, rect: getRect(annotation.targetElement, annotation.frameElement) })),
    );
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

    if (typeof document === "undefined") {
      return;
    }

    document.addEventListener("keydown", onKeyDown);
    if (resolvedTarget.document && resolvedTarget.document !== document) {
      resolvedTarget.document.addEventListener("keydown", onKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (resolvedTarget.document && resolvedTarget.document !== document) {
        resolvedTarget.document.removeEventListener("keydown", onKeyDown);
      }
    };
  }, [enabled, hotkey, resolvedTarget.document]);

  useEffect(() => {
    if (!enabled || !isAnnotating || !resolvedTarget.document) {
      setHoverRect(null);
      return;
    }

    const activeDocument = resolvedTarget.document;

    const onPointerOver = (event: PointerEvent) => {
      const eventTarget = getAnnotatableTarget(event.target, activeDocument);
      if (!eventTarget) {
        setHoverRect(null);
        return;
      }

      setHoverRect(getRect(eventTarget, resolvedTarget.frameElement));
    };

    const suppressInteraction = (event: Event) => {
      const eventTarget = getAnnotatableTarget(event.target, activeDocument);
      if (!eventTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onClick = (event: MouseEvent) => {
      const eventTarget = getAnnotatableTarget(event.target, activeDocument);
      if (!eventTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const rect = getRect(eventTarget, resolvedTarget.frameElement);
      setSelected({ element: eventTarget, rect, frameElement: resolvedTarget.frameElement, annotation: null, loading: true });
      setNote("");
      setStatus("Resolving source…");

      captureElementAnnotation(eventTarget, "")
        .then((annotation) => {
          setSelected((current) => {
            if (current?.element !== eventTarget) {
              return current;
            }

            return { ...current, annotation, loading: false };
          });
          setStatus(annotation.source ? "Source captured." : "Element captured without source info.");
        })
        .catch(() => {
          setSelected((current) => (current?.element === eventTarget ? { ...current, loading: false } : current));
          setStatus("Element captured without source info.");
        });
    };

    const onFramePointerLeave = () => {
      setHoverRect(null);
    };

    activeDocument.addEventListener("pointerover", onPointerOver, true);
    activeDocument.addEventListener("click", onClick, true);
    BLOCKED_INTERACTION_EVENTS.forEach((eventName) => activeDocument.addEventListener(eventName, suppressInteraction, true));
    resolvedTarget.frameElement?.addEventListener("pointerleave", onFramePointerLeave);

    return () => {
      activeDocument.removeEventListener("pointerover", onPointerOver, true);
      activeDocument.removeEventListener("click", onClick, true);
      BLOCKED_INTERACTION_EVENTS.forEach((eventName) => activeDocument.removeEventListener(eventName, suppressInteraction, true));
      resolvedTarget.frameElement?.removeEventListener("pointerleave", onFramePointerLeave);
    };
  }, [enabled, isAnnotating, resolvedTarget]);

  useEffect(() => {
    if (!enabled || !isAnnotating || !resolvedTarget.document) {
      return;
    }

    const activeDocument = resolvedTarget.document;

    activeDocument.addEventListener("scroll", refreshTrackedRects, true);
    if (typeof document !== "undefined" && activeDocument !== document) {
      document.addEventListener("scroll", refreshTrackedRects, true);
    }
    window.addEventListener("resize", refreshTrackedRects);

    return () => {
      activeDocument.removeEventListener("scroll", refreshTrackedRects, true);
      if (typeof document !== "undefined" && activeDocument !== document) {
        document.removeEventListener("scroll", refreshTrackedRects, true);
      }
      window.removeEventListener("resize", refreshTrackedRects);
    };
  }, [enabled, isAnnotating, refreshTrackedRects, resolvedTarget.document]);

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

    const storedAnnotation = {
      ...annotation,
      targetElement: current.element,
      rect: getRect(current.element, current.frameElement),
      frameElement: current.frameElement,
    };

    setAnnotations((existing) => {
      if (!current.editingId) {
        return [...existing, storedAnnotation];
      }

      return existing.map((item) => (item.id === current.editingId ? storedAnnotation : item));
    });
    setSelected(null);
    setNote("");
    setPreviewedAnnotation(null);
    setStatus(current.editingId ? "Annotation updated." : "Annotation saved.");
  }, [note]);

  const editAnnotation = useCallback((annotation: StoredAnnotation) => {
    setSelected({
      element: annotation.targetElement,
      rect: getRect(annotation.targetElement, annotation.frameElement),
      frameElement: annotation.frameElement,
      annotation,
      loading: false,
      editingId: annotation.id,
    });
    setNote(annotation.note);
    setPreviewedAnnotation(null);
    setStatus("Editing annotation.");
  }, []);

  const deleteAnnotation = useCallback((annotationId: string) => {
    setAnnotations((existing) => existing.filter((annotation) => annotation.id !== annotationId));
    setSelected((current) => (current?.editingId === annotationId ? null : current));
    setPreviewedAnnotation((current) => (current?.id === annotationId ? null : current));
    setStatus("Annotation deleted.");
  }, []);

  const collect = useCallback(async () => {
    const payload = createAnnotationCollection(
      annotations.map(({ rect: _rect, targetElement: _targetElement, frameElement: _frameElement, ...annotation }) => annotation),
    );
    const text = formatAnnotationCollection(payload, output);

    try {
      await copyTextToClipboard(text);
      onCollect?.(payload);
      setIsAnnotating(false);
      setSelected(null);
      setHoverRect(null);
      setAnnotations([]);
      setPreviewedAnnotation(null);
      setNote("");
      setStatus(null);
      toast.success("Annotations copied", { description: `${payload.annotations.length} copied to clipboard.` });
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
            <Pin
              key={annotation.id}
              annotation={annotation}
              index={index}
              onEdit={editAnnotation}
              onPreview={setPreviewedAnnotation}
              onPreviewEnd={() => setPreviewedAnnotation(null)}
            />
          ))
        : null}
      {isAnnotating && previewedAnnotation ? <AnnotationPreview annotation={previewedAnnotation} /> : null}

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
              {selected.editingId ? "Update note" : "Save note"}
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
              {annotations.map((annotation, index) => (
                <li key={annotation.id} style={styles.annotationItem}>
                  <div style={styles.annotationContent}>
                    <div style={styles.noteText}>{annotation.note}</div>
                    <div style={styles.metaText}>{formatSelectedSource(annotation)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAnnotation(annotation.id)}
                    style={styles.deleteButton}
                  >
                    Delete annotation {index + 1}
                  </button>
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
      data-mikuexe-annotator-box={kind}
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

function Pin({
  annotation,
  index,
  onEdit,
  onPreview,
  onPreviewEnd,
}: {
  annotation: StoredAnnotation;
  index: number;
  onEdit: (annotation: StoredAnnotation) => void;
  onPreview: (annotation: StoredAnnotation) => void;
  onPreviewEnd: () => void;
}) {
  return (
    <button
      type="button"
      style={{ ...styles.pin, top: Math.max(8, annotation.rect.top - 10), left: Math.max(8, annotation.rect.left - 10) }}
      title={annotation.note}
      aria-label={`Edit annotation ${index + 1}`}
      onClick={() => onEdit(annotation)}
      onMouseOver={() => onPreview(annotation)}
      onMouseOut={onPreviewEnd}
      onFocus={() => onPreview(annotation)}
      onBlur={onPreviewEnd}
    >
      {index + 1}
    </button>
  );
}

function AnnotationPreview({ annotation }: { annotation: StoredAnnotation }) {
  return (
    <div role="tooltip" style={getPreviewStyle(annotation.rect)}>
      <div style={styles.noteText}>{annotation.note}</div>
      <div style={styles.metaText}>{formatSelectedSource(annotation)}</div>
    </div>
  );
}

function getAnnotatableTarget(target: EventTarget | null, ownerDocument: Document): Element | null {
  if (!isElement(target, ownerDocument)) {
    return null;
  }

  if (target.closest(`[${ROOT_ATTR}]`)) {
    return null;
  }

  if (target === ownerDocument.body || target === ownerDocument.documentElement) {
    return null;
  }

  return target;
}

function getRect(element: Element, frameElement: HTMLIFrameElement | null): Rect {
  const rect = element.getBoundingClientRect();
  const frameRect = frameElement?.getBoundingClientRect();

  return {
    top: rect.top + (frameRect?.top ?? 0),
    left: rect.left + (frameRect?.left ?? 0),
    width: rect.width,
    height: rect.height,
  };
}

function useResolvedTarget(target: SourceAnnotatorTarget | undefined): ResolvedTarget {
  const [navigationVersion, setNavigationVersion] = useState(0);
  const resolvedTarget = useMemo(() => resolveTarget(target), [target, navigationVersion]);
  const currentDocumentRef = useRef<Document | null>(resolvedTarget.document);
  currentDocumentRef.current = resolvedTarget.document;

  useEffect(() => {
    if (typeof HTMLIFrameElement !== "undefined" && target instanceof HTMLIFrameElement) {
      const updateTarget = () => {
        const nextTarget = resolveTarget(target);
        if (nextTarget.document !== currentDocumentRef.current) {
          setNavigationVersion((version) => version + 1);
        }
      };
      target.addEventListener("load", updateTarget);
      return () => target.removeEventListener("load", updateTarget);
    }
  }, [target]);

  return resolvedTarget;
}

function resolveTarget(target: SourceAnnotatorTarget | undefined): ResolvedTarget {
  const hostDocument = typeof document === "undefined" ? null : document;

  if (typeof HTMLIFrameElement !== "undefined" && target instanceof HTMLIFrameElement) {
    const frameDocument = target.contentDocument;
    if (!frameDocument) {
      console.warn("@mikuexe/annotator-react: SourceAnnotator target iframe must be same-origin; iframe contentDocument is not accessible.");
      return {
        document: null,
        frameElement: target,
      };
    }

    return {
      document: frameDocument,
      frameElement: target,
    };
  }

  if (typeof Document !== "undefined" && target instanceof Document) {
    return {
      document: target,
      frameElement: null,
    };
  }

  return {
    document: hostDocument,
    frameElement: null,
  };
}

function isElement(target: EventTarget | null, ownerDocument: Document): target is Element {
  const elementConstructor = ownerDocument.defaultView?.Element ?? Element;
  return target instanceof elementConstructor;
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

function getPreviewStyle(rect: Rect): CSSProperties {
  const top = Math.min(window.innerHeight - 120, rect.top + rect.height + 8);
  const left = Math.min(window.innerWidth - 260, Math.max(8, rect.left));

  return {
    ...styles.preview,
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
    zIndex: 2,
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
    zIndex: 1,
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
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "start",
    marginBottom: 8,
  } satisfies CSSProperties,
  annotationContent: {
    minWidth: 0,
  } satisfies CSSProperties,
  noteText: {
    color: "#0f172a",
    fontWeight: 650,
    overflowWrap: "anywhere",
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
  deleteButton: {
    border: "1px solid #fecaca",
    borderRadius: 999,
    background: "#fff1f2",
    color: "#be123c",
    padding: "4px 7px",
    fontSize: 11,
    fontWeight: 750,
    cursor: "pointer",
  } satisfies CSSProperties,
  preview: {
    position: "fixed",
    maxWidth: 240,
    pointerEvents: "none",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 10,
    boxShadow: "0 14px 35px rgba(15, 23, 42, 0.18)",
  } satisfies CSSProperties,
  pin: {
    position: "fixed",
    border: 0,
    width: 20,
    height: 20,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    background: "#f97316",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 800,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.2)",
    cursor: "pointer",
    padding: 0,
  } satisfies CSSProperties,
};
