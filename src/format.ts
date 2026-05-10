import type { Annotation, AnnotationCollection, AnnotationTarget, PageContext, SourceAnnotatorOutput } from "./types";

const TASK_FRAMING = "Please update the UI based on these source-linked annotations.";

export function createAnnotationCollection(annotations: Annotation[], page = getPageContext()): AnnotationCollection {
  return {
    annotations,
    createdAt: new Date().toISOString(),
    page,
  };
}

export function getPageContext(targetDocument?: Document | null): PageContext {
  const activeDocument = targetDocument ?? (typeof document === "undefined" ? null : document);
  const location = activeDocument?.location;

  return {
    domain: location?.hostname ?? "",
    path: location?.pathname ?? "",
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
  const lines = [
    TASK_FRAMING,
    "",
    `Collected at: ${collection.createdAt}`,
    `Domain: ${collection.page.domain}`,
    `Path: ${collection.page.path}`,
    "",
  ];

  if (collection.annotations.length === 0) {
    lines.push("No annotations were collected.");
    return lines.join("\n");
  }

  collection.annotations.forEach((annotation, index) => {
    lines.push(`## Annotation ${index + 1}`);
    lines.push("");
    lines.push(`ID: ${annotation.id}`);
    lines.push(`Note: ${annotation.note || "(no note provided)"}`);

    annotation.targets.forEach((target, targetIndex) => {
      const isSingleTarget = annotation.targets.length === 1;
      const label = isSingleTarget ? "" : `Target ${targetIndex + 1} `;
      appendTargetMarkdown(lines, target, label);
    });

    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

function formatJson(collection: AnnotationCollection): string {
  return JSON.stringify(collection, null, 2);
}

function appendTargetMarkdown(lines: string[], target: AnnotationTarget, label: string) {
  const source = formatSource(target);
  const sourceStack = formatSourceStack(target);
  const nearestComponent = target.source?.componentName;
  const ownerPath = target.componentPath.join(" › ");

  if (source) {
    lines.push(`${label}Source: ${source}`);
  }

  if (nearestComponent) {
    lines.push(`${label}Nearest React component: ${nearestComponent}`);
  }

  if (ownerPath && ownerPath !== nearestComponent) {
    lines.push(`${label}React owner path: ${ownerPath}`);
  }

  if (sourceStack.length) {
    lines.push(`${label}React source stack:`);
    sourceStack.forEach((frame) => lines.push(`- ${frame}`));
  }

  lines.push(`${label}Element tag: ${target.element.tagName}`);

  if (target.element.html) {
    lines.push(`${label}Element HTML: ${target.element.html}`);
  }

  if (target.element.text) {
    lines.push(`${label}Element text: ${target.element.text}`);
  }

  if (target.element.selector) {
    lines.push(`${label}Selector: ${target.element.selector}`);
  }
}

function formatSource(target: AnnotationTarget): string {
  const source = target.source;

  if (!source?.filePath) {
    return "";
  }

  const line = source.lineNumber ? `:${source.lineNumber}` : "";
  const column = source.columnNumber ? `:${source.columnNumber}` : "";

  return `${source.filePath}${line}${column}`;
}

function formatSourceStack(target: AnnotationTarget): string[] {
  return target.sourceStack
    .map((frame) => {
      const location = formatSourceFrame(frame);
      const component = frame.componentName ? ` (${frame.componentName})` : "";

      return location ? `${location}${component}` : frame.componentName || "";
    })
    .filter(Boolean);
}

function formatSourceFrame(frame: AnnotationTarget["sourceStack"][number]): string {
  if (!frame.filePath) {
    return "";
  }

  const line = frame.lineNumber ? `:${frame.lineNumber}` : "";
  const column = frame.columnNumber ? `:${frame.columnNumber}` : "";

  return `${frame.filePath}${line}${column}`;
}
