/** Vector encoding inside a pack. f32 first; int8/turboquant added in Step 6. */
export type VectorFormat = "f32" | "int8" | "tq4" | "tq2";

/** Pack metadata (manifest.json) describing how to read the pack. */
export interface QPackManifest {
  name: string;
  version: string;
  /** embedding model id; the browser must use the same one */
  model: string;
  dim: number;
  count: number;
  metric: "cosine";
  vectorFormat: VectorFormat;
  /** logical name -> filename within the pack */
  files: Record<string, string>;
  /** format-specific parameters (e.g. codebook, rotation seed) */
  params?: Record<string, unknown>;
}

/** A stored document chunk and its payload. */
export interface QPackDoc {
  id: string;
  text: string;
  title?: string;
  url?: string;
  source?: string;
  /** arbitrary extra payload fields */
  [key: string]: unknown;
}

/** A single search result: a document and its similarity score. */
export interface QPackHit {
  score: number;
  doc: QPackDoc;
}

export interface SearchOptions {
  limit?: number;
  /** shallow equality filter on payload fields */
  filter?: Record<string, unknown> | null;
}

/** Chat-style result: a composed answer plus the chunks it cited. */
export interface AskResult {
  answer: string;
  sources: QPackHit[];
}

/** Build-time options: how to turn content into a pack. */
export interface BuildOptions {
  /** file, folder, URL, or sitemap to ingest */
  source: string | string[];
  /** output directory for the pack */
  out: string;
  /** pack name (defaults to the out dir name) */
  name?: string;
  /** embedding model id (default all-MiniLM-L6-v2) */
  model?: string;
  /** vector encoding (default "f32") */
  compress?: VectorFormat;
  /** Qdrant origin URL; omitted = embedded/in-memory */
  qdrantUrl?: string;
  /** Qdrant collection name */
  collection?: string;
}

/** Summary returned after a build. */
export interface BuildResult {
  name: string;
  out: string;
  count: number;
  dim: number;
  bytes: number;
  vectorFormat: VectorFormat;
}

/** Options for the drop-in chat widget. */
export interface WidgetOptions {
  /** pack URL (the directory containing manifest.json) */
  pack: string;
  /** element or selector to mount into */
  el: string | HTMLElement;
  title?: string;
  placeholder?: string;
}
