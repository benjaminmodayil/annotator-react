import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceAnnotator } from "../SourceAnnotator";

const captureMocks = vi.hoisted(() => ({
  captureElementAnnotation: vi.fn(),
}));

const sonnerMocks = vi.hoisted(() => ({
  toasterRender: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../capture", () => ({ captureElementAnnotation: captureMocks.captureElementAnnotation }));

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

describe("SourceAnnotator toaster ownership", () => {
  let roots: Root[] = [];

  beforeEach(() => {
    act(() => {
      roots.forEach((root) => root.unmount());
    });
    roots = [];
    document.body.innerHTML = "";
    captureMocks.captureElementAnnotation.mockReset();
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
