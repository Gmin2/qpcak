/**
 * TurboQuant core math, shared by the Node encoder and the browser store.
 *
 * Recipe (Zandieh et al. 2026, as shipped in Qdrant 1.18):
 *   1. rotate every vector by a random orthonormal transform (sign flips + a
 *      fast Walsh-Hadamard transform) so per-coordinate variance is spread out
 *      and each coordinate looks ~N(0,1). The rotation is orthonormal, so it
 *      preserves dot products and only needs a seed, not a stored matrix.
 *   2. quantize each rotated coordinate to the nearest level of a fixed
 *      Lloyd-Max codebook for the standard normal (2^bits levels).
 *   3. score asymmetrically: rotate the full-precision query once, then dot it
 *      against the reconstructed centroids, times a per-vector length scalar.
 */

/** Smallest power of two >= dim (FWHT needs a power-of-two length). */
export function paddedDim(dim: number): number {
  let p = 1;
  while (p < dim) p <<= 1;
  return p;
}

/** Deterministic ±1 sign vector of length p derived from a seed (LCG). */
export function signsFromSeed(seed: number, p: number): Int8Array {
  let s = seed >>> 0;
  const out = new Int8Array(p);
  for (let i = 0; i < p; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s & 1 ? 1 : -1;
  }
  return out;
}

/** In-place fast Walsh-Hadamard transform (length must be a power of two). */
export function fwht(a: Float32Array): void {
  const n = a.length;
  for (let len = 1; len < n; len <<= 1) {
    for (let i = 0; i < n; i += len << 1) {
      for (let j = i; j < i + len; j++) {
        const x = a[j];
        const y = a[j + len];
        a[j] = x + y;
        a[j + len] = x - y;
      }
    }
  }
}

/** Apply the orthonormal rotation: pad to p, sign-flip, FWHT, scale by 1/sqrt(p). */
export function rotate(vec: Float32Array, signs: Int8Array, p: number): Float32Array {
  const a = new Float32Array(p);
  for (let d = 0; d < vec.length; d++) a[d] = vec[d] * signs[d];
  fwht(a);
  const inv = 1 / Math.sqrt(p);
  for (let i = 0; i < p; i++) a[i] *= inv;
  return a;
}

/** Read a `bits`-wide index for coordinate `coord` from packed bytes. */
export function readIndex(packed: Uint8Array, base: number, coord: number, bits: number): number {
  const bit = coord * bits;
  return (packed[base + (bit >> 3)] >> (bit & 7)) & ((1 << bits) - 1);
}

/** Seeded standard-normal samples (LCG + Box-Muller), for codebook fitting. */
function gaussianSamples(n: number, seed: number): Float32Array {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return out;
}

/** Fit a Lloyd-Max codebook (2^bits centroids) for N(0,1). Deterministic. */
export function lloydMaxGaussian(bits: number): Float32Array {
  const levels = 1 << bits;
  const data = gaussianSamples(20000, 12345);
  const sorted = Float32Array.from(data).sort();
  const cent = new Float32Array(levels);
  for (let k = 0; k < levels; k++) {
    cent[k] = sorted[Math.floor(((k + 0.5) / levels) * sorted.length)];
  }
  for (let iter = 0; iter < 30; iter++) {
    const sum = new Float64Array(levels);
    const cnt = new Float64Array(levels);
    for (const x of data) {
      let bi = 0;
      let bd = Infinity;
      for (let k = 0; k < levels; k++) {
        const dd = (x - cent[k]) * (x - cent[k]);
        if (dd < bd) {
          bd = dd;
          bi = k;
        }
      }
      sum[bi] += x;
      cnt[bi] += 1;
    }
    for (let k = 0; k < levels; k++) if (cnt[k] > 0) cent[k] = sum[k] / cnt[k];
  }
  return cent;
}

/** Nearest codebook index for a value (linear scan; codebooks are tiny). */
export function nearest(value: number, cent: Float32Array): number {
  let bi = 0;
  let bd = Infinity;
  for (let k = 0; k < cent.length; k++) {
    const dd = (value - cent[k]) * (value - cent[k]);
    if (dd < bd) {
      bd = dd;
      bi = k;
    }
  }
  return bi;
}
