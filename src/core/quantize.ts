import type { VectorFormat } from "./types";

/** Encoded vectors: named binary blobs plus manifest params and a files map. */
export interface Encoded {
  /** filename -> bytes */
  blobs: Record<string, Uint8Array>;
  /** logical name -> filename (merged into manifest.files) */
  files: Record<string, string>;
  /** format-specific parameters (merged into manifest.params) */
  params?: Record<string, unknown>;
  /** total bytes of vector blobs (excludes payloads) */
  bytes: number;
}

/** Flatten one vector per row into a single contiguous Float32Array. */
export function flatten(vectors: Float32Array[], dim: number): Float32Array {
  const flat = new Float32Array(vectors.length * dim);
  for (let i = 0; i < vectors.length; i++) flat.set(vectors[i], i * dim);
  return flat;
}

function asBytes(arr: Int8Array | Float32Array | Uint8Array): Uint8Array {
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}

/** f32: raw little-endian float32, no compression (baseline / ground truth). */
export function encodeF32(flat: Float32Array): Encoded {
  const bytes = asBytes(flat);
  return {
    blobs: { "vectors.bin": bytes },
    files: { vectors: "vectors.bin" },
    bytes: bytes.byteLength,
  };
}

/** int8: per-vector symmetric scalar quantization (~4x smaller than f32). */
export function encodeInt8(flat: Float32Array, count: number, dim: number): Encoded {
  const q = new Int8Array(count * dim);
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const off = i * dim;
    let max = 1e-9;
    for (let d = 0; d < dim; d++) max = Math.max(max, Math.abs(flat[off + d]));
    scales[i] = max;
    const inv = 127 / max;
    for (let d = 0; d < dim; d++) {
      q[off + d] = Math.max(-127, Math.min(127, Math.round(flat[off + d] * inv)));
    }
  }
  const qBytes = asBytes(q);
  const sBytes = asBytes(scales);
  return {
    blobs: { "vectors.int8.bin": qBytes, "scales.f32.bin": sBytes },
    files: { vectors: "vectors.int8.bin", scales: "scales.f32.bin" },
    bytes: qBytes.byteLength + sBytes.byteLength,
  };
}

/** Dispatch encoding by format. */
export function encode(
  format: VectorFormat,
  flat: Float32Array,
  count: number,
  dim: number,
): Encoded {
  switch (format) {
    case "f32":
      return encodeF32(flat);
    case "int8":
      return encodeInt8(flat, count, dim);
    default:
      throw new Error(`qpack: encoder for "${format}" not implemented yet`);
  }
}
