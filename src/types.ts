export type AnnotationSource = {
  filePath: string;
  lineNumber: number | null;
  columnNumber: number | null;
  componentName: string | null;
};

export type AnnotationElement = {
  tagName: string;
  text: string;
  html: string;
  selector: string;
};

export type Annotation = {
  id: string;
  note: string;
  source: AnnotationSource | null;
  sourceStack: AnnotationSource[];
  componentPath: string[];
  element: AnnotationElement;
};

export type AnnotationCollection = {
  annotations: Annotation[];
  createdAt: string;
};

export type SourceAnnotatorOutput = "markdown" | "json" | "both";

export type SourceAnnotatorTarget = Document | HTMLIFrameElement | null;

export type SourceAnnotatorProps = {
  enabled?: boolean;
  hotkey?: string;
  output?: SourceAnnotatorOutput;
  target?: SourceAnnotatorTarget;
  onCollect?: (payload: AnnotationCollection) => void;
  renderToaster?: boolean;
};
