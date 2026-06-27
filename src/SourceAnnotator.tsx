import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { Toaster, toast } from "sonner";
import {
  captureAnnotationTarget,
  captureElementAnnotation,
  createAnnotationId,
} from "./capture";
import { copyTextToClipboard } from "./clipboard";
import {
  createAnnotationCollection,
  formatAnnotationCollection,
  getPageContext,
} from "./format";
import type {
  Annotation,
  AnnotationTarget,
  SourceAnnotatorOutput,
  SourceAnnotatorProps,
  SourceAnnotatorTarget,
} from "./types";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type DraftTarget = {
  element: Element;
  rect: Rect;
  frameElement: HTMLIFrameElement | null;
  target: AnnotationTarget | null;
  loading: boolean;
};

type DraftSelection = {
  targets: DraftTarget[];
  editingId?: string;
};

type StoredTarget = {
  targetElement: Element;
  rect: Rect;
  frameElement: HTMLIFrameElement | null;
  data: AnnotationTarget;
};

type StoredTargetInput = {
  targetElement: Element;
  rect: Rect;
  frameElement: HTMLIFrameElement | null;
  data: AnnotationTarget;
};

type StoredAnnotation = {
  id: string;
  note: string;
  targets: StoredTarget[];
};

type ResolvedTarget = {
  document: Document | null;
  frameElement: HTMLIFrameElement | null;
};

type AnnotatorState = {
  isAnnotating: boolean;
  hoverRect: Rect | null;
  selected: DraftSelection | null;
  note: string;
  annotations: StoredAnnotation[];
  previewedAnnotation: StoredAnnotation | null;
  status: string | null;
  linkingAnnotationId: string | null;
};

type AnnotatorAction =
  | { type: "reset"; isAnnotating: boolean }
  | { type: "setHoverRect"; rect: Rect | null }
  | { type: "setNote"; note: string }
  | { type: "setStatus"; status: string | null }
  | { type: "clearPreview" }
  | { type: "previewAnnotation"; annotation: StoredAnnotation }
  | { type: "cancelDraft" }
  | { type: "refreshRects" }
  | {
      type: "selectTarget";
      target: DraftTarget;
      append: boolean;
    }
  | {
      type: "resolveDraftTarget";
      element: Element;
      target: AnnotationTarget | null;
      status: string;
    }
  | { type: "saveAnnotation"; annotation: StoredAnnotation; editingId?: string }
  | { type: "editAnnotation"; annotation: StoredAnnotation }
  | { type: "startLinking"; annotationId: string }
  | {
      type: "linkTarget";
      annotationId: string;
      target: StoredTargetInput;
      status: string;
    }
  | { type: "deleteAnnotation"; annotationId: string }
  | { type: "closeWithEscape" };

const initialAnnotatorState: AnnotatorState = {
  isAnnotating: false,
  hoverRect: null,
  selected: null,
  note: "",
  annotations: [],
  previewedAnnotation: null,
  status: null,
  linkingAnnotationId: null,
};

function resetSession(isAnnotating: boolean): AnnotatorState {
  return { ...initialAnnotatorState, isAnnotating };
}

type AnnotatorActionHandler<T extends AnnotatorAction["type"]> = (
  state: AnnotatorState,
  action: Extract<AnnotatorAction, { type: T }>
) => AnnotatorState;

type AnnotatorActionHandlers = {
  [Type in AnnotatorAction["type"]]: AnnotatorActionHandler<Type>;
};

const annotatorActionHandlers = {
  reset: (_state, action) => resetSession(action.isAnnotating),
  setHoverRect: (state, action) =>
    state.hoverRect === action.rect
      ? state
      : { ...state, hoverRect: action.rect },
  setNote: (state, action) =>
    state.note === action.note ? state : { ...state, note: action.note },
  setStatus: (state, action) =>
    state.status === action.status
      ? state
      : { ...state, status: action.status },
  clearPreview: (state) => ({ ...state, previewedAnnotation: null }),
  previewAnnotation: (state, action) => ({
    ...state,
    previewedAnnotation: action.annotation,
  }),
  cancelDraft: (state) => ({ ...state, selected: null }),
  refreshRects: (state) => ({
    ...state,
    hoverRect: null,
    selected: refreshDraftSelectionRects(state.selected),
    annotations: refreshAnnotationRects(state.annotations),
  }),
  selectTarget: (state, action) => selectDraftTarget(state, action),
  resolveDraftTarget: (state, action) => ({
    ...state,
    selected: resolveDraftTarget(state.selected, action),
    status: action.status,
  }),
  saveAnnotation: (state, action) => ({
    ...state,
    annotations: action.editingId
      ? state.annotations.map((item) =>
          item.id === action.editingId ? action.annotation : item
        )
      : [...state.annotations, action.annotation],
    selected: null,
    note: "",
    previewedAnnotation: null,
    status: action.editingId ? "Annotation updated." : "Annotation saved.",
  }),
  editAnnotation: (state, action) => ({
    ...state,
    linkingAnnotationId: null,
    selected: createEditingSelection(action.annotation),
    note: action.annotation.note,
    previewedAnnotation: null,
    status: "Editing annotation.",
  }),
  startLinking: (state, action) => ({
    ...state,
    selected: null,
    previewedAnnotation: null,
    linkingAnnotationId: action.annotationId,
    status: "Click another element to link it to this annotation.",
  }),
  linkTarget: (state, action) => ({
    ...state,
    annotations: addTargetToAnnotation(
      state.annotations,
      action.annotationId,
      action.target
    ),
    linkingAnnotationId: null,
    previewedAnnotation: null,
    status: action.status,
  }),
  deleteAnnotation: (state, action) => ({
    ...state,
    annotations: state.annotations.filter(
      (annotation) => annotation.id !== action.annotationId
    ),
    selected:
      state.selected?.editingId === action.annotationId ? null : state.selected,
    previewedAnnotation:
      state.previewedAnnotation?.id === action.annotationId
        ? null
        : state.previewedAnnotation,
    linkingAnnotationId:
      state.linkingAnnotationId === action.annotationId
        ? null
        : state.linkingAnnotationId,
    status: "Annotation deleted.",
  }),
  closeWithEscape: (state) =>
    state.previewedAnnotation
      ? { ...state, previewedAnnotation: null }
      : { ...state, isAnnotating: false },
} satisfies AnnotatorActionHandlers;

