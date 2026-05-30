import type { QPackDoc, QPackHit, SearchOptions } from "./types";

/** Brute-force top-k cosine search (vectors are pre-normalized, so cosine == dot). */
export function cosineTopK(
  vectors: Float32Array,
  dim: number,
  docs: QPackDoc[],
  queryVec: Float32Array,
  opts: SearchOptions = {},
): QPackHit[] {
  const limit = opts.limit ?? 5;
  const filter = opts.filter ?? null;
  const top: { score: number; i: number }[] = [];

  for (let i = 0; i < docs.length; i++) {
    if (filter && !matchFilter(docs[i], filter)) continue;
    let s = 0;
    const off = i * dim;
    for (let d = 0; d < dim; d++) s += vectors[off + d] * queryVec[d];
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
