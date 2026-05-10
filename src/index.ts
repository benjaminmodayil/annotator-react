export { SourceAnnotator } from "./SourceAnnotator";
export { copyTextToClipboard } from "./clipboard";
export { captureAnnotationTarget, captureElementAnnotation, getElementSelector, trimText } from "./capture";
export { createAnnotationCollection, formatAnnotationCollection, formatMarkdown, getPageContext } from "./format";
export type {
  Annotation,
  AnnotationCollection,
  AnnotationElement,
  AnnotationSource,
  AnnotationTarget,
  PageContext,
  SourceAnnotatorOutput,
  SourceAnnotatorProps,
  SourceAnnotatorTarget,
} from "./types";
