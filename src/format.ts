import type { Annotation, AnnotationCollection, SourceAnnotatorOutput } from "./types";

const TASK_FRAMING = "Please update the UI based on these source-linked annotations.";

export function createAnnotationCollection(annotations: Annotation[]): AnnotationCollection {
  return {
    annotations,
    createdAt: new Date().toISOString(),
  };
}

export function formatAnnotationCollection(
  collection: AnnotationCollection,
  output: SourceAnnotatorOutput = "markdown",
): string {
  if (output === "json") {
    return formatJson(collection);
  }

  const markdown = formatMarkdown(collection);

  if (output === "markdown") {
    return markdown;
  }

  return `${markdown}\n\n## JSON Payload\n\n\`\`\`json\n${formatJson(collection)}\n\`\`\``;
}

export function formatMarkdown(collection: AnnotationCollection): string {
  const lines = [TASK_FRAMING, "", `Collected at: ${collection.createdAt}`, ""];

  if (collection.annotations.length === 0) {
    lines.push("No annotations were collected.");
    return lines.join("\n");
  }

  collection.annotations.forEach((annotation, index) => {
    const source = formatSource(annotation);
    const sourceStack = formatSourceStack(annotation);
    const nearestComponent = annotation.source?.componentName;
    const ownerPath = annotation.componentPath.join(" › ");

    lines.push(`## Annotation ${index + 1}`);
    lines.push("");
    lines.push(`ID: ${annotation.id}`);
    lines.push(`Note: ${annotation.note || "(no note provided)"}`);

    if (source) {
      lines.push(`Source: ${source}`);
    }

    if (nearestComponent) {
      lines.push(`Nearest React component: ${nearestComponent}`);
    }

    if (ownerPath && ownerPath !== nearestComponent) {
      lines.push(`React owner path: ${ownerPath}`);
    }

    if (sourceStack.length) {
      lines.push("React source stack:");
      sourceStack.forEach((frame) => lines.push(`- ${frame}`));
    }

    lines.push(`Element tag: ${annotation.element.tagName}`);

    if (annotation.element.html) {
      lines.push(`Element HTML: ${annotation.element.html}`);
    }

    if (annotation.element.text) {
      lines.push(`Element text: ${annotation.element.text}`);
    }

    if (annotation.element.selector) {
      lines.push(`Selector: ${annotation.element.selector}`);
    }

    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

function formatJson(collection: AnnotationCollection): string {
  return JSON.stringify(collection, null, 2);
}

function formatSource(annotation: Annotation): string {
  const source = annotation.source;

  if (!source?.filePath) {
    return "";
  }

  const line = source.lineNumber ? `:${source.lineNumber}` : "";
  const column = source.columnNumber ? `:${source.columnNumber}` : "";

  return `${source.filePath}${line}${column}`;
}

function formatSourceStack(annotation: Annotation): string[] {
  return annotation.sourceStack
    .map((frame) => {
      const location = formatSourceFrame(frame);
      const component = frame.componentName ? ` (${frame.componentName})` : "";

      return location ? `${location}${component}` : frame.componentName || "";
    })
    .filter(Boolean);
}

function formatSourceFrame(frame: Annotation["sourceStack"][number]): string {
  if (!frame.filePath) {
    return "";
  }

  const line = frame.lineNumber ? `:${frame.lineNumber}` : "";
  const column = frame.columnNumber ? `:${frame.columnNumber}` : "";

  return `${frame.filePath}${line}${column}`;
}
