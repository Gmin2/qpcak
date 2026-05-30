import type {
  AskResult,
  QPackHit,
  QPackManifest,
  SearchOptions,
} from "./core/types";

export type * from "./core/types";

/** A loaded semantic pack that runs search locally in the browser. */
export class QPack {
  readonly manifest: QPackManifest;

  private constructor(manifest: QPackManifest) {
    this.manifest = manifest;
  }

  /** Load a pack (the directory containing manifest.json) for local search. */
  static async load(_packUrl: string): Promise<QPack> {
    throw new Error("qpack: QPack.load not implemented yet");
  }

  /** Semantic search over the loaded pack; returns ranked document chunks. */
  async search(_query: string, _opts?: SearchOptions): Promise<QPackHit[]> {
    throw new Error("qpack: search not implemented yet");
  }

  /** Chat-style: retrieve, then compose a cited answer. */
  async ask(_query: string, _opts?: SearchOptions): Promise<AskResult> {
    throw new Error("qpack: ask not implemented yet");
  }
}

export default QPack;