function annotatorReducer(
  state: AnnotatorState,
  action: AnnotatorAction
): AnnotatorState {
  const handler = annotatorActionHandlers[action.type] as (
    currentState: AnnotatorState,
    currentAction: AnnotatorAction
  ) => AnnotatorState;
  return handler(state, action);
}

function refreshDraftSelectionRects(
  selection: DraftSelection | null
): DraftSelection | null {
  return selection
    ? {
        ...selection,
        targets: selection.targets.map((targetEntry) => ({
          ...targetEntry,
          rect: getRect(targetEntry.element, targetEntry.frameElement),
        })),
      }
    : selection;
}

function refreshAnnotationRects(
  annotations: StoredAnnotation[]
): StoredAnnotation[] {
  return annotations.map((annotation) => ({
    ...annotation,
    targets: annotation.targets.map((targetEntry) => ({
      ...targetEntry,
      rect: getRect(targetEntry.targetElement, targetEntry.frameElement),
    })),
  }));
}

function selectDraftTarget(
  state: AnnotatorState,
  action: Extract<AnnotatorAction, { type: "selectTarget" }>
): AnnotatorState {
  if (
    action.append &&
    state.selected &&
    state.selected.targets.some(
      (targetEntry) => targetEntry.element === action.target.element
    )
  ) {
    return { ...state, status: "Resolving source…" };
  }

  const nextSelected =
    action.append && state.selected
      ? {
          ...state.selected,
          targets: [...state.selected.targets, action.target],
        }
      : { targets: [action.target] };

  return {
    ...state,
    selected: nextSelected,
    note: action.append ? state.note : "",
    status: "Resolving source…",
  };
}

function resolveDraftTarget(
  selection: DraftSelection | null,
  action: Extract<AnnotatorAction, { type: "resolveDraftTarget" }>
): DraftSelection | null {
  return selection
    ? {
        ...selection,
        targets: selection.targets.map((targetEntry) =>
          targetEntry.element === action.element
            ? {
                ...targetEntry,
                target: action.target ?? targetEntry.target,
                loading: false,
              }
            : targetEntry
        ),
      }
    : selection;
}

function createEditingSelection(annotation: StoredAnnotation): DraftSelection {
  return {
    editingId: annotation.id,
    targets: annotation.targets.map((targetEntry) => ({
      element: targetEntry.targetElement,
      rect: getRect(targetEntry.targetElement, targetEntry.frameElement),
      frameElement: targetEntry.frameElement,
      target: targetEntry.data,
      loading: false,
    })),
  };
}

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

let nextElementKey = 0;
const elementKeys = new WeakMap<Element, string>();
const documentKeys = new WeakMap<Document, string>();
const frameKeys = new WeakMap<HTMLIFrameElement, string>();

function getWeakKey<T extends object>(keys: WeakMap<T, string>, value: T) {
  const existing = keys.get(value);
  if (existing) {
    return existing;
  }

  const key = String(nextElementKey++);
  keys.set(value, key);
  return key;
}

function getElementKey(element: Element): string {
  return getWeakKey(elementKeys, element);
}

function getDraftTargetKey(target: DraftTarget): string {
  return getElementKey(target.element);
}

function getStoredTargetKey(target: StoredTarget): string {
  return getElementKey(target.targetElement);
}

function getResolvedTargetKey(target: ResolvedTarget): string {
  const documentKey = target.document
    ? getWeakKey(documentKeys, target.document)
    : "no-document";
  const frameKey = target.frameElement
    ? getWeakKey(frameKeys, target.frameElement)
    : "no-frame";
  return `${documentKey}:${frameKey}`;
}

export function SourceAnnotator(props: SourceAnnotatorProps) {
  const { enabled = true, target } = props;
  const resolvedTarget = useResolvedTarget(target);

  if (!enabled) {
    return null;
  }

  return (
    <SourceAnnotatorSession
      key={getResolvedTargetKey(resolvedTarget)}
      {...props}
      enabled={enabled}
      resolvedTarget={resolvedTarget}
    />
  );
}

