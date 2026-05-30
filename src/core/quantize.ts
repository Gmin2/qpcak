import { lloydMaxGaussian, nearest, paddedDim, rotate, signsFromSeed } from "./turboquant";
import type { VectorFormat } from "./types";

/** TurboQuant bit depth per format. */
const TQ_BITS: Record<string, number> = { tq4: 4, tq2: 2, tq1: 1 };
const TQ_SEED = 0x9e3779b9;

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

/**
 * TurboQuant: rotate, quantize each coordinate against a Gaussian codebook, and
 * store a per-vector length scalar for asymmetric scoring. bits = 4 | 2 | 1.
 */
export function encodeTQ(
  flat: Float32Array,
  count: number,
  dim: number,
  bits: number,
): Encoded {
  const p = paddedDim(dim);
  const signs = signsFromSeed(TQ_SEED, p);
  const cent = lloydMaxGaussian(bits);
  const perVecBytes = (p * bits) >> 3;
  const packed = new Uint8Array(count * perVecBytes);
  const alpha = new Float32Array(count);
  const row = new Float32Array(dim);
  // Rotated unit vectors have per-coord std ~1/sqrt(p); standardize to ~N(0,1)
  // so the Gaussian codebook's full range of levels is actually used.
  const sp = Math.sqrt(p);

  for (let i = 0; i < count; i++) {
    row.set(flat.subarray(i * dim, i * dim + dim));
    const r = rotate(row, signs, p);

    let ptr = i * perVecBytes;
    let cur = 0;
    let bitpos = 0;
    let dotRrq = 0;
    let dotRq = 0;
    for (let d = 0; d < p; d++) {
      const idx = nearest(r[d] * sp, cent);
      cur |= idx << bitpos;
      bitpos += bits;
      if (bitpos === 8) {
        packed[ptr++] = cur;
        cur = 0;
        bitpos = 0;
      }
      const c = cent[idx];
      dotRrq += r[d] * c;
      dotRq += c * c;
    }
    // length renormalization: best scalar so alpha*reconstruction matches r
    alpha[i] = dotRq > 0 ? dotRrq / dotRq : 0;
  }

  const file = `vectors.tq${bits}.bin`;
  const pBytes = asBytes(packed);
  const aBytes = asBytes(alpha);
  return {
    blobs: { [file]: pBytes, "alpha.f32.bin": aBytes },
    files: { vectors: file, alpha: "alpha.f32.bin" },
    params: { bits, paddedDim: p, seed: TQ_SEED, codebook: Array.from(cent) },
    bytes: pBytes.byteLength + aBytes.byteLength,
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
    case "tq4":
    case "tq2":
    case "tq1":
      return encodeTQ(flat, count, dim, TQ_BITS[format]);
    default:
      throw new Error(`qpack: encoder for "${format}" not implemented yet`);
  }
}
