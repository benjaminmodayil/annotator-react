import { resolveElementInfo } from "element-source";
import type { Annotation, AnnotationSource, AnnotationTarget } from "./types";

const MAX_TEXT_LENGTH = 240;
const MAX_HTML_LENGTH = 640;
const MAX_SELECTOR_DEPTH = 6;

export async function captureElementAnnotation(
  element: Element,
  note: string,
  id = createAnnotationId(),
): Promise<Annotation> {
  return {
    id,
    note,
    targets: [await captureAnnotationTarget(element)],
  };
}

export async function captureAnnotationTarget(element: Element): Promise<AnnotationTarget> {
  const elementInfo = await safeResolveElementInfo(element);
  const source = normalizeSource(elementInfo?.source, elementInfo?.componentName);
  const sourceStack = normalizeSourceStack(elementInfo?.stack, source);
  const componentPath = getComponentPath(sourceStack, source);

  return {
    source,
    sourceStack,
    componentPath,
    element: {
      tagName: element.tagName.toLowerCase(),
      text: trimText(element.textContent ?? "", MAX_TEXT_LENGTH),
      html: trimText(getOuterHtml(element), MAX_HTML_LENGTH),
      selector: getElementSelector(element),
    },
  };
}

export function createAnnotationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `annotation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getElementSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < MAX_SELECTOR_DEPTH) {
    parts.unshift(getSelectorPart(current));

    if (current.id) {
      break;
    }

    current = current.parentElement;
    if (current?.tagName.toLowerCase() === "html") {
      break;
    }
  }

  return parts.join(" ");
}

export function trimText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

async function safeResolveElementInfo(element: Element) {
  try {
    return await resolveElementInfo(element);
  } catch {
    return null;
  }
}

function normalizeSource(
  source: AnnotationSource | null | undefined,
  componentName: string | null | undefined,
): AnnotationSource | null {
  if (!source) {
    return componentName
      ? { filePath: "", lineNumber: null, columnNumber: null, componentName }
      : null;
  }

  return {
    filePath: source.filePath,
    lineNumber: source.lineNumber ?? null,
    columnNumber: source.columnNumber ?? null,
    componentName: source.componentName ?? componentName ?? null,
  };
}

function normalizeSourceStack(
  stack: AnnotationSource[] | null | undefined,
  source: AnnotationSource | null,
): AnnotationSource[] {
  const normalizedStack = (stack ?? []).map((frame) => ({
    filePath: frame.filePath,
    lineNumber: frame.lineNumber ?? null,
    columnNumber: frame.columnNumber ?? null,
    componentName: frame.componentName ?? null,
  }));

  if (source && !normalizedStack.some((frame) => isSameSourceFrame(frame, source))) {
    normalizedStack.unshift(source);
  }

  return normalizedStack;
}

function getComponentPath(stack: AnnotationSource[], source: AnnotationSource | null): string[] {
  const names = stack.map((frame) => frame.componentName).filter((name): name is string => Boolean(name));
  return Array.from(new Set(names.length ? names : source?.componentName ? [source.componentName] : []));
}

function isSameSourceFrame(a: AnnotationSource, b: AnnotationSource): boolean {
  return a.filePath === b.filePath && a.lineNumber === b.lineNumber && a.columnNumber === b.columnNumber;
}

function getOuterHtml(element: Element): string {
  if ("outerHTML" in element && typeof element.outerHTML === "string") {
    return element.outerHTML;
  }

  return `<${element.tagName.toLowerCase()}>`;
}

function getSelectorPart(element: Element): string {
  const tagName = element.tagName.toLowerCase();

  if (element.id) {
    return `#${escapeIdentifier(element.id)}`;
  }

  const testId = element.getAttribute("data-testid");
  if (testId) {
    return `${tagName}[data-testid="${escapeAttribute(testId)}"]`;
  }

  const classes = Array.from(element.classList)
    .filter(Boolean)
    .slice(0, 2)
    .map((className) => `.${escapeIdentifier(className)}`)
    .join("");

  const siblingIndex = getNthOfType(element);
  const needsNth = siblingIndex > 1 || hasFollowingSiblingOfSameType(element);

  return `${tagName}${classes}${needsNth ? `:nth-of-type(${siblingIndex})` : ""}`;
}

function getNthOfType(element: Element): number {
  let index = 1;
  let sibling = element.previousElementSibling;

  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }
    sibling = sibling.previousElementSibling;
  }

  return index;
}

function hasFollowingSiblingOfSameType(element: Element): boolean {
  let sibling = element.nextElementSibling;

  while (sibling) {
    if (sibling.tagName === element.tagName) {
      return true;
    }
    sibling = sibling.nextElementSibling;
  }

  return false;
}

function escapeIdentifier(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, "\\\"");
}