function SourceAnnotatorSession({
  hotkey = DEFAULT_HOTKEY,
  output = DEFAULT_OUTPUT,
  onCollect,
  renderToaster = true,
  resolvedTarget,
}: SourceAnnotatorProps & {
  enabled: boolean;
  resolvedTarget: ResolvedTarget;
}) {
  const [state, dispatch] = useReducer(annotatorReducer, initialAnnotatorState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const { isAnnotating, previewedAnnotation } = state;

  const cancelAnnotationSession = useCallback(() => {
    dispatch({ type: "reset", isAnnotating: false });
  }, []);

  const toggleAnnotationSession = useCallback(() => {
    dispatch({ type: "reset", isAnnotating: !stateRef.current.isAnnotating });
  }, []);

  useAnnotatorHotkey(hotkey, resolvedTarget.document, toggleAnnotationSession);

  const handleElementSelection = useCallback(
    async (
      eventTarget: Element,
      frameElement: HTMLIFrameElement | null,
      extendSelection: boolean
    ) => {
      const { linkingAnnotationId, selected: currentSelected } =
        stateRef.current;
      if (linkingAnnotationId) {
        const rect = getRect(eventTarget, frameElement);
        dispatch({ type: "setStatus", status: "Resolving linked element…" });

        try {
          const targetData = await captureAnnotationTarget(eventTarget);
          dispatch({
            type: "linkTarget",
            annotationId: linkingAnnotationId,
            target: {
              targetElement: eventTarget,
              rect,
              frameElement,
              data: targetData,
            },
            status: "Element linked to annotation.",
          });
        } catch {
          dispatch({
            type: "linkTarget",
            annotationId: linkingAnnotationId,
            target: {
              targetElement: eventTarget,
              rect,
              frameElement,
              data: createFallbackTarget(eventTarget),
            },
            status: "Element linked without source info.",
          });
        }

        return;
      }

      const rect = getRect(eventTarget, frameElement);
      const shouldAppend =
        extendSelection &&
        Boolean(currentSelected) &&
        !currentSelected?.editingId;
      dispatch({
        type: "selectTarget",
        append: shouldAppend,
        target: {
          element: eventTarget,
          rect,
          frameElement,
          target: null,
          loading: true,
        },
      });

      try {
        const targetData = await captureAnnotationTarget(eventTarget);
        dispatch({
          type: "resolveDraftTarget",
          element: eventTarget,
          target: targetData,
          status: targetData.source
            ? "Source captured."
            : "Element captured without source info.",
        });
      } catch {
        dispatch({
          type: "resolveDraftTarget",
          element: eventTarget,
          target: null,
          status: "Element captured without source info.",
        });
      }
    },
    []
  );

  useAnnotatorTargetEvents({
    isAnnotating,
    resolvedTarget,
    onElementSelection: handleElementSelection,
    onHoverRectChange: (rect) => dispatch({ type: "setHoverRect", rect }),
  });
  useTrackedRectRefresh({
    isAnnotating,
    targetDocument: resolvedTarget.document,
    onRefresh: () => dispatch({ type: "refreshRects" }),
  });

  useAnnotationEscape(
    isAnnotating,
    previewedAnnotation,
    resolvedTarget.document,
    () => dispatch({ type: "closeWithEscape" })
  );

  const addAnnotation = useCallback(async () => {
    const current = stateRef.current.selected;
    if (
      !current ||
      current.targets.some((targetEntry) => targetEntry.loading)
    ) {
      return;
    }

    const trimmedNote = stateRef.current.note.trim();
    if (!trimmedNote) {
      dispatch({
        type: "setStatus",
        status: "Add a note before saving this annotation.",
      });
      return;
    }

    const currentTargets = await Promise.all(
      current.targets.map(async (targetEntry) => {
        if (targetEntry.target) {
          return targetEntry;
        }

        const annotation = await captureElementAnnotation(
          targetEntry.element,
          trimmedNote
        );
        return {
          ...targetEntry,
          target: annotation.targets[0],
          loading: false,
        };
      })
    );

    const storedAnnotation: StoredAnnotation = {
      id: current.editingId ?? createAnnotationId(),
      note: trimmedNote,
      targets: currentTargets.map((targetEntry) => ({
        targetElement: targetEntry.element,
        rect: getRect(targetEntry.element, targetEntry.frameElement),
        frameElement: targetEntry.frameElement,
        data: targetEntry.target as AnnotationTarget,
      })),
    };

    dispatch({
      type: "saveAnnotation",
      annotation: storedAnnotation,
      editingId: current.editingId,
    });
  }, []);

  const editAnnotation = useCallback((annotation: StoredAnnotation) => {
    dispatch({ type: "editAnnotation", annotation });
  }, []);

  const startLinkingAnnotation = useCallback((annotationId: string) => {
    dispatch({ type: "startLinking", annotationId });
  }, []);

  const deleteAnnotation = useCallback((annotationId: string) => {
    dispatch({ type: "deleteAnnotation", annotationId });
  }, []);

  const collect = useCallback(async () => {
    const currentAnnotations = stateRef.current.annotations;
    const payload = createAnnotationCollection(
      stripStoredAnnotations(currentAnnotations),
      getPageContext(resolvedTarget.document)
    );
    const text = formatAnnotationCollection(payload, output);

    try {
      await copyTextToClipboard(text);
      onCollect?.(payload);
      dispatch({ type: "reset", isAnnotating: false });
      toast.success("Annotations copied", {
        description: `${payload.annotations.length} copied to clipboard.`,
      });
    } catch (error) {
      toast.error("Copy failed", {
        description:
          error instanceof Error ? error.message : "Clipboard copy failed.",
      });
      dispatch({
        type: "setStatus",
        status:
          error instanceof Error ? error.message : "Clipboard copy failed.",
      });
    }
  }, [onCollect, output, resolvedTarget.document]);

  return (
    <SourceAnnotatorOverlay
      hotkey={hotkey}
      renderToaster={renderToaster}
      state={state}
      onToggle={toggleAnnotationSession}
      onPreview={(annotationToPreview) =>
        dispatch({ type: "previewAnnotation", annotation: annotationToPreview })
      }
      onClosePreview={() => dispatch({ type: "clearPreview" })}
      onNoteChange={(nextNote) => dispatch({ type: "setNote", note: nextNote })}
      onCancelDraft={() => dispatch({ type: "cancelDraft" })}
      onSaveDraft={addAnnotation}
      onEdit={editAnnotation}
      onDelete={deleteAnnotation}
      onCollect={collect}
      onLink={startLinkingAnnotation}
      onCancelSession={cancelAnnotationSession}
    />
  );
}

function useAnnotatorTargetEvents({
  isAnnotating,
  resolvedTarget,
  onElementSelection,
  onHoverRectChange,
}: {
  isAnnotating: boolean;
  resolvedTarget: ResolvedTarget;
  onElementSelection: (
    eventTarget: Element,
    frameElement: HTMLIFrameElement | null,
    extendSelection: boolean
  ) => void;
  onHoverRectChange: (rect: Rect | null) => void;
}) {
  useEffect(() => {
    if (!isAnnotating || !resolvedTarget.document) {
      onHoverRectChange(null);
      return;
    }

    const activeDocument = resolvedTarget.document;

    const onPointerOver = (event: PointerEvent) => {
      const eventTarget = getAnnotatableTarget(event.target, activeDocument);
      onHoverRectChange(
        eventTarget ? getRect(eventTarget, resolvedTarget.frameElement) : null
      );
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

      onElementSelection(
        eventTarget,
        resolvedTarget.frameElement,
        shouldExtendSelection(event)
      );
    };

    const onFramePointerLeave = () => {
      onHoverRectChange(null);
    };

    activeDocument.addEventListener("pointerover", onPointerOver, true);
    activeDocument.addEventListener("click", onClick, true);
    BLOCKED_INTERACTION_EVENTS.forEach((eventName) =>
      activeDocument.addEventListener(eventName, suppressInteraction, true)
    );
    resolvedTarget.frameElement?.addEventListener(
      "pointerleave",
      onFramePointerLeave
    );

    return () => {
      activeDocument.removeEventListener("pointerover", onPointerOver, true);
      activeDocument.removeEventListener("click", onClick, true);
      BLOCKED_INTERACTION_EVENTS.forEach((eventName) =>
        activeDocument.removeEventListener(eventName, suppressInteraction, true)
      );
      resolvedTarget.frameElement?.removeEventListener(
        "pointerleave",
        onFramePointerLeave
      );
    };
  }, [isAnnotating, onElementSelection, onHoverRectChange, resolvedTarget]);
}

function useTrackedRectRefresh({
  isAnnotating,
  targetDocument,
  onRefresh,
}: {
  isAnnotating: boolean;
  targetDocument: Document | null;
  onRefresh: () => void;
}) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!isAnnotating || !targetDocument) {
      return;
    }

    const onRefreshTrackedRects = () => refreshRef.current();

    targetDocument.addEventListener("scroll", onRefreshTrackedRects, true);
    if (typeof document !== "undefined" && targetDocument !== document) {
      document.addEventListener("scroll", onRefreshTrackedRects, true);
    }
    window.addEventListener("resize", onRefreshTrackedRects);

    return () => {
      targetDocument.removeEventListener("scroll", onRefreshTrackedRects, true);
      if (typeof document !== "undefined" && targetDocument !== document) {
        document.removeEventListener("scroll", onRefreshTrackedRects, true);
      }
      window.removeEventListener("resize", onRefreshTrackedRects);
    };
  }, [isAnnotating, targetDocument]);
}

