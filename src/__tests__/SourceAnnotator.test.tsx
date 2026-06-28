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
    mockPreferredColorScheme("light");
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

  async function createSavedAnnotation(note: string) {
    const target = createBodyTarget();
    mockCaptureTarget(createTarget({ text: "Target" }));
    const container = renderAnnotator();

    beginAnnotation(container);
    await clickTarget(target);
    await saveCurrentNote(container, note);

    return { container, target };
  }

  it("renders explicit colors for annotator UI in light mode", async () => {
    const target = createBodyTarget();
    mockCaptureTarget(createTarget({ text: "Target" }));
    const container = renderAnnotator({ renderToaster: false });

    beginAnnotation(container);
    await clickTarget(target);

    assertAnnotatorElementsHaveExplicitColor(container);
    expect(getButton(container, "Annotating").style.color).not.toBe("");
    expect(container.querySelector("textarea")?.style.color).not.toBe("");

    await saveCurrentNote(container, "Explicit color");

    const pin = getButton(container, "1");
    act(() => {
      pin.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    assertAnnotatorElementsHaveExplicitColor(container);
  });

  it("uses explicit dark colors when the OS prefers dark mode", () => {
    mockPreferredColorScheme("dark");
    const container = renderAnnotator();
    const button = getButton(container, "Annotate");

    expect(sonnerMocks.toasterRender).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "dark" })
    );
    expect(normalizeCssColor(button.style.color)).toMatch(
      /^(#e2e8f0|rgb\(226,232,240\))$/
    );
    expect(normalizeCssColor(button.style.background)).toMatch(
      /^(#0f172a|rgb\(15,23,42\))$/
    );
  });

  it("renders an owned Sonner Toaster by default", () => {
    renderAnnotator();

    expect(sonnerMocks.toasterRender).toHaveBeenCalledWith(
      expect.objectContaining({
        position: "bottom-right",
        richColors: true,
        theme: "light",
      })
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

    mockCaptureTarget(createTarget({ text: "Target" }));
    const container = renderAnnotator();

    beginAnnotation(container);
    await clickTarget(target);
    await saveCurrentNote(container, "Keep attached");

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

    mockCaptureTarget(createTarget({ text: "Interactive target" }));
    const container = renderAnnotator();

    beginAnnotation(container);

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

  it("focuses the note textbox after selecting a target", async () => {
    const target = createBodyTarget();
    mockCaptureTarget(createTarget({ text: "Target" }));
    const container = renderAnnotator();

    beginAnnotation(container);
    await clickTarget(target);

    const textarea = container.querySelector("textarea");

    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(document.activeElement).toBe(textarea);
  });

  it("shows annotation content and edit/delete actions when hovering a numbered dot", async () => {
    const { container } = await createSavedAnnotation("Original note");

    const pin = getButton(container, "1");
    expect(pin.getAttribute("aria-haspopup")).toBe("dialog");
    expect(pin.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      pin.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    expect(pin.getAttribute("aria-expanded")).toBe("true");
    const popover = container.querySelector(
      'dialog[aria-label="Annotation 1"]'
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
      container.querySelector('dialog[aria-label="Annotation 1"]')
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
      container.querySelector('dialog[aria-label="Annotation 1"]')
    ).toBeNull();
    expect(container.textContent).toContain("Annotations");

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
    const { container } = await createSavedAnnotation("Delete me");

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
    const { first, second } = createTargetPair({
      firstText: "First",
      secondText: "Second",
    });

    captureMocks.captureAnnotationTarget
      .mockResolvedValueOnce(
        createTarget({ text: "First", selector: "button:nth-of-type(1)" })
      )
      .mockResolvedValueOnce(
        createTarget({ text: "Second", selector: "button:nth-of-type(2)" })
      );

    const container = renderAnnotator();

    beginAnnotation(container);
    await clickTarget(first);
    await clickTarget(second, { ctrlKey: true });

    expect(
      container.querySelectorAll('[data-mikuexe-annotator-box="selected"]')
    ).toHaveLength(2);
    expect(container.textContent).toContain("2 elements selected");

    await saveCurrentNote(container, "One comment for both");

    expect(container.querySelectorAll("li")).toHaveLength(1);
    expect(
      container.querySelectorAll('[title="One comment for both"]')
    ).toHaveLength(2);
    expect(container.textContent).toContain("2 linked elements");
  });

  it("links another element from an existing annotation card", async () => {
    const { first, second } = createTargetPair({
      firstText: "Primary",
      secondTagName: "a",
      secondText: "Secondary",
    });

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

    beginAnnotation(container);
    await clickTarget(first);
    await saveCurrentNote(container, "Link this note");

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

    await collectCurrentAnnotations(container);

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
    const target = createBodyTarget();
    mockCaptureTarget(createTarget({ text: "Target" }));
    clipboardMocks.copyTextToClipboard.mockResolvedValue(undefined);
    const onCollect = vi.fn();
    const container = renderAnnotator({ onCollect });

    beginAnnotation(container);
    await clickTarget(target);
    await saveCurrentNote(container, "Copy me");

    window.history.pushState(null, "", "/after-selection");

    await collectCurrentAnnotations(container);

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

  it("cancels annotation mode with Escape and discards unsent annotations", async () => {
    const { container } = await createSavedAnnotation("Discard me");

    expect(container.textContent).toContain("Discard me");

    pressEscape();

    expect(getButton(container, "Annotate").getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(container.textContent).not.toContain("Discard me");

    beginAnnotation(container);

    expect(container.textContent).toContain(
      "Hover an element, click it, then add a note."
    );
    expect(container.textContent).not.toContain("Discard me");
  });

  it("cancels annotation mode with the panel Cancel button", async () => {
    const { container } = await createSavedAnnotation("Panel discard");

    act(() => {
      getButton(container, "Cancel").click();
    });

    expect(getButton(container, "Annotate").getAttribute("aria-pressed")).toBe(
      "false"
    );

    beginAnnotation(container);

    expect(container.textContent).not.toContain("Panel discard");
  });

  it("keeps draft Cancel scoped to the current selection", async () => {
    const target = createBodyTarget();
    mockCaptureTarget(createTarget({ text: "Target" }));
    const container = renderAnnotator();

    beginAnnotation(container);
    await clickTarget(target);

    act(() => {
      getButton(container, "Cancel").click();
    });

    expect(container.querySelector("textarea")).toBeNull();
    expect(
      getButton(container, "Annotating").getAttribute("aria-pressed")
    ).toBe("true");
    expect(container.textContent).toContain(
      "Hover an element, click it, then add a note."
    );
  });

  it("clears copied annotations and does not show stale copied status when reopened", async () => {
    const target = createBodyTarget();
    clipboardMocks.copyTextToClipboard.mockResolvedValue(undefined);
    mockCaptureTarget(createTarget({ text: "Target" }));
    const container = renderAnnotator();

    beginAnnotation(container);
    await clickTarget(target);
    await saveCurrentNote(container, "Copy me");
    await collectCurrentAnnotations(container);

    beginAnnotation(container);

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

    const target = createFrameTarget(frameDocument);
    mockCaptureTarget(createTarget({ text: "Frame target" }));

    const container = renderAnnotator({ target: iframe });

    beginAnnotation(container);

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

    const target = createFrameTarget(frameDocument);
    mockCaptureTarget(createTarget({ text: "Frame target" }));
    clipboardMocks.copyTextToClipboard.mockResolvedValue(undefined);
    const onCollect = vi.fn();

    const container = renderAnnotator({ target: iframe, onCollect });

    beginAnnotation(container);
    await clickTarget(target);
    await saveCurrentNote(container, "Frame note");
    await collectCurrentAnnotations(container);

    expect(onCollect.mock.calls[0]?.[0]?.page).toEqual({
      domain: "frame.example.com",
      path: "/inside",
    });
  });
});

function createTargetPair({
  firstText,
  secondTagName = "button",
  secondText,
}: {
  firstText: string;
  secondTagName?: keyof HTMLElementTagNameMap;
  secondText: string;
}) {
  const first = createBodyTarget({
    text: firstText,
    rect: { top: 40, left: 40, width: 80, height: 30 },
  });
  const second = createBodyTarget({
    tagName: secondTagName,
    text: secondText,
    rect: { top: 90, left: 40, width: 80, height: 30 },
  });

  return { first, second };
}

function createFrameTarget(frameDocument: Document) {
  return createBodyTarget({
    text: "Frame target",
    rect: { top: 25, left: 30, width: 100, height: 40 },
    ownerDocument: frameDocument,
  });
}

function createBodyTarget({
  tagName = "button",
  text = "Target",
  rect = { top: 100, left: 50, width: 80, height: 30 },
  ownerDocument = document,
}: {
  tagName?: keyof HTMLElementTagNameMap;
  text?: string;
  rect?: { top: number; left: number; width: number; height: number };
  ownerDocument?: Document;
} = {}) {
  const target = ownerDocument.createElement(tagName);
  target.textContent = text;
  target.getBoundingClientRect = vi.fn(() => createDomRect(rect));
  ownerDocument.body.append(target);
  return target;
}

function mockCaptureTarget(target: ReturnType<typeof createTarget>) {
  captureMocks.captureAnnotationTarget.mockResolvedValue(target);
}

function beginAnnotation(container: Element) {
  act(() => {
    getButton(container, "Annotate").click();
  });
}

async function saveCurrentNote(container: Element, note: string) {
  act(() => {
    setTextareaValue(
      container.querySelector("textarea") as HTMLTextAreaElement,
      note
    );
  });

  await act(async () => {
    getButton(container, "Save note").click();
    await Promise.resolve();
  });
}

async function collectCurrentAnnotations(container: Element) {
  await act(async () => {
    getButton(container, "Collect").click();
    await Promise.resolve();
  });
}

function pressEscape() {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
  });
}

async function clickTarget(target: Element, init: MouseEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, ...init })
    );
    await Promise.resolve();
  });
}

function assertAnnotatorElementsHaveExplicitColor(container: Element) {
  const root = container.querySelector<HTMLElement>(
    "[data-mikuexe-annotator-root]"
  );

  if (!root) {
    throw new Error("Annotator root not found");
  }

  const missingColor = [root, ...root.querySelectorAll<HTMLElement>("*")]
    .filter((element) => !element.style.color)
    .map(describeElement);

  expect(missingColor).toEqual([]);
}

function describeElement(element: HTMLElement): string {
  const label = element.getAttribute("aria-label") ?? element.textContent;
  return `${element.tagName.toLowerCase()}${label ? `:${label}` : ""}`;
}

function mockPreferredColorScheme(colorScheme: "light" | "dark") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(
      (query: string) =>
        ({
          matches:
            query === "(prefers-color-scheme: dark)" && colorScheme === "dark",
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList
    ),
  });
}

function normalizeCssColor(color: string): string {
  return color.toLowerCase().replace(/\s/g, "");
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
