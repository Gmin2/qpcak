import type { QPackManifest } from "./types";

/**
 * A format-aware vector store. Scoring is asymmetric: the query stays full
 * precision while stored vectors may be quantized.
 */
export interface VectorStore {
  count: number;
  dim: number;
  /** similarity of the full-precision query against stored vector i */
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
    default:
      throw new Error(`qpack: store for "${manifest.vectorFormat}" not implemented yet`);
  }
}