function SourceAnnotatorOverlay({
  hotkey,
  renderToaster,
  state,
  onToggle,
  onPreview,
  onClosePreview,
  onNoteChange,
  onCancelDraft,
  onSaveDraft,
  onEdit,
  onDelete,
  onCollect,
  onLink,
  onCancelSession,
}: {
  hotkey: string;
  renderToaster: boolean;
  state: AnnotatorState;
  onToggle: () => void;
  onPreview: (annotation: StoredAnnotation) => void;
  onClosePreview: () => void;
  onNoteChange: (note: string) => void;
  onCancelDraft: () => void;
  onSaveDraft: () => void;
  onEdit: (annotation: StoredAnnotation) => void;
  onDelete: (annotationId: string) => void;
  onCollect: () => void;
  onLink: (annotationId: string) => void;
  onCancelSession: () => void;
}) {
  const {
    isAnnotating,
    hoverRect,
    selected,
    note,
    annotations,
    previewedAnnotation,
    status,
  } = state;
  const colorScheme = usePreferredColorScheme();
  const styles = useMemo(
    () => createStyles(colorPalettes[colorScheme]),
    [colorScheme]
  );

  return (
    <div {...{ [ROOT_ATTR]: "" }} style={styles.root} aria-live="polite">
      {renderToaster ? (
        <Toaster position="bottom-right" richColors theme={colorScheme} />
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        style={{
          ...styles.floatingButton,
          ...(isAnnotating ? styles.floatingButtonActive : null),
        }}
        aria-pressed={isAnnotating}
        title={`Toggle annotator (${hotkey})`}
      >
        {isAnnotating ? "Annotating" : "Annotate"}
      </button>

      {isAnnotating && hoverRect ? (
        <Box rect={hoverRect} kind="hover" styles={styles} />
      ) : null}
      {isAnnotating
        ? selected?.targets.map((targetEntry) => (
            <Box
              key={getDraftTargetKey(targetEntry)}
              rect={targetEntry.rect}
              kind="selected"
              styles={styles}
            />
          ))
        : null}
      {isAnnotating
        ? annotations.map((annotation, index) =>
            annotation.targets.map((targetEntry) => (
              <Pin
                key={`${annotation.id}:${getStoredTargetKey(targetEntry)}`}
                annotation={annotation}
                rect={targetEntry.rect}
                index={index}
                isPreviewed={previewedAnnotation?.id === annotation.id}
                onPreview={onPreview}
                styles={styles}
              />
            ))
          )
        : null}
      {isAnnotating && previewedAnnotation ? (
        <AnnotationPreview
          annotation={previewedAnnotation}
          index={annotations.findIndex(
            (annotation) => annotation.id === previewedAnnotation.id
          )}
          onEdit={onEdit}
          onDelete={onDelete}
          onClose={onClosePreview}
          styles={styles}
        />
      ) : null}

      <DraftPopover
        selected={isAnnotating ? selected : null}
        note={note}
        onNoteChange={onNoteChange}
        onCancel={onCancelDraft}
        onSave={onSaveDraft}
        styles={styles}
      />

      <AnnotationPanel
        isAnnotating={isAnnotating}
        annotations={annotations}
        status={status}
        onCollect={onCollect}
        onLink={onLink}
        onDelete={onDelete}
        onCancel={onCancelSession}
        styles={styles}
      />
    </div>
  );
}

function Box({
  rect,
  kind,
  styles,
}: {
  rect: Rect;
  kind: "hover" | "selected";
  styles: AnnotatorStyles;
}) {
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
  rect,
  index,
  isPreviewed,
  onPreview,
  styles,
}: {
  annotation: StoredAnnotation;
  rect: Rect;
  index: number;
  isPreviewed: boolean;
  onPreview: (annotation: StoredAnnotation) => void;
  styles: AnnotatorStyles;
}) {
  return (
    <button
      type="button"
      style={{
        ...styles.pin,
        top: Math.max(8, rect.top - 10),
        left: Math.max(8, rect.left - 10),
      }}
      title={annotation.note}
      aria-label={`Show annotation ${index + 1}`}
      aria-haspopup="dialog"
      aria-expanded={isPreviewed}
      onClick={() => onPreview(annotation)}
      onMouseOver={() => onPreview(annotation)}
      onFocus={() => onPreview(annotation)}
    >
      {index + 1}
    </button>
  );
}

function DraftPopover({
  selected,
  note,
  onNoteChange,
  onCancel,
  onSave,
  styles,
}: {
  selected: DraftSelection | null;
  note: string;
  onNoteChange: (note: string) => void;
  onCancel: () => void;
  onSave: () => void;
  styles: AnnotatorStyles;
}) {
  if (!selected?.targets.length) {
    return null;
  }

  return (
    <dialog
      open
      style={getPopoverStyle(
        selected.targets[selected.targets.length - 1].rect,
        styles
      )}
      aria-label="Add source annotation"
    >
      <div style={styles.popoverTitle}>Annotation</div>
      <div style={styles.metaText}>
        {formatSelectedTargets(selected.targets)}
      </div>
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="What should change here?"
        aria-label="Annotation note"
        style={styles.textarea}
        rows={4}
      />
      <div style={styles.popoverActions}>
        <button type="button" onClick={onCancel} style={styles.secondaryButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          style={styles.primaryButton}
          disabled={selected.targets.some((targetEntry) => targetEntry.loading)}
        >
          {selected.editingId ? "Update note" : "Save note"}
        </button>
      </div>
    </dialog>
  );
}

function AnnotationPanel({
  isAnnotating,
  annotations,
  status,
  onCollect,
  onLink,
  onDelete,
  onCancel,
  styles,
}: {
  isAnnotating: boolean;
  annotations: StoredAnnotation[];
  status: string | null;
  onCollect: () => void;
  onLink: (annotationId: string) => void;
  onDelete: (annotationId: string) => void;
  onCancel: () => void;
  styles: AnnotatorStyles;
}) {
  if (!isAnnotating) {
    return null;
  }

  return (
    <section style={styles.panel} aria-label="Collected annotations">
      <div style={styles.panelHeader}>
        <strong style={styles.panelTitle}>Annotations</strong>
        <span style={styles.badge}>{annotations.length}</span>
      </div>
      {annotations.length ? (
        <ol style={styles.annotationList}>
          {annotations.map((annotation, index) => (
            <li key={annotation.id} style={styles.annotationItem}>
              <div style={styles.annotationContent}>
                <div style={styles.noteText}>{annotation.note}</div>
                <div style={styles.metaText}>
                  {formatStoredAnnotationSummary(annotation)}
                </div>
              </div>
              <div style={styles.annotationActions}>
                <button
                  type="button"
                  onClick={() => onLink(annotation.id)}
                  style={styles.linkButton}
                >
                  Link element
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(annotation.id)}
                  style={{ ...styles.deleteButton, ...styles.iconButton }}
                  aria-label={`Delete annotation ${index + 1}`}
                  title={`Delete annotation ${index + 1}`}
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p style={styles.emptyText}>
          Hover an element, click it, then add a note.
        </p>
      )}
      <div style={styles.panelFooter}>
        <button
          type="button"
          onClick={onCancel}
          style={styles.panelCancelButton}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onCollect}
          style={styles.collectButton}
          disabled={!annotations.length}
        >
          Collect
        </button>
      </div>
      {status ? <div style={styles.status}>{status}</div> : null}
    </section>
  );
}

function AnnotationPreview({
  annotation,
  index,
  onEdit,
  onDelete,
  onClose,
  styles,
}: {
  annotation: StoredAnnotation;
  index: number;
  onEdit: (annotation: StoredAnnotation) => void;
  onDelete: (annotationId: string) => void;
  onClose: () => void;
  styles: AnnotatorStyles;
}) {
  const displayIndex = index >= 0 ? index + 1 : 1;

  return (
    <dialog
      open
      aria-label={`Annotation ${displayIndex}`}
      style={getPreviewStyle(
        annotation.targets[0]?.rect ?? { top: 8, left: 8, width: 0, height: 0 },
        styles
      )}
    >
      <div style={styles.previewHeader}>
        <div style={styles.previewTitle}>Annotation {displayIndex}</div>
        <div style={styles.previewActions}>
          <button
            type="button"
            onClick={onClose}
            style={{ ...styles.secondaryButton, ...styles.iconButton }}
            aria-label={`Close annotation ${displayIndex}`}
            title={`Close annotation ${displayIndex}`}
          >
            ×
          </button>
          <button
            type="button"
            onClick={() => onEdit(annotation)}
            style={{ ...styles.secondaryButton, ...styles.iconButton }}
            aria-label={`Edit annotation ${displayIndex}`}
            title={`Edit annotation ${displayIndex}`}
          >
            ✎
          </button>
          <button
            type="button"
            onClick={() => onDelete(annotation.id)}
            style={{ ...styles.deleteButton, ...styles.iconButton }}
            aria-label={`Delete annotation ${displayIndex}`}
            title={`Delete annotation ${displayIndex}`}
          >
            🗑
          </button>
        </div>
      </div>
      <div style={styles.noteText}>{annotation.note}</div>
      <div style={styles.metaText}>
        {formatStoredAnnotationSummary(annotation)}
      </div>
    </dialog>
  );
}

function useAnnotatorHotkey(
  hotkey: string,
  targetDocument: Document | null,
  onToggle: () => void
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesHotkey(event, hotkey)) {
        return;
      }

      event.preventDefault();
      onToggle();
    };

    if (typeof document === "undefined") {
      return;
    }

    return listenForKeydown(targetDocument, onKeyDown);
  }, [hotkey, onToggle, targetDocument]);
}

