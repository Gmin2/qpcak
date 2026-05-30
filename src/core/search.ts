import type { VectorStore } from "./store";
import type { QPackDoc, QPackHit, SearchOptions } from "./types";

/** Brute-force top-k search using the store's (possibly quantized) scoring. */
export function topK(
  store: VectorStore,
  docs: QPackDoc[],
  queryVec: Float32Array,
  opts: SearchOptions = {},
): QPackHit[] {
  const limit = opts.limit ?? 5;
  const filter = opts.filter ?? null;
  const top: { score: number; i: number }[] = [];
  const prepared = store.prepareQuery ? store.prepareQuery(queryVec) : queryVec;

  for (let i = 0; i < store.count; i++) {
    if (filter && !matchFilter(docs[i], filter)) continue;
    const s = store.score(prepared, i);
    if (top.length < limit) {
      insertSorted(top, s, i);
    } else if (s > top[top.length - 1].score) {
      top.pop();
      insertSorted(top, s, i);
    }
  }

  return top.map((t) => ({ score: t.score, doc: docs[t.i] }));
}

function insertSorted(arr: { score: number; i: number }[], score: number, i: number): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].score > score) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, { score, i });
}

function matchFilter(doc: QPackDoc, filter: Record<string, unknown>): boolean {
  for (const [k, want] of Object.entries(filter)) {
    const have = doc[k];
    if (Array.isArray(want)) {
      if (!want.includes(have)) return false;
    } else if (have !== want) {
      return false;
    }
  }
  return true;
}
