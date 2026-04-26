import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureElementAnnotation, getElementSelector, trimText } from "../capture";

const resolveElementInfo = vi.fn();

vi.mock("element-source", () => ({
  resolveElementInfo: (...args: unknown[]) => resolveElementInfo(...args),
}));

beforeEach(() => {
  document.body.innerHTML = "";
  resolveElementInfo.mockReset();
});

describe("captureElementAnnotation", () => {
  it("combines element-source data with element context", async () => {
    resolveElementInfo.mockResolvedValue({
      source: {
        filePath: "src/App.tsx",
        lineNumber: 12,
        columnNumber: 5,
        componentName: "Card",
      },
      componentName: "Card",
      stack: [
        {
          filePath: "src/App.tsx",
          lineNumber: 12,
          columnNumber: 5,
          componentName: "Card",
        },
        {
          filePath: "src/App.tsx",
          lineNumber: 4,
          columnNumber: 1,
          componentName: "App",
        },
      ],
    });

    document.body.innerHTML = '<main id="root"><section><button> Save changes </button></section></main>';
    const button = document.querySelector("button")!;

    const annotation = await captureElementAnnotation(button, "Button copy should be shorter", "ann-1");

    expect(annotation).toEqual({
      id: "ann-1",
      note: "Button copy should be shorter",
      source: {
        filePath: "src/App.tsx",
        lineNumber: 12,
        columnNumber: 5,
        componentName: "Card",
      },
      sourceStack: [
        {
          filePath: "src/App.tsx",
          lineNumber: 12,
          columnNumber: 5,
          componentName: "Card",
        },
        {
          filePath: "src/App.tsx",
          lineNumber: 4,
          columnNumber: 1,
          componentName: "App",
        },
      ],
      componentPath: ["Card", "App"],
      element: {
        tagName: "button",
        text: "Save changes",
        html: "<button> Save changes </button>",
        selector: "#root section button",
      },
    });
  });

  it("keeps null-source behavior graceful", async () => {
    resolveElementInfo.mockRejectedValue(new Error("hook missing"));
    document.body.innerHTML = "<button>Broken source</button>";

    const annotation = await captureElementAnnotation(document.querySelector("button")!, "Needs source fallback", "ann-2");

    expect(annotation.source).toBeNull();
    expect(annotation.element.text).toBe("Broken source");
    expect(annotation.sourceStack).toEqual([]);
    expect(annotation.componentPath).toEqual([]);
  });
});

describe("selector and trimming helpers", () => {
  it("builds CSS-ish selectors with ids and nth-of-type when useful", () => {
    document.body.innerHTML = '<div id="root"><section><button>A</button><button>B</button></section></div>';

    expect(getElementSelector(document.querySelectorAll("button")[1]!)).toBe("#root section button:nth-of-type(2)");
  });

  it("collapses whitespace and truncates long text", () => {
    expect(trimText("  A\n\nlong   sentence  ", 100)).toBe("A long sentence");
    expect(trimText("abcdef", 4)).toBe("abc…");
  });
});