function useAnnotationEscape(
  isAnnotating: boolean,
  previewedAnnotation: StoredAnnotation | null,
  targetDocument: Document | null,
  onEscape: () => void
) {
  useEffect(() => {
    if (!isAnnotating && !previewedAnnotation) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onEscape();
    };

    return listenForKeydown(targetDocument, onKeyDown);
  }, [isAnnotating, onEscape, previewedAnnotation, targetDocument]);
}

function listenForKeydown(
  targetDocument: Document | null,
  onKeyDown: (event: KeyboardEvent) => void
) {
  document.addEventListener("keydown", onKeyDown);
  if (targetDocument && targetDocument !== document) {
    targetDocument.addEventListener("keydown", onKeyDown);
  }

  return () => {
    document.removeEventListener("keydown", onKeyDown);
    if (targetDocument && targetDocument !== document) {
      targetDocument.removeEventListener("keydown", onKeyDown);
    }
  };
}

function addTargetToAnnotation(
  annotations: StoredAnnotation[],
  annotationId: string,
  target: StoredTargetInput
): StoredAnnotation[] {
  return annotations.map((annotation) => {
    if (
      annotation.id !== annotationId ||
      hasStoredTarget(annotation, target.targetElement)
    ) {
      return annotation;
    }

    return {
      ...annotation,
      targets: [...annotation.targets, target],
    };
  });
}

