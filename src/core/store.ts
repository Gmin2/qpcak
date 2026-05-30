import { readIndex, rotate, signsFromSeed } from "./turboquant";
import type { QPackManifest } from "./types";

/**
 * A format-aware vector store. Scoring is asymmetric: the query stays full
 * precision while stored vectors may be quantized. `prepareQuery` runs any
 * one-time query transform (e.g. rotation) before the per-vector loop.
 */
export interface VectorStore {
  count: number;
  dim: number;
  /** optional one-time transform of the query (default: identity) */
  prepareQuery?(query: Float32Array): Float32Array;
  /** similarity of the prepared query against stored vector i */
  score(query: Float32Array, i: number): number;
}

class F32Store implements VectorStore {
  constructor(
    private v: Float32Array,
    public count: number,
    public dim: number,
  ) {}
  score(q: Float32Array, i: number): number {
    let s = 0;
    const off = i * this.dim;
    for (let d = 0; d < this.dim; d++) s += q[d] * this.v[off + d];
    return s;
  }
}

class Int8Store implements VectorStore {
  constructor(
    private q: Int8Array,
    private scales: Float32Array,
    public count: number,
    public dim: number,
  ) {}
  score(query: Float32Array, i: number): number {
    let s = 0;
    const off = i * this.dim;
    for (let d = 0; d < this.dim; d++) s += query[d] * this.q[off + d];
    return (s * this.scales[i]) / 127;
  }
}

class TQStore implements VectorStore {
  private signs: Int8Array;
  private perVecBytes: number;
  constructor(
    private packed: Uint8Array,
    private alpha: Float32Array,
    private codebook: Float32Array,
    private bits: number,
    private p: number,
    public count: number,
    public dim: number,
    seed: number,
  ) {
    this.signs = signsFromSeed(seed, p);
    this.perVecBytes = (p * bits) >> 3;
  }
  /** Rotate the full-precision query once into the padded, rotated space. */
  prepareQuery(query: Float32Array): Float32Array {
    return rotate(query, this.signs, this.p);
  }
  score(rotq: Float32Array, i: number): number {
    const base = i * this.perVecBytes;
    let s = 0;
    for (let d = 0; d < this.p; d++) {
      s += rotq[d] * this.codebook[readIndex(this.packed, base, d, this.bits)];
    }
    return s * this.alpha[i];
  }
}

/** Build the right store for a pack from its loaded file buffers. */
export function makeStore(
  manifest: QPackManifest,
  buffers: Record<string, ArrayBuffer>,
): VectorStore {
  const { count, dim, files } = manifest;
  switch (manifest.vectorFormat) {
    case "f32":
      return new F32Store(new Float32Array(buffers[files.vectors]), count, dim);
    case "int8":
      return new Int8Store(
        new Int8Array(buffers[files.vectors]),
        new Float32Array(buffers[files.scales]),
        count,
        dim,
      );
    case "tq4":
    case "tq2":
    case "tq1": {
      const p = manifest.params as { bits: number; paddedDim: number; seed: number; codebook: number[] };
      return new TQStore(
        new Uint8Array(buffers[files.vectors]),
        new Float32Array(buffers[files.alpha]),
        Float32Array.from(p.codebook),
        p.bits,
        p.paddedDim,
        count,
        dim,
        p.seed,
      );
    }
    default:
      throw new Error(`qpack: store for "${manifest.vectorFormat}" not implemented yet`);
  }
}
