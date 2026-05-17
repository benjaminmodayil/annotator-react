import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceAnnotator } from "../SourceAnnotator";

const captureMocks = vi.hoisted(() => ({
  captureAnnotationTarget: vi.fn(),
  captureElementAnnotation: vi.fn(),
  createAnnotationId: vi.fn(() => "ann-generated"),
}));

const clipboardMocks = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(),
}));

const sonnerMocks = vi.hoisted(() => ({
  toasterRender: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../capture", () => ({
  captureAnnotationTarget: captureMocks.captureAnnotationTarget,
  captureElementAnnotation: captureMocks.captureElementAnnotation,
  createAnnotationId: captureMocks.createAnnotationId,
}));

vi.mock("../clipboard", () => ({
  copyTextToClipboard: clipboardMocks.copyTextToClipboard,
}));

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

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("SourceAnnotator", () => {
  let roots: Root[] = [];

  beforeEach(() => {
    act(() => {
      roots.forEach((root) => root.unmount());
    });
    roots = [];
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
    captureMocks.captureAnnotationTarget.mockReset();
    captureMocks.captureElementAnnotation.mockReset();
    captureMocks.createAnnotationId.mockReset();
    captureMocks.createAnnotationId.mockReturnValue("ann-generated");
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

    expect(sonnerMocks.toasterRender).toHaveBeenCalledWith(
      expect.objectContaining({ position: "bottom-right", richColors: true })
    );
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

    captureMocks.captureAnnotationTarget.mockResolvedValue(
      createTarget({ text: "Target" })
    );

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await clickTarget(target);

    act(() => {
      setTextareaValue(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "Keep attached"
      );
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
    target.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 25, left: 30, width: 100, height: 40 })
    );
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("click", onClick);
    document.body.append(target);

    captureMocks.captureAnnotationTarget.mockResolvedValue(
      createTarget({ text: "Interactive target" })
    );

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    act(() => {
      target.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
      );
    });

    await clickTarget(target);

    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(container.querySelector("textarea")).toBeInstanceOf(
      HTMLTextAreaElement
    );
  });

  it("shows annotation content and edit/delete actions when hovering a pin", async () => {
    const target = document.createElement("button");
    target.textContent = "Target";
    target.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 100, left: 50, width: 80, height: 30 })
    );
    document.body.append(target);

    captureMocks.captureAnnotationTarget.mockResolvedValue(
      createTarget({ text: "Target" })
    );

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await clickTarget(target);

    act(() => {
      setTextareaValue(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "Original note"
      );
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    const pin = getButton(container, "1");
    expect(pin.getAttribute("aria-haspopup")).toBe("dialog");
    expect(pin.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      pin.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    expect(pin.getAttribute("aria-expanded")).toBe("true");
    const popover = container.querySelector(
      '[role="dialog"][aria-label="Annotation 1"]'
    );
    expect(popover?.textContent).toContain("Original note");
    expect(getButtonByLabel(container, "Edit annotation 1").textContent).toBe(
      "✎"
    );
    expect(getButtonByLabel(container, "Delete annotation 1").textContent).toBe(
      "🗑"
    );
    expect(getButtonByLabel(container, "Close annotation 1").textContent).toBe(
      "×"
    );

    act(() => {
      getButtonByLabel(container, "Close annotation 1").click();
    });

    expect(
      container.querySelector('[role="dialog"][aria-label="Annotation 1"]')
    ).toBeNull();
    expect(pin.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      pin.focus();
    });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    expect(
      container.querySelector('[role="dialog"][aria-label="Annotation 1"]')
    ).toBeNull();

    act(() => {
      pin.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    act(() => {
      getButtonByLabel(container, "Edit annotation 1").click();
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

  it("deletes annotations from the pin popover and uses icon-only summary delete buttons", async () => {
    const target = document.createElement("button");
    target.textContent = "Target";
    target.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 100, left: 50, width: 80, height: 30 })
    );
    document.body.append(target);

    captureMocks.captureAnnotationTarget.mockResolvedValue(
      createTarget({ text: "Target" })
    );

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await clickTarget(target);

    act(() => {
      setTextareaValue(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "Delete me"
      );
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    const summaryDelete = getButtonByLabel(container, "Delete annotation 1");
    expect(summaryDelete.textContent).toBe("🗑");
    expect(summaryDelete.textContent).not.toContain("Delete annotation");

    act(() => {
      getButton(container, "1").dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true })
      );
    });

    const deleteButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="Delete annotation 1"]'
      )
    );
    expect(deleteButtons).toHaveLength(2);

    act(() => {
      deleteButtons[1]?.click();
    });

    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.textContent).not.toContain("Delete me");
    expect(container.textContent).toContain(
      "Hover an element, click it, then add a note."
    );
  });

  it("supports modifier-click multi-select for one note", async () => {
    const first = document.createElement("button");
    first.textContent = "First";
    first.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 40, left: 40, width: 80, height: 30 })
    );
    const second = document.createElement("button");
    second.textContent = "Second";
    second.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 90, left: 40, width: 80, height: 30 })
    );
    document.body.append(first, second);

    captureMocks.captureAnnotationTarget
      .mockResolvedValueOnce(
        createTarget({ text: "First", selector: "button:nth-of-type(1)" })
      )
      .mockResolvedValueOnce(
        createTarget({ text: "Second", selector: "button:nth-of-type(2)" })
      );

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await clickTarget(first);
    await clickTarget(second, { ctrlKey: true });

    expect(
      container.querySelectorAll('[data-mikuexe-annotator-box="selected"]')
    ).toHaveLength(2);
    expect(container.textContent).toContain("2 elements selected");

    act(() => {
      setTextareaValue(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "One comment for both"
      );
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    expect(container.querySelectorAll("li")).toHaveLength(1);
    expect(
      container.querySelectorAll('[title="One comment for both"]')
    ).toHaveLength(2);
    expect(container.textContent).toContain("2 linked elements");
  });

  it("links another element from an existing annotation card", async () => {
    const first = document.createElement("button");
    first.textContent = "Primary";
    first.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 40, left: 40, width: 80, height: 30 })
    );
    const second = document.createElement("a");
    second.textContent = "Secondary";
    second.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 90, left: 40, width: 80, height: 30 })
    );
    document.body.append(first, second);

    captureMocks.captureAnnotationTarget
      .mockResolvedValueOnce(
        createTarget({ text: "Primary", selector: "button" })
      )
      .mockResolvedValueOnce(
        createTarget({
          tagName: "a",
          text: "Secondary",
          html: "<a>Secondary</a>",
          selector: "a",
        })
      );

    clipboardMocks.copyTextToClipboard.mockResolvedValue(undefined);
    const onCollect = vi.fn();
    const container = renderAnnotator({ onCollect });

    act(() => {
      getButton(container, "Annotate").click();
    });

    await clickTarget(first);

    act(() => {
      setTextareaValue(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "Link this note"
      );
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    act(() => {
      getButton(container, "Link element").click();
    });

    expect(container.textContent).toContain(
      "Click another element to link it to this annotation."
    );

    await clickTarget(second);

    expect(container.querySelectorAll('[title="Link this note"]')).toHaveLength(
      2
    );
    expect(container.textContent).toContain("2 linked elements");

    await act(async () => {
      getButton(container, "Collect").click();
      await Promise.resolve();
    });

    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({
        page: expect.objectContaining({ domain: "localhost", path: "/" }),
        annotations: [
          expect.objectContaining({
            note: "Link this note",
            targets: [expect.any(Object), expect.any(Object)],
          }),
        ],
      })
    );
  });

  it("includes page context in copied markdown and onCollect payload without DOM refs", async () => {
    const target = document.createElement("button");
    target.textContent = "Target";
    target.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 100, left: 50, width: 80, height: 30 })
    );
    document.body.append(target);

    captureMocks.captureAnnotationTarget.mockResolvedValue(
      createTarget({ text: "Target" })
    );
    clipboardMocks.copyTextToClipboard.mockResolvedValue(undefined);
    const onCollect = vi.fn();

    const container = renderAnnotator({ onCollect });

    act(() => {
      getButton(container, "Annotate").click();
    });

    await clickTarget(target);

    act(() => {
      setTextareaValue(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "Copy me"
      );
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    window.history.pushState(null, "", "/after-selection");

    await act(async () => {
      getButton(container, "Collect").click();
      await Promise.resolve();
    });

    expect(clipboardMocks.copyTextToClipboard).toHaveBeenCalledWith(
      expect.stringContaining("Domain: localhost")
    );
    expect(clipboardMocks.copyTextToClipboard).toHaveBeenCalledWith(
      expect.stringContaining("Path: /after-selection")
    );

    const payload = onCollect.mock.calls[0]?.[0];
    expect(payload.page).toEqual({
      domain: "localhost",
      path: "/after-selection",
    });
    expect(JSON.stringify(payload)).not.toContain("targetElement");
    expect(payload.annotations[0]?.targets[0]?.element.selector).toBe("button");
  });

  it("clears copied annotations and does not show stale copied status when reopened", async () => {
    const target = document.createElement("button");
    target.textContent = "Target";
    target.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 100, left: 50, width: 80, height: 30 })
    );
    document.body.append(target);

    clipboardMocks.copyTextToClipboard.mockResolvedValue(undefined);
    captureMocks.captureAnnotationTarget.mockResolvedValue(
      createTarget({ text: "Target" })
    );

    const container = renderAnnotator();

    act(() => {
      getButton(container, "Annotate").click();
    });

    await clickTarget(target);

    act(() => {
      setTextareaValue(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "Copy me"
      );
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

    expect(container.textContent).toContain(
      "Hover an element, click it, then add a note."
    );
    expect(container.textContent).not.toContain("Copy me");
  });

  it("selects elements inside a same-origin iframe target and positions the overlay in the host viewport", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    iframe.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 200, left: 300, width: 640, height: 480 })
    );

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      throw new Error("Expected iframe contentDocument in test environment.");
    }

    const target = frameDocument.createElement("button");
    target.textContent = "Frame target";
    target.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 25, left: 30, width: 100, height: 40 })
    );
    frameDocument.body.append(target);

    captureMocks.captureAnnotationTarget.mockResolvedValue(
      createTarget({ text: "Frame target" })
    );

    const container = renderAnnotator({ target: iframe });

    act(() => {
      getButton(container, "Annotate").click();
    });

    act(() => {
      target.dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true, cancelable: true })
      );
    });

    const hoverBox = container.querySelector<HTMLElement>(
      '[data-mikuexe-annotator-box="hover"]'
    );
    expect(hoverBox?.style.top).toBe("225px");
    expect(hoverBox?.style.left).toBe("330px");

    await clickTarget(target);

    expect(captureMocks.captureAnnotationTarget).toHaveBeenCalledWith(target);
    expect(container.querySelector("textarea")).toBeInstanceOf(
      HTMLTextAreaElement
    );
  });

  it("uses iframe document location for collected page context", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      throw new Error("Expected iframe contentDocument in test environment.");
    }

    const frameLocation = {
      hostname: "frame.example.com",
      pathname: "/inside",
    };
    Object.defineProperty(frameDocument, "location", {
      configurable: true,
      value: frameLocation,
    });

    const target = frameDocument.createElement("button");
    target.textContent = "Frame target";
    target.getBoundingClientRect = vi.fn(() =>
      createDomRect({ top: 25, left: 30, width: 100, height: 40 })
    );
    frameDocument.body.append(target);

    captureMocks.captureAnnotationTarget.mockResolvedValue(
      createTarget({ text: "Frame target" })
    );
    clipboardMocks.copyTextToClipboard.mockResolvedValue(undefined);
    const onCollect = vi.fn();

    const container = renderAnnotator({ target: iframe, onCollect });

    act(() => {
      getButton(container, "Annotate").click();
    });

    await clickTarget(target);

    act(() => {
      setTextareaValue(
        container.querySelector("textarea") as HTMLTextAreaElement,
        "Frame note"
      );
    });

    await act(async () => {
      getButton(container, "Save note").click();
      await Promise.resolve();
    });

    await act(async () => {
      getButton(container, "Collect").click();
      await Promise.resolve();
    });

    expect(onCollect.mock.calls[0]?.[0]?.page).toEqual({
      domain: "frame.example.com",
      path: "/inside",
    });
  });
});

async function clickTarget(target: Element, init: MouseEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, ...init })
    );
    await Promise.resolve();
  });
}

function getButton(container: Element, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

function getButtonByLabel(
  container: Element,
  label: string
): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found by label: ${label}`);
  }

  return button;
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function createTarget({
  tagName = "button",
  text,
  html = `<${tagName}>${text}</${tagName}>`,
  selector = tagName,
}: {
  tagName?: string;
  text: string;
  html?: string;
  selector?: string;
}) {
  return {
    source: null,
    sourceStack: [],
    componentPath: [],
    element: {
      tagName,
      text,
      html,
      selector,
    },
  };
}

function createDomRect(rect: {
  top: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
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
