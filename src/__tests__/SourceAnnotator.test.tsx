import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceAnnotator } from "../SourceAnnotator";

const captureMocks = vi.hoisted(() => ({
  captureElementAnnotation: vi.fn(),
}));

const clipboardMocks = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(),
}));

const sonnerMocks = vi.hoisted(() => ({
  toasterRender: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../capture", () => ({ captureElementAnnotation: captureMocks.captureElementAnnotation }));

vi.mock("../clipboard", () => ({ copyTextToClipboard: clipboardMocks.copyTextToClipboard }));

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => {
    sonnerMocks.toasterRender(props);
    return null;
  },
  toast: {
    error: sonnerMocks.toastError,
    success: sonnerMocks.toastSuccess,
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SourceAnnotator", () => {
  let roots: Root[] = [];

  beforeEach(() => {
    act(() => {
      roots.forEach((root) => root.unmount());
    });
    roots = [];
    document.body.innerHTML = "";
    captureMocks.captureElementAnnotation.mockReset();
    clipboardMocks.copyTextToClipboard.mockReset();
    sonnerMocks.toasterRender.mockClear();
    sonnerMocks.toastError.mockClear();
    sonnerMocks.toastSuccess.mockClear();
  });

  function renderAnnotator(props: ComponentProps<typeof SourceAnnotator> = {}) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<SourceAnnotator {...props} />);
    });

    return container;
  }

  it("renders an owned Sonner Toaster by default", () => {
    renderAnnotator();

    expect(sonnerMocks.toasterRender).toHaveBeenCalledWith(expect.objectContaining({ position: "bottom-right", richColors: true }));
  });

  it("lets host apps own Sonner rendering", () => {
    const container = renderAnnotator({ renderToaster: false });

    expect(sonnerMocks.toasterRender).not.toHaveBeenCalled();
    expect(container.querySelector("button")?.textContent).toBe("Annotate");
  });

  it("keeps saved annotation pins attached to their target after scrolling", async () => {
    let targetRect = { top: 100, left: 50, width: 80, height: 30 };
    const target = document.createElement("button");
    target.textContent = "Target";
    target.getBoundingClientRect = vi.fn(() => createDomRect(targetRect));
    document.body.append(target);

    captureMocks.captureElementAnnotation.mockResolvedValue({
      id: "ann-1",
      note: "",
      source: null,
      sourceStack: [],
      componentPath: [],
      element: {
        tagName: "button",
        text: "Target",
        html: "<button>Target</button>",
        selector: "button",
      },
    });

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);

    act(() => {
      setTextareaValue(textarea as HTMLTextAreaElement, "Keep attached");
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    const pin = container.querySelector<HTMLElement>('[title="Keep attached"]');
    expect(pin?.style.top).toBe("90px");
    expect(pin?.style.left).toBe("40px");

    targetRect = { top: 40, left: 75, width: 80, height: 30 };

    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });

    expect(pin?.style.top).toBe("30px");
    expect(pin?.style.left).toBe("65px");
  });

  it("blocks host pointer and click handlers while selecting an element", async () => {
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    const target = document.createElement("button");
    target.textContent = "Interactive target";
    target.getBoundingClientRect = vi.fn(() => createDomRect({ top: 25, left: 30, width: 100, height: 40 }));
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("click", onClick);
    document.body.append(target);

    captureMocks.captureElementAnnotation.mockResolvedValue(createAnnotation({ id: "ann-1", note: "", text: "Interactive target" }));

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    act(() => {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    });

    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(container.querySelector("textarea")).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("reopens an annotation from its pin, previews it on hover, and updates without duplicating", async () => {
    const target = document.createElement("button");
    target.textContent = "Target";
    target.getBoundingClientRect = vi.fn(() => createDomRect({ top: 100, left: 50, width: 80, height: 30 }));
    document.body.append(target);

    captureMocks.captureElementAnnotation.mockResolvedValue(createAnnotation({ id: "ann-1", note: "", text: "Target" }));

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    act(() => {
      setTextareaValue(container.querySelector("textarea") as HTMLTextAreaElement, "Original note");
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    const pin = getButton(container, "1");

    act(() => {
      pin.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain("Original note");

    act(() => {
      pin.click();
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Original note");

    act(() => {
      setTextareaValue(textarea, "Updated note");
    });

    await act(async () => {
      getButton(container, "Update note").click();
      await Promise.resolve();
    });

    const items = Array.from(container.querySelectorAll("li"));
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Updated note");
    expect(items[0]?.textContent).not.toContain("Original note");
  });

  it("deletes annotations from the summary panel", async () => {
    const target = document.createElement("button");
    target.textContent = "Target";
    target.getBoundingClientRect = vi.fn(() => createDomRect({ top: 100, left: 50, width: 80, height: 30 }));
    document.body.append(target);

    captureMocks.captureElementAnnotation.mockResolvedValue(createAnnotation({ id: "ann-1", note: "", text: "Target" }));

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    act(() => {
      setTextareaValue(container.querySelector("textarea") as HTMLTextAreaElement, "Delete me");
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    act(() => {
      getButton(container, "Delete annotation 1").click();
    });

    expect(container.textContent).toContain("Hover an element, click it, then add a note.");
    expect(container.textContent).not.toContain("Delete me");
  });

  it("clears copied annotations and does not show stale copied status when reopened", async () => {
    const target = document.createElement("button");
    target.textContent = "Target";
    target.getBoundingClientRect = vi.fn(() => createDomRect({ top: 100, left: 50, width: 80, height: 30 }));
    document.body.append(target);

    clipboardMocks.copyTextToClipboard.mockResolvedValue(undefined);
    captureMocks.captureElementAnnotation.mockResolvedValue(createAnnotation({ id: "ann-1", note: "", text: "Target" }));

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    act(() => {
      setTextareaValue(container.querySelector("textarea") as HTMLTextAreaElement, "Copy me");
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    await act(async () => {
      getButton(container, "Collect").click();
      await Promise.resolve();
    });

    act(() => {
      getButton(container, "Annotate").click();
    });

    expect(container.textContent).toContain("Hover an element, click it, then add a note.");
    expect(container.textContent).not.toContain("Copy me");
    expect(container.textContent).not.toContain("Copied 1 annotation");
  });

  it("selects elements inside a same-origin iframe target and positions the overlay in the host viewport", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    iframe.getBoundingClientRect = vi.fn(() => createDomRect({ top: 200, left: 300, width: 640, height: 480 }));

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      throw new Error("Expected iframe contentDocument in test environment.");
    }

    const target = frameDocument.createElement("button");
    target.textContent = "Frame target";
    target.getBoundingClientRect = vi.fn(() => createDomRect({ top: 25, left: 30, width: 100, height: 40 }));
    frameDocument.body.append(target);

    captureMocks.captureElementAnnotation.mockResolvedValue(createAnnotation({ id: "ann-frame", note: "", text: "Frame target" }));

    const container = renderAnnotator({ target: iframe });

    act(() => {
      getButton(container, "Annotate").click();
    });

    act(() => {
      target.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true }));
    });

    const hoverBox = container.querySelector<HTMLElement>('[data-mikuexe-annotator-box="hover"]');
    expect(hoverBox?.style.top).toBe("225px");
    expect(hoverBox?.style.left).toBe("330px");

    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(captureMocks.captureElementAnnotation).toHaveBeenCalledWith(target, "");
    expect(container.querySelector("textarea")).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("blocks iframe app interactions while selecting an iframe element", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      throw new Error("Expected iframe contentDocument in test environment.");
    }

    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    const target = frameDocument.createElement("button");
    target.textContent = "Frame interactive target";
    target.getBoundingClientRect = vi.fn(() => createDomRect({ top: 25, left: 30, width: 100, height: 40 }));
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("click", onClick);
    frameDocument.body.append(target);

    captureMocks.captureElementAnnotation.mockResolvedValue(createAnnotation({ id: "ann-frame", note: "", text: "Frame interactive target" }));

    const container = renderAnnotator({ target: iframe });

    act(() => {
      getButton(container, "Annotate").click();
    });

    act(() => {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    });

    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(container.querySelector("textarea")).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("clears the iframe hover box when the pointer leaves the iframe", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    iframe.getBoundingClientRect = vi.fn(() => createDomRect({ top: 200, left: 300, width: 640, height: 480 }));

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      throw new Error("Expected iframe contentDocument in test environment.");
    }

    const target = frameDocument.createElement("button");
    target.textContent = "Frame target";
    target.getBoundingClientRect = vi.fn(() => createDomRect({ top: 25, left: 30, width: 100, height: 40 }));
    frameDocument.body.append(target);

    const container = renderAnnotator({ target: iframe });

    act(() => {
      getButton(container, "Annotate").click();
    });

    act(() => {
      target.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector('[data-mikuexe-annotator-box="hover"]')).toBeInstanceOf(HTMLDivElement);

    act(() => {
      iframe.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false, cancelable: true }));
    });

    expect(container.querySelector('[data-mikuexe-annotator-box="hover"]')).toBeNull();
  });

  it("warns and does not fall back to parent document annotation for inaccessible iframes", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const iframe = document.createElement("iframe");
    Object.defineProperty(iframe, "contentDocument", { configurable: true, get: () => null });
    document.body.append(iframe);

    const parentTarget = document.createElement("button");
    parentTarget.textContent = "Parent target";
    parentTarget.getBoundingClientRect = vi.fn(() => createDomRect({ top: 25, left: 30, width: 100, height: 40 }));
    document.body.append(parentTarget);

    const container = renderAnnotator({ target: iframe });

    act(() => {
      getButton(container, "Annotate").click();
    });

    act(() => {
      parentTarget.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true }));
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(container.querySelector('[data-mikuexe-annotator-box="hover"]')).toBeNull();

    warnSpy.mockRestore();
  });

  it("reattaches iframe listeners when a same-origin iframe navigates", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    iframe.getBoundingClientRect = vi.fn(() => createDomRect({ top: 200, left: 300, width: 640, height: 480 }));

    const firstDocument = iframe.contentDocument;
    if (!firstDocument) {
      throw new Error("Expected iframe contentDocument in test environment.");
    }

    let currentDocument: Document = firstDocument;
    Object.defineProperty(iframe, "contentDocument", { configurable: true, get: () => currentDocument });

    const firstTarget = firstDocument.createElement("button");
    firstTarget.textContent = "First frame target";
    firstTarget.getBoundingClientRect = vi.fn(() => createDomRect({ top: 25, left: 30, width: 100, height: 40 }));
    firstDocument.body.append(firstTarget);

    const container = renderAnnotator({ target: iframe });

    act(() => {
      getButton(container, "Annotate").click();
    });

    act(() => {
      firstTarget.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector<HTMLElement>('[data-mikuexe-annotator-box="hover"]')?.style.top).toBe("225px");

    const nextDocument = document.implementation.createHTMLDocument("next frame");
    currentDocument = nextDocument;
    const nextTarget = nextDocument.createElement("button");
    nextTarget.textContent = "Next frame target";
    nextTarget.getBoundingClientRect = vi.fn(() => createDomRect({ top: 70, left: 45, width: 120, height: 50 }));
    nextDocument.body.append(nextTarget);

    act(() => {
      iframe.dispatchEvent(new Event("load"));
    });

    act(() => {
      nextTarget.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true }));
    });

    const hoverBox = container.querySelector<HTMLElement>('[data-mikuexe-annotator-box="hover"]');
    expect(hoverBox?.style.top).toBe("270px");
    expect(hoverBox?.style.left).toBe("345px");
  });
});

function getButton(container: Element, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent === text);

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function createAnnotation({ id, note, text }: { id: string; note: string; text: string }) {
  return {
    id,
    note,
    source: null,
    sourceStack: [],
    componentPath: [],
    element: {
      tagName: "button",
      text,
      html: `<button>${text}</button>`,
      selector: "button",
    },
  };
}

function createDomRect(rect: { top: number; left: number; width: number; height: number }): DOMRect {
  return {
    x: rect.left,
    y: rect.top,
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => rect,
  } as DOMRect;
}