function hasStoredTarget(annotation: StoredAnnotation, targetElement: Element) {
  return annotation.targets.some(
    (targetEntry) => targetEntry.targetElement === targetElement
  );
}

function createFallbackTarget(element: Element): AnnotationTarget {
  return {
    source: null,
    sourceStack: [],
    componentPath: [],
    element: {
      tagName: element.tagName.toLowerCase(),
      text: element.textContent?.trim() ?? "",
      html: "",
      selector: "",
    },
  };
}

function stripStoredAnnotations(annotations: StoredAnnotation[]): Annotation[] {
  return annotations.map((annotation) => ({
    id: annotation.id,
    note: annotation.note,
    targets: annotation.targets.map((targetEntry) => targetEntry.data),
  }));
}

function getAnnotatableTarget(
  target: EventTarget | null,
  ownerDocument: Document
): Element | null {
  if (!isElement(target, ownerDocument)) {
    return null;
  }

  if (target.closest(`[${ROOT_ATTR}]`)) {
    return null;
  }

  if (
    target === ownerDocument.body ||
    target === ownerDocument.documentElement
  ) {
    return null;
  }

  return target;
}

function getRect(
  element: Element,
  frameElement: HTMLIFrameElement | null
): Rect {
  const rect = element.getBoundingClientRect();
  const frameRect = frameElement?.getBoundingClientRect();

  return {
    top: rect.top + (frameRect?.top ?? 0),
    left: rect.left + (frameRect?.left ?? 0),
    width: rect.width,
    height: rect.height,
  };
}

