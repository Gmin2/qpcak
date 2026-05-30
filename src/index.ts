import { embedOne } from "./core/embed";
import { loadPack } from "./core/loadPack";
import { cosineTopK } from "./core/search";
import type {
  AskResult,
  QPackDoc,
  QPackHit,
  QPackManifest,
  SearchOptions,
} from "./core/types";

export type * from "./core/types";

/** A loaded semantic pack that runs search locally in the browser. */
export class QPack {
  readonly manifest: QPackManifest;
  private readonly vectors: Float32Array;
  private readonly docs: QPackDoc[];

  private constructor(manifest: QPackManifest, vectors: Float32Array, docs: QPackDoc[]) {
    this.manifest = manifest;
    this.vectors = vectors;
    this.docs = docs;
  }

  /** Load a pack (the directory containing manifest.json) for local search. */
  static async load(packUrl: string): Promise<QPack> {
    const { manifest, vectors, docs } = await loadPack(packUrl);
    return new QPack(manifest, vectors, docs);
  }

  /** Semantic search over the loaded pack; embeds the query locally. */
  async search(query: string, opts?: SearchOptions): Promise<QPackHit[]> {
    const queryVec = await embedOne(query, this.manifest.model);
    return cosineTopK(this.vectors, this.manifest.dim, this.docs, queryVec, opts);
  }

  /** Chat-style: retrieve, then compose a cited answer. */
  async ask(_query: string, _opts?: SearchOptions): Promise<AskResult> {
    throw new Error("qpack: ask not implemented yet");
  }
}

export default QPack;
