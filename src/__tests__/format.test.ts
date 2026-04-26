import { describe, expect, it } from "vitest";
import { formatAnnotationCollection } from "../format";
import type { AnnotationCollection } from "../types";

const collection: AnnotationCollection = {
  createdAt: "2026-04-25T00:00:00.000Z",
  annotations: [
    {
      id: "ann-1",
      note: "Make this CTA more prominent.",
      source: {
        filePath: "src/App.tsx",
        lineNumber: 42,
        columnNumber: 7,
        componentName: "Hero",
      },
      sourceStack: [
        {
          filePath: "src/App.tsx",
          lineNumber: 42,
          columnNumber: 7,
          componentName: "Hero",
        },
      ],
      componentPath: ["Hero", "App"],
      element: {
        tagName: "button",
        text: "Start now",
        html: "<button>Start now</button>",
        selector: "#root main section button",
      },
    },
  ],
};

describe("formatAnnotationCollection", () => {
  it("defaults to markdown without JSON payload", () => {
    const output = formatAnnotationCollection(collection);

    expect(output).toContain("Please update the UI based on these source-linked annotations.");
    expect(output).toContain("Collected at: 2026-04-25T00:00:00.000Z");
    expect(output).toContain("## Annotation 1");
    expect(output).toContain("ID: ann-1");
    expect(output).toContain("Note: Make this CTA more prominent.");
    expect(output).toContain("Source: src/App.tsx:42:7");
    expect(output).toContain("Nearest React component: Hero");
    expect(output).toContain("React owner path: Hero › App");
    expect(output).toContain("React source stack:");
    expect(output).toContain("- src/App.tsx:42:7 (Hero)");
    expect(output).toContain("Element tag: button");
    expect(output).toContain("Element HTML: <button>Start now</button>");
    expect(output).toContain("Element text: Start now");
    expect(output).toContain("Selector: #root main section button");
    expect(output).not.toContain("## JSON Payload");
  });

  it("omits the owner path when it matches the nearest component", () => {
    const output = formatAnnotationCollection(
      {
        ...collection,
        annotations: [
          {
            ...collection.annotations[0],
            componentPath: ["Hero"],
          },
        ],
      },
      "markdown",
    );

    expect(output).toContain("Nearest React component: Hero");
    expect(output).not.toContain("React owner path: Hero");
  });

  it("omits unavailable markdown fields", () => {
    const output = formatAnnotationCollection(
      {
        createdAt: "2026-04-25T00:00:00.000Z",
        annotations: [
          {
            id: "ann-2",
            note: "No source here.",
            source: null,
            sourceStack: [],
            componentPath: [],
            element: {
              tagName: "div",
              text: "",
              html: "<div></div>",
              selector: "div",
            },
          },
        ],
      },
      "markdown",
    );

    expect(output).not.toContain("Source:");
    expect(output).not.toContain("Nearest React component:");
    expect(output).not.toContain("React owner path:");
    expect(output).not.toContain("React source stack:");
    expect(output).not.toContain("Element text:");
    expect(output).toContain("Element HTML: <div></div>");
  });

  it("can include JSON when explicitly requested", () => {
    const output = formatAnnotationCollection(collection, "both");

    expect(output).toContain("## JSON Payload");
    expect(output).toContain('"annotations"');
  });

  it("can output JSON only", () => {
    expect(JSON.parse(formatAnnotationCollection(collection, "json"))).toEqual(collection);
  });
});