function useResolvedTarget(
  target: SourceAnnotatorTarget | undefined
): ResolvedTarget {
  const [navigationVersion, setNavigationVersion] = useState(0);
  const resolvedTarget = useMemo(() => {
    void navigationVersion;
    return resolveTarget(target);
  }, [target, navigationVersion]);
  const currentDocumentRef = useRef<Document | null>(resolvedTarget.document);
  currentDocumentRef.current = resolvedTarget.document;

  useEffect(() => {
    if (
      typeof HTMLIFrameElement !== "undefined" &&
      target instanceof HTMLIFrameElement
    ) {
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

function resolveTarget(
  target: SourceAnnotatorTarget | undefined
): ResolvedTarget {
  const hostDocument = typeof document === "undefined" ? null : document;

  if (
    typeof HTMLIFrameElement !== "undefined" &&
    target instanceof HTMLIFrameElement
  ) {
    const frameDocument = target.contentDocument;
    if (!frameDocument) {
      console.warn(
        "@mikuexe/annotator-react: SourceAnnotator target iframe must be same-origin; iframe contentDocument is not accessible."
      );
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

function isElement(
  target: EventTarget | null,
  ownerDocument: Document
): target is Element {
  const elementConstructor = ownerDocument.defaultView?.Element ?? Element;
  return target instanceof elementConstructor;
}

function getPopoverStyle(rect: Rect, styles: AnnotatorStyles): CSSProperties {
  const top = Math.min(window.innerHeight - 260, rect.top + rect.height + 8);
  const left = Math.min(window.innerWidth - 340, Math.max(8, rect.left));

  return {
    ...styles.popover,
    top: Math.max(8, top),
    left,
  };
}

function getPreviewStyle(rect: Rect, styles: AnnotatorStyles): CSSProperties {
  const top = Math.min(window.innerHeight - 120, rect.top + rect.height + 8);
  const left = Math.min(window.innerWidth - 260, Math.max(8, rect.left));

  return {
    ...styles.preview,
    top: Math.max(8, top),
    left,
  };
}

function formatSelectedTargets(targets: DraftTarget[]): string {
  if (!targets.length) {
    return "Source unavailable";
  }

  if (targets.length === 1) {
    return formatTargetSource(targets[0].target);
  }

  const resolvedCount = targets.filter(
    (targetEntry) => targetEntry.target
  ).length;
  return `${targets.length} elements selected · ${resolvedCount}/${targets.length} resolved`;
}

function formatStoredAnnotationSummary(annotation: StoredAnnotation): string {
  const firstTarget = annotation.targets[0]?.data;
  const targetSummary = formatTargetSource(firstTarget);
  const linkedSummary =
    annotation.targets.length > 1
      ? ` · ${annotation.targets.length} linked elements`
      : "";
  return `${targetSummary}${linkedSummary}`;
}

function formatTargetSource(
  target: AnnotationTarget | null | undefined
): string {
  const componentPath = target?.componentPath.length
    ? target.componentPath.join(" › ")
    : null;

  if (!target) {
    return "Source unavailable";
  }

  if (!target.source?.filePath) {
    return `${target.element.selector} · source unavailable`;
  }

  const line = target.source.lineNumber ? `:${target.source.lineNumber}` : "";
  const component = componentPath ? ` · ${componentPath}` : "";
  return `${target.source.filePath}${line}${component}`;
}

function shouldExtendSelection(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const parsedHotkey = parseHotkey(hotkey);

  return (
    event.key.toLowerCase() === parsedHotkey.key &&
    event.metaKey === parsedHotkey.modifiers.meta &&
    event.ctrlKey === parsedHotkey.modifiers.ctrl &&
    event.shiftKey === parsedHotkey.modifiers.shift &&
    event.altKey === parsedHotkey.modifiers.alt
  );
}

type ParsedHotkey = {
  key: string | undefined;
  modifiers: {
    meta: boolean;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
  };
};

const HOTKEY_MODIFIERS = new Set([
  "ctrl",
  "control",
  "cmd",
  "meta",
  "mod",
  "shift",
  "alt",
  "option",
]);

function parseHotkey(hotkey: string): ParsedHotkey {
  const parts = hotkey
    .toLowerCase()
    .split("+")
    .flatMap((part) => {
      const trimmed = part.trim();
      return trimmed ? [trimmed] : [];
    });
  const modifierParts = new Set(parts);
  const usesMacMod = modifierParts.has("mod") && isMac();

  return {
    key: parts.find((part) => !HOTKEY_MODIFIERS.has(part)),
    modifiers: {
      meta: modifierParts.has("meta") || modifierParts.has("cmd") || usesMacMod,
      ctrl:
        modifierParts.has("ctrl") ||
        modifierParts.has("control") ||
        (modifierParts.has("mod") && !usesMacMod),
      shift: modifierParts.has("shift"),
      alt: modifierParts.has("alt") || modifierParts.has("option"),
    },
  };
}

function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad|ipod/i.test(navigator.platform)
  );
}

const baseFont =
  '13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

type ColorScheme = "light" | "dark";

type AnnotatorPalette = {
  colorScheme: ColorScheme;
  text: string;
  mutedText: string;
  subtleText: string;
  surface: string;
  activeSurface: string;
  activeText: string;
  border: string;
  activeBorder: string;
  shadow: string;
  floatingShadow: string;
  hoverBorder: string;
  hoverBackground: string;
  selectedBorder: string;
  selectedBackground: string;
  badgeBackground: string;
  badgeText: string;
  linkBorder: string;
  linkBackground: string;
  linkText: string;
  dangerBorder: string;
  dangerBackground: string;
  dangerText: string;
  pinBackground: string;
  pinText: string;
};

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

const colorPalettes = {
  light: {
    colorScheme: "light",
    text: "#0f172a",
    mutedText: "#64748b",
    subtleText: "#475569",
    surface: "#ffffff",
    activeSurface: "#0f172a",
    activeText: "#ffffff",
    border: "#cbd5e1",
    activeBorder: "#0f172a",
    shadow: "rgba(15, 23, 42, 0.18)",
    floatingShadow: "rgba(15, 23, 42, 0.16)",
    hoverBorder: "#38bdf8",
    hoverBackground: "rgba(56, 189, 248, 0.08)",
    selectedBorder: "#f97316",
    selectedBackground: "rgba(249, 115, 22, 0.1)",
    badgeBackground: "#e2e8f0",
    badgeText: "#334155",
    linkBorder: "#bfdbfe",
    linkBackground: "#eff6ff",
    linkText: "#1d4ed8",
    dangerBorder: "#fecaca",
    dangerBackground: "#fff1f2",
    dangerText: "#be123c",
    pinBackground: "#f97316",
    pinText: "#ffffff",
  },
  dark: {
    colorScheme: "dark",
    text: "#e2e8f0",
    mutedText: "#94a3b8",
    subtleText: "#cbd5e1",
    surface: "#0f172a",
    activeSurface: "#e2e8f0",
    activeText: "#0f172a",
    border: "#334155",
    activeBorder: "#e2e8f0",
    shadow: "rgba(0, 0, 0, 0.42)",
    floatingShadow: "rgba(0, 0, 0, 0.36)",
    hoverBorder: "#38bdf8",
    hoverBackground: "rgba(56, 189, 248, 0.16)",
    selectedBorder: "#fb923c",
    selectedBackground: "rgba(251, 146, 60, 0.18)",
    badgeBackground: "#334155",
    badgeText: "#e2e8f0",
    linkBorder: "#2563eb",
    linkBackground: "#172554",
    linkText: "#bfdbfe",
    dangerBorder: "#be123c",
    dangerBackground: "#4c0519",
    dangerText: "#fecdd3",
    pinBackground: "#f97316",
    pinText: "#ffffff",
  },
} satisfies Record<ColorScheme, AnnotatorPalette>;

function usePreferredColorScheme(): ColorScheme {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    getPreferredColorScheme
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(DARK_MODE_QUERY);
    const syncColorScheme = (matches: boolean) => {
      setColorScheme(matches ? "dark" : "light");
    };
    const handleChange = (event: MediaQueryListEvent) => {
      syncColorScheme(event.matches);
    };

    syncColorScheme(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);

      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);

    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  return colorScheme;
}

function getPreferredColorScheme(): ColorScheme {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DARK_MODE_QUERY).matches
    ? "dark"
    : "light";
}

function createStyles(palette: AnnotatorPalette) {
  return {
    root: {
      position: "fixed",
      inset: 0,
      zIndex: 2147483647,
      pointerEvents: "none",
      font: baseFont,
      color: palette.text,
      colorScheme: palette.colorScheme,
    } satisfies CSSProperties,
    floatingButton: {
      position: "fixed",
      right: 16,
      bottom: 16,
      pointerEvents: "auto",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: palette.border,
      background: palette.surface,
      color: palette.text,
      borderRadius: 999,
      padding: "10px 14px",
      font: baseFont,
      fontWeight: 700,
      boxShadow: `0 10px 25px ${palette.floatingShadow}`,
      cursor: "pointer",
    } satisfies CSSProperties,
    floatingButtonActive: {
      background: palette.activeSurface,
      color: palette.activeText,
      borderColor: palette.activeBorder,
    } satisfies CSSProperties,
    box: {
      position: "fixed",
      borderRadius: 6,
      pointerEvents: "none",
      boxSizing: "border-box",
      color: palette.text,
    } satisfies CSSProperties,
    hoverBox: {
      border: `2px solid ${palette.hoverBorder}`,
      background: palette.hoverBackground,
    } satisfies CSSProperties,
    selectedBox: {
      border: `2px solid ${palette.selectedBorder}`,
      background: palette.selectedBackground,
    } satisfies CSSProperties,
    popover: {
      position: "fixed",
      zIndex: 2,
      width: 320,
      pointerEvents: "auto",
      background: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: 12,
      padding: 12,
      boxShadow: `0 18px 45px ${palette.shadow}`,
      color: palette.text,
    } satisfies CSSProperties,
    popoverTitle: {
      color: palette.text,
      fontWeight: 800,
      marginBottom: 4,
    } satisfies CSSProperties,
    metaText: {
      color: palette.mutedText,
      fontSize: 12,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } satisfies CSSProperties,
    textarea: {
      width: "100%",
      boxSizing: "border-box",
      marginTop: 10,
      border: `1px solid ${palette.border}`,
      borderRadius: 8,
      padding: 10,
      resize: "vertical",
      font: baseFont,
      background: palette.surface,
      color: palette.text,
      caretColor: palette.text,
      colorScheme: palette.colorScheme,
    } satisfies CSSProperties,
    popoverActions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 10,
      color: palette.text,
    } satisfies CSSProperties,
    secondaryButton: {
      border: `1px solid ${palette.border}`,
      borderRadius: 8,
      background: palette.surface,
      color: palette.text,
      padding: "7px 10px",
      font: baseFont,
      cursor: "pointer",
    } satisfies CSSProperties,
    primaryButton: {
      border: `1px solid ${palette.activeBorder}`,
      borderRadius: 8,
      background: palette.activeSurface,
      color: palette.activeText,
      padding: "7px 10px",
      font: baseFont,
      cursor: "pointer",
    } satisfies CSSProperties,
    panel: {
      position: "fixed",
      zIndex: 1,
      right: 16,
      bottom: 68,
      width: 300,
      pointerEvents: "auto",
      background: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: 12,
      padding: 12,
      boxShadow: `0 18px 45px ${palette.shadow}`,
      color: palette.text,
    } satisfies CSSProperties,
    panelHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
      color: palette.text,
    } satisfies CSSProperties,
    panelTitle: {
      color: palette.text,
    } satisfies CSSProperties,
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: palette.badgeBackground,
      color: palette.badgeText,
      fontWeight: 700,
      fontSize: 12,
    } satisfies CSSProperties,
    annotationList: {
      listStyle: "decimal",
      margin: "0 0 10px 18px",
      padding: 0,
      maxHeight: 180,
      overflow: "auto",
      color: palette.text,
    } satisfies CSSProperties,
    annotationItem: {
      display: "grid",
      gap: 8,
      alignItems: "start",
      marginBottom: 8,
      color: palette.text,
    } satisfies CSSProperties,
    annotationContent: {
      minWidth: 0,
      color: palette.text,
    } satisfies CSSProperties,
    annotationActions: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      color: palette.text,
    } satisfies CSSProperties,
    noteText: {
      color: palette.text,
      fontWeight: 650,
      overflowWrap: "anywhere",
    } satisfies CSSProperties,
    emptyText: {
      color: palette.mutedText,
      margin: "6px 0 10px",
    } satisfies CSSProperties,
    panelFooter: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      color: palette.text,
    } satisfies CSSProperties,
    panelCancelButton: {
      border: `1px solid ${palette.border}`,
      borderRadius: 8,
      background: palette.surface,
      color: palette.text,
      padding: "9px 10px",
      font: baseFont,
      fontWeight: 800,
      cursor: "pointer",
    } satisfies CSSProperties,
    collectButton: {
      width: "100%",
      border: `1px solid ${palette.activeBorder}`,
      borderRadius: 8,
      background: palette.activeSurface,
      color: palette.activeText,
      padding: "9px 10px",
      font: baseFont,
      fontWeight: 800,
      cursor: "pointer",
    } satisfies CSSProperties,
    status: {
      marginTop: 8,
      color: palette.subtleText,
      fontSize: 12,
    } satisfies CSSProperties,
    linkButton: {
      border: `1px solid ${palette.linkBorder}`,
      borderRadius: 999,
      background: palette.linkBackground,
      color: palette.linkText,
      padding: "4px 7px",
      font: baseFont,
      fontSize: 11,
      fontWeight: 750,
      cursor: "pointer",
    } satisfies CSSProperties,
    deleteButton: {
      border: `1px solid ${palette.dangerBorder}`,
      borderRadius: 999,
      background: palette.dangerBackground,
      color: palette.dangerText,
      padding: "4px 7px",
      font: baseFont,
      fontSize: 11,
      fontWeight: 750,
      cursor: "pointer",
    } satisfies CSSProperties,
    preview: {
      position: "fixed",
      maxWidth: 240,
      pointerEvents: "auto",
      background: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: 10,
      padding: 10,
      boxShadow: `0 14px 35px ${palette.shadow}`,
      color: palette.text,
    } satisfies CSSProperties,
    previewHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 6,
      color: palette.text,
    } satisfies CSSProperties,
    previewTitle: {
      color: palette.subtleText,
      fontSize: 12,
      fontWeight: 800,
    } satisfies CSSProperties,
    previewActions: {
      display: "inline-flex",
      gap: 6,
      color: palette.text,
    } satisfies CSSProperties,
    iconButton: {
      width: 26,
      height: 26,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      lineHeight: 1,
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
      background: palette.pinBackground,
      color: palette.pinText,
      fontSize: 12,
      fontWeight: 800,
      boxShadow: `0 8px 18px ${palette.shadow}`,
      cursor: "pointer",
      padding: 0,
    } satisfies CSSProperties,
  };
}

type AnnotatorStyles = ReturnType<typeof createStyles>;
