import { composeAnswer } from "./core/answer";
import { embedOne } from "./core/embed";
import { loadPack } from "./core/loadPack";
import { topK } from "./core/search";
import type { VectorStore } from "./core/store";
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
  private readonly store: VectorStore;
  private readonly docs: QPackDoc[];

  private constructor(manifest: QPackManifest, store: VectorStore, docs: QPackDoc[]) {
    this.manifest = manifest;
    this.store = store;
    this.docs = docs;
  }

  /** Load a pack (the directory containing manifest.json) for local search. */
  static async load(packUrl: string): Promise<QPack> {
    const { manifest, store, docs } = await loadPack(packUrl);
    return new QPack(manifest, store, docs);
  }

  /** Semantic search over the loaded pack; embeds the query locally. */
  async search(query: string, opts?: SearchOptions): Promise<QPackHit[]> {
    const queryVec = await embedOne(query, this.manifest.model);
    return topK(this.store, this.docs, queryVec, opts);
  }

  /** Chat-style: retrieve, then compose a cited answer. */
  async ask(query: string, opts?: SearchOptions): Promise<AskResult> {
    const hits = await this.search(query, { limit: opts?.limit ?? 4, filter: opts?.filter });
    return composeAnswer(query, hits);
  }
}

export default QPack;
